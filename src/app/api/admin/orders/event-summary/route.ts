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
import Airtable from 'airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { ORDERS_TABLE_ID } from '@/lib/types/airtable';

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

    // Determine the actual event_id
    // If passedEventId looks like a SimplyBook ID (numeric), generate the proper event_id
    let eventId = passedEventId;
    if (/^\d+$/.test(passedEventId)) {
      eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);
      console.log(`[orders/event-summary] Generated event_id: ${eventId} from SimplyBook ID: ${passedEventId}`);
    }

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID!);

    // Query orders by booking_id
    const orders = await base(ORDERS_TABLE_ID)
      .select({
        filterByFormula: `{booking_id} = "${eventId}"`,
      })
      .all();

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
      const totalAmount = order.fields.total_amount as number || 0;
      const lineItemsJson = order.fields.line_items as string;

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
