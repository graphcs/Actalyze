/**
 * Email Service using Resend
 * Handles sending alert notifications via email
 */

import { Resend } from 'resend';
import type { AlertType, AlertDetails } from '@/types/alerts';

const resend = new Resend(process.env.RESEND_API_KEY);

// Default from address (must be verified in Resend or use onboarding@resend.dev for testing)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'alerts@actalyze.com';
const FROM_NAME = 'Actalyze Alerts';

interface SendAlertEmailParams {
  to: string;
  alertType: AlertType;
  message: string;
  details: AlertDetails;
}

/**
 * Format alert type for display
 */
function formatAlertType(type: AlertType): string {
  switch (type) {
    case 'issue_surge':
      return 'Issue Surge Alert';
    case 'sentiment_shift':
      return 'Sentiment Shift Alert';
    case 'rep_mention':
      return 'Representative Mention Alert';
    default:
      return 'Alert';
  }
}

/**
 * Get color for alert type
 */
function getAlertColor(type: AlertType): string {
  switch (type) {
    case 'issue_surge':
      return '#ef4444'; // red
    case 'sentiment_shift':
      return '#f59e0b'; // amber
    case 'rep_mention':
      return '#3b82f6'; // blue
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Generate HTML email template for alerts
 */
function generateAlertEmailHtml(params: SendAlertEmailParams): string {
  const { alertType, message, details } = params;
  const color = getAlertColor(alertType);
  const typeName = formatAlertType(alertType);

  let detailsHtml = '';

  if (details.topic) {
    detailsHtml += `<p><strong>Topic:</strong> ${details.topic}</p>`;
  }
  if (details.representative_name) {
    detailsHtml += `<p><strong>Representative:</strong> ${details.representative_name}</p>`;
  }
  if (details.district_code) {
    const location = details.district_code === 'national' ? 'National' : details.district_code;
    detailsHtml += `<p><strong>Location:</strong> ${location}</p>`;
  }
  if (details.current_score !== undefined && details.baseline_score !== undefined) {
    detailsHtml += `<p><strong>Current Score:</strong> ${details.current_score.toFixed(1)} (baseline: ${details.baseline_score.toFixed(1)})</p>`;
  }
  if (details.current_sentiment !== undefined && details.baseline_sentiment !== undefined) {
    const sentimentLabel = details.current_sentiment > 0 ? 'Positive' : details.current_sentiment < 0 ? 'Negative' : 'Neutral';
    detailsHtml += `<p><strong>Current Sentiment:</strong> ${sentimentLabel} (${(details.current_sentiment * 100).toFixed(1)}%)</p>`;
    detailsHtml += `<p><strong>Previous:</strong> ${(details.baseline_sentiment * 100).toFixed(1)}%</p>`;
  }
  if (details.mention_count !== undefined) {
    detailsHtml += `<p><strong>Mentions Found:</strong> ${details.mention_count}</p>`;
  }

  // Sample tweets if available
  let tweetsHtml = '';
  if (details.sample_tweets && details.sample_tweets.length > 0) {
    tweetsHtml = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <h3 style="color: #374151; font-size: 14px; margin-bottom: 10px;">Sample Posts:</h3>
        ${details.sample_tweets.slice(0, 3).map(tweet => `
          <div style="background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; color: #4b5563;">
            "${tweet.length > 200 ? tweet.substring(0, 200) + '...' : tweet}"
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: ${color}; padding: 24px; text-align: center;">
            <h1 style="color: white; font-size: 20px; font-weight: 600; margin: 0;">
              ${typeName}
            </h1>
          </div>

          <!-- Content -->
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #111827; margin: 0 0 20px 0;">
              ${message}
            </p>

            <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
              ${detailsHtml}
            </div>

            ${tweetsHtml}
          </div>

          <!-- Footer -->
          <div style="padding: 20px 24px; background: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280; margin: 0;">
              This alert was sent by <a href="${process.env.NEXT_PUBLIC_URL || 'https://actalyze.com'}" style="color: ${color}; text-decoration: none;">Actalyze</a>
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin: 8px 0 0 0;">
              Manage your alert settings in the Admin panel
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email for fallback
 */
function generateAlertEmailText(params: SendAlertEmailParams): string {
  const { alertType, message, details } = params;
  const typeName = formatAlertType(alertType);

  let text = `${typeName}\n${'='.repeat(typeName.length)}\n\n`;
  text += `${message}\n\n`;
  text += 'Details:\n';

  if (details.topic) text += `- Topic: ${details.topic}\n`;
  if (details.representative_name) text += `- Representative: ${details.representative_name}\n`;
  if (details.district_code) {
    const location = details.district_code === 'national' ? 'National' : details.district_code;
    text += `- Location: ${location}\n`;
  }
  if (details.current_score !== undefined) {
    text += `- Current Score: ${details.current_score.toFixed(1)}`;
    if (details.baseline_score !== undefined) {
      text += ` (baseline: ${details.baseline_score.toFixed(1)})`;
    }
    text += '\n';
  }
  if (details.current_sentiment !== undefined) {
    text += `- Current Sentiment: ${(details.current_sentiment * 100).toFixed(1)}%`;
    if (details.baseline_sentiment !== undefined) {
      text += ` (previous: ${(details.baseline_sentiment * 100).toFixed(1)}%)`;
    }
    text += '\n';
  }
  if (details.mention_count !== undefined) {
    text += `- Mentions Found: ${details.mention_count}\n`;
  }

  text += '\n---\nSent by Actalyze\n';

  return text;
}

/**
 * Send an alert email notification
 */
export async function sendAlertEmail(params: SendAlertEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, alertType } = params;
  const typeName = formatAlertType(alertType);

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `[Actalyze] ${typeName}`,
      html: generateAlertEmailHtml(params),
      text: generateAlertEmailText(params),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`Email sent successfully to ${to}, ID: ${result.data?.id}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending email';
    console.error('Failed to send alert email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
