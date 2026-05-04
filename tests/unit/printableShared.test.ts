import {
  itemTypeToR2Type,
  r2TypeToItemType,
  PRINTABLE_ITEM_TYPES,
  convertItemToPdfConfig,
  PRINTABLE_TAB_GROUPS,
  itemTab,
  isPartialType,
  stripPartialSuffix,
  type PrintableTab,
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
    it('contains all 10 printable types', () => {
      expect(PRINTABLE_ITEM_TYPES).toHaveLength(10);
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

describe('PRINTABLE_TAB_GROUPS', () => {
  it('lists all 10 item types across the three tabs without overlap', () => {
    const all = [
      ...PRINTABLE_TAB_GROUPS.papersPreEvent,
      ...PRINTABLE_TAB_GROUPS.papersPostEvent,
      ...PRINTABLE_TAB_GROUPS.clothing,
    ];
    expect(new Set(all).size).toBe(all.length); // no overlap
    expect(all.length).toBe(10);
  });

  it('papersPreEvent contains flyer1 + flyer2 (front + back) + flyer3 (single-sided)', () => {
    expect(PRINTABLE_TAB_GROUPS.papersPreEvent).toEqual([
      'flyer1', 'flyer1-back',
      'flyer2', 'flyer2-back',
      'flyer3',
    ]);
  });

  it('papersPostEvent contains minicard, cd-jacket', () => {
    expect(PRINTABLE_TAB_GROUPS.papersPostEvent).toEqual([
      'minicard', 'cd-jacket',
    ]);
  });

  it('clothing contains tshirt, hoodie, button (in that order)', () => {
    expect(PRINTABLE_TAB_GROUPS.clothing).toEqual(['tshirt', 'hoodie', 'button']);
  });

  it('contains exactly the same items as PRINTABLE_ITEM_TYPES (set equality)', () => {
    const tabsAll = [
      ...PRINTABLE_TAB_GROUPS.papersPreEvent,
      ...PRINTABLE_TAB_GROUPS.papersPostEvent,
      ...PRINTABLE_TAB_GROUPS.clothing,
    ];
    expect(new Set(tabsAll)).toEqual(new Set(PRINTABLE_ITEM_TYPES));
  });
});

describe('itemTab', () => {
  it('returns "papersPreEvent" for flyer1, flyer2, flyer3', () => {
    expect(itemTab('flyer1')).toBe('papersPreEvent' as PrintableTab);
    expect(itemTab('flyer2')).toBe('papersPreEvent' as PrintableTab);
    expect(itemTab('flyer1-back')).toBe('papersPreEvent' as PrintableTab);
    expect(itemTab('flyer3')).toBe('papersPreEvent' as PrintableTab);
  });

  it('returns "papersPostEvent" for minicard, cd-jacket', () => {
    expect(itemTab('minicard')).toBe('papersPostEvent' as PrintableTab);
    expect(itemTab('cd-jacket')).toBe('papersPostEvent' as PrintableTab);
  });

  it('returns "clothing" for tshirt, hoodie, button', () => {
    expect(itemTab('tshirt')).toBe('clothing' as PrintableTab);
    expect(itemTab('hoodie')).toBe('clothing' as PrintableTab);
    expect(itemTab('button')).toBe('clothing' as PrintableTab);
  });
});

import { convertFormModeItemToPdfConfig } from '@/lib/config/printableShared';
import type { PrintableFieldDef } from '@/lib/config/printableFields';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';
import type { FormModeItemState } from '@/lib/config/formModeState';

describe('convertFormModeItemToPdfConfig', () => {
  const booking: ResolverBooking = {
    schoolName: 'Lindenschule',
    bookingDate: '2026-06-02',
    accessCode: 112,
    isKita: false,
  };

  const eventDateLocationField: PrintableFieldDef = {
    key: 'event-date-location',
    label: 'Event date + location',
    kind: 'text',
    defaultPosition: { x: 100, y: 50 },
    defaultSize: { width: 200, height: 40 },
    defaultFontSize: 18,
    defaultFontFamily: 'fredoka',
    defaultColor: '#000000',
    draggable: true,
    source: { type: 'computed', name: 'eventDateLocation' },
  };

  it('produces a PrintableItemConfig with one text element using the resolved value', () => {
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields: [eventDateLocationField],
      state: {},
      booking,
    });
    expect(result.type).toBe('flyer1-partial');
    expect(result.textElements).toHaveLength(1);
    expect(result.textElements[0].text).toBe('Am 02.06.2026 in der\nLindenschule');
    expect(result.textElements[0].fontFamily).toBe('fredoka');
    expect(result.textElements[0].color).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('admin override replaces the resolved text', () => {
    const state: FormModeItemState = {
      'event-date-location': { text: 'CUSTOM', textOverridden: true },
    };
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields: [eventDateLocationField],
      state,
      booking,
    });
    expect(result.textElements[0].text).toBe('CUSTOM');
  });

  it('admin position override is applied (CSS coordinates flipped to PDF)', () => {
    const state: FormModeItemState = {
      'event-date-location': { position: { x: 0, y: 0 } },
    };
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields: [eventDateLocationField],
      state,
      booking,
    });
    // CSS y=0, height=40 → bottom edge at 40. PDF y = pdfHeight(298) - 40 = 258.
    expect(result.textElements[0].x).toBe(0);
    expect(result.textElements[0].y).toBe(258);
  });

  it('handles a qr field', () => {
    const qrField: PrintableFieldDef = {
      key: 'qr',
      label: 'QR',
      kind: 'qr',
      defaultPosition: { x: 200, y: 100 },
      defaultSize: { width: 100, height: 100 },
      draggable: true,
      source: { type: 'computed', name: 'qrUrl' },
    };
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1-back',
      fields: [qrField],
      state: {},
      booking,
    });
    expect(result.type).toBe('flyer1-back-partial');
    expect(result.qrPosition).toBeDefined();
    expect(result.qrPosition?.size).toBe(100);
    expect(result.textElements).toHaveLength(0);
  });

  it('skips text fields with empty resolved value (no override)', () => {
    const customTextField: PrintableFieldDef = {
      key: 'discount-end',
      label: 'Discount',
      kind: 'date',
      defaultPosition: { x: 0, y: 0 },
      defaultSize: { width: 50, height: 14 },
      defaultFontSize: 12,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'earlyBirdDeadline' },
    };
    // Booking with empty bookingDate → earlyBirdDeadline returns ''.
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields: [customTextField],
      state: {},
      booking: { ...booking, bookingDate: '' },
    });
    expect(result.textElements).toHaveLength(0);
  });

  it('passes through optional EventTimelineOverrides to the resolver', () => {
    const earlyBirdField: PrintableFieldDef = {
      key: 'eb',
      label: 'EB',
      kind: 'date',
      defaultPosition: { x: 0, y: 0 },
      defaultSize: { width: 70, height: 14 },
      defaultFontSize: 12,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'earlyBirdDeadline' },
    };
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields: [earlyBirdField],
      state: {},
      booking,
      overrides: { early_bird_deadline_days: 10 },
    });
    // 2026-06-02 minus 10 days = 23.05.2026
    expect(result.textElements[0].text).toBe('23.05.2026');
  });
});

describe('isPartialType / stripPartialSuffix', () => {
  it('isPartialType detects the -partial suffix', () => {
    expect(isPartialType('flyer1-partial')).toBe(true);
    expect(isPartialType('flyer1')).toBe(false);
    expect(isPartialType('flyer1-back-partial')).toBe(true);
  });

  it('stripPartialSuffix removes -partial; passthrough otherwise', () => {
    expect(stripPartialSuffix('flyer1-partial')).toBe('flyer1');
    expect(stripPartialSuffix('flyer1-back-partial')).toBe('flyer1-back');
    expect(stripPartialSuffix('flyer2')).toBe('flyer2');
  });
});
