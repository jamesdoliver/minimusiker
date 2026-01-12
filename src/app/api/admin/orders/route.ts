/**
 * Admin Orders API
 *
 * GET /api/admin/orders
 * Query params:
 *   - eventId: Filter by event/booking ID
 *   - status: Filter by payment status (paid, pending, refunded)
 *   - limit: Max records to return (default 100)
 *
 * Returns orders with line items and aggregated data for admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';

interface OrderRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  bookingId: string;
  schoolName: string;
  classId?: string;
  orderDate: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  lineItems: ShopifyOrderLineItem[];
  fulfillmentStatus: string;
  paymentStatus: string;
  digitalDelivered: boolean;
  createdAt: string;
}

interface OrdersResponse {
  orders: OrderRecord[];
  summary: {
    totalOrders: number;
    totalRevenue: number;
    paidOrders: number;
    pendingOrders: number;
    digitalDelivered: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Build filter formula
    const filters: string[] = [];
    if (eventId) {
      filters.push(`{${ORDERS_FIELD_IDS.booking_id}} = "${eventId}"`);
    }
    if (status) {
      filters.push(`{${ORDERS_FIELD_IDS.payment_status}} = "${status}"`);
    }

    const filterFormula = filters.length > 0
      ? `AND(${filters.join(', ')})`
      : '';

    // Fetch orders from Airtable
    const Airtable = require('airtable');
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID!);

    const records = await base(ORDERS_TABLE_ID)
      .select({
        filterByFormula: filterFormula || undefined,
        maxRecords: limit,
        sort: [{ field: ORDERS_FIELD_IDS.order_date, direction: 'desc' }],
      })
      .all();

    // Transform records
    const orders: OrderRecord[] = records.map((record: any) => {
      let lineItems: ShopifyOrderLineItem[] = [];
      try {
        const lineItemsJson = record.get(ORDERS_FIELD_IDS.line_items);
        if (lineItemsJson) {
          lineItems = JSON.parse(lineItemsJson);
        }
      } catch (e) {
        console.warn('Failed to parse line items for order:', record.id);
      }

      return {
        id: record.id,
        orderId: record.get(ORDERS_FIELD_IDS.order_id) || '',
        orderNumber: record.get(ORDERS_FIELD_IDS.order_number) || '',
        bookingId: record.get(ORDERS_FIELD_IDS.booking_id) || '',
        schoolName: record.get(ORDERS_FIELD_IDS.school_name) || '',
        classId: record.get(ORDERS_FIELD_IDS.class_id)?.[0],
        orderDate: record.get(ORDERS_FIELD_IDS.order_date) || '',
        totalAmount: record.get(ORDERS_FIELD_IDS.total_amount) || 0,
        subtotal: record.get(ORDERS_FIELD_IDS.subtotal) || 0,
        taxAmount: record.get(ORDERS_FIELD_IDS.tax_amount) || 0,
        shippingAmount: record.get(ORDERS_FIELD_IDS.shipping_amount) || 0,
        lineItems,
        fulfillmentStatus: record.get(ORDERS_FIELD_IDS.fulfillment_status) || 'pending',
        paymentStatus: record.get(ORDERS_FIELD_IDS.payment_status) || 'pending',
        digitalDelivered: record.get(ORDERS_FIELD_IDS.digital_delivered) || false,
        createdAt: record.get(ORDERS_FIELD_IDS.created_at) || '',
      };
    });

    // Calculate summary
    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      paidOrders: orders.filter(o => o.paymentStatus === 'paid').length,
      pendingOrders: orders.filter(o => o.paymentStatus === 'pending').length,
      digitalDelivered: orders.filter(o => o.digitalDelivered).length,
    };

    const response: OrdersResponse = { orders, summary };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[admin/orders] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
