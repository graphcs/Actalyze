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
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, verify it
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('Unauthorized cron request');
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
