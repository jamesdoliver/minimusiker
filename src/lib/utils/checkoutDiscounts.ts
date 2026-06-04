/**
 * Checkout availability + bundle-discount guards.
 *
 * The "T-Shirt + Hoodie" bundle is sent to the server as two separate line items
 * (a t-shirt line + a hoodie line). The cart-level BUNDLE15 discount is applied
 * whenever both productTypes are present — but a sold-out hoodie is dropped by
 * Shopify at checkout while the cart-level discount survives, leaving a shirt-only
 * order at 15% off.
 *
 * These helpers strip sold-out hoodie lines BEFORE evaluating the bundle discount,
 * so BUNDLE15 can only apply to an order that will actually contain a purchasable
 * hoodie. The sold-out source of truth is `SOLD_OUT_HOODIE_VARIANT_IDS`, derived
 * from the `soldOut` flags in the shop config.
 */

import { SOLD_OUT_HOODIE_VARIANT_IDS } from '@/lib/config/shopProfiles';

export type CheckoutProductType = 'tshirt' | 'hoodie' | 'audio';

export interface CheckoutLineItemLike {
  variantId: string;
  quantity: number;
  productType?: CheckoutProductType;
}

/** Numeric portion of a Shopify variant id (accepts a full gid or a bare id). */
function variantNumericId(variantId: string): string {
  return variantId.split('/').pop() ?? variantId;
}

/** True when the line item is a hoodie variant that is currently sold out. */
export function isSoldOutHoodieLine(
  item: CheckoutLineItemLike,
  soldOutVariantIds: Set<string> = SOLD_OUT_HOODIE_VARIANT_IDS
): boolean {
  return soldOutVariantIds.has(variantNumericId(item.variantId));
}

/**
 * Removes line items that cannot currently be purchased (sold-out hoodie variants).
 * Shopify would drop these at checkout anyway; stripping them here means we never
 * send them and never apply a discount that assumes they survive.
 */
export function filterPurchasableLineItems<T extends CheckoutLineItemLike>(
  items: T[],
  soldOutVariantIds: Set<string> = SOLD_OUT_HOODIE_VARIANT_IDS
): T[] {
  return items.filter((item) => !isSoldOutHoodieLine(item, soldOutVariantIds));
}

/**
 * The bundle discount applies only when the (already-filtered) order contains BOTH
 * a t-shirt and a purchasable hoodie. Pass items returned by
 * `filterPurchasableLineItems` so a sold-out hoodie can never qualify.
 */
export function qualifiesForBundleDiscount(items: CheckoutLineItemLike[]): boolean {
  const hasTshirt = items.some((item) => item.productType === 'tshirt');
  const hasHoodie = items.some((item) => item.productType === 'hoodie');
  return hasTshirt && hasHoodie;
}
