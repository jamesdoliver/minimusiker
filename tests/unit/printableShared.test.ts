import {
  itemTypeToR2Type,
  r2TypeToItemType,
  PRINTABLE_ITEM_TYPES,
  convertItemToPdfConfig,
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

describe('convertItemToPdfConfig', () => {
  it('converts text elements from CSS to PDF coordinates', () => {
    const result = convertItemToPdfConfig({
      type: 'flyer1',
      textElements: [{
        id: 'test-1',
        type: 'headline',
        text: 'Test School',
        position: { x: 100, y: 50 },
        size: { width: 200, height: 40 },
        fontSize: 20,
        color: '#000000',
      }],
      canvasScale: 1,
    });

    expect(result.type).toBe('flyer1');
    expect(result.textElements).toHaveLength(1);
    expect(result.textElements[0].text).toBe('Test School');
    // CSS y=50, height=40, so bottom edge at 90. PDF y = 298 - 90 = 208
    expect(result.textElements[0].y).toBe(208);
    expect(result.textElements[0].x).toBe(100);
  });

  it('clamps invalid canvasScale to safe range', () => {
    const result = convertItemToPdfConfig({
      type: 'flyer1',
      textElements: [{
        id: 'test-1',
        type: 'headline',
        text: 'Test',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 30 },
        fontSize: 14,
        color: '#ff0000',
      }],
      canvasScale: 0.01, // Too small — should clamp to 0.1
    });

    // With scale 0.1: x = 10/0.1 = 100
    expect(result.textElements[0].x).toBe(100);
  });

  it('converts QR position from CSS to PDF coordinates', () => {
    const result = convertItemToPdfConfig({
      type: 'flyer1-back',
      textElements: [],
      qrPosition: { x: 247, y: 99, size: 100 },
      canvasScale: 1,
    });

    expect(result.qrPosition).toBeDefined();
    expect(result.qrPosition!.size).toBe(100);
    // CSS y=99, QR height=100, bottom at 199. PDF y = 298 - 199 = 99
    expect(result.qrPosition!.y).toBe(99);
  });

  it('returns undefined qrPosition when not provided', () => {
    const result = convertItemToPdfConfig({
      type: 'flyer1',
      textElements: [],
      canvasScale: 1,
    });

    expect(result.qrPosition).toBeUndefined();
  });
});
