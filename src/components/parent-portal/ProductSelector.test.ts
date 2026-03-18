/**
 * Tests for ProductSelector discount compatibility
 * Verifies that the time-based product switching works correctly with discounts
 *
 * NEW LOGIC (Jan 2026):
 * - Personalized clothing: available up to 4 days AFTER event
 * - EARLYBIRD10: applies when more than 19 days before event (early bird deadline)
 * - BUNDLE15: always applies for T-shirt + Hoodie combo
 */

import { canOrderPersonalizedClothing, PERSONALIZED_CLOTHING_CUTOFF_DAYS } from '@/lib/utils/eventTimeline';
import { MINIMUSIKERTAG_PROFILE, resolveShopProfile } from '@/lib/config/shopProfiles';

// Use the variant map from the minimusikertag profile (source of truth)
const SHOPIFY_VARIANT_MAP = MINIMUSIKERTAG_PROFILE.shopifyVariantMap;

// Helper to simulate checkout line item creation (mirrors ProductSelector logic)
function createLineItems(
  showPersonalized: boolean,
  tshirtSize: string,
  hoodieSize: string
): Array<{ variantId: string; quantity: number; productType: 'tshirt' | 'hoodie' }> {
  const variantPrefix = showPersonalized ? 'personalized' : 'standard';
  const lineItems: Array<{ variantId: string; quantity: number; productType: 'tshirt' | 'hoodie' }> = [];

  const tshirtVariantId = SHOPIFY_VARIANT_MAP[`tshirt-${variantPrefix}-${tshirtSize}`];
  if (tshirtVariantId) {
    lineItems.push({ variantId: tshirtVariantId, quantity: 1, productType: 'tshirt' });
  }

  const hoodieVariantId = SHOPIFY_VARIANT_MAP[`hoodie-${variantPrefix}-${hoodieSize}`];
  if (hoodieVariantId) {
    lineItems.push({ variantId: hoodieVariantId, quantity: 1, productType: 'hoodie' });
  }

  return lineItems;
}

// Default early bird deadline: 19 days before event
const EARLY_BIRD_DEADLINE_DAYS = 19;

// Simulate the discount check logic from create-checkout API
// EARLYBIRD10 applies when more than EARLY_BIRD_DEADLINE_DAYS before event
function determineDiscountCodes(
  lineItems: Array<{ productType: string }>,
  daysUntilEvent: number
): string[] {
  const discountCodes: string[] = [];

  // Early-bird check - only applies before early bird deadline
  if (daysUntilEvent > EARLY_BIRD_DEADLINE_DAYS) {
    discountCodes.push('EARLYBIRD10');
  }

  // Bundle check (same logic as API)
  const hasTshirt = lineItems.some(item => item.productType === 'tshirt');
  const hasHoodie = lineItems.some(item => item.productType === 'hoodie');
  if (hasTshirt && hasHoodie) {
    discountCodes.push('BUNDLE15');
  }

  return discountCodes;
}

// Helper to create a date N days from today (local timezone, not UTC)
const daysFromToday = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('ProductSelector Discount Compatibility', () => {
  describe('BUNDLE15 discount', () => {
    it('applies when buying T-shirt + Hoodie with personalized products', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');

      // Verify productType is set correctly
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].productType).toBe('tshirt');
      expect(lineItems[1].productType).toBe('hoodie');

      // Verify discount applies
      const discounts = determineDiscountCodes(lineItems, 25);
      expect(discounts).toContain('BUNDLE15');
    });

    it('applies when buying T-shirt + Hoodie with standard products', () => {
      const lineItems = createLineItems(false, '98/104 (3-4J)', '116 (5-6 J)');

      // Verify productType is set correctly
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].productType).toBe('tshirt');
      expect(lineItems[1].productType).toBe('hoodie');

      // Verify discount applies
      const discounts = determineDiscountCodes(lineItems, 10);
      expect(discounts).toContain('BUNDLE15');
    });

    it('applies even on event day', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, 0);
      expect(discounts).toContain('BUNDLE15');
    });

    it('applies even after event (within personalized window)', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, -3);
      expect(discounts).toContain('BUNDLE15');
    });

    it('uses different variant IDs for personalized vs standard', () => {
      const personalizedItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const standardItems = createLineItems(false, '98/104 (3-4J)', '116 (5-6 J)');

      // Variant IDs should be different
      expect(personalizedItems[0].variantId).not.toBe(standardItems[0].variantId);
      expect(personalizedItems[1].variantId).not.toBe(standardItems[1].variantId);

      // But productType should be the same (for discount compatibility)
      expect(personalizedItems[0].productType).toBe(standardItems[0].productType);
      expect(personalizedItems[1].productType).toBe(standardItems[1].productType);
    });
  });

  describe('EARLYBIRD10 discount', () => {
    it('applies when event is 25 days away (within early bird window)', () => {
      const discounts = determineDiscountCodes([], 25);
      expect(discounts).toContain('EARLYBIRD10');
    });

    it('applies when event is 20 days away (within early bird window)', () => {
      const discounts = determineDiscountCodes([], 20);
      expect(discounts).toContain('EARLYBIRD10');
    });

    it('does NOT apply when event is 19 days away (at deadline)', () => {
      const discounts = determineDiscountCodes([], 19);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('does NOT apply when event is 10 days away (past deadline)', () => {
      const discounts = determineDiscountCodes([], 10);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('does NOT apply on event day', () => {
      const discounts = determineDiscountCodes([], 0);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('does NOT apply after event', () => {
      const discounts = determineDiscountCodes([], -1);
      expect(discounts).not.toContain('EARLYBIRD10');
    });
  });

  describe('Personalized clothing availability', () => {
    it('available when event is in the future', () => {
      expect(canOrderPersonalizedClothing(daysFromToday(10))).toBe(true);
      expect(canOrderPersonalizedClothing(daysFromToday(1))).toBe(true);
    });

    it('available on event day', () => {
      expect(canOrderPersonalizedClothing(daysFromToday(0))).toBe(true);
    });

    it('available up to 4 days after event', () => {
      expect(canOrderPersonalizedClothing(daysFromToday(-1))).toBe(true);
      expect(canOrderPersonalizedClothing(daysFromToday(-2))).toBe(true);
      expect(canOrderPersonalizedClothing(daysFromToday(-3))).toBe(true);
      expect(canOrderPersonalizedClothing(daysFromToday(-4))).toBe(true);
    });

    it('NOT available 5+ days after event', () => {
      expect(canOrderPersonalizedClothing(daysFromToday(-5))).toBe(false);
      expect(canOrderPersonalizedClothing(daysFromToday(-10))).toBe(false);
    });

    it('uses PERSONALIZED_CLOTHING_CUTOFF_DAYS = -4', () => {
      expect(PERSONALIZED_CLOTHING_CUTOFF_DAYS).toBe(-4);
    });
  });

  describe('Combined discounts', () => {
    it('applies both EARLYBIRD10 and BUNDLE15 for bundle purchase within early bird window', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, 25);

      expect(discounts).toContain('EARLYBIRD10');
      expect(discounts).toContain('BUNDLE15');
      expect(discounts).toHaveLength(2);
    });

    it('applies only BUNDLE15 when past early bird deadline', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, 10);

      expect(discounts).not.toContain('EARLYBIRD10');
      expect(discounts).toContain('BUNDLE15');
      expect(discounts).toHaveLength(1);
    });

    it('applies only BUNDLE15 on event day', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, 0);

      expect(discounts).not.toContain('EARLYBIRD10');
      expect(discounts).toContain('BUNDLE15');
      expect(discounts).toHaveLength(1);
    });

    it('applies only BUNDLE15 after event', () => {
      const lineItems = createLineItems(true, '98/104 (3-4J)', '116 (5-6 J)');
      const discounts = determineDiscountCodes(lineItems, -3);

      expect(discounts).not.toContain('EARLYBIRD10');
      expect(discounts).toContain('BUNDLE15');
      expect(discounts).toHaveLength(1);
    });
  });

  describe('Business scenarios', () => {
    it('Scenario: Event 25 days away - personalized + EARLYBIRD10', () => {
      const eventDate = daysFromToday(25);
      const daysUntilEvent = 25;

      expect(canOrderPersonalizedClothing(eventDate)).toBe(true);

      const discounts = determineDiscountCodes([], daysUntilEvent);
      expect(discounts).toContain('EARLYBIRD10');
    });

    it('Scenario: Event 10 days away - personalized + NO EARLYBIRD10 (past deadline)', () => {
      const eventDate = daysFromToday(10);
      const daysUntilEvent = 10;

      expect(canOrderPersonalizedClothing(eventDate)).toBe(true);

      const discounts = determineDiscountCodes([], daysUntilEvent);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('Scenario: Event today - personalized + NO EARLYBIRD10', () => {
      const eventDate = daysFromToday(0);
      const daysUntilEvent = 0;

      expect(canOrderPersonalizedClothing(eventDate)).toBe(true);

      const discounts = determineDiscountCodes([], daysUntilEvent);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('Scenario: Event 3 days ago - personalized + NO EARLYBIRD10', () => {
      const eventDate = daysFromToday(-3);
      const daysUntilEvent = -3;

      expect(canOrderPersonalizedClothing(eventDate)).toBe(true);

      const discounts = determineDiscountCodes([], daysUntilEvent);
      expect(discounts).not.toContain('EARLYBIRD10');
    });

    it('Scenario: Event 5+ days ago - standard products + NO EARLYBIRD10', () => {
      const eventDate = daysFromToday(-5);
      const daysUntilEvent = -5;

      expect(canOrderPersonalizedClothing(eventDate)).toBe(false);

      const discounts = determineDiscountCodes([], daysUntilEvent);
      expect(discounts).not.toContain('EARLYBIRD10');
    });
  });
});

describe('resolveShopProfile', () => {
  it('returns minimusikertag for default flags', () => {
    const profile = resolveShopProfile({ isMinimusikertag: true });
    expect(profile.profileType).toBe('minimusikertag');
  });

  it('returns plus when isPlus is true', () => {
    const profile = resolveShopProfile({ isPlus: true, isMinimusikertag: true });
    expect(profile.profileType).toBe('plus');
    expect(profile.shopifyTagFilter).toBe('PLUS');
  });

  it('returns schulsong-only when isSchulsong=true and isMinimusikertag=false', () => {
    const profile = resolveShopProfile({ isSchulsong: true, isMinimusikertag: false });
    expect(profile.profileType).toBe('schulsong-only');
    expect(profile.audioProducts).toHaveLength(0);
  });

  it('returns minimusikertag (not schulsong-only) when both isSchulsong and isMinimusikertag are true', () => {
    const profile = resolveShopProfile({ isSchulsong: true, isMinimusikertag: true });
    expect(profile.profileType).toBe('minimusikertag');
    expect(profile.audioProducts.length).toBeGreaterThan(0);
  });

  it('schulsong-only takes priority over plus', () => {
    const profile = resolveShopProfile({ isPlus: true, isSchulsong: true, isMinimusikertag: false });
    expect(profile.profileType).toBe('schulsong-only');
  });
});
