# Mix Fertig → Trigger Emails Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert two timeline-based emails (`Trigger: Eltern - Mix fertig`, `Trigger: E-Mail 4 - Mix für Schule ist fertig`) into three event-driven trigger emails: a parent email split into audio-buyer and non-audio-buyer variants plus a single teacher email — all firing when the mix is actually ready (engineer submitted finals + schulsong teacher-approved if applicable) instead of on a fixed +7 day schedule.

**Architecture:** Pure cron-polled trigger pattern (same shape as `processSchulsongReleaseEmails`). One new `processMixReadyEmails()` runs hourly inside the 6–8am Berlin window from `/api/cron/email-automation`, finds Mimi/Plus-tier events meeting all readiness conditions, and fires the appropriate trigger registry entry per recipient using EMAIL_LOGS dedup. Audience split for parents uses a new `hasAudioPurchaseForEvent()` helper that recognises any audio-category line item (broader than the existing `hasMinicardForEvent` digital-access check).

**Tech Stack:** Next.js App Router · TypeScript · Airtable (templates, events, orders) · Resend (delivery) · Jest (unit tests)

---

## Background and decisions (read first)

### What the existing emails do today

| Airtable record id | Name | Audience | triggerDays | Event-type flags |
|---|---|---|---|---|
| `rec4Mcz6yJG3TJZyn` | `Trigger: Eltern - Mix fertig` | parent | +7 @ 07:00 | is_minimusikertag + is_plus |
| `recSsdDqf0QYc3DSD` | `Trigger: E-Mail 4 - Mix für Schule ist fertig` | teacher | +7 @ 07:00 | is_minimusikertag + is_plus |

Both are stored as Timeline templates (no `template_type` set → treated as timeline). They fire purely off the +7-day mark via `processEmailAutomation` — no check on whether engineer finals exist or whether (for schulsong-appended events) the schulsong has been approved.

### Why this is wrong

Parent audio access in `src/app/api/parent/audio-access/route.ts` is gated by:
- engineer-uploaded final files actually existing on R2,
- `audio_hidden !== true`,
- for schulsong-included events, `schulsong_released_at <= now`,
- the +7 / +14 day timing thresholds.

If the engineer is late or the schulsong isn't approved by day +7, the email lands while there's nothing to listen to. Per the user: "no audio is released before (if `is_schulsong`) the schulsong is approved" and "no audio released if the finals are not present from the minimusikertag engineer" — so the email should fire when the audio is actually ready, not on a fixed schedule.

### Trigger condition (decided)

Fire the email when ALL of:
- `getEventTier(event)` is `'minimusikertag'` or `'plus'` (Mimi-only and combined Mimi+Schulsong; pure Schulsong-only events are out of scope and keep the existing `schulsong_audio_release` / `schulsong_parent_release` triggers),
- `event.status` is not `'Cancelled'` and not `'Deleted'`,
- `parseOverrides(event.timeline_overrides)?.communications_paused` is not true,
- `event.audio_pipeline_stage === 'finals_submitted'` (set by engineer's manual submit-for-review click),
- if `event.is_schulsong === true`: `event.schulsong_released_at` is not null (teacher has approved schulsong — the route at `src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts:61` writes this automatically),
- `parseOverrides(event.timeline_overrides)?.audio_hidden !== true`.

**No time-of-event gate** (no `event_date + 14`). Per the user's accepted answer to AskUserQuestion: "Engineer submit-for-review (+ schulsong if applicable)" — they accepted that this can fire before the +7 preview moment for early-mixed events. Cron-runs are throttled to 6–8am Berlin which gives a natural send time.

### Audience split (decided)

| Pool | Sent which email |
|---|---|
| parents who have at least one paid order whose line items contain an audio-category variant (minicard / cd / minicard-cd-bundle / bluetooth-box, across Mimi+Plus profiles) | `parent_mix_ready_audio_buyer` |
| parents registered for the event whose orders contain no audio variants (or who have no paid orders at all) | `parent_mix_ready_non_audio_buyer` |
| teachers (one email, single template) | `teacher_mix_ready` |

This is broader than the existing `hasMinicardForEvent` digital-access check (which excludes CD-only buyers): user explicitly chose "Any audio-category line item (incl. CD-only)".

### Old templates

`rec4Mcz6yJG3TJZyn` and `recSsdDqf0QYc3DSD` will be deactivated in Airtable (flip `active=false`). Records preserved for audit. Manual one-off step at the end of the rollout — no migration script needed.

### Files map

**Read for context (do not modify):**
- `src/lib/services/emailAutomationService.ts` — esp. `processSchulsongReleaseEmails` (lines 783–838) — the pattern we're cloning
- `src/lib/services/schulsongEmailService.ts` — the per-event sender we're cloning
- `src/lib/config/trigger-email-registry.ts` — where new defaults go
- `src/lib/config/trigger-event-catalog.ts` — where new event entry goes
- `src/lib/utils/minicardAccess.ts` — the existing audio-access helper (do not change; we're adding a sibling)
- `src/lib/config/shopProfiles.ts` — where `MINICARD_VARIANT_IDS` lives (we add `AUDIO_PRODUCT_VARIANT_IDS`)
- `src/app/api/cron/email-automation/route.ts` — where we wire the new cron handler

**Will be created:**
- `src/lib/utils/audioPurchaseAccess.ts` — the new `hasAudioPurchaseForEvent` helper
- `src/lib/services/mixReadyEmailService.ts` — per-event sender, mirrors `schulsongEmailService.ts`
- `tests/unit/audioPurchaseAccess.test.ts` — unit tests for variant-detection logic
- `tests/unit/mixReadyEligibility.test.ts` — unit tests for the eligibility predicate

**Will be modified:**
- `src/lib/config/shopProfiles.ts` — add `AUDIO_PRODUCT_VARIANT_IDS` set
- `src/lib/config/trigger-event-catalog.ts` — add `event:mix_ready_for_release`
- `src/lib/config/trigger-email-registry.ts` — add three new registry entries with defaults
- `src/lib/services/emailAutomationService.ts` — add `processMixReadyEmails` exported function
- `src/app/api/cron/email-automation/route.ts` — call `processMixReadyEmails` in the 6–8am window

**Manual Airtable step at end (no code):**
- Set `Active=false` on records `rec4Mcz6yJG3TJZyn` and `recSsdDqf0QYc3DSD`.

---

## Phase 1 — Foundations: audio-buyer detection

### Task 1: Add `AUDIO_PRODUCT_VARIANT_IDS` constant

**Files:**
- Modify: `src/lib/config/shopProfiles.ts` (append after `MINICARD_VARIANT_IDS`, around line 363)

**Step 1: Read current variant ID exports**

Confirm the exact location and final lines of the existing `MINICARD_VARIANT_IDS` block so we add the new export right after it without disrupting the profile constants further down.

Run: `grep -n "MINICARD_VARIANT_IDS\|export const \(MINIMUSIKERTAG\|PLUS\)_VARIANT_MAP" src/lib/config/shopProfiles.ts`

Expected: shows `MINICARD_VARIANT_IDS` on or near line 354 and the variant maps earlier in the file.

**Step 2: Add the new constant**

After the closing `]);` of `MINICARD_VARIANT_IDS`, insert:

```ts
/**
 * All Shopify variant IDs for audio-category products across all profiles
 * (Minicard, CD, Minicard+CD bundle, Kinderliederbox).
 * Used by `hasAudioPurchaseForEvent` to classify a parent as an "audio buyer".
 *
 * Broader than `MINICARD_VARIANT_IDS`, which is restricted to digital-access
 * variants (CD-only is intentionally excluded there because the CD doesn't
 * grant digital streaming access).
 */
export const AUDIO_PRODUCT_VARIANT_IDS = new Set([
  // Minimusikertag profile
  '53258099720538',   // Minicard
  '53258098639194',   // CD
  '53327238824282',   // Minicard+CD bundle
  '53265570824538',   // Kinderliederbox
  // PLUS profile
  '53440629375322',   // Minicard PLUS
  '53525559771482',   // CD PLUS
  '53525549089114',   // Minicard+CD bundle PLUS
  '53836123472218',   // Kinderliederbox PLUS
]);
```

The 8 variant IDs are sourced verbatim from `MINIMUSIKERTAG_VARIANT_MAP` and `PLUS_VARIANT_MAP` in the same file. SCS profiles reuse these maps so they're covered automatically.

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/lib/config/shopProfiles.ts
git commit -m "feat(audio): add AUDIO_PRODUCT_VARIANT_IDS spanning all audio products"
```

---

### Task 2: Write the failing tests for `hasAudioPurchaseForEvent`

**Files:**
- Create: `tests/unit/audioPurchaseAccess.test.ts`

The function we are about to add will mirror `hasMinicardForEvent` but check the broader variant set. We write the tests before any implementation.

**Step 1: Create the test file**

```ts
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
  it.todo('returns true when product_title contains "minicard" / "kinderliederbox" / "tonie" (case-insensitive)');
  it.todo('returns false when line items contain only T-shirts or hoodies');
  it.todo('returns false on empty / malformed line items');
});
```

**Step 2: Run the tests to confirm two pass and four are pending**

Run: `npx jest tests/unit/audioPurchaseAccess.test.ts -t "AUDIO_PRODUCT_VARIANT_IDS"`
Expected: 3 passing.

Run: `npx jest tests/unit/audioPurchaseAccess.test.ts`
Expected: 3 passing + 4 pending (todo).

**Step 3: Commit**

```bash
git add tests/unit/audioPurchaseAccess.test.ts
git commit -m "test(audio): pin AUDIO_PRODUCT_VARIANT_IDS coverage; stub line-item classifier"
```

---

### Task 3: Implement `classifyLineItemsAsAudioPurchase` to make four todos pass

**Files:**
- Create: `src/lib/utils/audioPurchaseAccess.ts`
- Modify: `tests/unit/audioPurchaseAccess.test.ts` (replace the four `it.todo` calls with real assertions)

**Step 1: Replace the four `it.todo` calls in the test file**

```ts
import { classifyLineItemsAsAudioPurchase } from '@/lib/utils/audioPurchaseAccess';
// ...inside the existing `describe('classifyLineItemsAsAudioPurchase ...')` block:
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
  // @ts-expect-error - simulating malformed runtime input
  expect(classifyLineItemsAsAudioPurchase(null)).toBe(false);
  // @ts-expect-error - simulating malformed runtime input
  expect(classifyLineItemsAsAudioPurchase(undefined)).toBe(false);
});
```

**Step 2: Run the tests and confirm all four fail with the same import error**

Run: `npx jest tests/unit/audioPurchaseAccess.test.ts`
Expected: import error from `@/lib/utils/audioPurchaseAccess` (module not found) — all four new tests fail.

**Step 3: Create the implementation file**

```ts
// src/lib/utils/audioPurchaseAccess.ts
import { getAirtableService } from '@/lib/services/airtableService';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import { AUDIO_PRODUCT_VARIANT_IDS } from '@/lib/config/shopProfiles';

// 'cd' deliberately omitted — too short, would false-match titles like "ABCD pack".
// CD variants are covered by variant_id matching against AUDIO_PRODUCT_VARIANT_IDS.
const AUDIO_TITLE_KEYWORDS = ['minicard', 'kinderliederbox', 'tonie'];

/**
 * Pure: does any line item count as an audio-category purchase?
 * Order matters: variant_id is authoritative, product_title is a fallback
 * for legacy / custom orders where the variant isn't in our variant-ID set.
 */
export function classifyLineItemsAsAudioPurchase(
  lineItems: ShopifyOrderLineItem[] | null | undefined
): boolean {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return false;
  for (const item of lineItems) {
    const numericId = (item.variant_id || '').replace('gid://shopify/ProductVariant/', '');
    if (numericId && AUDIO_PRODUCT_VARIANT_IDS.has(numericId)) return true;

    const title = (item.product_title || '').toLowerCase();
    for (const kw of AUDIO_TITLE_KEYWORDS) {
      if (title.includes(kw)) return true;
    }
  }
  return false;
}

/**
 * Has this parent purchased ANY audio-category product (minicard, CD,
 * bundle, or Kinderliederbox) for this event?
 *
 * Used to split the parent "Mix fertig" trigger email between buyers and
 * non-buyers. Distinct from `hasMinicardForEvent` (audio-access gate),
 * which deliberately excludes CD-only buyers.
 *
 * Implementation mirrors `hasMinicardForEvent` exactly so the behaviour
 * around event matching (booking_id and event_id link) stays consistent.
 */
export async function hasAudioPurchaseForEvent(
  parentRecordId: string,
  eventId: string
): Promise<boolean> {
  const airtable = getAirtableService();
  const base = airtable.getBase();
  const ordersTable = base(ORDERS_TABLE_ID);

  const orders = await ordersTable
    .select({
      filterByFormula: `AND(
        {${ORDERS_FIELD_IDS.payment_status}} = 'paid',
        FIND('${parentRecordId}', ARRAYJOIN({${ORDERS_FIELD_IDS.parent_id}}, ','))
      )`,
      returnFieldsByFieldId: true,
    })
    .all();

  if (orders.length === 0) return false;

  for (const order of orders) {
    const orderBookingId = order.get(ORDERS_FIELD_IDS.booking_id) as string | undefined;
    const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;

    let isForEvent = false;
    if (orderBookingId && orderBookingId === eventId) isForEvent = true;
    if (!isForEvent && eventIds) {
      try {
        for (const eventRecId of eventIds) {
          const eventRecord = await base('Events').find(eventRecId);
          const canonicalEventId = eventRecord.get('event_id') as string | undefined;
          if (canonicalEventId === eventId) { isForEvent = true; break; }
        }
      } catch {
        // event lookup failed — continue with what we have
      }
    }
    if (!isForEvent) continue;

    const lineItemsRaw = order.get(ORDERS_FIELD_IDS.line_items);
    let lineItems: ShopifyOrderLineItem[];
    try {
      lineItems = typeof lineItemsRaw === 'string' ? JSON.parse(lineItemsRaw) : (lineItemsRaw as ShopifyOrderLineItem[]);
    } catch {
      continue;
    }

    if (classifyLineItemsAsAudioPurchase(lineItems)) return true;
  }

  return false;
}
```

**Step 4: Run the tests**

Run: `npx jest tests/unit/audioPurchaseAccess.test.ts`
Expected: 7 passing.

**Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 6: Commit**

```bash
git add src/lib/utils/audioPurchaseAccess.ts tests/unit/audioPurchaseAccess.test.ts
git commit -m "feat(audio): add hasAudioPurchaseForEvent for buyer/non-buyer email split"
```

---

## Phase 2 — Trigger registry: defaults for the three new emails

### Task 4: Add `event:mix_ready_for_release` to the catalog

**Files:**
- Modify: `src/lib/config/trigger-event-catalog.ts` (append a new entry inside `TRIGGER_EVENT_CATALOG`)

**Step 1: Append the entry**

Add inside the array, before the closing `];`:

```ts
{
  key: 'event:mix_ready_for_release',
  name: 'Mix fertig (Audio-Release)',
  description:
    'Wird ausgelöst, wenn der Mix für ein Mimi-/Plus-Event fertiggestellt ist: ' +
    'der Engineer hat die Finals abgegeben (audio_pipeline_stage=finals_submitted) ' +
    'und – falls Schulsong angehängt ist – der Lehrer hat den Schulsong freigegeben ' +
    '(schulsong_released_at gesetzt). Polled hourly im 6–8 Uhr Berlin Fenster.',
  availableVariables: ['schoolName', 'eventDate', 'parentName', 'parentFirstName', 'childName', 'className', 'parentPortalLink'],
  recipientMode: 'specific',
},
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/lib/config/trigger-event-catalog.ts
git commit -m "feat(emails): add event:mix_ready_for_release to trigger event catalog"
```

---

### Task 5: Add three registry entries with defaults

**Files:**
- Modify: `src/lib/config/trigger-email-registry.ts` (append three entries inside `TRIGGER_EMAIL_REGISTRY`)

Templates use the same `{{variable}}` substitution syntax as existing trigger entries. We're keeping the body deliberately close to the existing Airtable template subjects so admins can carry over their copy with minimal edits, and we surface a portal CTA so the email is actionable when audio is reachable.

**Step 1: Append entries**

```ts
{
  slug: 'parent_mix_ready_audio_buyer',
  name: 'Mix fertig — Eltern (Audio-Käufer)',
  description: 'Eltern, die für dieses Event ein Audio-Produkt (Minicard, CD, Bundle, Kinderliederbox) gekauft haben.',
  recipientType: 'parent',
  defaultSubject: 'Hier singt {{childName}}! Eure Aufnahmen sind fertig.',
  defaultBodyHtml: `
    <p>Hallo {{parentFirstName}},</p>
    <p>die Aufnahmen vom Minimusikertag an der {{schoolName}} sind fertig — und {{childName}} ist live dabei.</p>
    <p>Da ihr bereits Audio bestellt habt, könnt ihr die Aufnahmen jederzeit über euer Familien-Portal abspielen, sobald sie zur Veröffentlichung freigegeben sind.</p>
    <p><a href="{{parentPortalLink}}">Zum Familien-Portal →</a></p>
    <p>Liebe Grüße<br/>Euer Minimusiker-Team</p>
  `,
  triggerEventKey: 'event:mix_ready_for_release',
  availableVariables: ['schoolName', 'eventDate', 'parentName', 'parentFirstName', 'childName', 'className', 'parentPortalLink'],
},
{
  slug: 'parent_mix_ready_non_audio_buyer',
  name: 'Mix fertig — Eltern (kein Audio-Kauf)',
  description: 'Eltern dieses Events, die noch kein Audio-Produkt gekauft haben.',
  recipientType: 'parent',
  defaultSubject: 'Hier singt {{childName}}! Hört jetzt in die Aufnahme rein.',
  defaultBodyHtml: `
    <p>Hallo {{parentFirstName}},</p>
    <p>die Aufnahmen vom Minimusikertag an der {{schoolName}} sind fertig — und {{childName}} ist live dabei.</p>
    <p>Im Familien-Portal könnt ihr eine Hörprobe abspielen — und dort auch eine Minicard oder Kinderliederbox bestellen, um die kompletten Aufnahmen herunterzuladen und unbegrenzt anzuhören.</p>
    <p><a href="{{parentPortalLink}}">Reinhören und bestellen →</a></p>
    <p>Liebe Grüße<br/>Euer Minimusiker-Team</p>
  `,
  triggerEventKey: 'event:mix_ready_for_release',
  availableVariables: ['schoolName', 'eventDate', 'parentName', 'parentFirstName', 'childName', 'className', 'parentPortalLink'],
},
{
  slug: 'teacher_mix_ready',
  name: 'Mix fertig — Lehrer',
  description: 'Lehrer eines Mimi-/Plus-Events: alle Aufnahmen sind gemixt und ggf. Schulsong vom Lehrer freigegeben.',
  recipientType: 'teacher',
  defaultSubject: 'So klingt die {{schoolName}}! Hört jetzt in eure Aufnahmen rein.',
  defaultBodyHtml: `
    <p>Hallo,</p>
    <p>die Aufnahmen vom Minimusikertag an der {{schoolName}} sind fertig.</p>
    <p>Du kannst die Mixe ab sofort in deinem Pädagogen-Portal anhören.</p>
    <p><a href="{{parentPortalLink}}">Zum Pädagogen-Portal →</a></p>
    <p>Liebe Grüße<br/>Euer Minimusiker-Team</p>
  `,
  triggerEventKey: 'event:mix_ready_for_release',
  availableVariables: ['schoolName', 'parentPortalLink'],
},
```

(The `parentPortalLink` for the teacher entry is intentionally reused as a generic "portal link" — render-time we'll feed the teacher portal URL through the same variable name to keep the template simple. If we later want different templating, that's a follow-up.)

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 3: Spot-check by running the existing trigger-template service in a unit test or REPL**

There's no dedicated test for the registry, but `getRegistryEntry('parent_mix_ready_audio_buyer')` should return the new entry. Quick sanity check via tsx:

```bash
npx tsx -e "import('./src/lib/config/trigger-email-registry.ts').then(m => console.log(m.getRegistryEntry('parent_mix_ready_audio_buyer')?.name))"
```

Expected: prints `Mix fertig — Eltern (Audio-Käufer)`.

**Step 4: Commit**

```bash
git add src/lib/config/trigger-email-registry.ts
git commit -m "feat(emails): add parent buyer/non-buyer + teacher mix-ready registry entries"
```

---

## Phase 3 — Eligibility predicate and per-event sender

### Task 6: Write failing test for `isMixReadyForEvent` eligibility predicate

The eligibility predicate is the single place that encodes the trigger condition. Pulled into its own pure function so it can be unit-tested without Airtable.

**Files:**
- Create: `tests/unit/mixReadyEligibility.test.ts`

**Step 1: Create the test file**

```ts
import { isMixReadyForEvent } from '@/lib/services/mixReadyEmailService';
import type { Event } from '@/lib/types/airtable';

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'recE',
    event_id: 'evt_1',
    school_name: 'Test',
    event_date: '2026-04-01',
    is_minimusikertag: true,
    is_plus: false,
    is_schulsong: false,
    is_kita: false,
    status: 'Confirmed',
    audio_pipeline_stage: 'finals_submitted',
    schulsong_released_at: undefined,
    timeline_overrides: undefined,
    ...overrides,
  } as Event;
}

describe('isMixReadyForEvent', () => {
  it('Mimi event with finals_submitted is eligible', () => {
    expect(isMixReadyForEvent(baseEvent())).toBe(true);
  });

  it('Plus event with finals_submitted is eligible', () => {
    expect(isMixReadyForEvent(baseEvent({ is_minimusikertag: false, is_plus: true }))).toBe(true);
  });

  it('schulsong-only event is NOT eligible (handled by existing schulsong_release trigger)', () => {
    expect(isMixReadyForEvent(baseEvent({ is_minimusikertag: false, is_plus: false, is_schulsong: true }))).toBe(false);
  });

  it('Mimi+Schulsong combined event needs schulsong_released_at to be set', () => {
    expect(isMixReadyForEvent(baseEvent({ is_schulsong: true }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ is_schulsong: true, schulsong_released_at: '2026-04-15T07:00:00Z' }))).toBe(true);
  });

  it('not eligible when audio_pipeline_stage is not finals_submitted', () => {
    expect(isMixReadyForEvent(baseEvent({ audio_pipeline_stage: 'staff_uploaded' }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ audio_pipeline_stage: 'not_started' }))).toBe(false);
  });

  it('not eligible when event is cancelled or deleted', () => {
    expect(isMixReadyForEvent(baseEvent({ status: 'Cancelled' }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ status: 'Deleted' }))).toBe(false);
  });

  it('not eligible when audio_hidden is set in timeline_overrides', () => {
    expect(isMixReadyForEvent(baseEvent({ timeline_overrides: '{"audio_hidden":true}' }))).toBe(false);
  });

  it('not eligible when communications_paused is set in timeline_overrides', () => {
    expect(isMixReadyForEvent(baseEvent({ timeline_overrides: '{"communications_paused":true}' }))).toBe(false);
  });
});
```

**Step 2: Run the test to confirm import failure**

Run: `npx jest tests/unit/mixReadyEligibility.test.ts`
Expected: import error from `@/lib/services/mixReadyEmailService` — all eight tests fail.

**Step 3: Commit**

```bash
git add tests/unit/mixReadyEligibility.test.ts
git commit -m "test(emails): add failing eligibility tests for mix-ready trigger"
```

---

### Task 7: Implement `isMixReadyForEvent` predicate

**Files:**
- Create: `src/lib/services/mixReadyEmailService.ts`

**Step 1: Create file with predicate only (sender comes in next task)**

```ts
import type { Event } from '@/lib/types/airtable';
import { parseOverrides } from '@/lib/utils/eventThresholds';
import { getEventTier } from '@/lib/services/emailAutomationService';

export function isMixReadyForEvent(event: Event): boolean {
  // Tier check — Mimi/Plus only. Pure schulsong-only is handled by the
  // existing schulsong_release trigger.
  const tier = getEventTier({
    isMinimusikertag: event.is_minimusikertag,
    isPlus: event.is_plus,
    isSchulsong: event.is_schulsong,
    eventId: event.event_id,
    schoolName: event.school_name,
  });
  if (tier !== 'minimusikertag' && tier !== 'plus') return false;

  if (event.status === 'Cancelled' || event.status === 'Deleted') return false;

  if (event.audio_pipeline_stage !== 'finals_submitted') return false;

  // For schulsong-appended events, teacher must have approved schulsong
  // (the approve route writes schulsong_released_at to a non-null value).
  if (event.is_schulsong && !event.schulsong_released_at) return false;

  const overrides = parseOverrides(event.timeline_overrides);
  if (overrides?.audio_hidden === true) return false;
  if (overrides?.communications_paused === true) return false;

  return true;
}
```

**Step 2: Run the eligibility tests**

Run: `npx jest tests/unit/mixReadyEligibility.test.ts`
Expected: 8 passing.

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/lib/services/mixReadyEmailService.ts
git commit -m "feat(emails): add isMixReadyForEvent eligibility predicate"
```

---

### Task 8: Implement per-event senders

**Files:**
- Modify: `src/lib/services/mixReadyEmailService.ts` (append the senders)

The shape mirrors `schulsongEmailService.ts`. Three sends per event:
1. teacher recipients → `teacher_mix_ready`
2. parent recipients (audio buyers) → `parent_mix_ready_audio_buyer`
3. parent recipients (non-buyers) → `parent_mix_ready_non_audio_buyer`

Each parent recipient is partitioned via `hasAudioPurchaseForEvent(parentRecordId, eventId)`. We pass the parent's Airtable record id (which `getParentRecipientsForEvent` does NOT currently include in its templateData) — we need to extend the recipient shape to carry `parentRecordId` so we can look up purchases without re-querying parents.

#### Step 1: Extend `EmailRecipient` to carry `parentRecordId` (read-only annotation, optional)

**Files:**
- Modify: `src/lib/types/email-automation.ts` (add `parentRecordId?: string` to `EmailRecipient`)
- Modify: `src/lib/services/emailAutomationService.ts` `getParentRecipientsForEvent` (line ~404) — when constructing the recipient, also set `parentRecordId: parentRecordId`

```ts
// In emailAutomationService.ts, inside the recipients.push({...}) for parents:
recipients.push({
  email: parent.parent_email,
  name: parent.parent_first_name,
  type: 'parent',
  eventId: eventId,
  classId: registration.class_id?.[0],
  parentRecordId,  // <-- new
  templateData: { /* unchanged */ },
});
```

```ts
// In email-automation.ts, EmailRecipient interface:
export interface EmailRecipient {
  email: string;
  name?: string;
  type: 'teacher' | 'parent' | 'non-buyer';
  eventId: string;
  classId?: string;
  parentRecordId?: string;   // <-- new (optional; only set for parent recipients)
  templateData: TemplateData;
}
```

This is purely additive — every existing call site gets a no-op (optional field). Run `npx tsc --noEmit` after the change.

#### Step 2: Add the senders in `mixReadyEmailService.ts`

```ts
import { Resend } from 'resend';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  getTeacherRecipientsForEvent,
  getParentRecipientsForEvent,
  sleep,
} from '@/lib/services/emailAutomationService';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';
import { getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { hasAudioPurchaseForEvent } from '@/lib/utils/audioPurchaseAccess';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';
import type {
  EventThresholdMatch,
  CreateEmailLogInput,
  EmailRecipient,
} from '@/lib/types/email-automation';

const TEACHER_SLUG = 'teacher_mix_ready';
const PARENT_BUYER_SLUG = 'parent_mix_ready_audio_buyer';
const PARENT_NON_BUYER_SLUG = 'parent_mix_ready_non_audio_buyer';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';
const RATE_LIMIT_DELAY_MS = 500;

interface SendCounters { sent: number; skipped: number; failed: number; }

function buildVariables(recipient: EmailRecipient, schoolName: string, parentPortalLink: string) {
  return {
    schoolName,
    eventDate: (recipient.templateData?.event_date as string) || '',
    parentName: (recipient.templateData?.parent_name as string) || '',
    parentFirstName: (recipient.templateData?.parent_first_name as string) || '',
    childName: (recipient.templateData?.child_name as string) || '',
    className: (recipient.templateData?.class_name as string) || '',
    parentPortalLink,
  };
}

async function sendOne(
  slug: string,
  recipient: EmailRecipient,
  variables: Record<string, string>,
  counters: SendCounters
): Promise<void> {
  const airtable = getAirtableService();
  const entry = getRegistryEntry(slug);
  if (!entry) { counters.failed++; return; }

  const trigger = await getTriggerTemplate(slug);
  if (!trigger.active) { counters.skipped++; return; }

  const alreadySent = await airtable.hasEmailBeenSent(entry.name, recipient.eventId, recipient.email);
  if (alreadySent) { counters.skipped++; return; }

  const isParentLike = recipient.type === 'parent' || recipient.type === 'non-buyer';
  const unsubscribeUrl = isParentLike ? generateUnsubscribeUrl(recipient.email) : undefined;
  const templateOptions = isParentLike && unsubscribeUrl
    ? { showUnsubscribe: true, unsubscribeUrl }
    : undefined;

  const subject = renderTriggerTemplate(trigger.subject, variables);
  const html = renderFullTriggerEmail(trigger.bodyHtml, variables, templateOptions);

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | undefined;
  let resendMessageId: string | undefined;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[MixReadyEmail] (dev) To: ${recipient.email}, Subject: ${subject}`);
    resendMessageId = 'dev-mode';
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const headers: Record<string, string> = {};
      if (unsubscribeUrl) {
        headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: recipient.email,
        subject,
        html,
        headers: Object.keys(headers).length ? headers : undefined,
      });
      if (error) { status = 'failed'; errorMessage = error.message; }
      else { resendMessageId = data?.id; }
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  const logInput: CreateEmailLogInput = {
    templateName: entry.name,
    eventId: recipient.eventId,
    recipientEmail: recipient.email,
    recipientType: recipient.type,
    status,
    errorMessage,
    resendMessageId,
  };
  await airtable.createEmailLog(logInput);

  if (status === 'sent') counters.sent++;
  else counters.failed++;

  await sleep(RATE_LIMIT_DELAY_MS);
}

export async function sendMixReadyEmailForEvent(eventId: string): Promise<SendCounters> {
  const airtable = getAirtableService();
  const event = await airtable.getEventByEventId(eventId);
  if (!event) {
    console.error(`[MixReadyEmail] Event not found: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!isMixReadyForEvent(event)) {
    console.log(`[MixReadyEmail] Skipping — event no longer eligible: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const parentPortalLink = `${baseUrl}/familie`;
  const teacherPortalLink = `${baseUrl}/paedagogen`;

  const eventData: EventThresholdMatch = {
    eventId: event.event_id,
    eventRecordId: event.id,
    schoolName: event.school_name,
    eventDate: event.event_date,
    eventType: event.is_kita ? 'KiTa' : 'Schule',
    daysUntilEvent: 0,
    accessCode: event.access_code,
    isKita: event.is_kita,
    isMinimusikertag: event.is_minimusikertag,
    isPlus: event.is_plus,
    isSchulsong: event.is_schulsong,
    isUnder100: event.is_under_100,
  };

  const counters: SendCounters = { sent: 0, skipped: 0, failed: 0 };

  // 1. Teachers — single template
  const teachers = await getTeacherRecipientsForEvent(event.event_id, event.id, eventData);
  for (const t of teachers) {
    const vars = buildVariables(t, event.school_name, teacherPortalLink);
    await sendOne(TEACHER_SLUG, t, vars, counters);
  }

  // 2. Parents — partition by audio purchase
  const parents = await getParentRecipientsForEvent(event.event_id, event.id, eventData);
  for (const p of parents) {
    const isBuyer = p.parentRecordId
      ? await hasAudioPurchaseForEvent(p.parentRecordId, event.event_id)
      : false;
    const slug = isBuyer ? PARENT_BUYER_SLUG : PARENT_NON_BUYER_SLUG;
    const vars = buildVariables(p, event.school_name, parentPortalLink);
    await sendOne(slug, p, vars, counters);
  }

  console.log(
    `[MixReadyEmail] ${eventId}: ${counters.sent} sent, ${counters.failed} failed, ${counters.skipped} skipped`
  );
  return counters;
}
```

**Step 3: Run the test suite**

Run: `npx jest tests/unit/mixReadyEligibility.test.ts tests/unit/audioPurchaseAccess.test.ts`
Expected: all green.

**Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 5: Commit**

```bash
git add src/lib/services/mixReadyEmailService.ts src/lib/types/email-automation.ts src/lib/services/emailAutomationService.ts
git commit -m "feat(emails): per-event mix-ready sender with audio buyer / non-buyer split"
```

---

## Phase 4 — Cron integration

### Task 9: Add `processMixReadyEmails` to `emailAutomationService.ts`

**Files:**
- Modify: `src/lib/services/emailAutomationService.ts` (append after `processSchulsongReleaseEmails`, around line 838)

**Step 1: Append**

```ts
// =============================================================================
// Mix Ready Email Processing (called by cron — Mimi/Plus tier events)
// =============================================================================

/**
 * Find all events whose mix is ready (engineer finals submitted; for combined
 * Mimi+Schulsong events, also requires teacher schulsong approval = schulsong_released_at set).
 * Sends teacher + parent (split by audio purchase) emails. Dedup via EMAIL_LOGS.
 */
export async function processMixReadyEmails(
  dryRun: boolean = false
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const { sendMixReadyEmailForEvent, isMixReadyForEvent } = await import('@/lib/services/mixReadyEmailService');

  const airtable = getAirtableService();
  const allEvents = await airtable.getAllEvents();
  const eligible = allEvents.filter(isMixReadyForEvent);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of eligible) {
    try {
      if (dryRun) {
        console.log(`[MixReadyCron] (dry-run) Would send for ${event.event_id} (${event.school_name})`);
        skipped++;
        continue;
      }
      const result = await sendMixReadyEmailForEvent(event.event_id);
      sent += result.sent;
      skipped += result.skipped;
      failed += result.failed;
    } catch (err) {
      const msg = `Failed to process ${event.event_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[MixReadyCron] ${msg}`);
      errors.push(msg);
    }
  }

  console.log(
    `[MixReadyCron] Processed ${eligible.length} events: ${sent} sent, ${skipped} skipped, ${failed} failed`
  );
  return { sent, skipped, failed, errors };
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/lib/services/emailAutomationService.ts
git commit -m "feat(emails): add processMixReadyEmails cron handler"
```

---

### Task 10: Wire into `/api/cron/email-automation`

**Files:**
- Modify: `src/app/api/cron/email-automation/route.ts`

**Step 1: Read the current route to find the schulsong block**

Run: `grep -n "processSchulsongReleaseEmails\|schulsongResult\|berlinHour" src/app/api/cron/email-automation/route.ts`

Expected: find the `if (berlinHour >= 6 && berlinHour <= 8)` block around line 96 that currently runs `processSchulsongReleaseEmails`.

**Step 2: Edit the route**

Inside the same `berlinHour >= 6 && berlinHour <= 8` window, after the existing `schulsongResult = await processSchulsongReleaseEmails(isDryRun)` call, add:

```ts
let mixReadyResult: { sent: number; skipped: number; failed: number; errors: string[] } | undefined;
console.log(`[Email Automation Cron] Processing mix-ready releases (Berlin hour: ${berlinHour})`);
mixReadyResult = await processMixReadyEmails(isDryRun);
if (mixReadyResult.errors.length > 0) {
  console.error('[Email Automation Cron] MixReady errors:', mixReadyResult.errors);
}
```

Add the import at the top alongside `processSchulsongReleaseEmails`:

```ts
import { processSchulsongReleaseEmails, processMixReadyEmails /* + existing imports */ } from '@/lib/services/emailAutomationService';
```

And in the response summary log block (where `schulsongResult` is logged), add:

```ts
if (mixReadyResult) {
  console.log(
    `[Email Automation Cron] MixReady: ${mixReadyResult.sent} sent, ${mixReadyResult.skipped} skipped, ${mixReadyResult.failed} failed`
  );
}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

**Step 4: Smoke test the route locally with dry-run**

Run: `curl 'http://localhost:3000/api/cron/email-automation?dryRun=1' -H "Authorization: Bearer $CRON_SECRET"` (with the dev server up).

Expected: response includes a `mixReadyResult` summary or you see `[MixReadyCron] (dry-run) Would send for ...` in server logs for any currently eligible events. If no events are eligible, you simply see `Processed 0 events`.

**Step 5: Commit**

```bash
git add src/app/api/cron/email-automation/route.ts
git commit -m "feat(emails): wire processMixReadyEmails into hourly cron 6-8am window"
```

---

## Phase 5 — Validation and cutover

### Task 11: Manual end-to-end smoke (dev)

No code changes — verification only.

**Step 1: Identify a test event** with `audio_pipeline_stage='finals_submitted'`, no schulsong, and at least one registered parent.

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
base('Events').select({
  fields: ['event_id', 'school_name', 'audio_pipeline_stage', 'is_minimusikertag', 'is_plus', 'is_schulsong'],
  maxRecords: 50,
  filterByFormula: \"AND({audio_pipeline_stage}='finals_submitted', OR({is_minimusikertag}, {is_plus}))\",
}).all().then(r => r.forEach(x => console.log(x.get('event_id'), '|', x.get('school_name'))));
"
```

**Step 2: Trigger the cron in dry-run** with that event in scope:

```bash
RESEND_API_KEY="" npx tsx -e "
import('./src/lib/services/emailAutomationService.ts').then(async m => {
  const r = await m.processMixReadyEmails(true);
  console.log(JSON.stringify(r, null, 2));
});
"
```

Expected: log lines `[MixReadyCron] (dry-run) Would send for evt_...` for each eligible event. No emails actually sent (RESEND_API_KEY blank short-circuits to console.log inside `sendOne`).

**Step 3: Run real send for ONE specific event in dev**

Use the per-event helper directly:

```bash
RESEND_API_KEY="$RESEND_API_KEY" NEXT_PUBLIC_APP_URL="https://dev.minimusiker.app" npx tsx -e "
import('./src/lib/services/mixReadyEmailService.ts').then(async m => {
  const r = await m.sendMixReadyEmailForEvent('<EVENT_ID>');
  console.log(JSON.stringify(r, null, 2));
});
"
```

Replace `<EVENT_ID>` with a test event id where you control the parent emails. Verify:
- One teacher email arrives
- Each parent gets exactly one email (buyer-variant or non-buyer-variant)
- Re-running the same command produces `0 sent, N skipped, 0 failed` (dedup works)

**Step 4: Verify EMAIL_LOGS rows**

In Airtable Email Logs, confirm rows with `templateName` matching the three new entries (`Mix fertig — Eltern (Audio-Käufer)` etc.).

No commit — verification only.

---

### Task 12: Deactivate the legacy Timeline templates in Airtable

Manual one-off step. Owner: project admin.

**Step 1: Open Airtable EMAIL_TEMPLATES table** (`tbl9M6cOhR6OpYJRe`).

**Step 2: For each of these two records, uncheck `Active`:**
- `rec4Mcz6yJG3TJZyn` — `Trigger: Eltern - Mix fertig`
- `recSsdDqf0QYc3DSD` — `Trigger: E-Mail 4 - Mix für Schule ist fertig`

**Step 3: Verify by running the timeline cron (dry-run)** and confirming neither template name appears in eligible templates:

```bash
npx tsx -e "
import('./src/lib/services/emailAutomationService.ts').then(async m => {
  const r = await m.processEmailAutomation(true);
  console.log(JSON.stringify(r, null, 2));
});
"
```

Expected: no log entries for either of the two deactivated names; the new mix-ready trigger remains the only firing path.

No commit — Airtable change only.

---

## Phase 6 — Documentation and PR

### Task 13: Update or add a short doc note (optional)

If the team has an `EMAILS.md` or similar, add a paragraph linking the trigger slugs and the registry entries. Skip if no such doc exists.

```bash
# Quick check
ls docs/ | grep -i email
```

If no doc — skip this task and document via the PR description instead.

---

### Task 14: Open PR

**Step 1: Push the branch**

```bash
git push -u origin email_expansion_april
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(emails): mix-fertig timeline → trigger emails with audio-buyer split" --body "$(cat <<'EOF'
## Summary
- Convert the two `+7-day` Timeline emails (`Trigger: Eltern - Mix fertig`, `Trigger: E-Mail 4 - Mix für Schule ist fertig`) into three event-driven trigger emails firing when the engineer has submitted finals (and, for schulsong-appended events, the teacher has approved the schulsong).
- Split the parent email into audio-buyer / non-audio-buyer variants using a new `hasAudioPurchaseForEvent` helper that recognises any audio-category line item (Minicard, CD, bundle, Kinderliederbox).
- Cron-driven (same pattern as `processSchulsongReleaseEmails`); fires hourly inside the 6–8am Berlin window with EMAIL_LOGS dedup.

## Test plan
- [ ] Unit tests pass: `npx jest tests/unit/audioPurchaseAccess.test.ts tests/unit/mixReadyEligibility.test.ts`
- [ ] Type-check clean: `npx tsc --noEmit`
- [ ] Manual dry-run confirms eligible events: `npx tsx ...processMixReadyEmails(true)`
- [ ] Single live send to a controlled test event sends exactly 1 teacher + 1 per parent (variant by purchase)
- [ ] Re-running on the same event returns `0 sent, N skipped` (dedup)
- [ ] Old Airtable Timeline templates `rec4Mcz6yJG3TJZyn` and `recSsdDqf0QYc3DSD` deactivated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Risks and rollback

- **Pre-+7-day fires:** for events where the engineer finishes mixing well before the event, the email fires earlier than the existing +7-day timeline. Parents clicking through may see only previews (or nothing if pre-+7). User accepted this trade-off.
- **Dedup boundary:** `hasEmailBeenSent` keys on `(template_name, event_id, recipient_email)`. If a parent's audio-purchase status changes after the email is sent (e.g. they buy later), they will NOT be re-emailed — by design.
- **Rollback:** to revert, re-activate the two Airtable Timeline records and either (a) leave the new code in place but mark the three new registry entries inactive in Airtable (admin can do this from the Trigger E-Mails tab), or (b) revert the PR. The cron handler is additive and disabling the registry entries makes it a no-op.

---

## Out of scope (mentioned for clarity)

- `Trigger: Schulsong fertig` (`reczelnIXJNNeQvsN`) — schulsong-tier teacher email; left untouched per user direction. Pure schulsong-only events continue to use the existing `schulsong_audio_release` / `schulsong_parent_release` triggers.
- Per-engineer tracking — unchanged. Engineer's manual "submit for review" remains the single signal.
- Refactoring `getNonBuyerRecipientsForEvent` — the existing `non-buyers` Timeline audience definition stays as-is.
- Removing the +7-day preview unlock or the +14-day full-release gate in `audio-access` — out of scope; this plan only changes when the email fires, not when audio is reachable.
