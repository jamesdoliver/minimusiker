# Confirm Printables Revamp — Phase −1: Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lay the type, registry, resolver, UI tab, and editor-routing infrastructure that lets later phases (0–4) migrate one printable item at a time from the legacy free-form drag editor to a form-driven flow built around the new partially-blank PDF templates — all without changing any current item's behavior.

**Architecture:**
- A new **field registry** (`PrintableFieldDef[]` per item type) declares the overlay fields for each item: position, size, font, source. Items not yet migrated return `null` from the registry lookup, falling through to the legacy editor.
- A new **resolver** maps a `BookingWithDetails` + item type to default field values (school name, formatted dates, QR URL, "Schule"/"KiTa" word swap, early-bird deadline = `eventDate − getThreshold('early_bird_deadline_days')`).
- The wizard splits items into a **Papers** tab (flyer1/2/3 + their backs, minicard, cd-jacket — the items that will migrate) and a **Clothing** tab (tshirt, hoodie, button — staying legacy). Tab state is part of the modal; step navigation is scoped to the active tab.
- A scaffold component **`PrintableFormEditor`** is added that, for now, renders the existing legacy editor. Phase 0 fills in the form-mode rendering for Flyer 1.

After this phase merges: zero behavior change for users; all current draggable flows still work; the wizard simply has two tabs grouping the items.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Jest, existing `printableShared.ts` / `printableTextConfig.ts` / `eventTimeline.ts` / `eventThresholds.ts`.

**Compressed templates already in place:** `public/printables/Flyers (MiniMusiker)/_compressed/{flyer1,flyer2,flyer3,minicards,cd-booklet}-partial.pdf` (regenerable with `scripts/compress-printable-templates.sh`). They are not consumed in this phase.

---

## Tab assignments

| Tab | Item types |
|---|---|
| Papers (will migrate to form-mode) | `flyer1`, `flyer1-back`, `flyer2`, `flyer2-back`, `flyer3`, `flyer3-back`, `minicard`, `cd-jacket` |
| Clothing (stays legacy) | `tshirt`, `hoodie`, `button` |

Order within Papers matches the existing wizard order. Clothing keeps tshirt → hoodie → button.

---

## Task 1: Define `PrintableFieldDef` types

**Files:**
- Create: `src/lib/config/printableFields.ts`
- Test: `tests/unit/printableFields.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/printableFields.test.ts`:

```typescript
import type {
  PrintableFieldDef,
  PrintableFieldKind,
  PrintableFieldSource,
  ResolvedFieldValue,
} from '@/lib/config/printableFields';

describe('printableFields types', () => {
  it('PrintableFieldDef compiles with all field kinds', () => {
    const text: PrintableFieldDef = {
      key: 'event-headline',
      label: 'Event headline',
      kind: 'text',
      defaultPosition: { x: 50, y: 100 },
      defaultSize: { width: 250, height: 50 },
      defaultFontSize: 18,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'eventDateLocation' },
    };
    const qr: PrintableFieldDef = {
      key: 'qr',
      label: 'QR code',
      kind: 'qr',
      defaultPosition: { x: 200, y: 100 },
      defaultSize: { width: 100, height: 100 },
      draggable: true,
      source: { type: 'computed', name: 'qrUrl' },
    };
    const dateField: PrintableFieldDef = {
      key: 'discount-end',
      label: 'Discount end date',
      kind: 'date',
      defaultPosition: { x: 480, y: 240 },
      defaultSize: { width: 90, height: 20 },
      defaultFontSize: 14,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'earlyBirdDeadline' },
    };

    expect([text.kind, qr.kind, dateField.kind]).toEqual(['text', 'qr', 'date']);
  });

  it('ResolvedFieldValue carries text/url/date depending on kind', () => {
    const t: ResolvedFieldValue = { kind: 'text', text: 'hello' };
    const q: ResolvedFieldValue = { kind: 'qr', url: 'https://x' };
    const d: ResolvedFieldValue = { kind: 'date', text: '15.05.2026' };
    expect([t.kind, q.kind, d.kind]).toEqual(['text', 'qr', 'date']);
  });

  it('PrintableFieldKind is the discriminator union', () => {
    const k: PrintableFieldKind = 'text';
    expect(['text', 'qr', 'date']).toContain(k);
  });

  it('PrintableFieldSource supports static and computed', () => {
    const a: PrintableFieldSource = { type: 'static', value: 'literal' };
    const b: PrintableFieldSource = { type: 'computed', name: 'schoolName' };
    expect([a.type, b.type]).toEqual(['static', 'computed']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/printableFields.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '@/lib/config/printableFields'".

**Step 3: Implement the types**

Create `src/lib/config/printableFields.ts`:

```typescript
import type { FontFamily } from './printableTextConfig';

export type PrintableFieldKind = 'text' | 'qr' | 'date';

/**
 * Where the default value for a field comes from.
 * - static: literal string baked into the registry
 * - computed: derived from the booking by the resolver (`name` selects which derivation)
 */
export type PrintableFieldSource =
  | { type: 'static'; value: string }
  | { type: 'computed'; name: ComputedFieldName };

/**
 * Names of computed values the resolver knows how to produce. Adding a new
 * source here is the contract: the resolver must implement it.
 */
export type ComputedFieldName =
  | 'schoolName'
  | 'eventDateLocation'   // "Am DD.MM.YYYY in der {schoolName}"
  | 'schuleOrKita'        // "Schule" | "KiTa"
  | 'qrUrl'               // "minimusiker.app/e/{accessCode}" (or full https://)
  | 'earlyBirdDeadline';  // "DD.MM.YYYY" (eventDate - threshold days)

export interface PrintableFieldDef {
  /** Stable key used to address this field in saved state. Unique per item type. */
  key: string;
  /** Human-readable label shown in the form UI. */
  label: string;
  kind: PrintableFieldKind;
  /** Default position in CSS pixels at canvasScale = 1. */
  defaultPosition: { x: number; y: number };
  /** Default size in CSS pixels at canvasScale = 1. */
  defaultSize: { width: number; height: number };
  /** For text/date kinds. */
  defaultFontSize?: number;
  defaultFontFamily?: FontFamily;
  defaultColor?: string;
  /** When false, the form UI hides the position handle and the canvas shows the field as a non-draggable badge. */
  draggable: boolean;
  source: PrintableFieldSource;
}

export type ResolvedFieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'qr'; url: string }
  | { kind: 'date'; text: string };

/** Map of fieldKey -> resolved default value for one item. */
export type ResolvedFieldValues = Record<string, ResolvedFieldValue>;
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/printableFields.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 4 tests.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

**Step 6: Commit**

```bash
git add src/lib/config/printableFields.ts tests/unit/printableFields.test.ts
git commit -m "feat(printables): add PrintableFieldDef types for form-mode foundation"
```

---

## Task 2: Build the per-item field registry mechanism

**Files:**
- Create: `src/lib/config/printableFieldRegistry.ts`
- Test: `tests/unit/printableFieldRegistry.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/printableFieldRegistry.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/printableFieldRegistry.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '@/lib/config/printableFieldRegistry'".

**Step 3: Implement the registry**

Create `src/lib/config/printableFieldRegistry.ts`:

```typescript
import type { PrintableItemType } from './printableTextConfig';
import type { PrintableFieldDef } from './printableFields';

/**
 * Per-item field definitions. An item present here uses the form-mode editor;
 * an item absent here (or mapped to null) falls through to the legacy
 * draggable editor. Phase 0+ adds entries one item at a time.
 */
const REGISTRIES: Partial<Record<PrintableItemType, PrintableFieldDef[]>> = {
  // Intentionally empty in Phase -1.
};

export function getFieldRegistry(itemType: PrintableItemType): PrintableFieldDef[] | null {
  return REGISTRIES[itemType] ?? null;
}

export function hasFormMode(itemType: PrintableItemType): boolean {
  return getFieldRegistry(itemType) !== null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/printableFieldRegistry.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 2 tests.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

**Step 6: Commit**

```bash
git add src/lib/config/printableFieldRegistry.ts tests/unit/printableFieldRegistry.test.ts
git commit -m "feat(printables): add empty field registry with hasFormMode lookup"
```

---

## Task 3: Resolver — `schoolName` source

**Files:**
- Create: `src/lib/config/printableFieldResolver.ts`
- Test: `tests/unit/printableFieldResolver.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/printableFieldResolver.test.ts`:

```typescript
import { resolveFieldValues, type ResolverBooking } from '@/lib/config/printableFieldResolver';
import type { PrintableFieldDef } from '@/lib/config/printableFields';

const baseBooking: ResolverBooking = {
  schoolName: 'Lindenschule Halle',
  bookingDate: '2026-06-02',
  accessCode: 112,
  isKita: false,
};

describe('resolveFieldValues', () => {
  it('returns empty object when given an empty registry', () => {
    expect(resolveFieldValues([], baseBooking)).toEqual({});
  });

  it('resolves a static text field to its literal value', () => {
    const fields: PrintableFieldDef[] = [
      {
        key: 'tagline',
        label: 'Tagline',
        kind: 'text',
        defaultPosition: { x: 0, y: 0 },
        defaultSize: { width: 0, height: 0 },
        draggable: false,
        source: { type: 'static', value: 'Hallo' },
      },
    ];
    expect(resolveFieldValues(fields, baseBooking)).toEqual({
      tagline: { kind: 'text', text: 'Hallo' },
    });
  });

  it('resolves computed.schoolName to booking.schoolName', () => {
    const fields: PrintableFieldDef[] = [
      {
        key: 'shirt-label',
        label: 'Shirt label',
        kind: 'text',
        defaultPosition: { x: 0, y: 0 },
        defaultSize: { width: 0, height: 0 },
        draggable: true,
        source: { type: 'computed', name: 'schoolName' },
      },
    ];
    expect(resolveFieldValues(fields, baseBooking)).toEqual({
      'shirt-label': { kind: 'text', text: 'Lindenschule Halle' },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '@/lib/config/printableFieldResolver'".

**Step 3: Implement the resolver (just enough for these tests)**

Create `src/lib/config/printableFieldResolver.ts`:

```typescript
import type { EventTimelineOverrides } from '@/lib/utils/eventThresholds';
import type {
  PrintableFieldDef,
  ResolvedFieldValue,
  ResolvedFieldValues,
  ComputedFieldName,
} from './printableFields';

/**
 * Minimal booking shape needed by the resolver. Real callers pass a
 * BookingWithDetails (which is structurally compatible).
 */
export interface ResolverBooking {
  schoolName: string;
  bookingDate: string;        // ISO date (YYYY-MM-DD) or empty
  accessCode?: number;
  isKita?: boolean;
  /** Per-event timeline overrides parsed from Airtable. Optional. */
  timelineOverrides?: EventTimelineOverrides | null;
}

export function resolveFieldValues(
  fields: PrintableFieldDef[],
  booking: ResolverBooking,
): ResolvedFieldValues {
  const out: ResolvedFieldValues = {};
  for (const field of fields) {
    out[field.key] = resolveOne(field, booking);
  }
  return out;
}

function resolveOne(field: PrintableFieldDef, booking: ResolverBooking): ResolvedFieldValue {
  if (field.source.type === 'static') {
    return wrap(field, field.source.value);
  }
  return wrap(field, resolveComputed(field.source.name, booking));
}

function wrap(field: PrintableFieldDef, raw: string): ResolvedFieldValue {
  switch (field.kind) {
    case 'qr':
      return { kind: 'qr', url: raw };
    case 'date':
      return { kind: 'date', text: raw };
    case 'text':
    default:
      return { kind: 'text', text: raw };
  }
}

function resolveComputed(name: ComputedFieldName, booking: ResolverBooking): string {
  switch (name) {
    case 'schoolName':
      return booking.schoolName ?? '';
    // Other computed sources implemented in later tasks.
    default:
      return '';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): add field resolver with schoolName + static sources"
```

---

## Task 4: Resolver — `schuleOrKita` word swap

**Files:**
- Modify: `src/lib/config/printableFieldResolver.ts`
- Modify: `tests/unit/printableFieldResolver.test.ts`

**Step 1: Add the failing test**

Append to `tests/unit/printableFieldResolver.test.ts`:

```typescript
describe('resolveFieldValues — schuleOrKita', () => {
  const field: PrintableFieldDef = {
    key: 'school-or-kita',
    label: 'Institution word',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: false,
    source: { type: 'computed', name: 'schuleOrKita' },
  };

  it('returns "Schule" when isKita is false', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: false })).toEqual({
      'school-or-kita': { kind: 'text', text: 'Schule' },
    });
  });

  it('returns "KiTa" when isKita is true', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: true })).toEqual({
      'school-or-kita': { kind: 'text', text: 'KiTa' },
    });
  });

  it('returns "Schule" when isKita is undefined (default)', () => {
    const { isKita: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      'school-or-kita': { kind: 'text', text: 'Schule' },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -8`
Expected: 3 new tests fail (resolved to empty string instead of "Schule"/"KiTa").

**Step 3: Implement the source**

In `src/lib/config/printableFieldResolver.ts`, extend `resolveComputed`:

```typescript
function resolveComputed(name: ComputedFieldName, booking: ResolverBooking): string {
  switch (name) {
    case 'schoolName':
      return booking.schoolName ?? '';
    case 'schuleOrKita':
      return booking.isKita ? 'KiTa' : 'Schule';
    default:
      return '';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): resolve schuleOrKita source from booking.isKita"
```

---

## Task 5: Resolver — `qrUrl` source

**Files:**
- Modify: `src/lib/config/printableFieldResolver.ts`
- Modify: `tests/unit/printableFieldResolver.test.ts`

**Step 1: Add the failing test**

Append to `tests/unit/printableFieldResolver.test.ts`:

```typescript
describe('resolveFieldValues — qrUrl', () => {
  const field: PrintableFieldDef = {
    key: 'qr',
    label: 'QR code',
    kind: 'qr',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  };

  it('builds the canonical short URL from accessCode', () => {
    expect(resolveFieldValues([field], { ...baseBooking, accessCode: 112 })).toEqual({
      qr: { kind: 'qr', url: 'https://minimusiker.app/e/112' },
    });
  });

  it('returns an empty url when accessCode is missing', () => {
    const { accessCode: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      qr: { kind: 'qr', url: '' },
    });
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -8`
Expected: 2 new failures.

**Step 3: Implement**

In `src/lib/config/printableFieldResolver.ts`, extend `resolveComputed`:

```typescript
case 'qrUrl':
  return booking.accessCode ? `https://minimusiker.app/e/${booking.accessCode}` : '';
```

**Step 4: Run to verify it passes**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 8 tests.

**Step 5: Commit**

```bash
git add src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): resolve qrUrl source to canonical minimusiker.app/e/<code>"
```

---

## Task 6: Resolver — `eventDateLocation` source

The expected output is exactly: `"Am DD.MM.YYYY in der {schoolName}"`. This matches what the filled examples show ("Am 02.06.2026 in der Lindenschule" / "Am 12.05.2026 in der FZ Mattiswald"). Admin can edit afterwards.

**Files:**
- Modify: `src/lib/config/printableFieldResolver.ts`
- Modify: `tests/unit/printableFieldResolver.test.ts`

**Step 1: Add the failing test**

Append to `tests/unit/printableFieldResolver.test.ts`:

```typescript
describe('resolveFieldValues — eventDateLocation', () => {
  const field: PrintableFieldDef = {
    key: 'event-date-location',
    label: 'Event date + location',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'eventDateLocation' },
  };

  it('formats ISO bookingDate as DD.MM.YYYY with school name', () => {
    expect(resolveFieldValues([field], baseBooking)).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der Lindenschule Halle' },
    });
  });

  it('returns just the date prefix when schoolName is empty', () => {
    expect(resolveFieldValues([field], { ...baseBooking, schoolName: '' })).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der ' },
    });
  });

  it('returns empty string when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      'event-date-location': { kind: 'text', text: '' },
    });
  });

  it('handles a bookingDate that already includes a time component', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-06-02T09:00:00.000Z' })).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der Lindenschule Halle' },
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -10`
Expected: 4 new failures.

**Step 3: Implement**

In `src/lib/config/printableFieldResolver.ts`, add the formatter and extend `resolveComputed`:

```typescript
function formatGermanDate(iso: string): string {
  if (!iso) return '';
  // Accept "YYYY-MM-DD" and "YYYY-MM-DDT..." — never construct a Date (timezone hazard).
  const datePart = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y}`;
}
```

```typescript
case 'eventDateLocation': {
  const date = formatGermanDate(booking.bookingDate);
  if (!date) return '';
  return `Am ${date} in der ${booking.schoolName ?? ''}`;
}
```

**Step 4: Run to verify it passes**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 12 tests.

**Step 5: Commit**

```bash
git add src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): resolve eventDateLocation as 'Am DD.MM.YYYY in der <school>'"
```

---

## Task 7: Resolver — `earlyBirdDeadline` source

Discount end date = `eventDate − getThreshold('early_bird_deadline_days', overrides)`. Default 19 days; per-event override read from `booking.timelineOverrides`.

**Files:**
- Modify: `src/lib/config/printableFieldResolver.ts`
- Modify: `tests/unit/printableFieldResolver.test.ts`

**Step 1: Add the failing test**

Append to `tests/unit/printableFieldResolver.test.ts`:

```typescript
describe('resolveFieldValues — earlyBirdDeadline', () => {
  const field: PrintableFieldDef = {
    key: 'discount-end',
    label: 'Discount end date',
    kind: 'date',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'earlyBirdDeadline' },
  };

  it('subtracts the global default (19 days) from bookingDate', () => {
    // 2026-06-02 minus 19 days = 2026-05-14
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-06-02' })).toEqual({
      'discount-end': { kind: 'date', text: '14.05.2026' },
    });
  });

  it('respects per-event timeline override', () => {
    // 2026-06-02 minus 10 days = 2026-05-23
    expect(
      resolveFieldValues([field], {
        ...baseBooking,
        bookingDate: '2026-06-02',
        timelineOverrides: { early_bird_deadline_days: 10 },
      }),
    ).toEqual({
      'discount-end': { kind: 'date', text: '23.05.2026' },
    });
  });

  it('returns empty when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      'discount-end': { kind: 'date', text: '' },
    });
  });

  it('handles cross-month and cross-year boundaries (timezone-safe)', () => {
    // 2026-01-05 minus 19 days = 2025-12-17
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-01-05' })).toEqual({
      'discount-end': { kind: 'date', text: '17.12.2025' },
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -10`
Expected: 4 new failures.

**Step 3: Implement**

In `src/lib/config/printableFieldResolver.ts`, add:

```typescript
import { getThreshold } from '@/lib/utils/eventThresholds';

function subtractDaysIso(iso: string, days: number): string {
  const datePart = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return '';
  // Use UTC to avoid local-timezone DST shifts.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() - days);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}.${mo}.${y}`;
}
```

Extend `resolveComputed`:

```typescript
case 'earlyBirdDeadline': {
  if (!booking.bookingDate) return '';
  const days = getThreshold('early_bird_deadline_days', booking.timelineOverrides ?? null);
  return subtractDaysIso(booking.bookingDate, days);
}
```

**Step 4: Run to verify it passes**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 16 tests.

**Step 5: Commit**

```bash
git add src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): resolve earlyBirdDeadline (eventDate - threshold days)"
```

---

## Task 8: `PrintableFormEditor` scaffold component

**Files:**
- Create: `src/components/admin/bookings/PrintableFormEditor.tsx`

This is a thin scaffold. In Phase −1 it always renders the legacy editor — Phase 0 fills in the form-mode branch. The point of landing it now is to give `ConfirmPrintablesModal` a single entry point that knows how to switch.

**Step 1: Create the component**

```tsx
'use client';

import React from 'react';
import { hasFormMode } from '@/lib/config/printableFieldRegistry';
import { PrintableEditor, type PrintableEditorProps } from './PrintableEditor';

/**
 * Editor router. Today: always renders the legacy PrintableEditor.
 * Phase 0+: when hasFormMode(itemConfig.id) is true, renders the new
 * form-mode editor instead.
 */
export function PrintableFormEditor(props: PrintableEditorProps) {
  if (hasFormMode(props.itemConfig.id)) {
    // Phase 0 will render <FormModeEditor {...props} /> here.
    // Until then this branch is unreachable because no item registers form-mode.
    return <PrintableEditor {...props} />;
  }
  return <PrintableEditor {...props} />;
}
```

**Step 2: Confirm `PrintableEditor` exports its props type**

Run: `grep -n "export.*PrintableEditorProps\|interface PrintableEditorProps\|type PrintableEditorProps" src/components/admin/bookings/PrintableEditor.tsx`

If it does not export the props type, add `export` to the existing `interface` / `type` declaration in that file (no other changes — its definition stays the same). If the props type is not named `PrintableEditorProps`, rename to it (a single-file refactor). Then re-run the grep until it returns a hit.

**Step 3: Wire into `ConfirmPrintablesModal`**

Modify `src/components/admin/bookings/ConfirmPrintablesModal.tsx`:

- Replace the import of `PrintableEditor` with `PrintableFormEditor` from `./PrintableFormEditor`.
- Replace the JSX `<PrintableEditor … />` call site with `<PrintableFormEditor … />`. There should be exactly one usage; confirm with `grep -n "PrintableEditor" src/components/admin/bookings/ConfirmPrintablesModal.tsx` before and after.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

**Step 5: Smoke-test the modal**

Run: `pnpm dev` (or the project's existing dev command — check `package.json` scripts).
Open `/admin/bookings`, open any booking, click Confirm Printables, step through 2 items, drag a text element. Behavior must be identical to before.

**Step 6: Commit**

```bash
git add src/components/admin/bookings/PrintableFormEditor.tsx \
        src/components/admin/bookings/PrintableEditor.tsx \
        src/components/admin/bookings/ConfirmPrintablesModal.tsx
git commit -m "feat(printables): add PrintableFormEditor router (form-mode entry point)"
```

---

## Task 9: Wizard tab split — define groups

**Files:**
- Modify: `src/lib/config/printableShared.ts`
- Test: `tests/unit/printableShared.test.ts`

We add a typed grouping so the modal does not hardcode the membership list.

**Step 1: Add the failing test**

Append to `tests/unit/printableShared.test.ts`:

```typescript
import {
  PRINTABLE_TAB_GROUPS,
  itemTab,
  type PrintableTab,
} from '@/lib/config/printableShared';

describe('PRINTABLE_TAB_GROUPS', () => {
  it('lists all 11 item types across the two tabs without overlap', () => {
    const all = [...PRINTABLE_TAB_GROUPS.papers, ...PRINTABLE_TAB_GROUPS.clothing];
    expect(new Set(all).size).toBe(all.length); // no overlap
    expect(all.length).toBe(11);
  });

  it('papers contains the 6 flyer items + minicard + cd-jacket', () => {
    expect(PRINTABLE_TAB_GROUPS.papers).toEqual([
      'flyer1', 'flyer1-back',
      'flyer2', 'flyer2-back',
      'flyer3', 'flyer3-back',
      'minicard', 'cd-jacket',
    ]);
  });

  it('clothing contains tshirt, hoodie, button (in that order)', () => {
    expect(PRINTABLE_TAB_GROUPS.clothing).toEqual(['tshirt', 'hoodie', 'button']);
  });
});

describe('itemTab', () => {
  it('returns "papers" for flyer1 and minicard', () => {
    expect(itemTab('flyer1')).toBe('papers' as PrintableTab);
    expect(itemTab('minicard')).toBe('papers' as PrintableTab);
  });
  it('returns "clothing" for tshirt and button', () => {
    expect(itemTab('tshirt')).toBe('clothing' as PrintableTab);
    expect(itemTab('button')).toBe('clothing' as PrintableTab);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableShared.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — `PRINTABLE_TAB_GROUPS` / `itemTab` not exported.

**Step 3: Implement**

In `src/lib/config/printableShared.ts`, add (after `PRINTABLE_ITEM_TYPES`):

```typescript
export type PrintableTab = 'papers' | 'clothing';

export const PRINTABLE_TAB_GROUPS: Record<PrintableTab, PrintableItemType[]> = {
  papers: [
    'flyer1', 'flyer1-back',
    'flyer2', 'flyer2-back',
    'flyer3', 'flyer3-back',
    'minicard', 'cd-jacket',
  ],
  clothing: ['tshirt', 'hoodie', 'button'],
};

export function itemTab(itemType: PrintableItemType): PrintableTab {
  return PRINTABLE_TAB_GROUPS.clothing.includes(itemType) ? 'clothing' : 'papers';
}
```

**Step 4: Run to verify it passes**

Run: `npx jest tests/unit/printableShared.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

**Step 6: Commit**

```bash
git add src/lib/config/printableShared.ts tests/unit/printableShared.test.ts
git commit -m "feat(printables): add Papers/Clothing tab grouping helpers"
```

---

## Task 10: Wizard tab UI — render the two tabs in `ConfirmPrintablesModal`

This is the largest UI change in Phase −1. We're keeping all existing logic; we only:
1. Track an active tab in modal state.
2. Filter the wizard step list to only items in the active tab.
3. Render two tab buttons with item counts.
4. Reset `currentStep` to the first item in a tab when the user switches tabs.

**Files:**
- Modify: `src/components/admin/bookings/ConfirmPrintablesModal.tsx`

**Step 1: Read current step/navigation structure**

Run: `grep -n "currentStep\|setCurrentStep\|PRINTABLE_ITEM_TYPES\|currentItem\|wizardItems\|orderedItems" src/components/admin/bookings/ConfirmPrintablesModal.tsx`

Identify exactly:
- Where the ordered list of items is computed (probably from `PRINTABLE_ITEM_TYPES`).
- Where `currentStep` is initialized and where step navigation happens (next/prev buttons).
- Where the progress dots are rendered.

Write down the line numbers — you will touch each.

**Step 2: Add tab state**

Near the existing `useState` declarations, add:

```typescript
import { PRINTABLE_TAB_GROUPS, itemTab, type PrintableTab } from '@/lib/config/printableShared';

const [activeTab, setActiveTab] = useState<PrintableTab>('papers');
const tabItems = PRINTABLE_TAB_GROUPS[activeTab];
```

Replace any reference to the full `PRINTABLE_ITEM_TYPES` array used to drive wizard rendering with `tabItems`. Status loading and persistence still operate on all items — only the visible wizard sequence is scoped to the tab.

**Step 3: Reset currentStep on tab change**

Add a small effect:

```typescript
useEffect(() => {
  setCurrentStep(0);
}, [activeTab]);
```

**Step 4: Render tab buttons**

Above the progress stepper, render the two tab buttons. Reuse the existing color palette (the modal uses `#F4A261` / `#E07B3A` for primary). Pseudo-JSX for the layout:

```tsx
<div className="flex gap-2 mb-3">
  {(['papers', 'clothing'] as const).map(tab => {
    const items = PRINTABLE_TAB_GROUPS[tab];
    const confirmedCount = items.filter(i => itemsStatus[i] === 'confirmed').length;
    const skippedCount = items.filter(i => itemsStatus[i] === 'skipped').length;
    const isActive = tab === activeTab;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#F4A261] text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {tab === 'papers' ? 'Papers' : 'Clothing'}
        <span className="ml-2 text-xs opacity-80">
          {confirmedCount + skippedCount}/{items.length}
        </span>
      </button>
    );
  })}
</div>
```

**Step 5: Adjust the step counter / progress dots to operate over `tabItems`**

The existing dots/progress-counter referenced the full 11-item list. Replace with `tabItems` so a Papers tab shows 8 dots and Clothing shows 3.

**Step 6: Adjust `handleConfirmAndNext`, `handleSkip`, "Generate All" button**

- "Next" beyond the last item in the current tab should just disable the button (do not auto-jump tabs).
- "Generate All" still operates on **all** items across both tabs (no scope change). The tab is purely for visual navigation; generation writes whatever is confirmed/skipped/pending.

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

**Step 8: Smoke-test in the browser**

Run the dev server. Open Confirm Printables on a booking.
- Verify two tab buttons appear with counts (e.g. "Papers 0/8" and "Clothing 0/3").
- Verify Papers tab shows flyer1 first; clicking Clothing jumps to tshirt.
- Verify the Next button stops at the last item of the tab.
- Confirm an item, switch tabs and back — its confirmed status is preserved.
- Click Generate All — generation logic operates over all 11 items.

If anything regresses, fix it before commit.

**Step 9: Commit**

```bash
git add src/components/admin/bookings/ConfirmPrintablesModal.tsx
git commit -m "feat(printables): split wizard into Papers/Clothing tabs"
```

---

## Task 11: Final verification

**Step 1: Run the full unit test suite**

Run: `npx jest --no-coverage 2>&1 | tail -10`
Expected: all tests pass; new files contribute ≥18 new test cases (4 + 2 + 3 + 3 + 2 + 4 + 3 + tab tests).

**Step 2: Type check the whole repo**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean.

**Step 3: Build**

Run: `pnpm build` (or the project's build script).
Expected: success.

**Step 4: Manual checklist**

- [ ] Confirm Printables modal opens with Papers tab active.
- [ ] Switching to Clothing shows tshirt/hoodie/button only.
- [ ] Counts update as items are confirmed/skipped.
- [ ] Generate All still produces the same outputs as before this phase (test on a staging booking).
- [ ] No console errors.

**Step 5: Commit (only if any fixups landed)**

If steps 1–4 forced any fixes, commit them as `chore: phase -1 fixups`.

---

## Out of scope for Phase −1 (handled in Phase 0+)

- Defining any item's `PrintableFieldDef[]` (Flyer 1's 7 fields land in Phase 0).
- Form-mode UI rendering inside `PrintableFormEditor` (Phase 0 wires the form panel).
- Uploading the compressed partially-blank PDFs to R2 (Phase 0 uploads the Flyer 1 template; later phases upload theirs).
- Generating PNG previews of partially-blank PDFs for the canvas (per phase, when each item migrates).
- Modifying `convertItemToPdfConfig` or the generate route to source values from the registry (Phase 0 adds a parallel form-mode path; legacy stays for non-migrated items).

---

## Files touched in Phase −1

```
Create: src/lib/config/printableFields.ts
Create: src/lib/config/printableFieldRegistry.ts
Create: src/lib/config/printableFieldResolver.ts
Create: src/components/admin/bookings/PrintableFormEditor.tsx
Modify: src/lib/config/printableShared.ts
Modify: src/components/admin/bookings/ConfirmPrintablesModal.tsx
Modify: src/components/admin/bookings/PrintableEditor.tsx (export props type only)

Create: tests/unit/printableFields.test.ts
Create: tests/unit/printableFieldRegistry.test.ts
Create: tests/unit/printableFieldResolver.test.ts
Modify: tests/unit/printableShared.test.ts
```

No production behavior change. After this phase merges, Phase 0 can land Flyer 1's registry and form-mode UI without touching foundation again.
