import { NextResponse } from 'next/server';
import { generateMockOrders, StockOrder } from '@/lib/types/stock';

// In-memory storage for development (will be replaced with Airtable/Flyeralarm integration)
let ordersCache: StockOrder[] | null = null;

export async function GET() {
  try {
    // Use cached data or generate new mock data
    if (!ordersCache) {
      ordersCache = generateMockOrders();
    }

    return NextResponse.json({
      success: true,
      orders: ordersCache,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
