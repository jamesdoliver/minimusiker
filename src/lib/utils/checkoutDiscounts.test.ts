/**
 * Tests for checkout availability / bundle-discount guards.
 *
 * Regression context (June 2026): parents were completing SHIRT-ONLY orders that
 * still received the 15% "T-Shirt + Hoodie" bundle discount (BUNDLE15).
 *
 * Root cause: when a customer picks the bundle, the client sends a t-shirt line +
 * a hoodie line, and the server applied the cart-level BUNDLE15 code whenever both
 * productTypes were present. With hoodies set to 0 stock (WirMachenDruck delivery
 * problems), Shopify drops the unavailable hoodie line at checkout but the
 * cart-level discount survives -> a shirt-only order at 15% off.
 *
 * Fix: sold-out hoodie variants are stripped BEFORE the bundle check, so BUNDLE15
 * can never apply to an order that won't actually contain a purchasable hoodie.
 */

import {
  filterPurchasableLineItems,
  qualifiesForBundleDiscount,
  isSoldOutHoodieLine,
  type CheckoutLineItemLike,
} from './checkoutDiscounts';
import {
  MINIMUSIKERTAG_PROFILE,
  SCS_PROFILE,
  SOLD_OUT_HOODIE_VARIANT_IDS,
} from '@/lib/config/shopProfiles';

const VARIANT_MAP = MINIMUSIKERTAG_PROFILE.shopifyVariantMap;
const TSHIRT_VARIANT = VARIANT_MAP['tshirt-standard-98/104 (3-4J)'];
const HOODIE_VARIANT = VARIANT_MAP['hoodie-standard-116 (5-6 J)'];

const tshirtLine = (): CheckoutLineItemLike => ({ variantId: TSHIRT_VARIANT, quantity: 1, productType: 'tshirt' });
const hoodieLine = (): CheckoutLineItemLike => ({ variantId: HOODIE_VARIANT, quantity: 1, productType: 'hoodie' });

describe('checkout sold-out hoodie guard', () => {
  describe('current shop config', () => {
    it('marks the Hoodie and the T-Shirt+Hoodie bundle as sold out in every general profile', () => {
      const findById = (id: string) =>
        MINIMUSIKERTAG_PROFILE.standardClothingProducts.find((p) => p.id === id);
      expect(findById('hoodie')?.soldOut).toBe(true);
      expect(findById('tshirt-hoodie')?.soldOut).toBe(true);
      // The standalone T-shirt stays available.
      expect(findById('tshirt')?.soldOut).toBeFalsy();
    });

    it('marks the SCS hoodie-only product sold out', () => {
      expect(SCS_PROFILE.standardClothingProducts.find((p) => p.id === 'hoodie')?.soldOut).toBe(true);
    });

    it('derives SOLD_OUT_HOODIE_VARIANT_IDS containing every hoodie variant but no t-shirt/audio variant', () => {
      const numeric = (gid: string) => gid.split('/').pop() as string;
      expect(SOLD_OUT_HOODIE_VARIANT_IDS.has(numeric(HOODIE_VARIANT))).toBe(true);
      expect(SOLD_OUT_HOODIE_VARIANT_IDS.has(numeric(TSHIRT_VARIANT))).toBe(false);
      // Every hoodie-* variant in the map is covered.
      for (const [key, gid] of Object.entries(VARIANT_MAP)) {
        if (key.startsWith('hoodie-')) {
          expect(SOLD_OUT_HOODIE_VARIANT_IDS.has(numeric(gid))).toBe(true);
        }
      }
    });
  });

  describe('isSoldOutHoodieLine', () => {
    it('flags a sold-out hoodie line and not a t-shirt line', () => {
      expect(isSoldOutHoodieLine(hoodieLine())).toBe(true);
      expect(isSoldOutHoodieLine(tshirtLine())).toBe(false);
    });
  });

  describe('filterPurchasableLineItems', () => {
    it('strips the sold-out hoodie from a bundle, leaving the t-shirt', () => {
      const filtered = filterPurchasableLineItems([tshirtLine(), hoodieLine()]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].productType).toBe('tshirt');
    });

    it('strips a standalone sold-out hoodie down to nothing', () => {
      expect(filterPurchasableLineItems([hoodieLine()])).toHaveLength(0);
    });

    it('respects an injected sold-out set (decoupled from live config)', () => {
      const emptySet = new Set<string>();
      // With no sold-out variants, nothing is stripped.
      expect(filterPurchasableLineItems([tshirtLine(), hoodieLine()], emptySet)).toHaveLength(2);
    });
  });

  describe('qualifiesForBundleDiscount after filtering (the fix)', () => {
    it('does NOT apply BUNDLE15 to a bundle whose hoodie is sold out (shirt-only result)', () => {
      const purchasable = filterPurchasableLineItems([tshirtLine(), hoodieLine()]);
      expect(qualifiesForBundleDiscount(purchasable)).toBe(false);
    });

    it('does NOT apply BUNDLE15 to standalone t-shirt + standalone (sold-out) hoodie', () => {
      const purchasable = filterPurchasableLineItems([tshirtLine(), hoodieLine()]);
      expect(qualifiesForBundleDiscount(purchasable)).toBe(false);
    });

    it('WOULD still apply BUNDLE15 when the hoodie is purchasable (rule unchanged)', () => {
      // Simulate hoodies back in stock via an empty sold-out set.
      const purchasable = filterPurchasableLineItems([tshirtLine(), hoodieLine()], new Set<string>());
      expect(qualifiesForBundleDiscount(purchasable)).toBe(true);
    });
  });
});
