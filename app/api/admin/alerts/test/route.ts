/**
 * API Route: /api/admin/alerts/test
 * Test/demo alert checking - runs a single alert check immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAlertConfig } from '@/lib/alerts';
import { sendAlertEmail, isEmailConfigured } from '@/lib/email/resend';
import type { AlertConfig } from '@/types/alerts';

/**
 * POST /api/admin/alerts/test
 * Test a single alert configuration (runs the check immediately)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { alert, forceTrigger, sendTestEmail } = body as {
      alert: AlertConfig;
      forceTrigger?: boolean;
      sendTestEmail?: boolean;
    };

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert configuration required' },
        { status: 400 }
      );
    }

    // If forceTrigger is true, simulate a triggered alert without actually checking
    if (forceTrigger) {
      const mockResult = {
        triggered: true,
        message: `[TEST] ${alert.alert_type === 'issue_surge'
          ? `"${alert.topic}" is surging! Score of 85 is 70% above baseline.`
          : alert.alert_type === 'sentiment_shift'
          ? `Sentiment on "${alert.topic}" has shifted 35% more negative.`
          : `${alert.representative_name} was mentioned 25 times in the last hour.`
        }`,
        details: {
          topic: alert.topic,
          representative_name: alert.representative_name,
          district_code: alert.district_code,
          test_mode: true,
          current_score: 85,
          baseline_score: 50,
          timestamp: new Date().toISOString(),
        },
      };

      // Optionally send a test email
      let emailSent = false;
      let emailError: string | undefined;

      if (sendTestEmail && alert.notify_email && isEmailConfigured()) {
        const emailResult = await sendAlertEmail({
          to: session.user.email,
          alertType: alert.alert_type,
          message: mockResult.message,
          details: mockResult.details,
        });
        emailSent = emailResult.success;
        emailError = emailResult.error;
      }

      return NextResponse.json({
        success: true,
        mode: 'forced_trigger',
        result: mockResult,
        emailSent,
        emailError,
        emailConfigured: isEmailConfigured(),
      });
    }

    // Run actual alert check
    console.log(`Testing alert: ${alert.alert_type} for ${alert.topic || alert.representative_name}`);
    const result = await checkAlertConfig(alert);

    // Optionally send email if triggered
    let emailSent = false;
    let emailError: string | undefined;

    if (result.triggered && sendTestEmail && alert.notify_email && isEmailConfigured() && result.details) {
      const emailResult = await sendAlertEmail({
        to: session.user.email,
        alertType: alert.alert_type,
        message: result.message || 'Alert triggered',
        details: result.details,
      });
      emailSent = emailResult.success;
      emailError = emailResult.error;
    }

    return NextResponse.json({
      success: true,
      mode: 'live_check',
      result,
      emailSent,
      emailError,
      emailConfigured: isEmailConfigured(),
    });

  } catch (error) {
    console.error('Error testing alert:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to test alert: ${errorMessage}` },
      { status: 500 }
    );
  }
}
