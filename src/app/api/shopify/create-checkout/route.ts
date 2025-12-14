import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';
import { CheckoutLineItem, CheckoutCustomAttributes } from '@/lib/types/shop';

interface CheckoutRequest {
  lineItems: CheckoutLineItem[];
  customAttributes?: CheckoutCustomAttributes;
}

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
      const mockCheckoutId = `mock_checkout_${Date.now()}`;
      console.log('Mock checkout created:', {
        checkoutId: mockCheckoutId,
        lineItems,
        customAttributes,
      });

      return NextResponse.json({
        checkoutId: mockCheckoutId,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCheckoutId}`,
        webUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCheckoutId}`,
        message: 'Shopify integration is disabled. This is a mock checkout.',
      });
    }

    // Create real Shopify checkout
    const checkout = await shopifyService.createCheckout(lineItems, customAttributes);

    console.log('Shopify checkout created:', {
      checkoutId: checkout.checkoutId,
      itemCount: lineItems.length,
      parentId: customAttributes?.parentId,
    });

    return NextResponse.json({
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      webUrl: checkout.webUrl,
    });
  } catch (error) {
    console.error('Error creating checkout:', error);

    return NextResponse.json(
      {
        error: 'Failed to create checkout',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
