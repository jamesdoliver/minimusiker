import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * GET /api/admin/analytics/manual-costs
 * Fetch manual costs for an event
 * Query params: eventId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'eventId is required' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const manualCosts = await airtable.getManualCostsForEvent(eventId);

    return NextResponse.json({
      success: true,
      data: manualCosts,
    });
  } catch (error) {
    console.error('Error fetching manual costs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch manual costs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/manual-costs
 * Create a new manual cost entry
 * Body: { eventId, costName, amount }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, costName, amount } = body;

    if (!eventId || !costName || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'eventId, costName, and amount are required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const manualCost = await airtable.createManualCost(eventId, costName, amount);

    return NextResponse.json({
      success: true,
      data: manualCost,
    });
  } catch (error) {
    console.error('Error creating manual cost:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create manual cost' },
      { status: 500 }
    );
  }
}
