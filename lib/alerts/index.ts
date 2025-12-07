/**
 * Alert System - Main Entry Point
 * Orchestrates checking all alerts and sending notifications
 */

import { createClient } from '@supabase/supabase-js';
import { checkIssueSurge } from './surge-detector';
import { checkSentimentShift } from './sentiment-detector';
import { checkRepMention } from './mention-detector';
import { sendAlertEmail, isEmailConfigured } from '../email/resend';
import type { AlertConfig, AlertCheckResult, AlertHistoryEntry, CheckAlertsResponse } from '@/types/alerts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cooldown period to prevent duplicate alerts (in hours)
const ALERT_COOLDOWN_HOURS = 6;

/**
 * Get all enabled alert configs
 */
async function getEnabledAlerts(): Promise<AlertConfig[]> {
  const { data, error } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('Error fetching alert configs:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if alert was recently triggered (cooldown)
 */
async function wasRecentlyTriggered(configId: string): Promise<boolean> {
  const cooldownTime = new Date();
  cooldownTime.setHours(cooldownTime.getHours() - ALERT_COOLDOWN_HOURS);

  const { data, error } = await supabase
    .from('alert_history')
    .select('id')
    .eq('config_id', configId)
    .gte('sent_at', cooldownTime.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking cooldown:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Record alert in history
 */
async function recordAlertHistory(
  config: AlertConfig,
  result: AlertCheckResult,
  emailSent: boolean
): Promise<AlertHistoryEntry | null> {
  const entry = {
    config_id: config.id,
    alert_type: config.alert_type,
    message: result.message || '',
    details: result.details || {},
    delivery_status: emailSent ? 'sent' : 'failed',
  };

  const { data, error } = await supabase
    .from('alert_history')
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error('Error recording alert history:', error);
    return null;
  }

  return data;
}

/**
 * Check a single alert config
 */
export async function checkAlertConfig(config: AlertConfig): Promise<AlertCheckResult> {
  switch (config.alert_type) {
    case 'issue_surge':
      return checkIssueSurge(config);
    case 'sentiment_shift':
      return checkSentimentShift(config);
    case 'rep_mention':
      return checkRepMention(config);
    default:
      return { triggered: false };
  }
}

/**
 * Process a triggered alert (send notification, record history)
 */
async function processTriggeredAlert(
  config: AlertConfig,
  result: AlertCheckResult
): Promise<AlertHistoryEntry | null> {
  let emailSent = false;

  // Send email if configured
  if (config.notify_email && isEmailConfigured() && result.details) {
    const emailResult = await sendAlertEmail({
      to: config.user_email,
      alertType: config.alert_type,
      message: result.message || '',
      details: result.details,
    });

    emailSent = emailResult.success;

    if (!emailResult.success) {
      console.error(`Failed to send alert email: ${emailResult.error}`);
    }
  }

  // Record in history
  const historyEntry = await recordAlertHistory(config, result, emailSent);

  return historyEntry;
}

/**
 * Check all enabled alerts
 */
export async function checkAllAlerts(): Promise<CheckAlertsResponse> {
  const alerts = await getEnabledAlerts();
  const triggered: AlertHistoryEntry[] = [];
  const errors: string[] = [];

  console.log(`Checking ${alerts.length} enabled alerts...`);

  for (const config of alerts) {
    try {
      // Check cooldown
      const recentlyTriggered = await wasRecentlyTriggered(config.id);
      if (recentlyTriggered) {
        console.log(`Alert ${config.id} is in cooldown, skipping`);
        continue;
      }

      // Check the alert
      const result = await checkAlertConfig(config);

      if (result.triggered) {
        console.log(`Alert triggered: ${config.alert_type} - ${result.message}`);

        const historyEntry = await processTriggeredAlert(config, result);
        if (historyEntry) {
          triggered.push(historyEntry);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error checking alert ${config.id}:`, errorMsg);
      errors.push(`Alert ${config.id}: ${errorMsg}`);
    }
  }

  console.log(`Checked ${alerts.length} alerts, ${triggered.length} triggered`);

  return {
    checked: alerts.length,
    triggered,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get alert history for a user
 */
export async function getAlertHistory(
  userEmail?: string,
  limit = 20
): Promise<AlertHistoryEntry[]> {
  let query = supabase
    .from('alert_history')
    .select('*, alert_configs!inner(user_email)')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (userEmail) {
    query = query.eq('alert_configs.user_email', userEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching alert history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get alert configs for a user
 */
export async function getUserAlerts(userEmail: string): Promise<AlertConfig[]> {
  const { data, error } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user alerts:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new alert config
 */
export async function createAlertConfig(
  userEmail: string,
  config: Omit<AlertConfig, 'id' | 'user_email' | 'created_at' | 'updated_at'>
): Promise<AlertConfig | null> {
  const { data, error } = await supabase
    .from('alert_configs')
    .insert({
      ...config,
      user_email: userEmail,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating alert config:', error);
    return null;
  }

  return data;
}

/**
 * Update an alert config
 */
export async function updateAlertConfig(
  id: string,
  updates: Partial<AlertConfig>
): Promise<AlertConfig | null> {
  const { data, error } = await supabase
    .from('alert_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating alert config:', error);
    return null;
  }

  return data;
}

/**
 * Delete an alert config
 */
export async function deleteAlertConfig(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('alert_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting alert config:', error);
    return false;
  }

  return true;
}
