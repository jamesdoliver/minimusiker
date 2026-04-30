// Mock the Airtable module — importing audioPurchaseAccess pulls in airtableService,
// which top-level requires the `airtable` package. We don't exercise it from the
// pure-helper tests below, but the require chain still needs to resolve cleanly.
jest.mock('airtable', () => {
  const mockTable = jest.fn(() => ({ select: jest.fn(), find: jest.fn() }));
  const mockBase = jest.fn(() => mockTable);
  return jest.fn(() => ({ base: mockBase }));
});

import { AUDIO_PRODUCT_VARIANT_IDS, MINICARD_VARIANT_IDS } from '@/lib/config/shopProfiles';
import { classifyLineItemsAsAudioPurchase } from '@/lib/utils/audioPurchaseAccess';

describe('AUDIO_PRODUCT_VARIANT_IDS', () => {
  it('is a strict superset of MINICARD_VARIANT_IDS (every digital-access variant is also an audio variant)', () => {
    for (const id of MINICARD_VARIANT_IDS) {
      expect(AUDIO_PRODUCT_VARIANT_IDS.has(id)).toBe(true);
    }
  });

  it('includes both Minimusikertag and PLUS CD variants (which MINICARD_VARIANT_IDS does not)', () => {
    expect(AUDIO_PRODUCT_VARIANT_IDS.has('53258098639194')).toBe(true); // Minimusikertag CD
    expect(AUDIO_PRODUCT_VARIANT_IDS.has('53525559771482')).toBe(true); // PLUS CD
    expect(MINICARD_VARIANT_IDS.has('53258098639194')).toBe(false);
    expect(MINICARD_VARIANT_IDS.has('53525559771482')).toBe(false);
  });

  it('contains exactly 8 variants (4 audio products × 2 profiles)', () => {
    expect(AUDIO_PRODUCT_VARIANT_IDS.size).toBe(8);
  });
});

describe('classifyLineItemsAsAudioPurchase (pure helper)', () => {
  // We will export a small pure helper alongside hasAudioPurchaseForEvent
  // that only inspects line items, so we can unit-test it without mocking Airtable.
  it('returns true when any line item variant_id matches AUDIO_PRODUCT_VARIANT_IDS', () => {
    expect(classifyLineItemsAsAudioPurchase([
      { variant_id: 'gid://shopify/ProductVariant/53258098639194', product_title: 'CD', quantity: 1, price: 19, total: 19 },
    ])).toBe(true);
  });

  it('returns true when product_title contains an access-keyword (case-insensitive)', () => {
    expect(classifyLineItemsAsAudioPurchase([
      { variant_id: 'gid://shopify/ProductVariant/0', product_title: 'Custom MiniCard', quantity: 1, price: 0, total: 0 },
    ])).toBe(true);
    expect(classifyLineItemsAsAudioPurchase([
      { variant_id: 'gid://shopify/ProductVariant/0', product_title: 'kinderliederBOX', quantity: 1, price: 0, total: 0 },
    ])).toBe(true);
    expect(classifyLineItemsAsAudioPurchase([
      { variant_id: 'gid://shopify/ProductVariant/0', product_title: 'Tonie - Schul-Edition', quantity: 1, price: 0, total: 0 },
    ])).toBe(true);
  });

  it('returns false when line items contain only T-shirts or hoodies', () => {
    expect(classifyLineItemsAsAudioPurchase([
      { variant_id: 'gid://shopify/ProductVariant/53328491512154', product_title: 'T-Shirt 98/104', quantity: 1, price: 25, total: 25 },
      { variant_id: 'gid://shopify/ProductVariant/53325998948698', product_title: 'Hoodie 116',       quantity: 1, price: 49, total: 49 },
    ])).toBe(false);
  });

  it('returns false on empty / malformed line items', () => {
    expect(classifyLineItemsAsAudioPurchase([])).toBe(false);
    expect(classifyLineItemsAsAudioPurchase(null)).toBe(false);
    expect(classifyLineItemsAsAudioPurchase(undefined)).toBe(false);
  });
});
