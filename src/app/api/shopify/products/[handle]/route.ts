import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';

/**
 * GET /api/shopify/products/[handle]
 * Fetches a single product by its handle (URL-friendly identifier)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const { handle } = params;

    if (!handle) {
      return NextResponse.json(
        { error: 'Product handle is required' },
        { status: 400 }
      );
    }

    // Fetch product from Shopify
    const product = await shopifyService.getProductByHandle(handle);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
