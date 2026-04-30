import { getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { PRINTABLE_ITEM_TYPES } from '@/lib/config/printableShared';

describe('getFieldRegistry', () => {
  it('returns null for every item type while no items are migrated', () => {
    for (const t of PRINTABLE_ITEM_TYPES) {
      expect(getFieldRegistry(t)).toBeNull();
    }
  });

  it('returns null for an unknown item type without throwing', () => {
    // @ts-expect-error - intentionally invalid for runtime safety check
    expect(getFieldRegistry('not-a-real-type')).toBeNull();
  });
});
