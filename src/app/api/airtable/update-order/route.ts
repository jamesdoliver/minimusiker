import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, Order } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json();

    if (!orderData.parent_id || !orderData.event_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Parent ID and Event ID are required' },
        { status: 400 }
      );
    }

    // Generate a unique order ID
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newOrder: Partial<Order> = {
      order_id: orderId,
      parent_id: orderData.parent_id,
      event_id: orderData.event_id,
      shopify_order_id: orderData.shopify_order_id,
      order_date: new Date().toISOString(),
      products: orderData.products || [],
      subtotal: orderData.subtotal || 0,
      tax: orderData.tax || 0,
      shipping: orderData.shipping || 0,
      total_amount: orderData.total_amount || 0,
      fulfillment_status: 'pending',
      digital_delivered: false,
    };

    const createdOrder = await airtableService.createOrder(newOrder);

    return NextResponse.json<ApiResponse<Order>>({
      success: true,
      data: createdOrder,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { orderId, updates } = await request.json();

    if (!orderId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Find the order by order_id first
    const orders = await airtableService.getOrdersByParentId(updates.parent_id || '');
    const order = orders.find(o => o.order_id === orderId);

    if (!order) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const updatedOrder = await airtableService.updateOrder(order.id, updates);

    return NextResponse.json<ApiResponse<Order>>({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}