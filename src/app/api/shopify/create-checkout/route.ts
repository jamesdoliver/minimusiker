import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';
import { CheckoutLineItem, CheckoutCustomAttributes, ShippingAddressInput } from '@/lib/types/shop';
import { getAirtableService } from '@/lib/services/airtableService';
import { parseOverrides, getThreshold, canOrderPersonalizedClothingForEvent } from '@/lib/utils/eventThresholds';
import { filterPurchasableLineItems, qualifiesForBundleDiscount, stripPersonalizedClothingLineItems } from '@/lib/utils/checkoutDiscounts';
import { resolveShopProfile } from '@/lib/config/shopProfiles';
import { computeStandardMerchOnly } from '@/lib/utils/eventTimeline';

export const dynamic = 'force-dynamic';

interface CheckoutRequest {
  lineItems: CheckoutLineItem[];
  customAttributes?: CheckoutCustomAttributes;
  note?: string;
  shippingAddress?: ShippingAddressInput;
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
    const { lineItems, customAttributes, note, shippingAddress } = (await request.json()) as CheckoutRequest;

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

    // Drop sold-out items (currently: hoodie variants) before doing anything else.
    // A sold-out hoodie is dropped by Shopify at checkout anyway; removing it here
    // means we never send it AND the cart-level bundle discount can never survive
    // onto a shirt-only order. The portal already hides sold-out products — this
    // guards stale/tampered clients.
    let purchasableLineItems = filterPurchasableLineItems(lineItems);

    if (purchasableLineItems.length < lineItems.length) {
      console.warn('[create-checkout] Dropped sold-out line item(s):', {
        sent: lineItems.length,
        purchasable: purchasableLineItems.length,
      });
    }

    if (purchasableLineItems.length === 0) {
      return NextResponse.json(
        { error: 'Die ausgewählten Artikel sind aktuell ausverkauft.' },
        { status: 409 }
      );
    }

    // Determine discount codes to apply
    const discountCodes: string[] = [];

    // Whether PERSONALIZED ("Schul") clothing may still be ordered. Personalized items
    // are batch-produced per school and close at their cutoff; standard clothing + audio
    // are always allowed. Fail CLOSED for personalized when the event can't be verified
    // (missing eventId or lookup failure) — an unattributable school shirt can't be produced.
    let personalizedAllowed = false;

    // 1. Early-bird + schoolName backfill + personalized-cutoff resolution (event lookup)
    if (customAttributes?.eventId) {
      try {
        const airtable = getAirtableService();
        const event = await airtable.getEventByEventId(customAttributes.eventId);
        const overrides = parseOverrides(event?.timeline_overrides);

        // Detect schulsong-only events (no audio products → no early-bird discount).
        // Derive from the SAME profile the shop renders so this never drifts: a
        // Plus/Minimusikertag/SCS event that also has a schulsong still sells audio and
        // must remain early-bird eligible (regression: "Plus + Schulsong" event 1756).
        const earlyBirdProfile = resolveShopProfile({
          isMinimusikertag: event?.is_minimusikertag === true,
          isPlus: event?.is_plus === true,
          isSchulsong: event?.is_schulsong === true,
          isScs: event?.scs_shirts_included === true,
        });
        const isSchulsongOnly = earlyBirdProfile.audioProducts.length === 0;

        // Personalized clothing window — mirrors the shop's personalized→standard switch
        // so the server enforcement and the UI never disagree. Standard clothing is NOT
        // governed by this (it stays orderable indefinitely).
        if (event) {
          personalizedAllowed = canOrderPersonalizedClothingForEvent({
            eventDate: event.event_date,
            overrides,
            isSchulsongOnly,
            isStandardMerchOnly: computeStandardMerchOnly(event.standard_merch_override, event.is_under_100),
            schulsongMerchCutoff: event.schulsong_merch_cutoff ?? null,
          });
        }

        // Early-bird discount: must be within deadline window AND not schulsong-only
        if (event?.event_date && !isSchulsongOnly) {
          const eventDate = new Date(event.event_date);
          const earlyBirdDays = getThreshold('early_bird_deadline_days', overrides);
          const deadline = new Date(eventDate);
          deadline.setDate(deadline.getDate() - earlyBirdDays);
          deadline.setHours(23, 59, 59, 999);

          if (Date.now() < deadline.getTime()) {
            discountCodes.push('EARLYBIRD10');
            console.log('[create-checkout] Early-bird discount applied:', {
              eventDate: event.event_date,
              earlyBirdDeadline: deadline.toISOString(),
              earlyBirdDays,
            });
          } else {
            console.log('[create-checkout] Early-bird deadline passed:', {
              eventDate: event.event_date,
              earlyBirdDeadline: deadline.toISOString(),
              earlyBirdDays,
            });
          }
        } else if (isSchulsongOnly) {
          console.log('[create-checkout] Skipping early-bird discount for schulsong-only event:', {
            eventId: customAttributes.eventId,
          });
        }

        // Backfill schoolName from Event record if missing from request
        if (!customAttributes.schoolName && event?.school_name) {
          customAttributes.schoolName = event.school_name;
          console.log('[create-checkout] Backfilled schoolName from Event:', event.school_name);
        }
      } catch (error) {
        console.error('[create-checkout] Error checking early-bird/schoolName:', error);
        // personalizedAllowed stays false → personalized stripped below (fail-closed).
        // Standard clothing + audio are unaffected; early-bird discount is simply skipped.
      }
    }

    // Enforce the personalized ("Schul") clothing cutoff server-side. Standard clothing
    // (rolling stock) and audio always pass; only personalized variants are stripped —
    // this closes the stale/tampered-client gap for the batch-produced school items.
    if (!personalizedAllowed) {
      const beforeStrip = purchasableLineItems.length;
      purchasableLineItems = stripPersonalizedClothingLineItems(purchasableLineItems);
      if (purchasableLineItems.length < beforeStrip) {
        console.warn('[create-checkout] Stripped personalized clothing past its order cutoff:', {
          eventId: customAttributes?.eventId,
          before: beforeStrip,
          after: purchasableLineItems.length,
        });
      }
      if (purchasableLineItems.length === 0) {
        return NextResponse.json(
          { error: 'Die Bestellfrist für personalisierte Schulkleidung ist abgelaufen. Standard-Artikel und Audio sind weiterhin bestellbar.' },
          { status: 409 }
        );
      }
    }

    // 2. Bundle check (T-shirt + Hoodie) — evaluated on PURCHASABLE items only, so a
    //    bundle whose hoodie is sold out never earns the 15% on the surviving shirt.
    if (qualifiesForBundleDiscount(purchasableLineItems)) {
      discountCodes.push('BUNDLE15');
      console.log('[create-checkout] Bundle discount applied: T-shirt + Hoodie combo');
    }

    if (discountCodes.length > 0) {
      console.log('[create-checkout] Discount codes to apply:', discountCodes);
    }

    // Check if Shopify integration is enabled
    const isShopifyEnabled = process.env.ENABLE_SHOPIFY_INTEGRATION === 'true';

    if (!isShopifyEnabled) {
      // Return mock checkout URL for development
      const mockCartId = `mock_cart_${Date.now()}`;
      console.log('[create-checkout] Mock cart created:', {
        cartId: mockCartId,
        lineItems: purchasableLineItems,
        customAttributes,
        discountCodes,
        note,
        shippingAddress,
      });

      return NextResponse.json({
        cartId: mockCartId,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCartId}`,
        totalQuantity: purchasableLineItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: 0,
        currency: 'EUR',
        // Legacy fields for backward compatibility
        checkoutId: mockCartId,
        webUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock/${mockCartId}`,
        message: 'Shopify integration is disabled. This is a mock cart.',
        discountCodes, // Include for debugging in mock mode
      });
    }

    // Create real Shopify cart using modern Cart API
    const cart = await shopifyService.createCartFromCheckoutItems(
      purchasableLineItems,
      customAttributes,
      discountCodes,
      note,
      shippingAddress
    );

    console.log('[create-checkout] Shopify cart created:', {
      cartId: cart.cartId,
      itemCount: purchasableLineItems.length,
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
