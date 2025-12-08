/**
 * API Route: /api/admin/alerts
 * CRUD operations for alert configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUserAlerts,
  createAlertConfig,
  updateAlertConfig,
  deleteAlertConfig,
} from '@/lib/alerts';
import type { CreateAlertRequest, UpdateAlertRequest } from '@/types/alerts';

/**
 * GET /api/admin/alerts
 * Get all alerts for the authenticated user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const alerts = await getUserAlerts(session.user.email);

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/alerts
 * Create a new alert configuration
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

    const body: CreateAlertRequest = await request.json();

    // Validate required fields
    if (!body.alert_type) {
      return NextResponse.json(
        { error: 'alert_type is required' },
        { status: 400 }
      );
    }

    // Validate alert-type specific fields
    if (body.alert_type === 'issue_surge' || body.alert_type === 'sentiment_shift') {
      if (!body.topic) {
        return NextResponse.json(
          { error: 'topic is required for this alert type' },
          { status: 400 }
        );
      }
    }

    if (body.alert_type === 'rep_mention') {
      if (!body.representative_name) {
        return NextResponse.json(
          { error: 'representative_name is required for this alert type' },
          { status: 400 }
        );
      }
    }

    const result = await createAlertConfig(session.user.email, {
      alert_type: body.alert_type,
      enabled: true,
      topic: body.topic,
      representative_name: body.representative_name,
      district_code: body.district_code || 'national',
      threshold: body.threshold,
      notify_email: body.notify_email ?? true,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to create alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert: result.data }, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create alert: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/alerts
 * Update an existing alert configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateAlertRequest & { id: string } = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const userAlerts = await getUserAlerts(session.user.email);
    const ownsAlert = userAlerts.some(a => a.id === body.id);

    if (!ownsAlert) {
      return NextResponse.json(
        { error: 'Alert not found or not authorized' },
        { status: 404 }
      );
    }

    const { id, ...updates } = body;
    const alert = await updateAlertConfig(id, updates);

    if (!alert) {
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/alerts
 * Delete an alert configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const userAlerts = await getUserAlerts(session.user.email);
    const ownsAlert = userAlerts.some(a => a.id === id);

    if (!ownsAlert) {
      return NextResponse.json(
        { error: 'Alert not found or not authorized' },
        { status: 404 }
      );
    }

    const success = await deleteAlertConfig(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}
