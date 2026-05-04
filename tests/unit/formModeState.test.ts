import {
  emptyFormModeState,
  mergeFieldRender,
  type FormModeFieldOverride,
  type FieldRender,
} from '@/lib/config/formModeState';
import type { PrintableFieldDef } from '@/lib/config/printableFields';

const textField: PrintableFieldDef = {
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

const qrField: PrintableFieldDef = {
  key: 'qr-code',
  label: 'QR code',
  kind: 'qr',
  defaultPosition: { x: 200, y: 100 },
  defaultSize: { width: 100, height: 100 },
  draggable: true,
  source: { type: 'computed', name: 'qrUrl' },
};

const dateField: PrintableFieldDef = {
  key: 'discount-end-date',
  label: 'Discount end date',
  kind: 'date',
  defaultPosition: { x: 500, y: 250 },
  defaultSize: { width: 70, height: 14 },
  defaultFontSize: 12,
  defaultFontFamily: 'fredoka',
  defaultColor: '#000000',
  draggable: true,
  source: { type: 'computed', name: 'earlyBirdDeadline' },
};

describe('emptyFormModeState', () => {
  it('returns an empty object for any field list', () => {
    expect(emptyFormModeState([textField, qrField])).toEqual({});
  });
});

describe('mergeFieldRender — text field', () => {
  it('uses defaults + resolved value when no override', () => {
    const render = mergeFieldRender(textField, undefined, { kind: 'text', text: 'Am 02.06.2026 in der Lindenschule' });
    expect(render).toEqual<FieldRender>({
      key: 'event-date-location',
      kind: 'text',
      text: 'Am 02.06.2026 in der Lindenschule',
      url: undefined,
      position: { x: 100, y: 50 },
      size: { width: 200, height: 40 },
      fontSize: 18,
      fontFamily: 'fredoka',
      color: '#000000',
    });
  });

  it('applies a text override when textOverridden is true', () => {
    const override: FormModeFieldOverride = { text: 'Custom text', textOverridden: true };
    const render = mergeFieldRender(textField, override, { kind: 'text', text: 'Resolved' });
    expect(render.text).toBe('Custom text');
  });

  it('ignores text override when textOverridden is false/undefined', () => {
    const override: FormModeFieldOverride = { text: 'Stale value' };
    const render = mergeFieldRender(textField, override, { kind: 'text', text: 'Resolved' });
    expect(render.text).toBe('Resolved');
  });

  it('applies a position override', () => {
    const override: FormModeFieldOverride = { position: { x: 1, y: 2 } };
    const render = mergeFieldRender(textField, override, { kind: 'text', text: 'x' });
    expect(render.position).toEqual({ x: 1, y: 2 });
  });

  it('applies size, fontSize, fontFamily, color overrides individually', () => {
    const override: FormModeFieldOverride = {
      size: { width: 300, height: 60 },
      fontSize: 24,
      fontFamily: 'springwood-display',
      color: '#FF0000',
    };
    const render = mergeFieldRender(textField, override, { kind: 'text', text: 'x' });
    expect(render.size).toEqual({ width: 300, height: 60 });
    expect(render.fontSize).toBe(24);
    expect(render.fontFamily).toBe('springwood-display');
    expect(render.color).toBe('#FF0000');
  });
});

describe('mergeFieldRender — date field', () => {
  it('treats date kind like text (uses resolved.text)', () => {
    const render = mergeFieldRender(dateField, undefined, { kind: 'date', text: '15.05.2026' });
    expect(render.kind).toBe('date');
    expect(render.text).toBe('15.05.2026');
    expect(render.url).toBeUndefined();
  });

  it('admin can override the date text', () => {
    const override: FormModeFieldOverride = { text: '01.01.2026', textOverridden: true };
    const render = mergeFieldRender(dateField, override, { kind: 'date', text: '15.05.2026' });
    expect(render.text).toBe('01.01.2026');
  });
});

describe('mergeFieldRender — qr field', () => {
  it('uses url from resolved value', () => {
    const render = mergeFieldRender(qrField, undefined, { kind: 'qr', url: 'https://minimusiker.app/e/112' });
    expect(render.kind).toBe('qr');
    expect(render.url).toBe('https://minimusiker.app/e/112');
    expect(render.text).toBeUndefined();
    expect(render.position).toEqual({ x: 200, y: 100 });
    expect(render.size).toEqual({ width: 100, height: 100 });
  });

  it('does not apply text override to qr field', () => {
    const override: FormModeFieldOverride = { text: 'ignored', textOverridden: true };
    const render = mergeFieldRender(qrField, override, { kind: 'qr', url: 'https://x' });
    expect(render.text).toBeUndefined();
    expect(render.url).toBe('https://x');
  });

  it('applies position override on qr field', () => {
    const override: FormModeFieldOverride = { position: { x: 50, y: 60 } };
    const render = mergeFieldRender(qrField, override, { kind: 'qr', url: 'https://x' });
    expect(render.position).toEqual({ x: 50, y: 60 });
  });
});
