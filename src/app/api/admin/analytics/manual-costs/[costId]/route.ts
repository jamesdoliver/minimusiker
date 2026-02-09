import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ costId: string }>;
}

/**
 * PATCH /api/admin/analytics/manual-costs/[costId]
 * Update a manual cost entry
 * Body: { costName, amount }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { costId } = await params;
    const body = await request.json();
    const { costName, amount } = body;

    if (!costName || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'costName and amount are required' },
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
    const manualCost = await airtable.updateManualCost(costId, costName, amount);

    return NextResponse.json({
      success: true,
      data: manualCost,
    });
  } catch (error) {
    console.error('Error updating manual cost:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update manual cost' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/analytics/manual-costs/[costId]
 * Delete a manual cost entry
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { costId } = await params;

    const airtable = getAirtableService();
    await airtable.deleteManualCost(costId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting manual cost:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete manual cost' },
      { status: 500 }
    );
  }
}
