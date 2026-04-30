import { AUDIO_PRODUCT_VARIANT_IDS, MINICARD_VARIANT_IDS } from '@/lib/config/shopProfiles';

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
  it.todo('returns true when any line item variant_id matches AUDIO_PRODUCT_VARIANT_IDS');
  it.todo('returns true when product_title contains "minicard" / "cd" / "kinderliederbox" / "tonie" (case-insensitive)');
  it.todo('returns false when line items contain only T-shirts or hoodies');
  it.todo('returns false on empty / malformed line items');
});
