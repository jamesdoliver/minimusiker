# Confirm Printables Revamp — Phase 0: Flyer 1 (Front + Back)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the `flyer1` and `flyer1-back` items from the legacy free-form drag editor to the new form-mode editor that overlays event-specific fields onto the partially-blank PDF template — admin fills a small form, the canvas shows draggable previews, generation produces a print-ready PDF that visually matches the reference filled examples.

**Architecture:**
- Form-mode editor renders a left-side **form panel** (one input per `PrintableFieldDef`) and a right-side **canvas** (PNG of the partially-blank PDF page with `DraggableText`/`DraggableQrCode` overlays at registry positions).
- Editor state is held in a new `FormModeItemState` shape (per-field overrides for value, position, size, font, color) and persisted to a separate localStorage slice (`-form` key, never mixed with the legacy `-editor` key).
- Generation loads the single 2-page partially-blank PDF from R2, picks page 0 for `flyer1` / page 1 for `flyer1-back`, overlays the resolved+overridden field values via `pdf-lib`, and uploads the result to the existing R2 output path. Legacy `convertItemToPdfConfig` stays untouched; a parallel `convertFormModeItemToPdfConfig` handles migrated items.
- `PrintableFormEditor` (the router landed in Phase −1) gets its `if (hasFormMode(...))` branch filled in to render the new editor; legacy items still fall through unchanged.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Jest, pdf-lib, Cloudflare R2 (via AWS S3 SDK), Ghostscript (build-time PNG rendering).

**Scope:** Flyer 1 only. Flyer 2 / Flyer 3 / Minicards / CD Booklet ship in Phases 1–4. T-shirt / Hoodie / Button stay on the legacy editor indefinitely (they live in the Clothing tab).

---

## Reference: what the 7 fields are

From comparing the partially-blank PDF (`public/printables/Flyers (MiniMusiker)/_compressed/flyer1-partial.pdf`, 600.75 × 303 pt, 2 pages) against the filled School and KiTa examples:

### Front page (`flyer1`, page 0) — 1 field

| Field key | Kind | Source | Notes |
|---|---|---|---|
| `event-date-location` | text | `computed.eventDateLocation` (`"Am DD.MM.YYYY in der {schoolName}"`) | Sits to the right of the calendar X icon in the lower-left quadrant. Two-line wrap when school name is long. |

### Back page (`flyer1-back`, page 1) — 6 fields

| Field key | Kind | Source | Notes |
|---|---|---|---|
| `tshirt-body-paragraph` | text | `computed.tshirtBodyParagraph` (NEW, full paragraph with Schule/KiTa swap) | Multi-line body under the "T-shirts & Hoodies" headline. |
| `shirt-label-tshirt` | text | `computed.schoolName` | Tiny label printed onto the T-shirt mockup. |
| `shirt-label-hoodie` | text | `computed.schoolName` | Tiny label printed onto the Hoodie mockup. |
| `qr-code` | qr | `computed.qrUrl` (`https://minimusiker.app/e/{accessCode}`) | The actual QR image; goes in the yellow box. |
| `qr-caption` | text | `computed.qrCaption` (NEW, `minimusiker.app/e/{accessCode}` without scheme) | Caption text immediately below the QR image. |
| `discount-end-date` | date | `computed.earlyBirdDeadline` | German `DD.MM.YYYY` inside the "Spare 10%" pill. |

Two new computed sources are introduced in Task 1: `tshirtBodyParagraph` and `qrCaption`. The closed-union exhaustiveness check on `resolveComputed` (set at the end of Phase −1) will fail to compile until both cases are added — that's the type system enforcing the contract.

---

## Reference: R2 layout for Phase 0

Single 2-page PDF uploaded to a NEW key (legacy templates stay untouched until a future cleanup phase):

```
minimusiker-assets/
  templates/
    flyer1-partial-template.pdf   ← new, 2-page (1.7 MB compressed)
    flyer1-template.pdf           ← legacy, unused after Phase 0 (stays for now)
    flyer1-back-template.pdf      ← legacy, unused after Phase 0 (stays for now)
```

Form-mode generator: load `flyer1-partial-template.pdf`, copy page 0 for `flyer1` items, page 1 for `flyer1-back` items, overlay text/QR.

Output paths (unchanged): events still write to `events/{eventId}/printables/flyers/flyer1.pdf` and `flyer1-back.pdf`.

---

## Task 1: Add `tshirtBodyParagraph` and `qrCaption` computed sources

**Files:**
- Modify: `src/lib/config/printableFields.ts` (extend `ComputedFieldName` union)
- Modify: `src/lib/config/printableFieldResolver.ts` (add 2 cases)
- Modify: `tests/unit/printableFieldResolver.test.ts` (TDD)

**Step 1: Add the failing tests**

Append to `tests/unit/printableFieldResolver.test.ts`:

```typescript
describe('resolveFieldValues — tshirtBodyParagraph', () => {
  const field: PrintableFieldDef = {
    key: 'tshirt-body',
    label: 'T-shirt body paragraph',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'tshirtBodyParagraph' },
  };

  it('uses "Schule" for schools (isKita false)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: false })).toEqual({
      'tshirt-body': {
        kind: 'text',
        text: 'Mit dem passenden T-Shirt oder Hoodie eurer Schule, strahlt nicht nur die Stimme, sondern auch dein Kind.',
      },
    });
  });

  it('uses "KiTa" for KiTas (isKita true)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: true })).toEqual({
      'tshirt-body': {
        kind: 'text',
        text: 'Mit dem passenden T-Shirt oder Hoodie eurer KiTa, strahlt nicht nur die Stimme, sondern auch dein Kind.',
      },
    });
  });
});

describe('resolveFieldValues — qrCaption', () => {
  const field: PrintableFieldDef = {
    key: 'qr-caption',
    label: 'QR caption',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  };

  it('builds the bare-host short URL from accessCode (no scheme)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, accessCode: 112 })).toEqual({
      'qr-caption': { kind: 'text', text: 'minimusiker.app/e/112' },
    });
  });

  it('returns empty when accessCode is missing', () => {
    const { accessCode: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      'qr-caption': { kind: 'text', text: '' },
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -10`
Expected: 4 new tests fail. Some may fail at COMPILATION because `'tshirtBodyParagraph'` and `'qrCaption'` are not in `ComputedFieldName`. That's the closed-union check working — fix it in step 3.

**Step 3: Extend `ComputedFieldName` and `resolveComputed`**

In `src/lib/config/printableFields.ts`, extend the union:

```typescript
export type ComputedFieldName =
  | 'schoolName'
  | 'eventDateLocation'
  | 'schuleOrKita'
  | 'qrUrl'
  | 'earlyBirdDeadline'
  | 'tshirtBodyParagraph'  // NEW (Phase 0)
  | 'qrCaption';           // NEW (Phase 0)
```

In `src/lib/config/printableFieldResolver.ts`, add two cases to `resolveComputed`, between `'earlyBirdDeadline'` and the `default:` exhaustiveness check:

```typescript
case 'tshirtBodyParagraph': {
  const word = booking.isKita ? 'KiTa' : 'Schule';
  return `Mit dem passenden T-Shirt oder Hoodie eurer ${word}, strahlt nicht nur die Stimme, sondern auch dein Kind.`;
}
case 'qrCaption':
  return booking.accessCode ? `minimusiker.app/e/${booking.accessCode}` : '';
```

The exhaustiveness check at the bottom of the switch will now compile because all 7 union members are handled.

**Step 4: Run to verify all pass**

Run: `npx jest tests/unit/printableFieldResolver.test.ts --no-coverage 2>&1 | tail -5`
Expected: 21/21 pass (17 from Phase −1 + 4 new).

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "printableFields|printableFieldResolver" | head`
Expected: empty.

**Step 6: Commit**

```bash
git add src/lib/config/printableFields.ts src/lib/config/printableFieldResolver.ts tests/unit/printableFieldResolver.test.ts
git commit -m "feat(printables): add tshirtBodyParagraph and qrCaption computed sources"
```

---

## Task 2: Render PNG previews of the partially-blank PDFs

**Files:**
- Create: `scripts/render-printable-previews.sh`
- Create: `public/images/printable_previews/flyer1-partial-front.png`
- Create: `public/images/printable_previews/flyer1-partial-back.png`

The form-mode canvas uses a PNG of the partially-blank page as its backdrop. We render at 2× display resolution for retina sharpness.

**Step 1: Write the rendering script**

Create `scripts/render-printable-previews.sh`:

```bash
#!/usr/bin/env bash
#
# Render PNG previews of the compressed partially-blank PDF templates for use
# as the form-mode editor canvas backdrops.
#
# Source: public/printables/Flyers (MiniMusiker)/_compressed/<item>-partial.pdf
# Output: public/images/printable_previews/<item>-partial-{front,back}.png
#
# Renders at 192 dpi (2x of 96 dpi screen baseline) for retina displays.
# Re-runnable; overwrites existing files.
#
# Requires: ghostscript (`brew install ghostscript`).

set -euo pipefail

if ! command -v gs >/dev/null 2>&1; then
  echo "ghostscript not found. Install with: brew install ghostscript" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRCDIR="$REPO_ROOT/public/printables/Flyers (MiniMusiker)/_compressed"
OUTDIR="$REPO_ROOT/public/images/printable_previews"

mkdir -p "$OUTDIR"

# input pdf : output basename : pages-as-suffixes
declare -a TEMPLATES=(
  "flyer1-partial.pdf:flyer1-partial:front,back"
)

render_one() {
  local in="$1" outbase="$2" page="$3" suffix="$4"
  gs \
    -sDEVICE=png16m \
    -r192 \
    -dFirstPage="$page" -dLastPage="$page" \
    -dNOPAUSE -dQUIET -dBATCH \
    -sOutputFile="${OUTDIR}/${outbase}-${suffix}.png" \
    "$in"
}

for entry in "${TEMPLATES[@]}"; do
  src="${entry%%:*}"
  rest="${entry#*:}"
  outbase="${rest%%:*}"
  pagespec="${rest##*:}"
  in_path="$SRCDIR/$src"

  if [ ! -f "$in_path" ]; then
    echo "MISSING: $in_path (run scripts/compress-printable-templates.sh first)" >&2
    exit 1
  fi

  IFS=',' read -ra suffixes <<< "$pagespec"
  page=1
  for suffix in "${suffixes[@]}"; do
    render_one "$in_path" "$outbase" "$page" "$suffix"
    out="$OUTDIR/${outbase}-${suffix}.png"
    size=$(stat -f%z "$out")
    echo "${outbase}-${suffix}.png: ${size} bytes (page ${page})"
    page=$((page + 1))
  done
done

echo
echo "PNG previews written to: $OUTDIR"
```

**Step 2: Make it executable and run it**

```bash
chmod +x scripts/render-printable-previews.sh
scripts/render-printable-previews.sh
```

Verify two new files exist:
```bash
ls -la public/images/printable_previews/flyer1-partial-*.png
```

Each should be in the 200–800 KB range. If either is over ~2 MB, the resolution may be too high — drop `-r192` to `-r144` and re-run.

**Step 3: Visual sanity check**

Open both PNGs in an image viewer (or just look at the file size differences). Confirm:
- `flyer1-partial-front.png` shows the front page (character + headline area).
- `flyer1-partial-back.png` shows the back page (3 body paragraphs + empty QR yellow box + T-shirt/Hoodie mockups).

**Step 4: Commit**

```bash
git add scripts/render-printable-previews.sh public/images/printable_previews/flyer1-partial-front.png public/images/printable_previews/flyer1-partial-back.png
git commit -m "build(printables): add Flyer 1 partial-blank PNG previews + render script"
```

---

## Task 3: R2 upload script for partial-blank templates

**Files:**
- Create: `scripts/upload-printable-templates.ts`

This script uploads the compressed partially-blank PDFs to R2 so the form-mode generator can fetch them. It is a one-time setup the user runs locally with R2 credentials in their environment.

**Step 1: Look up the existing R2 client setup**

Run: `grep -n "S3Client\|R2_BUCKET\|R2_ENDPOINT\|R2_ACCOUNT_ID" src/lib/services/r2Service.ts | head -10`

Identify how `r2Service` constructs its S3 client and which env vars are required. The new script reuses the same env vars.

**Step 2: Write the upload script**

Create `scripts/upload-printable-templates.ts`:

```typescript
#!/usr/bin/env -S npx tsx
/**
 * Upload the compressed partially-blank PDF templates to R2.
 *
 * Source: public/printables/Flyers (MiniMusiker)/_compressed/<item>-partial.pdf
 * Destination: R2 key `templates/<item>-partial-template.pdf` in the assets bucket.
 *
 * One-time setup; subsequent phases (Flyer 2, Flyer 3, etc.) extend the UPLOADS map.
 *
 * Required env vars (same as r2Service):
 *   - R2_ACCOUNT_ID
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_ASSETS_BUCKET (or whichever the project uses for templates)
 *
 * Usage:
 *   pnpm tsx scripts/upload-printable-templates.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const COMPRESSED_DIR = path.join(
  REPO_ROOT,
  'public/printables/Flyers (MiniMusiker)/_compressed',
);

const UPLOADS: Array<{ source: string; r2Key: string }> = [
  {
    source: 'flyer1-partial.pdf',
    r2Key: 'templates/flyer1-partial-template.pdf',
  },
  // Phase 1+ adds: flyer2-partial.pdf, flyer3-partial.pdf, minicards-partial.pdf, cd-booklet-partial.pdf
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

async function main() {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const bucket = requireEnv('R2_ASSETS_BUCKET');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  for (const { source, r2Key } of UPLOADS) {
    const localPath = path.join(COMPRESSED_DIR, source);
    if (!fs.existsSync(localPath)) {
      throw new Error(
        `Source not found: ${localPath}\n` +
          'Run scripts/compress-printable-templates.sh first.',
      );
    }
    const body = fs.readFileSync(localPath);
    console.log(`Uploading ${source} (${body.length} bytes) → s3://${bucket}/${r2Key}`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
    console.log(`  ok`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

**Step 3: Verify the env var names match the project**

Run: `grep -n "R2_ACCOUNT_ID\|R2_ACCESS_KEY_ID\|R2_SECRET_ACCESS_KEY\|R2_ASSETS_BUCKET\|process\.env\.R2" src/lib/services/r2Service.ts | head -20`

If the project uses different env var names (e.g. `R2_BUCKET` instead of `R2_ASSETS_BUCKET`), update the script's `requireEnv` calls to match. The script must use the SAME env vars `r2Service` reads.

**Step 4: Commit the script**

```bash
git add scripts/upload-printable-templates.ts
git commit -m "build(printables): add R2 upload script for partial-blank templates"
```

**Step 5 (manual, by user — NOT in this commit): Run the upload**

The user runs locally:
```bash
pnpm tsx scripts/upload-printable-templates.ts
```

This is the one-time R2 setup. The implementer subagent does NOT run it (no credentials in subagent env). Note in the task report that this step requires the user's manual action.

---

## Task 4: Author Flyer 1 field definitions

**Files:**
- Create: `src/lib/config/printableFieldRegistries/flyer1.ts`
- Test: `tests/unit/printableFieldRegistries/flyer1.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/printableFieldRegistries/flyer1.test.ts`:

```typescript
import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer1';

describe('FLYER1_FIELDS (front page)', () => {
  it('declares exactly 1 field', () => {
    expect(FLYER1_FIELDS).toHaveLength(1);
  });

  it('event-date-location is a draggable computed text field', () => {
    const f = FLYER1_FIELDS.find(x => x.key === 'event-date-location');
    expect(f).toBeDefined();
    expect(f?.kind).toBe('text');
    expect(f?.draggable).toBe(true);
    expect(f?.source).toEqual({ type: 'computed', name: 'eventDateLocation' });
  });
});

describe('FLYER1_BACK_FIELDS (back page)', () => {
  it('declares exactly 6 fields', () => {
    expect(FLYER1_BACK_FIELDS).toHaveLength(6);
  });

  it.each([
    ['tshirt-body-paragraph', 'text', { type: 'computed', name: 'tshirtBodyParagraph' }],
    ['shirt-label-tshirt',    'text', { type: 'computed', name: 'schoolName' }],
    ['shirt-label-hoodie',    'text', { type: 'computed', name: 'schoolName' }],
    ['qr-code',               'qr',   { type: 'computed', name: 'qrUrl' }],
    ['qr-caption',            'text', { type: 'computed', name: 'qrCaption' }],
    ['discount-end-date',     'date', { type: 'computed', name: 'earlyBirdDeadline' }],
  ])('field %s has kind %s and source %s', (key, kind, source) => {
    const f = FLYER1_BACK_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });

  it('all fields are draggable', () => {
    expect(FLYER1_BACK_FIELDS.every(f => f.draggable === true)).toBe(true);
  });

  it('all fields have non-zero default size', () => {
    for (const f of FLYER1_BACK_FIELDS) {
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableFieldRegistries/flyer1.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — module not found.

**Step 3: Author the field definitions**

Create `src/lib/config/printableFieldRegistries/flyer1.ts`:

```typescript
/**
 * Field definitions for the Flyer 1 form-mode editor.
 *
 * Positions are in CSS pixels at canvasScale = 1 (i.e. 1 CSS px ↔ 1 PDF point
 * since the partially-blank PDF is 600.75 × 303 pt). The form-mode editor's
 * canvas rescales these to fit the rendered PNG width.
 *
 * Hand-measured against the reference filled examples:
 *   public/printables/Flyers (MiniMusiker)/Filled out Flyers/Flyer 1/
 *
 * These are STARTING positions. Admins can drag to fine-tune per event;
 * Phase 0 verification iterates positions until the rendered PDF matches
 * the filled example pixel-for-pixel within reasonable tolerance.
 */

import type { PrintableFieldDef } from '../printableFields';

export const FLYER1_FIELDS: PrintableFieldDef[] = [
  {
    key: 'event-date-location',
    label: 'Event date + location',
    kind: 'text',
    // Right of the calendar X icon, lower-left quadrant of the front page.
    defaultPosition: { x: 155, y: 175 },
    defaultSize: { width: 195, height: 50 },
    defaultFontSize: 18,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'eventDateLocation' },
  },
];

export const FLYER1_BACK_FIELDS: PrintableFieldDef[] = [
  {
    key: 'tshirt-body-paragraph',
    label: 'T-shirt section body',
    kind: 'text',
    // Below the "T-shirts & Hoodies" headline, left of the mockup images.
    defaultPosition: { x: 405, y: 105 },
    defaultSize: { width: 100, height: 70 },
    defaultFontSize: 9,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'tshirtBodyParagraph' },
  },
  {
    key: 'shirt-label-hoodie',
    label: 'Hoodie label',
    kind: 'text',
    // On the hoodie mockup (top-right of the back page).
    defaultPosition: { x: 522, y: 70 },
    defaultSize: { width: 60, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'schoolName' },
  },
  {
    key: 'shirt-label-tshirt',
    label: 'T-shirt label',
    kind: 'text',
    // On the t-shirt mockup (below the hoodie).
    defaultPosition: { x: 532, y: 130 },
    defaultSize: { width: 60, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'schoolName' },
  },
  {
    key: 'qr-code',
    label: 'QR code',
    kind: 'qr',
    // Inside the yellow box on the middle of the back page.
    defaultPosition: { x: 220, y: 75 },
    defaultSize: { width: 110, height: 110 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  },
  {
    key: 'qr-caption',
    label: 'QR caption (URL text)',
    kind: 'text',
    // Below the QR image, inside the yellow box.
    defaultPosition: { x: 222, y: 188 },
    defaultSize: { width: 105, height: 12 },
    defaultFontSize: 8,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  },
  {
    key: 'discount-end-date',
    label: 'Discount end date',
    kind: 'date',
    // Inside the "Spare 10%" pill, lower-right of the back page.
    defaultPosition: { x: 502, y: 245 },
    defaultSize: { width: 70, height: 14 },
    defaultFontSize: 11,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'earlyBirdDeadline' },
  },
];
```

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/printableFieldRegistries/flyer1.test.ts --no-coverage 2>&1 | tail -5`
Expected: PASS, 9 tests (1 + 1 + 6 + 1 + ??).

If `tests/unit/printableFieldRegistries/` doesn't exist as a directory yet, jest will create the path automatically when the test runs.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "printableFieldRegistries/flyer1" | head`
Expected: empty.

**Step 6: Commit**

```bash
git add src/lib/config/printableFieldRegistries/flyer1.ts tests/unit/printableFieldRegistries/flyer1.test.ts
git commit -m "feat(printables): add Flyer 1 field definitions (front + back)"
```

---

## Task 5: Register Flyer 1 in the field registry

**Files:**
- Modify: `src/lib/config/printableFieldRegistry.ts`
- Modify: `tests/unit/printableFieldRegistry.test.ts`

**Step 1: Update the registry test**

The Phase −1 test asserted "returns null for every item type while no items are migrated." That assertion is now false. Update `tests/unit/printableFieldRegistry.test.ts`:

```typescript
import { getFieldRegistry, hasFormMode } from '@/lib/config/printableFieldRegistry';
import { PRINTABLE_ITEM_TYPES } from '@/lib/config/printableShared';
import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer1';

describe('getFieldRegistry', () => {
  it('returns FLYER1_FIELDS for flyer1', () => {
    expect(getFieldRegistry('flyer1')).toBe(FLYER1_FIELDS);
  });

  it('returns FLYER1_BACK_FIELDS for flyer1-back', () => {
    expect(getFieldRegistry('flyer1-back')).toBe(FLYER1_BACK_FIELDS);
  });

  it('returns null for not-yet-migrated items', () => {
    const stillLegacy: typeof PRINTABLE_ITEM_TYPES[number][] = [
      'tshirt', 'hoodie', 'button',
      'flyer2', 'flyer2-back',
      'flyer3', 'flyer3-back',
      'minicard', 'cd-jacket',
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
  it('returns true for flyer1 and flyer1-back', () => {
    expect(hasFormMode('flyer1')).toBe(true);
    expect(hasFormMode('flyer1-back')).toBe(true);
  });

  it('returns false for legacy items', () => {
    expect(hasFormMode('tshirt')).toBe(false);
    expect(hasFormMode('button')).toBe(false);
    expect(hasFormMode('cd-jacket')).toBe(false);
  });
});
```

**Step 2: Run to verify failures**

Run: `npx jest tests/unit/printableFieldRegistry.test.ts --no-coverage 2>&1 | tail -10`
Expected: 4 of the 6 tests fail (registry still returns null for everything).

**Step 3: Wire up the registry**

In `src/lib/config/printableFieldRegistry.ts`:

```typescript
import type { PrintableItemType } from './printableTextConfig';
import type { PrintableFieldDef } from './printableFields';
import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from './printableFieldRegistries/flyer1';

const REGISTRIES: Partial<Record<PrintableItemType, PrintableFieldDef[]>> = {
  'flyer1': FLYER1_FIELDS,
  'flyer1-back': FLYER1_BACK_FIELDS,
};

export function getFieldRegistry(itemType: PrintableItemType): PrintableFieldDef[] | null {
  return REGISTRIES[itemType] ?? null;
}

export function hasFormMode(itemType: PrintableItemType): boolean {
  return getFieldRegistry(itemType) !== null;
}
```

The JSDoc comment from Phase −1 ("Intentionally empty in Phase -1.") should be removed or updated.

**Step 4: Run to verify all pass**

Run: `npx jest tests/unit/printableFieldRegistry.test.ts --no-coverage 2>&1 | tail -5`
Expected: all 6 tests pass.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "printableFieldRegistry" | head`
Expected: empty.

**Step 6: Commit**

```bash
git add src/lib/config/printableFieldRegistry.ts tests/unit/printableFieldRegistry.test.ts
git commit -m "feat(printables): register Flyer 1 + Flyer 1 back as form-mode items"
```

---

## Task 6: Define `FormModeItemState` type + merge helpers

**Files:**
- Create: `src/lib/config/formModeState.ts`
- Test: `tests/unit/formModeState.test.ts`

`FormModeItemState` holds per-field overrides. Each field starts at `{}` (no overrides) and the merge helper combines defaults from `PrintableFieldDef` + resolved values from the resolver + admin overrides into the final renderable shape.

**Step 1: Write the failing tests**

Create `tests/unit/formModeState.test.ts`:

```typescript
import {
  emptyFormModeState,
  mergeFieldRender,
  type FormModeItemState,
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

  it('applies a text override over the resolved value', () => {
    const override: FormModeFieldOverride = { text: 'Custom text', textOverridden: true };
    const render = mergeFieldRender(textField, override, { kind: 'text', text: 'Resolved' });
    expect(render.text).toBe('Custom text');
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
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/formModeState.test.ts --no-coverage 2>&1 | tail -10`
Expected: module-not-found.

**Step 3: Implement**

Create `src/lib/config/formModeState.ts`:

```typescript
import type { FontFamily } from './printableTextConfig';
import type { PrintableFieldDef, ResolvedFieldValue } from './printableFields';

/**
 * Per-field admin overrides on top of the registry defaults.
 * Each property is optional; undefined means "use the default".
 */
export interface FormModeFieldOverride {
  /** Text/date kinds: admin-edited text. */
  text?: string;
  /** Set true when the admin has typed into the input. Lets us distinguish "admin chose empty string" from "no override". */
  textOverridden?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  fontSize?: number;
  fontFamily?: FontFamily;
  color?: string;
}

/** Override map per item: { fieldKey: override }. Empty when no admin edits. */
export type FormModeItemState = Record<string, FormModeFieldOverride>;

/** The final renderable shape combining defaults + overrides + resolved value. */
export interface FieldRender {
  key: string;
  kind: 'text' | 'qr' | 'date';
  /** For text/date kinds. */
  text?: string;
  /** For qr kind. */
  url?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  fontSize?: number;
  fontFamily?: FontFamily;
  color?: string;
}

/**
 * Initial FormModeItemState — empty object, no overrides applied.
 */
export function emptyFormModeState(_fields: PrintableFieldDef[]): FormModeItemState {
  return {};
}

/**
 * Combine field definition + (optional) admin override + resolved value into
 * the renderable shape consumed by the canvas overlay components and by the
 * PDF generator.
 */
export function mergeFieldRender(
  def: PrintableFieldDef,
  override: FormModeFieldOverride | undefined,
  resolved: ResolvedFieldValue,
): FieldRender {
  const position = override?.position ?? def.defaultPosition;
  const size = override?.size ?? def.defaultSize;
  const fontSize = override?.fontSize ?? def.defaultFontSize;
  const fontFamily = override?.fontFamily ?? def.defaultFontFamily;
  const color = override?.color ?? def.defaultColor;

  if (def.kind === 'qr') {
    return {
      key: def.key,
      kind: 'qr',
      text: undefined,
      url: resolved.kind === 'qr' ? resolved.url : '',
      position,
      size,
      fontSize: undefined,
      fontFamily: undefined,
      color: undefined,
    };
  }

  // text or date
  const resolvedText = resolved.kind === 'text' || resolved.kind === 'date' ? resolved.text : '';
  const text = override?.textOverridden ? override.text ?? '' : resolvedText;

  return {
    key: def.key,
    kind: def.kind,
    text,
    url: undefined,
    position,
    size,
    fontSize,
    fontFamily,
    color,
  };
}
```

**Step 4: Run to verify all pass**

Run: `npx jest tests/unit/formModeState.test.ts --no-coverage 2>&1 | tail -5`
Expected: all tests pass.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "formModeState" | head`
Expected: empty.

**Step 6: Commit**

```bash
git add src/lib/config/formModeState.ts tests/unit/formModeState.test.ts
git commit -m "feat(printables): add FormModeItemState + mergeFieldRender helper"
```

---

## Task 7: Form-mode persistence in `ConfirmPrintablesModal`

**Files:**
- Modify: `src/components/admin/bookings/ConfirmPrintablesModal.tsx`

Add a parallel state slice for form-mode overrides, persisted to a separate localStorage key (`-form` suffix). The legacy `-editor` key keeps holding state for non-migrated items.

**Step 1: Read the current state declarations**

Run: `grep -n "useState\|storageKeyPrefix\|setItemEditorStates" src/components/admin/bookings/ConfirmPrintablesModal.tsx | head -30`

Note the file region around `storageKeyPrefix` and the existing `useEffect` that persists `itemEditorStates` to `${storageKeyPrefix}-editor`.

**Step 2: Add the form-mode state slice and persistence**

In `ConfirmPrintablesModal.tsx`:

a) Import the new types and registry hook:

```typescript
import { getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { type FormModeItemState } from '@/lib/config/formModeState';
import { type PrintableItemType } from '@/lib/config/printableTextConfig';
```

b) Add state alongside `itemEditorStates`:

```typescript
const [formModeStates, setFormModeStates] = useState<
  Partial<Record<PrintableItemType, FormModeItemState>>
>({});
```

c) Add a parallel localStorage hydration on mount. Find where the existing `-editor` localStorage restore runs and add a sibling block:

```typescript
// Restore form-mode overrides from localStorage (separate key from legacy editor)
try {
  const raw = localStorage.getItem(`${storageKeyPrefix}-form`);
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<Record<PrintableItemType, FormModeItemState>>;
    if (parsed && typeof parsed === 'object') {
      setFormModeStates(parsed);
    }
  }
} catch {
  // Corrupted JSON — start fresh.
}
```

d) Add a persistence effect that writes on change:

```typescript
useEffect(() => {
  if (!storageKeyPrefix) return;
  try {
    localStorage.setItem(
      `${storageKeyPrefix}-form`,
      JSON.stringify(formModeStates),
    );
  } catch {
    // Quota exceeded or disabled storage — ignore silently.
  }
}, [formModeStates, storageKeyPrefix]);
```

e) Add a setter that updates a single item's overrides:

```typescript
const setItemFormModeState = useCallback(
  (itemType: PrintableItemType, next: FormModeItemState) => {
    setFormModeStates(prev => ({ ...prev, [itemType]: next }));
  },
  [],
);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "ConfirmPrintablesModal" | head`
Expected: empty.

**Step 4: Smoke check the dev server**

```bash
timeout 30 npm run dev > /tmp/dev-task7.log 2>&1 &
sleep 20
grep -E "compiled|error" /tmp/dev-task7.log | head
kill %1 2>/dev/null || true
```

Expected: clean compile.

**Step 5: Commit**

```bash
git add src/components/admin/bookings/ConfirmPrintablesModal.tsx
git commit -m "feat(printables): add form-mode state slice + separate localStorage key"
```

---

## Task 8: `FormModeEditor` skeleton — canvas with PNG backdrop

**Files:**
- Create: `src/components/admin/bookings/FormModeEditor.tsx`
- Create: `src/components/admin/bookings/FormModeEditor.module.css` (optional)

**Step 1: Build the skeleton**

Create `src/components/admin/bookings/FormModeEditor.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import type { PrintableTextConfig, PrintableItemType } from '@/lib/config/printableTextConfig';
import type { PrintableFieldDef } from '@/lib/config/printableFields';
import type { FormModeItemState } from '@/lib/config/formModeState';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';

interface FormModeEditorProps {
  itemConfig: PrintableTextConfig;
  fields: PrintableFieldDef[];
  state: FormModeItemState;
  onStateChange: (next: FormModeItemState) => void;
  booking: ResolverBooking;
  schoolName: string; // for logo overlay parity with legacy
  accessCode?: number;
  eventDate: string;
}

/**
 * Form-mode editor: left-side form panel + right-side canvas with the
 * partially-blank PDF preview and draggable field overlays.
 *
 * Phase 0 wires Flyer 1 (front + back). Subsequent phases reuse this component.
 */
export function FormModeEditor(props: FormModeEditorProps) {
  const partialPreviewSrc = useMemo(() => previewPathFor(props.itemConfig.type), [props.itemConfig.type]);

  return (
    <div className="flex gap-4 h-full">
      <aside className="w-64 shrink-0 border-r border-gray-200 pr-4 overflow-y-auto">
        {/* Form panel — Task 10 fills this in */}
        <div className="text-sm text-gray-500">Form panel — Task 10</div>
      </aside>

      <main className="flex-1 min-h-0 flex items-center justify-center bg-gray-50">
        <div className="relative" style={{ width: 800, maxWidth: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={partialPreviewSrc}
            alt={`${props.itemConfig.name} preview`}
            className="block w-full h-auto select-none pointer-events-none"
            draggable={false}
          />
          {/* Field overlays — Task 9 fills this in */}
        </div>
      </main>
    </div>
  );
}

function previewPathFor(itemType: PrintableItemType): string {
  // Convention: form-mode previews live alongside the legacy ones with a -partial-{front,back} suffix.
  switch (itemType) {
    case 'flyer1': return '/images/printable_previews/flyer1-partial-front.png';
    case 'flyer1-back': return '/images/printable_previews/flyer1-partial-back.png';
    // Phase 1+ adds the rest.
    default:
      throw new Error(`No partial-blank preview registered for item type ${itemType}`);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "FormModeEditor" | head`
Expected: empty.

**Step 3: Smoke-compile the dev server**

```bash
timeout 30 npm run dev > /tmp/dev-task8.log 2>&1 &
sleep 20
grep -E "compiled|error" /tmp/dev-task8.log | head
kill %1 2>/dev/null || true
```

**Step 4: Commit**

```bash
git add src/components/admin/bookings/FormModeEditor.tsx
git commit -m "feat(printables): add FormModeEditor skeleton with PNG backdrop"
```

---

## Task 9: Render draggable field overlays on the canvas

**Files:**
- Modify: `src/components/admin/bookings/FormModeEditor.tsx`

Reuse `DraggableText` and `DraggableQrCode` (already used by the legacy editor). For each field, render the appropriate overlay at the merged position; on drag, write to `FormModeItemState`.

**Step 1: Find the existing draggable components**

Run: `grep -n "export.*DraggableText\|export.*DraggableQrCode" src/components/admin/bookings/Draggable*.tsx`

Note their props signatures. Both should accept `position: {x, y}`, `size: {width, height}`, `onMove`, `onResize`, `selected`, `onSelect`, plus content (text or hidden in QR's case).

**Step 2: Compute the canvas scale and field renders**

In `FormModeEditor.tsx`:

a) Add resolver imports and the renderable computation:

```typescript
import { resolveFieldValues } from '@/lib/config/printableFieldResolver';
import { mergeFieldRender, type FieldRender } from '@/lib/config/formModeState';
import { useMemo, useState } from 'react';
```

b) Inside the component, compute:

```typescript
const resolved = useMemo(
  () => resolveFieldValues(props.fields, props.booking),
  [props.fields, props.booking],
);

const renders: FieldRender[] = useMemo(
  () => props.fields.map(def =>
    mergeFieldRender(def, props.state[def.key], resolved[def.key] ?? defaultResolvedFor(def.kind)),
  ),
  [props.fields, props.state, resolved],
);
```

Add a tiny helper:

```typescript
function defaultResolvedFor(kind: 'text' | 'qr' | 'date') {
  if (kind === 'qr') return { kind: 'qr' as const, url: '' };
  return { kind: kind as 'text' | 'date', text: '' };
}
```

c) Track the selected field (for visual focus):

```typescript
const [selectedKey, setSelectedKey] = useState<string | null>(null);
```

d) Compute the canvas display scale (fit the PDF's 600.75-pt width into the rendered img width). Since the PNG is rendered at 192 dpi and the PDF is 600.75 × 303 pt, the rendered image at the displayed width corresponds to the scale `displayedWidth / 600.75`. Read the rendered image's width with a ref or hardcode the canvas to a fixed display width and compute scale accordingly:

```typescript
const CANVAS_DISPLAY_WIDTH = 800; // px in CSS
const scale = CANVAS_DISPLAY_WIDTH / props.itemConfig.pdfDimensions.width;
```

(`pdfDimensions.width` is on `PrintableTextConfig` — verify with grep.)

e) Render overlays. Replace the `{/* Field overlays — Task 9 */}` placeholder with:

```tsx
{renders.map(r => {
  const isSelected = selectedKey === r.key;
  const cssPos = { x: r.position.x * scale, y: r.position.y * scale };
  const cssSize = { width: r.size.width * scale, height: r.size.height * scale };
  if (r.kind === 'qr') {
    return (
      <DraggableQrCode
        key={r.key}
        position={cssPos}
        size={cssSize}
        selected={isSelected}
        onSelect={() => setSelectedKey(r.key)}
        onMove={p => updateOverride(r.key, { position: { x: p.x / scale, y: p.y / scale } })}
        onResize={s => updateOverride(r.key, { size: { width: s.width / scale, height: s.height / scale } })}
      />
    );
  }
  return (
    <DraggableText
      key={r.key}
      position={cssPos}
      size={cssSize}
      text={r.text ?? ''}
      fontSize={(r.fontSize ?? 14) * scale}
      fontFamily={r.fontFamily}
      color={r.color}
      selected={isSelected}
      onSelect={() => setSelectedKey(r.key)}
      onMove={p => updateOverride(r.key, { position: { x: p.x / scale, y: p.y / scale } })}
      onResize={s => updateOverride(r.key, { size: { width: s.width / scale, height: s.height / scale } })}
      onTextChange={t => updateOverride(r.key, { text: t, textOverridden: true })}
    />
  );
})}
```

f) Add the `updateOverride` helper:

```typescript
function updateOverride(key: string, patch: Partial<FormModeFieldOverride>) {
  props.onStateChange({
    ...props.state,
    [key]: { ...(props.state[key] ?? {}), ...patch },
  });
}
```

**Step 3: Verify props match the existing DraggableText/DraggableQrCode signatures**

Compare with the legacy usage in `PrintableEditor.tsx`. If a prop name differs (e.g. `onMove` vs `onPositionChange`, `text` vs `value`), adapt to the actual signatures. Do NOT change the existing components — adapt the new caller.

**Step 4: Verify TypeScript compiles + dev compile**

```
npx tsc --noEmit 2>&1 | grep -E "FormModeEditor" | head
```
Expected: empty.

**Step 5: Commit**

```bash
git add src/components/admin/bookings/FormModeEditor.tsx
git commit -m "feat(printables): render draggable field overlays in FormModeEditor"
```

---

## Task 10: Form panel inputs + reset-to-default

**Files:**
- Modify: `src/components/admin/bookings/FormModeEditor.tsx`

**Step 1: Replace the form-panel placeholder**

Replace the `<aside>` placeholder in `FormModeEditor.tsx`:

```tsx
<aside className="w-72 shrink-0 border-r border-gray-200 pr-4 overflow-y-auto">
  <h3 className="font-semibold text-sm mb-3">{props.itemConfig.name}</h3>
  <div className="space-y-3">
    {props.fields.map(def => {
      const render = renders.find(r => r.key === def.key);
      if (!render) return null;
      return (
        <FieldFormRow
          key={def.key}
          def={def}
          render={render}
          override={props.state[def.key]}
          onChange={patch => updateOverride(def.key, patch)}
          onReset={() => resetField(def.key)}
          isSelected={selectedKey === def.key}
          onFocus={() => setSelectedKey(def.key)}
        />
      );
    })}
  </div>
</aside>
```

Add the helper component (inside the same file or split out — your call; inline keeps it together for Phase 0):

```tsx
function FieldFormRow(props: {
  def: PrintableFieldDef;
  render: FieldRender;
  override: FormModeFieldOverride | undefined;
  onChange: (patch: Partial<FormModeFieldOverride>) => void;
  onReset: () => void;
  isSelected: boolean;
  onFocus: () => void;
}) {
  const { def, render, override, onChange, onReset, isSelected, onFocus } = props;
  const hasOverride = !!override && Object.keys(override).length > 0;

  return (
    <div
      className={`p-2 rounded border ${isSelected ? 'border-[#F4A261] bg-orange-50' : 'border-gray-200'}`}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">{def.label}</label>
        {hasOverride && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-[#E07B3A]"
          >
            Reset
          </button>
        )}
      </div>
      {def.kind === 'qr' ? (
        <input
          type="text"
          value={render.url ?? ''}
          readOnly
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-500"
        />
      ) : (
        <textarea
          value={render.text ?? ''}
          onChange={e => onChange({ text: e.target.value, textOverridden: true })}
          rows={def.kind === 'text' && (def.defaultSize.height > 30) ? 3 : 1}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded resize-y"
        />
      )}
    </div>
  );
}
```

Add the `resetField` helper near `updateOverride`:

```typescript
function resetField(key: string) {
  const next = { ...props.state };
  delete next[key];
  props.onStateChange(next);
}
```

**Step 2: Verify TypeScript compiles + dev**

```
npx tsc --noEmit 2>&1 | grep -E "FormModeEditor" | head
```

**Step 3: Commit**

```bash
git add src/components/admin/bookings/FormModeEditor.tsx
git commit -m "feat(printables): add form panel inputs with reset-to-default in FormModeEditor"
```

---

## Task 11: Wire `PrintableFormEditor` to render `FormModeEditor`

**Files:**
- Modify: `src/components/admin/bookings/PrintableFormEditor.tsx`
- Modify: `src/components/admin/bookings/ConfirmPrintablesModal.tsx`

**Step 1: Replace the stub branch**

In `PrintableFormEditor.tsx`, replace the form-mode branch (currently still rendering `<PrintableEditor>`) with `<FormModeEditor>`. The router's props need to grow to include the form-mode-specific props.

Add new optional props to `PrintableEditorProps` (at `PrintableEditor.tsx`)? Better: keep `PrintableEditorProps` unchanged for the legacy editor, and define a separate `PrintableFormEditorProps` that extends it with form-mode-specific fields:

In `PrintableFormEditor.tsx`:

```tsx
'use client';

import { hasFormMode, getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { PrintableEditor, type PrintableEditorProps } from './PrintableEditor';
import { FormModeEditor } from './FormModeEditor';
import type { FormModeItemState } from '@/lib/config/formModeState';
import type { PrintableItemType } from '@/lib/config/printableTextConfig';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';

export interface PrintableFormEditorProps extends PrintableEditorProps {
  formModeState: FormModeItemState;
  onFormModeStateChange: (itemType: PrintableItemType, next: FormModeItemState) => void;
  booking: ResolverBooking;
}

export function PrintableFormEditor(props: PrintableFormEditorProps) {
  const itemType = props.itemConfig.type;
  const fields = getFieldRegistry(itemType);

  if (hasFormMode(itemType) && fields) {
    return (
      <FormModeEditor
        itemConfig={props.itemConfig}
        fields={fields}
        state={props.formModeState}
        onStateChange={next => props.onFormModeStateChange(itemType, next)}
        booking={props.booking}
        schoolName={props.schoolName}
        accessCode={props.accessCode}
        eventDate={props.eventDate}
      />
    );
  }
  return <PrintableEditor {...props} />;
}
```

**Step 2: Update the modal to pass the new props**

In `ConfirmPrintablesModal.tsx`, find the `<PrintableFormEditor ... />` site and add the form-mode props:

```tsx
<PrintableFormEditor
  {...existingProps}
  formModeState={formModeStates[currentItem.type] ?? {}}
  onFormModeStateChange={setItemFormModeState}
  booking={{
    schoolName: booking.schoolName,
    bookingDate: booking.bookingDate,
    accessCode: booking.accessCode,
    isKita: booking.isKita,
  }}
/>
```

**Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit 2>&1 | grep -E "PrintableFormEditor|FormModeEditor|ConfirmPrintablesModal" | head -20
```
Expected: empty.

**Step 4: Smoke compile dev**

Standard 30s timeout. Expect "Ready" with no errors.

**Step 5: Manual browser smoke (call out to user)**

The implementer subagent doesn't run a browser. Note in the report:

> User must verify: open Confirm Printables on a booking, navigate to flyer1 step, confirm the new form-mode editor renders (form panel on left, PDF backdrop on right with overlays). Switch to flyer2 step, confirm the legacy editor still renders.

**Step 6: Commit**

```bash
git add src/components/admin/bookings/PrintableFormEditor.tsx src/components/admin/bookings/ConfirmPrintablesModal.tsx
git commit -m "feat(printables): route migrated items through FormModeEditor"
```

---

## Task 12: `convertFormModeItemToPdfConfig` helper

**Files:**
- Modify: `src/lib/config/printableShared.ts` (add new export alongside `convertItemToPdfConfig`)
- Test: `tests/unit/printableShared.test.ts`

**Step 1: Add the failing test**

Append to `tests/unit/printableShared.test.ts`:

```typescript
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

  const fields: PrintableFieldDef[] = [
    {
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
    },
  ];

  it('produces a PrintableItemConfig with one text element using resolved value', () => {
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields,
      state: {},
      booking,
    });
    expect(result.type).toBe('flyer1-partial');
    expect(result.textElements).toHaveLength(1);
    expect(result.textElements[0].text).toBe('Am 02.06.2026 in der Lindenschule');
  });

  it('admin override replaces the resolved text', () => {
    const state: FormModeItemState = {
      'event-date-location': { text: 'CUSTOM', textOverridden: true },
    };
    const result = convertFormModeItemToPdfConfig({ type: 'flyer1', fields, state, booking });
    expect(result.textElements[0].text).toBe('CUSTOM');
  });

  it('admin position override is applied (CSS coordinates flipped to PDF)', () => {
    const state: FormModeItemState = {
      'event-date-location': { position: { x: 0, y: 0 } },
    };
    const result = convertFormModeItemToPdfConfig({
      type: 'flyer1',
      fields,
      state,
      booking,
    });
    // CSS y=0, height=40, so bottom edge at 40. PDF y = pdfHeight - 40.
    // Flyer1 PDF height is 303. -> 263.
    expect(result.textElements[0].x).toBe(0);
    expect(result.textElements[0].y).toBe(263);
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
    expect(result.qrPosition).toBeDefined();
    expect(result.qrPosition?.size).toBe(100);
    expect(result.textElements).toHaveLength(0);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx jest tests/unit/printableShared.test.ts --no-coverage 2>&1 | tail -10`
Expected: 4 new failures (function not exported).

**Step 3: Implement**

In `src/lib/config/printableShared.ts`, add:

```typescript
import { resolveFieldValues, type ResolverBooking } from './printableFieldResolver';
import { mergeFieldRender, type FormModeItemState } from './formModeState';
import {
  cssToPdfPosition,
  cssToPdfSize,
  hexToRgb,
  getPrintableConfig,
} from './printableTextConfig';
import type { PrintableFieldDef } from './printableFields';
import type { TextElementConfig, PrintableItemConfig } from '../services/printableService';
import type { EventTimelineOverrides } from '@/lib/utils/eventThresholds';

export interface FormModeItemInput {
  type: PrintableItemType;
  fields: PrintableFieldDef[];
  state: FormModeItemState;
  booking: ResolverBooking;
  overrides?: EventTimelineOverrides | null;
}

/**
 * Form-mode parallel of `convertItemToPdfConfig`.
 * Resolves field values from the booking, applies admin overrides,
 * flips CSS→PDF coordinates, and returns the same `PrintableItemConfig`
 * shape consumed by `printableService.generateAllPrintablesWithConfigs`.
 *
 * The output `type` becomes `<itemType>-partial` to signal to the generator
 * that it should pull from the partial-blank R2 template rather than the
 * legacy template.
 */
export function convertFormModeItemToPdfConfig(input: FormModeItemInput): PrintableItemConfig {
  const printableConfig = getPrintableConfig(input.type);
  const pdfHeight = printableConfig?.pdfDimensions.height ?? 303;

  const resolved = resolveFieldValues(input.fields, input.booking, input.overrides ?? null);

  const textElements: TextElementConfig[] = [];
  let qrPosition: { x: number; y: number; size: number } | undefined;

  for (const def of input.fields) {
    const render = mergeFieldRender(def, input.state[def.key], resolved[def.key] ?? defaultResolvedFor(def.kind));
    const pdfPos = cssToPdfPosition(render.position.x, render.position.y + render.size.height, pdfHeight, 1);
    const pdfSize = cssToPdfSize(render.size.width, render.size.height, 1);

    if (render.kind === 'qr') {
      qrPosition = {
        x: pdfPos.x,
        y: pdfPos.y,
        size: pdfSize.width, // QR is square; width == height
      };
      continue;
    }

    if (!render.text) continue; // skip empty text fields

    textElements.push({
      id: render.key,
      type: 'custom',
      text: render.text,
      x: pdfPos.x,
      y: pdfPos.y,
      width: pdfSize.width,
      height: pdfSize.height,
      fontSize: render.fontSize ?? 14,
      color: hexToRgb(render.color ?? '#000000'),
      fontFamily: render.fontFamily,
    });
  }

  return {
    type: `${input.type}-partial` as never, // generator dispatches on the -partial suffix
    textElements,
    qrPosition,
  };
}

function defaultResolvedFor(kind: 'text' | 'qr' | 'date') {
  if (kind === 'qr') return { kind: 'qr' as const, url: '' };
  return { kind: kind as 'text' | 'date', text: '' };
}
```

The `as never` cast on the type field bypasses the strict `PrintableType` union — Phase 0 needs the generator to recognize "partial" variants. Task 13 extends the generator to handle these.

**Step 4: Run to verify all pass**

Run: `npx jest tests/unit/printableShared.test.ts --no-coverage 2>&1 | tail -5`
Expected: all tests pass (existing + 4 new).

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "printableShared" | head`
Expected: empty.

**Step 6: Commit**

```bash
git add src/lib/config/printableShared.ts tests/unit/printableShared.test.ts
git commit -m "feat(printables): add convertFormModeItemToPdfConfig helper"
```

---

## Task 13: Wire `/api/admin/printables/generate` and `/preview` to dispatch on form-mode

**Files:**
- Modify: `src/app/api/admin/printables/generate/route.ts`
- Modify: `src/app/api/admin/printables/preview/route.ts`
- Modify: `src/lib/services/printableService.ts` (extend to handle the `-partial` template variant for flyer1)

**Step 1: Read the existing generate route**

Run: `grep -n "convertItemToPdfConfig\|generateAllPrintablesWithConfigs\|loadTemplate\|TEMPLATE_FILENAMES" src/app/api/admin/printables/generate/route.ts src/lib/services/printableService.ts | head -30`

Identify:
- Where `convertItemToPdfConfig` is called per-item.
- Where the template is loaded for each item type.
- The shape of the request body.

**Step 2: Add request-body fields for form-mode**

The wizard needs to send `formModeState` alongside `textElements` for migrated items. Update the API request schema:

```typescript
// In generate/route.ts request type:
items: Array<{
  type: PrintableItemType;
  status?: 'confirmed' | 'skipped' | 'pending';
  // Legacy items:
  textElements?: TextElement[];
  qrPosition?: { x: number; y: number; size: number };
  canvasScale?: number;
  // Form-mode items (Phase 0+):
  formModeState?: FormModeItemState;
}>;
```

**Step 3: Dispatch on `hasFormMode` in the conversion step**

Find the loop that builds `itemConfigs`. Replace with:

```typescript
import { hasFormMode, getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { convertItemToPdfConfig, convertFormModeItemToPdfConfig } from '@/lib/config/printableShared';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';

// Build the booking projection once:
const resolverBooking: ResolverBooking = {
  schoolName,
  bookingDate: eventDate,
  accessCode,
  isKita: bookingRecord?.isKita,
};

const itemConfigs = confirmedItems.map(item => {
  if (hasFormMode(item.type)) {
    const fields = getFieldRegistry(item.type)!;
    return convertFormModeItemToPdfConfig({
      type: item.type,
      fields,
      state: item.formModeState ?? {},
      booking: resolverBooking,
    });
  }
  return convertItemToPdfConfig({
    type: item.type,
    textElements: item.textElements ?? [],
    qrPosition: item.qrPosition,
    canvasScale: item.canvasScale,
  });
});
```

**Step 4: Teach `printableService` about `-partial` template variants**

In `src/lib/services/printableService.ts`, find the function that loads templates per item type. Add a branch: if the item config's `type` ends with `-partial`, load `templates/flyer1-partial-template.pdf` and pick the right page (page 0 for `flyer1`, page 1 for `flyer1-back`).

Pseudocode for the template-load section:

```typescript
async function loadTemplateForItem(itemConfig: PrintableItemConfig): Promise<{ pdf: PDFDocument; pageIndex: number }> {
  if (itemConfig.type === 'flyer1-partial' || itemConfig.type === 'flyer1-back-partial') {
    const r2Bytes = await r2Service.fetchTemplate('flyer1-partial-template.pdf');
    const pdf = await PDFDocument.load(r2Bytes);
    const pageIndex = itemConfig.type === 'flyer1-partial' ? 0 : 1;
    return { pdf, pageIndex };
  }
  // Legacy path:
  const filename = TEMPLATE_FILENAMES[itemConfig.type];
  const r2Bytes = await r2Service.fetchTemplate(filename);
  const pdf = await PDFDocument.load(r2Bytes);
  return { pdf, pageIndex: 0 };
}
```

The exact integration depends on how `printableService` is currently structured. The implementer may need to refactor a small section to support the `pageIndex` selection for multi-page templates. Read the existing template-load code and adapt.

**Step 5: Update the upload step to use the legacy R2 output key**

The OUTPUT key in R2 (e.g. `events/{eventId}/printables/flyers/flyer1.pdf`) stays the same — readers downstream don't change. The `-partial` suffix is purely internal to the generator. After generating the PDF, save under the original `PRINTABLE_FILENAMES[itemType]` key.

In other words: input type `flyer1-partial` → load partial-blank template → output as `flyer1.pdf` (matches the legacy filename).

Confirm by reading `r2Service.uploadGeneratedPrintable` (or equivalent) and verifying the output key is derived from the original `itemType` (e.g. `flyer1`), not `flyer1-partial`. If the generator currently passes `flyer1-partial` directly to the upload step, intercept and rewrite to `flyer1` for uploads.

**Step 6: Apply the same dispatch to the preview route**

In `src/app/api/admin/printables/preview/route.ts`, do the same: if `hasFormMode(item.type)`, use `convertFormModeItemToPdfConfig`; load the partial-blank template.

**Step 7: Verify TypeScript compiles**

```
npx tsc --noEmit 2>&1 | grep -E "generate/route|preview/route|printableService" | head -20
```
Expected: empty.

**Step 8: Smoke compile dev**

Standard 30s timeout.

**Step 9: Commit**

```bash
git add src/app/api/admin/printables/generate/route.ts src/app/api/admin/printables/preview/route.ts src/lib/services/printableService.ts
git commit -m "feat(printables): route flyer1 generation through partial-blank template + form-mode converter"
```

---

## Task 14: Final verification

**Files:** none modified; this is a verification + manual smoke.

**Step 1: Full Jest unit-test run**

```
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all printables-related tests pass. New test counts (vs Phase −1 baseline):
- `printableFieldResolver.test.ts`: 21 (was 17, +4 from Task 1)
- `printableFieldRegistries/flyer1.test.ts`: ~9 (Task 4)
- `printableFieldRegistry.test.ts`: 6 (was 2, +4 from Task 5)
- `formModeState.test.ts`: ~7 (Task 6)
- `printableShared.test.ts`: ~22 (was 18, +4 from Task 12)

**Step 2: Type check**

```
npx tsc --noEmit 2>&1 | tail -50
```

Phase 0 files should produce no new errors. Pre-existing errors in unrelated files are not blockers.

**Step 3: Production build**

```
npm run build 2>&1 | tail -50
```

Expected: build succeeds.

**Step 4: Manual checklist for the user**

The implementer subagent CANNOT do these — list them in the report:

1. **R2 upload (one-time)**:
   ```
   pnpm tsx scripts/upload-printable-templates.ts
   ```
   Verify in R2 console that `templates/flyer1-partial-template.pdf` exists.

2. **Browser smoke test** on staging or local dev:
   - Open Confirm Printables on a booking with a known event date and a known KiTa or School isKita value.
   - Navigate to the flyer1 step (Papers tab, step 1).
   - Verify the new form-mode editor renders: form panel on the left with one input ("Event date + location") prefilled with `Am DD.MM.YYYY in der {schoolName}`, canvas on the right with the partially-blank front-page PNG and a draggable text overlay positioned to the right of the calendar X icon.
   - Drag the overlay; release; reload the modal; verify the position persists (localStorage `-form` key).
   - Edit the input text; verify the canvas overlay updates live; click "Reset"; verify it falls back to the auto-fill.
   - Navigate to flyer1-back step. Verify all 6 fields render correctly: T-shirt body paragraph, two shirt labels (school name), QR code in yellow box, QR caption beneath, discount end date in the orange pill.
   - Confirm both flyer1 + flyer1-back items.
   - Click "Generate All". Wait for completion.
   - Open the generated `flyer1.pdf` from R2 (or via the admin UI's download link). Compare visually against `Filled out Flyers/Flyer 1/Flyer 1 Example Filled (School).pdf`.
   - Tolerance: positions should be within 1-2 pixels of the reference; if any field is wildly off (e.g. QR code in a corner), log the discrepancy and adjust the field's `defaultPosition` in `flyer1.ts`.
   - Repeat for a KiTa booking: confirm the "T-shirt body" paragraph reads "...eurer KiTa..." instead of "...eurer Schule...".

3. **Position iteration loop**:
   - If any field's default position is off, edit `src/lib/config/printableFieldRegistries/flyer1.ts` with the corrected coordinates.
   - Re-run the browser smoke test.
   - Iterate until the rendered PDF matches the reference within tolerance.
   - Each position adjustment commit: `fix(printables): adjust flyer1 <field-key> default position`.

**Step 5: Inventory uncommitted state**

```
git status --short | head -20
```

Expected: only Phase 0 files committed; user's other in-progress work untouched.

**Step 6: If position iteration is needed**

Run the implementer ONE more time to amend `flyer1.ts` positions based on the user's measurements. Commit each round as a separate `fix(printables): ...` commit.

**Step 7: Report**

Final report should include:
- All test counts and pass/fail status.
- tsc result.
- Build result.
- Any uncommitted Phase 0 files.
- A reminder to the user about the manual R2 upload + browser smoke test.
- Iteration commits, if any.

---

## Out of scope for Phase 0 (deferred to Phase 1+ or follow-ups)

These were flagged during Phase −1 reviews or are architectural decisions deferred to later phases:

1. **`bookingToResolverInput(b: BookingWithDetails)` adapter** — the modal currently constructs a `ResolverBooking` inline at the call site. Extract a single helper if/when more call sites appear.
2. **`eventShortUrl(accessCode)` helper** in `printableShared.ts` to consolidate the `https://minimusiker.app/e/<code>` pattern across `qrUrl` resolver, `qrCaption` resolver, `printables/generate` route, `printables/preview` route.
3. **Retire the buggy long-form `formatGermanDate` in `printableConfig.ts`** (uses `new Date(iso)` which is timezone-unsafe). Migrate `printableService.ts:828, 974` and the duplicated definitions in `ProjectDetailCard.tsx` and `ProjectCard.tsx`.
4. **Scope `loadPrintablesStatus`'s first-pending search to the active tab** (Phase −1 Task 10 review).
5. **Exhaustiveness check on `wrap()` in `printableFieldResolver.ts`** — currently has `case 'text': default:` collapse; tighten if a 4th `PrintableFieldKind` is ever added.
6. **Drop legacy `flyer1-template.pdf` and `flyer1-back-template.pdf` from R2** once Phase 0 ships and is stable in production.
7. **Phase 1+ migrations**: Flyer 2, Flyer 3, Minicard, CD Booklet — each follows the same 14-task template structure.

---

## Files touched in Phase 0

```
Create: src/lib/config/printableFieldRegistries/flyer1.ts
Create: src/lib/config/formModeState.ts
Create: src/components/admin/bookings/FormModeEditor.tsx
Create: scripts/render-printable-previews.sh
Create: scripts/upload-printable-templates.ts
Create: public/images/printable_previews/flyer1-partial-front.png
Create: public/images/printable_previews/flyer1-partial-back.png

Modify: src/lib/config/printableFields.ts (extend ComputedFieldName)
Modify: src/lib/config/printableFieldResolver.ts (2 new cases)
Modify: src/lib/config/printableFieldRegistry.ts (register flyer1)
Modify: src/lib/config/printableShared.ts (add convertFormModeItemToPdfConfig)
Modify: src/components/admin/bookings/PrintableFormEditor.tsx (route to FormModeEditor)
Modify: src/components/admin/bookings/ConfirmPrintablesModal.tsx (form-mode state slice)
Modify: src/lib/services/printableService.ts (handle -partial template variant)
Modify: src/app/api/admin/printables/generate/route.ts (dispatch on hasFormMode)
Modify: src/app/api/admin/printables/preview/route.ts (dispatch on hasFormMode)

Create: tests/unit/printableFieldRegistries/flyer1.test.ts
Create: tests/unit/formModeState.test.ts
Modify: tests/unit/printableFieldResolver.test.ts (4 new tests)
Modify: tests/unit/printableFieldRegistry.test.ts (4 new tests)
Modify: tests/unit/printableShared.test.ts (4 new tests)
```

After Phase 0 ships:
- `flyer1` and `flyer1-back` use form-mode end-to-end.
- All other items still use the legacy editor.
- Generated PDFs for flyer1/flyer1-back match the reference filled examples.
- Phase 1 starts: same task structure, just with Flyer 2's PDF + fields + positions.
