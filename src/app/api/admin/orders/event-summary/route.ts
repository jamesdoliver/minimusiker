/**
 * Event Orders Summary API
 *
 * GET /api/admin/orders/event-summary?eventId={id}&schoolName={school}&eventDate={date}
 *
 * Returns aggregated order data for an event, including:
 * - Total orders count
 * - Total revenue
 * - Total items count
 * - Items breakdown by product/variant
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { ORDERS_FIELD_IDS } from '@/lib/types/airtable';
import {
  getEventRecordIdByAccessCode,
  getOrdersByEventRecordId,
} from '@/lib/services/ordersHelper';

interface LineItem {
  variant_id: string;
  product_title: string;
  variant_title?: string;
  quantity: number;
  price: number;
  total: number;
}

interface ItemBreakdown {
  name: string;
  quantity: number;
  revenue: number;
}

interface EventSummaryResponse {
  success: boolean;
  data?: {
    totalOrders: number;
    totalRevenue: number;
    totalItems: number;
    itemsBreakdown: ItemBreakdown[];
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<EventSummaryResponse>> {
  try {
    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const passedEventId = searchParams.get('eventId');
    const schoolName = searchParams.get('schoolName');
    const eventDate = searchParams.get('eventDate');

    if (!passedEventId || !schoolName || !eventDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: eventId, schoolName, eventDate' },
        { status: 400 }
      );
    }

    // Look up Event by access_code to get the Airtable record ID
    // passedEventId is the numeric access_code from the admin booking view
    let eventRecordId: string | null = null;

    if (/^\d+$/.test(passedEventId)) {
      // Numeric ID = access_code
      eventRecordId = await getEventRecordIdByAccessCode(passedEventId);
      console.log(`[orders/event-summary] Looking up by access_code: ${passedEventId} -> ${eventRecordId || 'not found'}`);
    } else {
      // Fallback: generate event_id and try to look it up
      const eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);
      console.log(`[orders/event-summary] Generated event_id: ${eventId} from passedEventId: ${passedEventId}`);
      // For now, we'll still use the access_code lookup since admin bookings always pass access_code
    }

    // If we couldn't find the event, return empty summary
    if (!eventRecordId) {
      console.warn(`[orders/event-summary] Event not found for identifier: ${passedEventId}`);
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: 0,
          totalRevenue: 0,
          totalItems: 0,
          itemsBreakdown: [],
        },
      });
    }

    // Query orders by event_id linked record field
    const orders = await getOrdersByEventRecordId(eventRecordId);
    console.log(`[orders/event-summary] Found ${orders.length} orders for event record: ${eventRecordId}`);

    // If no orders, return empty summary
    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: 0,
          totalRevenue: 0,
          totalItems: 0,
          itemsBreakdown: [],
        },
      });
    }

    // Aggregate quantities by product/variant
    const itemSummary = new Map<string, { quantity: number; revenue: number }>();
    let totalRevenue = 0;
    let totalItems = 0;

    for (const order of orders) {
      // Note: Helper uses returnFieldsByFieldId, so access via field IDs
      const totalAmount = order.get(ORDERS_FIELD_IDS.total_amount) as number || 0;
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;

      totalRevenue += Number(totalAmount);

      if (!lineItemsJson) continue;

      let lineItems: LineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        console.warn(`[orders/event-summary] Error parsing line items for order ${order.id}`);
        continue;
      }

      for (const item of lineItems) {
        const key = item.variant_title
          ? `${item.product_title} - ${item.variant_title}`
          : item.product_title;

        const current = itemSummary.get(key) || { quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += item.total || (item.quantity * item.price);
        itemSummary.set(key, current);

        totalItems += item.quantity;
      }
    }

    // Convert to array and sort by quantity descending
    const itemsBreakdown: ItemBreakdown[] = [...itemSummary.entries()]
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: orders.length,
        totalRevenue,
        totalItems,
        itemsBreakdown,
      },
    });
  } catch (error) {
    console.error('[orders/event-summary] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order summary' },
      { status: 500 }
    );
  }
}
