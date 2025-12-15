import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, Product } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const products = await airtableService.getProductsByEventId(eventId);

    // Check for early bird pricing
    const productsWithPricing = products.map(product => {
      const now = new Date();
      const isEarlyBird = product.early_bird_deadline
        ? new Date(product.early_bird_deadline) > now
        : false;

      return {
        ...product,
        currentPrice: isEarlyBird && product.early_bird_price
          ? product.early_bird_price
          : product.price,
        isEarlyBird,
      };
    });

    return NextResponse.json<ApiResponse<Product[]>>({
      success: true,
      data: productsWithPricing,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}