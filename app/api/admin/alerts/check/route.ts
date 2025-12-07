/**
 * API Route: /api/admin/alerts/check
 * Manual trigger to check all alerts
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAllAlerts } from '@/lib/alerts';

/**
 * POST /api/admin/alerts/check
 * Manually trigger alert checking
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`Manual alert check triggered by ${session.user.email}`);

    const result = await checkAllAlerts();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error checking alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}
