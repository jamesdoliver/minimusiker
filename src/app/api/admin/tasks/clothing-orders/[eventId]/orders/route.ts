import { NextRequest, NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/clothing-orders/[eventId]/orders
 * Get individual orders for an event (for modal display)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const clothingOrdersService = getClothingOrdersService();
    const orders = await clothingOrdersService.getOrdersForEvent(eventId);

    return NextResponse.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    console.error('Error fetching orders for event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
