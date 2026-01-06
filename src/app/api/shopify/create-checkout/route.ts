import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';
import { CheckoutLineItem, CheckoutCustomAttributes } from '@/lib/types/shop';

interface CheckoutRequest {
  lineItems: CheckoutLineItem[];
  customAttributes?: CheckoutCustomAttributes;
}

/**
 * POST /api/shopify/create-checkout
 *
 * Creates a Shopify cart and returns the checkout URL.
 * Uses the modern Cart API (2025) instead of the legacy Checkout API.
 *
 * Request body:
 * {
 *   lineItems: [{ variantId: string, quantity: number }],
 *   customAttributes?: {
 *     parentId: string,
 *     parentEmail: string,
 *     eventId?: string,
 *     schoolName?: string
 *   }
 * }
 *
 * Response:
 * {
 *   cartId: string,
 *   checkoutUrl: string,
 *   totalQuantity: number,
 *   totalAmount: number,
 *   currency: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { lineItems, customAttributes } = (await request.json()) as CheckoutRequest;

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Line items are required' },
        { status: 400 }
      );
    }

    // Validate line items
    for (const item of lineItems) {
      if (!item.variantId) {
        return NextResponse.json(
          { error: 'Each line item must have a variantId' },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { error: 'Each line item must have a quantity of at least 1' },
          { status: 400 }
        );
      }
    }

    // Check if Shopify integration is enabled
    const isShopifyEnabled = process.env.ENABLE_SHOPIFY_INTEGRATION === 'true';

    if (!isShopifyEnabled) {
      // Return mock checkout URL for development
      const mockCartId = `mock_cart_${Date.now()}`;
      console.log('[create-checkout] Mock cart created:', {
        cartId: mockCartId,
        lineItems,
        customAttributes,
      });

      return NextResponse.json({
        cartId: mockCartId,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCartId}`,
        totalQuantity: lineItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: 0,
        currency: 'EUR',
        // Legacy fields for backward compatibility
        checkoutId: mockCartId,
        webUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCartId}`,
        message: 'Shopify integration is disabled. This is a mock cart.',
      });
    }

    // Create real Shopify cart using modern Cart API
    const cart = await shopifyService.createCartFromCheckoutItems(lineItems, customAttributes);

    console.log('[create-checkout] Shopify cart created:', {
      cartId: cart.cartId,
      itemCount: lineItems.length,
      totalQuantity: cart.totalQuantity,
      totalAmount: cart.totalAmount,
      currency: cart.currency,
      parentId: customAttributes?.parentId,
      eventId: customAttributes?.eventId,
    });

    return NextResponse.json({
      cartId: cart.cartId,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      totalAmount: cart.totalAmount,
      currency: cart.currency,
      // Legacy fields for backward compatibility
      checkoutId: cart.cartId,
      webUrl: cart.checkoutUrl,
    });
  } catch (error) {
    console.error('[create-checkout] Error creating cart:', error);

    return NextResponse.json(
      {
        error: 'Failed to create checkout',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
