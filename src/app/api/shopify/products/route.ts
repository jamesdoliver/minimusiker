import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shopify/products
 * Fetches products from Shopify filtered by tag
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagParam = searchParams.get('tag');
    // Use 'all' to fetch without tag filter, otherwise default to 'minimusiker-shop'
    const tag = tagParam === 'all' ? undefined : (tagParam || 'minimusiker-shop');
    const category = searchParams.get('category');

    // Fetch products from Shopify
    let products = await shopifyService.getProducts(tag);

    // Filter by category (productType) if specified
    if (category) {
      products = products.filter(
        (product) => product.productType.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter out unavailable products
    products = products.filter((product) => product.availableForSale);

    return NextResponse.json({
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Error fetching products:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
