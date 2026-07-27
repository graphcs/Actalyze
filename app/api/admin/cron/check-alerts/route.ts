/**
 * API Route: /api/admin/cron/check-alerts
 * Vercel Cron endpoint to check alerts on a schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAllAlerts } from '@/lib/alerts';

/**
 * GET /api/admin/cron/check-alerts
 * Called by Vercel Cron to check all alerts
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security.
    // This must FAIL CLOSED: an unset CRON_SECRET previously let anyone on the
    // internet trigger a full alert sweep (LLM + email spend), so a missing
    // secret now disables the endpoint entirely rather than opening it.
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        'CRON_SECRET is not configured - refusing to run the alert sweep. ' +
          'Set CRON_SECRET in the environment (see .env.example) and have the ' +
          'cron scheduler send "Authorization: Bearer <CRON_SECRET>".'
      );
      return NextResponse.json(
        { error: 'Cron endpoint is not configured' },
        { status: 503 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron request rejected');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Cron alert check started');

    const result = await checkAllAlerts();

    console.log(`Cron alert check completed: ${result.checked} checked, ${result.triggered.length} triggered`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Cron error checking alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}

// Vercel Cron config - runs every 15 minutes
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for alert checking
