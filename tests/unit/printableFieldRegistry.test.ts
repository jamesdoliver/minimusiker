import { getFieldRegistry, hasFormMode } from '@/lib/config/printableFieldRegistry';
import { PRINTABLE_ITEM_TYPES } from '@/lib/config/printableShared';
import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer1';
import { FLYER2_FIELDS, FLYER2_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer2';
import { FLYER3_FIELDS } from '@/lib/config/printableFieldRegistries/flyer3';
import { MINICARD_FIELDS } from '@/lib/config/printableFieldRegistries/minicard';
import { CD_JACKET_FIELDS } from '@/lib/config/printableFieldRegistries/cd-jacket';

describe('getFieldRegistry', () => {
  it('returns FLYER1_FIELDS for flyer1', () => {
    expect(getFieldRegistry('flyer1')).toBe(FLYER1_FIELDS);
  });

  it('returns FLYER1_BACK_FIELDS for flyer1-back', () => {
    expect(getFieldRegistry('flyer1-back')).toBe(FLYER1_BACK_FIELDS);
  });

  it('returns FLYER2_FIELDS for flyer2', () => {
    expect(getFieldRegistry('flyer2')).toBe(FLYER2_FIELDS);
  });

  it('returns FLYER2_BACK_FIELDS for flyer2-back', () => {
    expect(getFieldRegistry('flyer2-back')).toBe(FLYER2_BACK_FIELDS);
  });

  it('returns FLYER3_FIELDS for flyer3', () => {
    expect(getFieldRegistry('flyer3')).toBe(FLYER3_FIELDS);
  });

  it('returns MINICARD_FIELDS for minicard', () => {
    expect(getFieldRegistry('minicard')).toBe(MINICARD_FIELDS);
  });

  it('returns CD_JACKET_FIELDS for cd-jacket', () => {
    expect(getFieldRegistry('cd-jacket')).toBe(CD_JACKET_FIELDS);
  });

  it('returns null for not-yet-migrated items', () => {
    const stillLegacy: typeof PRINTABLE_ITEM_TYPES[number][] = [
      'tshirt', 'hoodie', 'button',
      'flyer3-back',
    ];
    for (const t of stillLegacy) {
      expect(getFieldRegistry(t)).toBeNull();
    }
  });

  it('returns null for an unknown item type without throwing', () => {
    // @ts-expect-error - intentionally invalid for runtime safety check
    expect(getFieldRegistry('not-a-real-type')).toBeNull();
  });
});

describe('hasFormMode', () => {
  it('returns true for flyer1, flyer1-back, flyer2, flyer2-back, flyer3, minicard, cd-jacket', () => {
    expect(hasFormMode('flyer1')).toBe(true);
    expect(hasFormMode('flyer1-back')).toBe(true);
    expect(hasFormMode('flyer2')).toBe(true);
    expect(hasFormMode('flyer2-back')).toBe(true);
    expect(hasFormMode('flyer3')).toBe(true);
    expect(hasFormMode('minicard')).toBe(true);
    expect(hasFormMode('cd-jacket')).toBe(true);
  });

  it('returns false for legacy items', () => {
    expect(hasFormMode('tshirt')).toBe(false);
    expect(hasFormMode('button')).toBe(false);
    expect(hasFormMode('flyer3-back')).toBe(false);
  });
});
