import {
  itemTypeToR2Type,
  r2TypeToItemType,
  PRINTABLE_ITEM_TYPES,
} from '@/lib/config/printableShared';

describe('printableShared', () => {
  describe('itemTypeToR2Type', () => {
    it('maps tshirt to tshirt-print', () => {
      expect(itemTypeToR2Type('tshirt')).toBe('tshirt-print');
    });

    it('maps hoodie to hoodie-print', () => {
      expect(itemTypeToR2Type('hoodie')).toBe('hoodie-print');
    });

    it('passes through unmapped types', () => {
      expect(itemTypeToR2Type('flyer1')).toBe('flyer1');
      expect(itemTypeToR2Type('button')).toBe('button');
      expect(itemTypeToR2Type('cd-jacket')).toBe('cd-jacket');
    });
  });

  describe('r2TypeToItemType', () => {
    it('maps tshirt-print to tshirt', () => {
      expect(r2TypeToItemType('tshirt-print')).toBe('tshirt');
    });

    it('maps hoodie-print to hoodie', () => {
      expect(r2TypeToItemType('hoodie-print')).toBe('hoodie');
    });

    it('passes through unmapped types', () => {
      expect(r2TypeToItemType('flyer1')).toBe('flyer1');
      expect(r2TypeToItemType('button')).toBe('button');
    });
  });

  describe('PRINTABLE_ITEM_TYPES', () => {
    it('contains all 11 printable types', () => {
      expect(PRINTABLE_ITEM_TYPES).toHaveLength(11);
    });

    it('includes tshirt and hoodie', () => {
      expect(PRINTABLE_ITEM_TYPES).toContain('tshirt');
      expect(PRINTABLE_ITEM_TYPES).toContain('hoodie');
    });
  });
});
