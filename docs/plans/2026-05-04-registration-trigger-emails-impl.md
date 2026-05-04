# Registration Shortfall Trigger Emails — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the production-safe T-7 registration shortfall trigger emails as designed in `docs/plans/2026-05-04-registration-trigger-emails-design.md`.

**Architecture:** Two trigger templates (Low <50%, Critical <33%), gated to teacher recipients of registration-eligible events at exactly T-7 days. New `defaultActive` and `category` fields on `TriggerEmailDefinition` plumb through three locations (seeder + two cache fallbacks) so templates can ship inactive without leaking active during the pre-seed window. New "Registrierungen" UI section in the admin Trigger E-Mails tab.

**Tech Stack:** Next.js 16 App Router, TypeScript, Airtable as the data store, Resend for sending, Jest (with `next/jest`) for tests.

**Worktree:** `.worktrees/registration-shortfall-emails` on branch `feat/registration-shortfall-emails`.

**Reference:** Design doc at `docs/plans/2026-05-04-registration-trigger-emails-design.md` is the authoritative spec — when in doubt, follow it.

---

## Task 0: Worktree setup

**Step 1: Install dependencies**

```bash
cd .worktrees/registration-shortfall-emails && npm install
```

Expected: completes without errors. May take 1–3 minutes.

**Step 2: Baseline type-check**

```bash
npm run type-check
```

Expected: passes (no errors). If it fails on `main`, stop — capture the failures and report; do not proceed.

**Step 3: Baseline test run**

```bash
npm test -- --listTests | head -10
npm test
```

Expected: existing tests pass. Note any pre-existing failures so we can distinguish ours from baseline noise.

No commit at this task — it's pure verification.

---

## Task 1: Add `defaultActive` + `category` fields to TriggerEmailDefinition

**Files:**
- Modify: `src/lib/config/trigger-email-registry.ts:9-22`

**Step 1: Edit the interface**

Replace the `TriggerEmailDefinition` interface so it reads:

```ts
export interface TriggerEmailDefinition {
  slug: string;
  name: string;
  description: string;
  recipientType: 'admin' | 'teacher' | 'parent' | 'staff' | 'engineer';
  defaultSubject: string;
  defaultBodyHtml: string;
  availableVariables: string[];
  triggerEventKey?: string;  // Key from TRIGGER_EVENT_CATALOG
  /** When false, freshly seeded Airtable rows and pre-seed cache fallbacks return active=false. Defaults to true (backwards-compatible). */
  defaultActive?: boolean;
  /** Optional UI grouping. Templates with a category render under that section instead of under their recipientType. */
  category?: string;
  sendNow?: {
    eventFilter: 'schulsong_approved' | 'all_events' | 'schulsong_events';
    recipientResolver: 'event_teacher' | 'parents_by_registration';
  };
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: passes — no other entries set the new fields, so no regressions.

**Step 3: Commit**

```bash
git add src/lib/config/trigger-email-registry.ts
git commit -m "feat(emails): add defaultActive and category fields to TriggerEmailDefinition"
```

---

## Task 2: Surface `category` on `TriggerEmailTemplate` and propagate

**Files:**
- Modify: `src/lib/types/email-automation.ts:90-105`
- Modify: `src/lib/services/triggerTemplateService.ts` (mapping functions)

**Step 1: Add `category?: string` to `TriggerEmailTemplate`**

In `email-automation.ts`, locate the `TriggerEmailTemplate` interface (line 90-105) and add the line `category?: string;                              // UI grouping override (e.g. 'registrations')` right before `triggerEventKey?: string;`.

**Step 2: Propagate in `getAllTriggerTemplates`**

In `triggerTemplateService.ts`, find the two `return { ... }` blocks inside `getAllTriggerTemplates` (one in the try, one in the catch fallback). Add `category: entry.category,` to both objects.

**Step 3: Propagate in `getTriggerTemplateBySlug`**

Same pattern in `getTriggerTemplateBySlug` — add `category: entry.category,` to both return blocks (try and catch).

**Step 4: Type-check**

```bash
npm run type-check
```

Expected: passes.

**Step 5: Commit**

```bash
git add src/lib/types/email-automation.ts src/lib/services/triggerTemplateService.ts
git commit -m "feat(emails): surface category through TriggerEmailTemplate mapping"
```

---

## Task 3: Honor `defaultActive` in seeder + cache fallbacks (TDD)

**Files:**
- Modify: `src/lib/services/triggerTemplateService.ts:80-87, 219, 271`
- Test: `src/lib/services/triggerTemplateService.test.ts` (new file)

**Step 1: Write the failing test**

Create `src/lib/services/triggerTemplateService.test.ts`:

```ts
// Stub airtable transitively — same pattern as emailAutomationService.test.ts
jest.mock('airtable', () => ({
  __esModule: true,
  default: class AirtableStub {
    static configure() {}
    base() { return () => ({ select: () => ({ all: async () => [] }) }); }
  },
}));

// Stub the airtable service module so getAllEmailTemplates returns nothing.
// This simulates the pre-seed window: registry entries exist but no Airtable row.
jest.mock('./airtableService', () => ({
  getAirtableService: () => ({
    getAllEmailTemplates: async () => [],
    createEmailTemplate: jest.fn(async () => ({ id: 'rec_new' })),
    updateEmailTemplate: jest.fn(async () => undefined),
  }),
}));

// Replace the registry with a synthetic one we control. We do this AFTER stubs
// so the import resolves cleanly, then mutate the export at module-load time.
jest.mock('@/lib/config/trigger-email-registry', () => {
  const TRIGGER_EMAIL_REGISTRY = [
    {
      slug: 'test_default_active',
      name: 'Default active',
      description: 'd',
      recipientType: 'teacher',
      defaultSubject: 's',
      defaultBodyHtml: 'b',
      availableVariables: [],
    },
    {
      slug: 'test_default_inactive',
      name: 'Default inactive',
      description: 'd',
      recipientType: 'teacher',
      defaultSubject: 's',
      defaultBodyHtml: 'b',
      availableVariables: [],
      defaultActive: false,
    },
  ];
  return {
    __esModule: true,
    TRIGGER_EMAIL_REGISTRY,
    getRegistryEntry: (slug: string) =>
      TRIGGER_EMAIL_REGISTRY.find((e: { slug: string }) => e.slug === slug),
  };
});

import { getAllTriggerTemplates, getTriggerTemplate } from './triggerTemplateService';

describe('defaultActive plumbing', () => {
  it('getAllTriggerTemplates returns active=true when defaultActive is unset', async () => {
    const all = await getAllTriggerTemplates();
    const e = all.find((t) => t.triggerSlug === 'test_default_active');
    expect(e?.active).toBe(true);
  });

  it('getAllTriggerTemplates returns active=false when defaultActive is explicitly false', async () => {
    const all = await getAllTriggerTemplates();
    const e = all.find((t) => t.triggerSlug === 'test_default_inactive');
    expect(e?.active).toBe(false);
  });

  it('getTriggerTemplate cache fallback returns active=false for defaultActive=false slug', async () => {
    const t = await getTriggerTemplate('test_default_inactive');
    expect(t.active).toBe(false);
  });

  it('getTriggerTemplate cache fallback returns active=true for unset slug', async () => {
    const t = await getTriggerTemplate('test_default_active');
    expect(t.active).toBe(true);
  });
});
```

**Step 2: Run the test — verify failure**

```bash
npm test -- triggerTemplateService.test.ts
```

Expected: the two `defaultActive=false` cases FAIL because the current code falls back to `active: true` regardless. The two `defaultActive` unset cases pass.

**Step 3: Update three locations to honor `defaultActive`**

In `triggerTemplateService.ts`:

(a) `seedMissingTriggerTemplates`, line 219 — change `active: true,` to `active: entry.defaultActive ?? true,`.

(b) `populateAllTriggerCaches`, lines 80-87 — change the `else` branch (no record case):

```ts
} else {
  result = {
    active: entry.defaultActive ?? true,
    subject: entry.defaultSubject,
    bodyHtml: entry.defaultBodyHtml,
    isCustomized: false,
  };
}
```

Also update the catch-block fallback (lines 94-104) similarly:

```ts
for (const entry of TRIGGER_EMAIL_REGISTRY) {
  if (!getCached(entry.slug)) {
    setCache(entry.slug, {
      active: entry.defaultActive ?? true,
      subject: entry.defaultSubject,
      bodyHtml: entry.defaultBodyHtml,
      isCustomized: false,
    });
  }
}
```

(c) `getAllTriggerTemplates`, line 271 — change `active: record?.active ?? true,` to `active: record?.active ?? (entry.defaultActive ?? true),`.

(d) Same change in the catch-block fallback (line 294 area), and in `getTriggerTemplateBySlug` (line 335 and the catch fallback line 355 area).

**Step 4: Run the test — verify pass**

```bash
npm test -- triggerTemplateService.test.ts
```

Expected: all four cases pass.

**Step 5: Commit**

```bash
git add src/lib/services/triggerTemplateService.ts src/lib/services/triggerTemplateService.test.ts
git commit -m "feat(emails): honor defaultActive in seeder and pre-seed cache fallbacks"
```

---

## Task 4: Category-aware admin UI grouping

**Files:**
- Modify: `src/components/admin/emails/TriggerEmailsTab.tsx:9-23, 117-135`

**Step 1: Add a category group constant**

After `RECIPIENT_GROUP_ORDER` (line 23), add:

```ts
const CATEGORY_GROUP_ORDER: Array<{ key: string; label: string }> = [
  { key: 'registrations', label: 'Registrierungen' },
];
```

**Step 2: Update the grouping logic**

Replace the existing `grouped` block (line 117-121) with:

```ts
// Category groups render first, recipient-type groups below.
// Categorized templates are excluded from recipient groups so they don't appear twice.
const categoryGroups = CATEGORY_GROUP_ORDER.map((group) => ({
  key: `cat:${group.key}`,
  label: group.label,
  templates: templates.filter((t) => t.category === group.key),
})).filter((g) => g.templates.length > 0);

const recipientGroups = RECIPIENT_GROUP_ORDER.map((group) => ({
  key: `rec:${group.key}`,
  label: group.label,
  templates: templates.filter((t) => t.recipientType === group.key && !t.category),
})).filter((g) => g.templates.length > 0);

const grouped = [...categoryGroups, ...recipientGroups];
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: passes. The render block uses `group.key`, `group.label`, `group.templates` — same shape, no JSX changes needed.

**Step 4: Commit**

```bash
git add src/components/admin/emails/TriggerEmailsTab.tsx
git commit -m "feat(emails): add category-first grouping in admin trigger emails tab"
```

---

## Task 5: Add the trigger event catalog entry

**Files:**
- Modify: `src/lib/config/trigger-event-catalog.ts` (append to `TRIGGER_EVENT_CATALOG`)

**Step 1: Append the entry**

Add the following entry at the end of the `TRIGGER_EVENT_CATALOG` array, before the closing `];`:

```ts
{
  key: 'cron:registration_shortfall_t7',
  name: 'CRON: Registrierungen unter Schwelle (T-7)',
  description:
    'Läuft täglich um 7 Uhr. Sendet eine Erinnerung an die Lehrkraft, '
    + 'wenn 7 Tage vor dem Event weniger als 50% der erwarteten Kinder '
    + 'registriert sind. Zwei Schwere-Stufen: <50%, <33%.',
  availableVariables: [
    'teacherName', 'schoolName', 'eventDate',
    'registeredCount', 'expectedCount', 'percentRegistered',
    'daysUntilEvent', 'teacherPortalUrl',
  ],
  recipientMode: 'specific',
},
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: passes.

**Step 3: Commit**

```bash
git add src/lib/config/trigger-event-catalog.ts
git commit -m "feat(emails): add cron:registration_shortfall_t7 catalog entry"
```

---

## Task 6: Pure tier-selection helper with unit tests (TDD)

**Files:**
- Create: `src/lib/services/registrationShortfall.ts`
- Create: `src/lib/services/registrationShortfall.test.ts`

We extract the tier logic into a tiny pure module so it's trivially testable and reusable.

**Step 1: Write failing test**

Create `src/lib/services/registrationShortfall.test.ts`:

```ts
import { selectShortfallSlug, REGISTRATION_SHORTFALL_SLUGS } from './registrationShortfall';

describe('selectShortfallSlug', () => {
  it('returns null at exactly 50%', () => {
    expect(selectShortfallSlug(50, 100)).toBeNull();
  });

  it('returns null above 50%', () => {
    expect(selectShortfallSlug(60, 100)).toBeNull();
  });

  it('returns "low" slug at 49.9%', () => {
    expect(selectShortfallSlug(499, 1000)).toBe(REGISTRATION_SHORTFALL_SLUGS.low);
  });

  it('returns "low" slug at 33.0%', () => {
    expect(selectShortfallSlug(33, 100)).toBe(REGISTRATION_SHORTFALL_SLUGS.low);
  });

  it('returns "critical" slug at 32.9%', () => {
    expect(selectShortfallSlug(329, 1000)).toBe(REGISTRATION_SHORTFALL_SLUGS.critical);
  });

  it('returns "critical" slug at 0 registered with positive expected', () => {
    expect(selectShortfallSlug(0, 100)).toBe(REGISTRATION_SHORTFALL_SLUGS.critical);
  });

  it('returns null when expected is 0 (skip — no comparison possible)', () => {
    expect(selectShortfallSlug(0, 0)).toBeNull();
    expect(selectShortfallSlug(5, 0)).toBeNull();
  });

  it('returns null when expected is negative or undefined-as-0', () => {
    expect(selectShortfallSlug(0, -1)).toBeNull();
  });
});
```

**Step 2: Run test — verify failure**

```bash
npm test -- registrationShortfall.test.ts
```

Expected: FAIL with "Cannot find module './registrationShortfall'".

**Step 3: Implement the helper**

Create `src/lib/services/registrationShortfall.ts`:

```ts
/**
 * Pure tier selection for the T-7 registration shortfall trigger.
 * No side effects, no I/O — easy to unit test.
 */

export const REGISTRATION_SHORTFALL_SLUGS = {
  low: 'cron:registration_low_t7',
  critical: 'cron:registration_critical_t7',
} as const;

export type RegistrationShortfallSlug =
  | typeof REGISTRATION_SHORTFALL_SLUGS.low
  | typeof REGISTRATION_SHORTFALL_SLUGS.critical;

/**
 * Pick the tier slug for a given (registered, expected) pair.
 * Returns null when no email should fire (≥50%, or expected ≤ 0).
 */
export function selectShortfallSlug(
  registeredCount: number,
  expectedCount: number,
): RegistrationShortfallSlug | null {
  if (expectedCount <= 0) return null;
  const ratio = registeredCount / expectedCount;
  if (ratio >= 0.5) return null;
  if (ratio < 0.33) return REGISTRATION_SHORTFALL_SLUGS.critical;
  return REGISTRATION_SHORTFALL_SLUGS.low;
}
```

**Step 4: Run test — verify pass**

```bash
npm test -- registrationShortfall.test.ts
```

Expected: all 8 cases pass.

**Step 5: Commit**

```bash
git add src/lib/services/registrationShortfall.ts src/lib/services/registrationShortfall.test.ts
git commit -m "feat(emails): pure tier-selection helper for registration shortfall"
```

---

## Task 7: Add the two registry entries

**Files:**
- Modify: `src/lib/config/trigger-email-registry.ts` (append to `TRIGGER_EMAIL_REGISTRY`)

**Step 1: Append the two entries**

Append two entries at the end of the `TRIGGER_EMAIL_REGISTRY` array, before the closing `];`. Both use `defaultActive: false` and `category: 'registrations'`. The placeholder German copy is intentionally minimal — admins will rewrite.

```ts
// ─── Registration Shortfall — Low (33–50%) ──────────────────────────
{
  slug: 'cron:registration_low_t7',
  name: 'Registrierungen niedrig (33–50%) — T-7',
  description:
    'Wird 7 Tage vor dem Event an die Lehrkraft gesendet, wenn 33–50% '
    + 'der erwarteten Kinder registriert sind. Default-Status: inaktiv.',
  recipientType: 'teacher',
  triggerEventKey: 'cron:registration_shortfall_t7',
  category: 'registrations',
  defaultActive: false,
  defaultSubject: 'Erinnerung: Anmeldungen für {{schoolName}} – noch 7 Tage',
  defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{teacherName}},
</h2>
<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Bisher sind <strong>{{registeredCount}} von {{expectedCount}} Kindern</strong>
  ({{percentRegistered}}%) für das Event an der {{schoolName}} am {{eventDate}}
  angemeldet — noch 7 Tage bis zum Termin.
</p>
<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Bitte erinnern Sie die Eltern noch einmal an die Anmeldung — z.B. per
  Klassen-WhatsApp oder einem Flyer im Tornister.
</p>
<p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  <a href="{{teacherPortalUrl}}" style="color: #d85a6a;">Pädagogen-Portal öffnen</a>
</p>`,
  availableVariables: [
    'teacherName', 'schoolName', 'eventDate',
    'registeredCount', 'expectedCount', 'percentRegistered',
    'daysUntilEvent', 'teacherPortalUrl',
  ],
},

// ─── Registration Shortfall — Critical (<33%) ───────────────────────
{
  slug: 'cron:registration_critical_t7',
  name: 'Registrierungen kritisch niedrig (<33%) — T-7',
  description:
    'Wird 7 Tage vor dem Event an die Lehrkraft gesendet, wenn weniger '
    + 'als 33% der erwarteten Kinder registriert sind. Default-Status: inaktiv.',
  recipientType: 'teacher',
  triggerEventKey: 'cron:registration_shortfall_t7',
  category: 'registrations',
  defaultActive: false,
  defaultSubject: 'Dringend: Wenige Anmeldungen für {{schoolName}} — bitte handeln',
  defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{teacherName}},
</h2>
<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Aktuell sind erst <strong>{{registeredCount}} von {{expectedCount}} Kindern</strong>
  ({{percentRegistered}}%) für das Event an der {{schoolName}} am {{eventDate}}
  angemeldet. Das Event findet in 7 Tagen statt.
</p>
<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Bitte aktivieren Sie die Eltern jetzt — direkte Ansprache, Flyer, Klassen-Chat.
  Ohne Aktion wird die Teilnehmerzahl deutlich unter dem Erwartungswert bleiben.
</p>
<p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  <a href="{{teacherPortalUrl}}" style="color: #d85a6a;">Pädagogen-Portal öffnen</a>
</p>`,
  availableVariables: [
    'teacherName', 'schoolName', 'eventDate',
    'registeredCount', 'expectedCount', 'percentRegistered',
    'daysUntilEvent', 'teacherPortalUrl',
  ],
},
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: passes.

**Step 3: Commit**

```bash
git add src/lib/config/trigger-email-registry.ts
git commit -m "feat(emails): add registration shortfall low/critical templates (inactive)"
```

---

## Task 8: Add a sender helper in `resendService.ts`

**Files:**
- Modify: `src/lib/services/resendService.ts` (append a new exported function)

**Step 1: Add the sender**

After the existing `sendStaffEventReminderEmail` block in `resendService.ts`, add:

```ts
/**
 * Send a registration-shortfall reminder to the teacher (T-7).
 * Slug is selected by the cron based on the registered/expected ratio
 * (see `selectShortfallSlug`). Inactive templates short-circuit upstream
 * — this helper just delegates to `sendTriggerEmail`.
 */
export async function sendRegistrationShortfallEmail(
  email: string,
  slug: 'cron:registration_low_t7' | 'cron:registration_critical_t7',
  variables: {
    teacherName: string;
    schoolName: string;
    eventDate: string;
    registeredCount: string;
    expectedCount: string;
    percentRegistered: string;
    daysUntilEvent: string;
    teacherPortalUrl: string;
  },
  options?: { eventRecordId?: string },
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, slug, variables, 'Registration shortfall', options);
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: passes.

**Step 3: Commit**

```bash
git add src/lib/services/resendService.ts
git commit -m "feat(emails): add sendRegistrationShortfallEmail helper"
```

---

## Task 9: Implement `checkRegistrationShortfall` in `eventReadinessService.ts` (TDD)

**Files:**
- Modify: `src/lib/services/eventReadinessService.ts` (append the new function)
- Create: `src/lib/services/eventReadinessService.test.ts` if absent, or extend if present

**Step 1: Locate the existing test file (or create it)**

```bash
ls src/lib/services/eventReadinessService.test.ts 2>/dev/null
```

If it doesn't exist, create it with the airtable stub at the top, matching the pattern in `emailAutomationService.test.ts`.

**Step 2: Write failing tests for tier behavior + edge cases**

Add the following describe block to `eventReadinessService.test.ts`. The test relies on mocking `getAirtableService`, `getTeacherRecipientsForEvent`, `getTriggerTemplate`, and the `sendRegistrationShortfallEmail` helper.

```ts
// At the top of the file, after the airtable stub:

const mockSend = jest.fn(async () => ({ success: true, messageId: 'm1' }));
const mockGetAirtable = {
  getAllEvents: jest.fn(async () => []),
  getRegistrationsByEventId: jest.fn(async () => []),
  getSchoolBookingById: jest.fn(async () => null),
};
const mockGetTeacherRecipients = jest.fn(async () => []);
const mockGetTriggerTemplate = jest.fn(async () => ({ active: true, subject: '', bodyHtml: '', isCustomized: false }));

jest.mock('./airtableService', () => ({
  getAirtableService: () => mockGetAirtable,
}));
jest.mock('./emailAutomationService', () => ({
  getTeacherRecipientsForEvent: (...args: unknown[]) => mockGetTeacherRecipients(...args),
}));
jest.mock('./triggerTemplateService', () => ({
  getTriggerTemplate: (...args: unknown[]) => mockGetTriggerTemplate(...args),
}));
jest.mock('./resendService', () => ({
  sendRegistrationShortfallEmail: (...args: unknown[]) => mockSend(...args),
}));
jest.mock('./activityService', () => ({
  getActivityService: () => ({ logActivity: jest.fn() }),
}));

import { checkRegistrationShortfall } from './eventReadinessService';

function makeEventAtT7(overrides: Record<string, unknown> = {}) {
  const t7 = new Date();
  t7.setDate(t7.getDate() + 7);
  return {
    id: 'rec_evt',
    event_id: 'evt_test',
    event_date: t7.toISOString().split('T')[0],
    school_name: 'Test',
    status: 'Confirmed',
    simplybook_booking: ['rec_book'],
    is_minimusikertag: true,
    is_kita: false,
    is_plus: false,
    is_schulsong: false,
    ...overrides,
  };
}

describe('checkRegistrationShortfall', () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockGetTeacherRecipients.mockClear();
    mockGetAirtable.getAllEvents.mockReset();
    mockGetAirtable.getRegistrationsByEventId.mockReset();
    mockGetAirtable.getSchoolBookingById.mockReset();
    mockGetTriggerTemplate.mockReset();
    mockGetTriggerTemplate.mockResolvedValue({ active: true, subject: '', bodyHtml: '', isCustomized: false });
    mockGetTeacherRecipients.mockResolvedValue([{ email: 't@e.de', name: 'Frau X' }]);
  });

  it('skips when ratio >= 50% (no email)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });

  it('sends low slug at 40% ratio', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall();
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_low_t7',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('sends critical slug at 30% ratio', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall();
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_critical_t7',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('counts only registered_complete=true rows in the numerator', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    // 60 in-flight (incomplete) + 30 complete → numerator should be 30, ratio = 30%, critical
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      ...Array.from({ length: 60 }, (_, i) => ({ registered_complete: false, id: `i${i}` })),
      ...Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `c${i}` })),
    ]);
    await checkRegistrationShortfall();
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_critical_t7',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('skips when estimatedChildren is 0 or missing', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 0 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      { registered_complete: true, id: 'r1' },
    ]);
    const r = await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });

  it('skips schulsong-only events (no registration flags set)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([
      makeEventAtT7({ is_minimusikertag: false, is_kita: false, is_plus: false, is_schulsong: true }),
    ]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips cancelled events', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7({ status: 'Cancelled' })]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips when teacher has no email', async () => {
    mockGetTeacherRecipients.mockResolvedValueOnce([]);
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does NOT call sender when template is inactive (avoids telemetry pollution)', async () => {
    mockGetTriggerTemplate.mockResolvedValue({ active: false, subject: '', bodyHtml: '', isCustomized: false });
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });

  it('dryRun=true does not call sender even when ratio matches', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not match events whose date is not exactly T+7', async () => {
    const tooEarly = new Date();
    tooEarly.setDate(tooEarly.getDate() + 5);
    mockGetAirtable.getAllEvents.mockResolvedValue([
      makeEventAtT7({ event_date: tooEarly.toISOString().split('T')[0] }),
    ]);
    await checkRegistrationShortfall();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run tests — verify failure**

```bash
npm test -- eventReadinessService.test.ts
```

Expected: FAIL — `checkRegistrationShortfall` not exported.

**Step 4: Implement `checkRegistrationShortfall`**

Append to `src/lib/services/eventReadinessService.ts`:

```ts
import { selectShortfallSlug } from './registrationShortfall';
import { getTriggerTemplate } from './triggerTemplateService';
import { sendRegistrationShortfallEmail } from './resendService';
import { getTeacherRecipientsForEvent } from './emailAutomationService';

const REGISTRATION_SHORTFALL_DAYS_BEFORE = 7;

/**
 * T-7 registration shortfall reminder. Sends one of two tiered emails to the
 * assigned teacher when the registered/expected ratio falls below 50%.
 *
 * Idempotency: exact-date match on T-7 means each event is evaluated exactly
 * once over its lifetime — same model as `checkStaffEventReminder`.
 */
export async function checkRegistrationShortfall(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();
    const allEvents = await airtable.getAllEvents();

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + REGISTRATION_SHORTFALL_DAYS_BEFORE);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const candidates = allEvents.filter((event) => {
      if (!event.event_date) return false;
      if (event.status !== 'Confirmed') return false;
      if (!event.simplybook_booking?.[0]) return false;
      // Only events with a parent-registration flow.
      // Schulsong-only events are excluded.
      const takesRegistrations = !!(event.is_minimusikertag || event.is_plus || event.is_kita);
      if (!takesRegistrations) return false;
      return event.event_date.split('T')[0] === targetDateStr;
    });

    if (candidates.length === 0) {
      console.log(`[EventReadiness] No registration-eligible events on ${targetDateStr}`);
      result.skipped = 1;
      return result;
    }

    console.log(`[EventReadiness] Found ${candidates.length} registration-eligible event(s) at T-7`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';

    for (const event of candidates) {
      const bookingId = event.simplybook_booking![0];
      let estimatedChildren: number = 0;
      try {
        const booking = await airtable.getSchoolBookingById(bookingId);
        estimatedChildren = booking?.estimatedChildren ?? 0;
      } catch (err) {
        console.warn(`[EventReadiness] Could not fetch booking for ${event.event_id}:`, err);
      }

      if (!estimatedChildren || estimatedChildren <= 0) {
        result.skipped++;
        continue;
      }

      const registrations = await airtable.getRegistrationsByEventId(event.id);
      const registeredCount = registrations.filter((r) => r.registered_complete).length;

      const slug = selectShortfallSlug(registeredCount, estimatedChildren);
      if (!slug) continue;  // ratio ≥ 50%

      const teacherRecipients = await getTeacherRecipientsForEvent(
        event.event_id,
        event.id,
        {
          eventId: event.event_id,
          eventRecordId: event.id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type || 'MiniMusiker',
          daysUntilEvent: REGISTRATION_SHORTFALL_DAYS_BEFORE,
          accessCode: event.access_code,
          isKita: event.is_kita,
          isMinimusikertag: event.is_minimusikertag,
          isPlus: event.is_plus,
          isSchulsong: event.is_schulsong,
        },
      );

      const teacher = teacherRecipients[0];
      if (!teacher?.email) {
        console.warn(`[EventReadiness] No teacher email for ${event.event_id}, skipping shortfall`);
        result.skipped++;
        continue;
      }

      // Pre-check active flag — disabled templates would otherwise be reported as "sent" by the
      // resendService disabled-shortcut (returns success: true with messageId: 'disabled').
      const template = await getTriggerTemplate(slug);
      if (!template.active) {
        result.skipped++;
        continue;
      }

      const percentRegistered = Math.floor((registeredCount / estimatedChildren) * 100);

      if (dryRun) {
        console.log(
          `[EventReadiness] DRY RUN: would send ${slug} to ${teacher.email} `
          + `(ratio: ${percentRegistered}%, registered: ${registeredCount}/${estimatedChildren})`,
        );
        result.skipped++;
        continue;
      }

      try {
        const r = await sendRegistrationShortfallEmail(
          teacher.email,
          slug,
          {
            teacherName: teacher.name || 'Lehrkraft',
            schoolName: event.school_name,
            eventDate: event.event_date,
            registeredCount: String(registeredCount),
            expectedCount: String(estimatedChildren),
            percentRegistered: String(percentRegistered),
            daysUntilEvent: String(REGISTRATION_SHORTFALL_DAYS_BEFORE),
            teacherPortalUrl: `${baseUrl}/paedagogen/events/${event.event_id}`,
          },
          { eventRecordId: event.id },
        );

        if (r.success) {
          result.sent++;
          getActivityService().logActivity({
            eventRecordId: event.id,
            activityType: 'email_sent',
            description: `Registration shortfall (${slug}) — ${percentRegistered}% (${registeredCount}/${estimatedChildren})`,
            actorEmail: 'system',
            actorType: 'system',
            metadata: { slug, ratio: percentRegistered },
          });
        } else {
          result.failed++;
          result.errors.push(`Shortfall send failed for ${event.event_id}: ${r.error}`);
        }
      } catch (err) {
        result.failed++;
        result.errors.push(
          `Shortfall send error for ${event.event_id}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(
      `[EventReadiness] checkRegistrationShortfall: ${error instanceof Error ? error.message : 'Unknown'}`,
    );
    console.error('[EventReadiness] Error in checkRegistrationShortfall:', error);
  }

  return result;
}
```

Note on activityType: We re-use `'email_sent'` to avoid a schema-union extension. The `metadata.slug` and `description` carry the tier information.

**Step 5: Run tests — verify pass**

```bash
npm test -- eventReadinessService.test.ts
```

Expected: all 10 cases pass.

**Step 6: Commit**

```bash
git add src/lib/services/eventReadinessService.ts src/lib/services/eventReadinessService.test.ts
git commit -m "feat(emails): implement checkRegistrationShortfall T-7 evaluator with tiered tests"
```

---

## Task 10: Wire `checkRegistrationShortfall` into the cron route

**Files:**
- Modify: `src/app/api/cron/event-readiness/route.ts:27-37, 50-60, 85-94`

**Step 1: Extend the imports**

At the top of the file, add `checkRegistrationShortfall` to the import from `eventReadinessService`:

```ts
import {
  checkNoStaffAssigned,
  checkClassesAndSongs,
  checkBookingsWithoutEvent,
  checkPostWave2Orders,
  checkRecentOrderChanges,
  checkStaffEventReminder,
  checkRegistrationShortfall,
} from '@/lib/services/eventReadinessService';
```

**Step 2: Extend `CronResult`**

Add `registrationShortfall?: { sent: number; skipped: number; failed: number; errors: string[] };` to the `CronResult` interface (line 27-37).

**Step 3: Add the daily call**

In `handleCronRequest`, after the existing `staffReminderResult` call (around line 60), add:

```ts
// Daily check: registration shortfall (7 days before, only if <50% registered)
const registrationShortfallResult = await checkRegistrationShortfall(isDryRun);
console.log('[Event Readiness Cron] Registration shortfall check:', registrationShortfallResult);
```

**Step 4: Add to the JSON response**

In the final `NextResponse.json({...})` (line 85-94), add:

```ts
registrationShortfall: registrationShortfallResult,
```

**Step 5: Type-check**

```bash
npm run type-check
```

Expected: passes.

**Step 6: Smoke run via dry-run**

```bash
# In one terminal
npm run dev
# In another:
curl -X POST 'http://localhost:3000/api/cron/event-readiness?dryRun=true' \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected JSON includes `registrationShortfall: {sent: 0, skipped: ..., failed: 0, errors: []}` (assumes no event happens to land on today+7 with the right shape; usually `skipped: 1` for the no-candidates branch). No 500. Console shows the new log line.

**Step 7: Commit**

```bash
git add src/app/api/cron/event-readiness/route.ts
git commit -m "feat(emails): wire registration shortfall check into daily cron"
```

---

## Task 11: Verify open questions in code

**Step 1: Activity-type union**

```bash
grep -n "ActivityType\|activity_type" src/lib/types/airtable.ts | head
grep -rn "logActivity" src/lib/services/activityService.ts | head
```

Confirm `'email_sent'` is already an accepted `activityType`. Since Task 9 reuses this value, no schema change is needed. If it's NOT in the union, add it (but it should be — it's used in `resendService.ts:171`).

**Step 2: Teacher `email_campaigns` flag**

```bash
grep -n "email_campaigns" src/lib/types/airtable.ts
```

Determine whether the Persons table has an `email_campaigns` field (parents do at `airtable.ts:911` as `'yes' | 'no'`). If teachers also have one and it's set to `'no'`, our send should respect it. Patch in `checkRegistrationShortfall` if applicable:

```ts
// Inside the loop, after resolving teacher:
// (only if the field exists on Persons)
if (teacher.email_campaigns === 'no') {
  result.skipped++;
  continue;
}
```

If teachers have no such field, no change needed — leave a code comment noting the audit was done and skip is N/A.

**Step 3: Commit any small fixes (only if changes were needed)**

```bash
git add src/lib/services/eventReadinessService.ts
git commit -m "feat(emails): respect teacher email_campaigns opt-out (if present)"
```

If no changes — skip this commit.

---

## Task 12: Manual end-to-end smoke test

This task is non-automated; the goal is human verification before declaring the feature done.

**Step 1: Pick a synthetic test event**

In Airtable, find a Confirmed event with `is_minimusikertag=true`, registrations linked, and a `simplybook_booking` set. Note its `event_date` and `estimatedChildren`.

**Step 2: Date-shift it to today + 7d (temporarily)**

Update `event_date` to today+7. Save. (We will revert at the end of the task.)

**Step 3: Run the cron in dry-run mode**

```bash
npm run dev
curl -X POST 'http://localhost:3000/api/cron/event-readiness?dryRun=true' \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.registrationShortfall'
```

Confirm the log line `would send <slug> to <teacher.email> (ratio: X%, ...)` matches expected tier.

**Step 4: Test active=true path with one slug**

Open `/admin/emails`. Confirm the "Registrierungen" section is visible at the top with two entries. Open the matching tier's template, edit the body slightly to mark it as "test", and toggle `active=true`. Save.

Run the cron live (no dryRun):

```bash
curl -X POST 'http://localhost:3000/api/cron/event-readiness' \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expect:
- The teacher receives the email at the configured Resend sender.
- `result.sent === 1` for `registrationShortfall` in the JSON response.
- An `email_sent` activity log entry appears for the event with `metadata.slug` set to the tier slug.
- A second run **same day** does NOT re-send (the date filter still matches but the event-once-per-lifetime guarantee holds via T-7 exact match — confirm by looking at the second-run JSON: still `sent: 1` because the same event matches, but live-mode would re-send. **NOTE**: this is the accepted "forced-rerun re-fires" risk from the design doc.)

**Step 5: Toggle active back to false, restore the event date**

In `/admin/emails`, set the modified template back to inactive. In Airtable, restore the original `event_date` value.

**Step 6: Final type-check + tests**

```bash
npm run type-check
npm test
```

Expected: all green.

No commit at this task — it's verification only.

---

## Summary of files touched

- `src/lib/config/trigger-email-registry.ts` — interface field additions + 2 new entries
- `src/lib/config/trigger-event-catalog.ts` — 1 new entry
- `src/lib/types/email-automation.ts` — `category` field on `TriggerEmailTemplate`
- `src/lib/services/triggerTemplateService.ts` — `defaultActive` plumbing in 3 places + `category` propagation
- `src/lib/services/registrationShortfall.ts` — pure tier helper (new file)
- `src/lib/services/registrationShortfall.test.ts` — tier helper tests (new file)
- `src/lib/services/resendService.ts` — `sendRegistrationShortfallEmail` helper
- `src/lib/services/eventReadinessService.ts` — `checkRegistrationShortfall` impl
- `src/lib/services/eventReadinessService.test.ts` — integration tests
- `src/lib/services/triggerTemplateService.test.ts` — unit tests for plumbing
- `src/components/admin/emails/TriggerEmailsTab.tsx` — category-first grouping
- `src/app/api/cron/event-readiness/route.ts` — wire-up

## Out of scope

- Refactoring `getAllEvents` to be fetched once per cron pass
- Adding a `trigger_slug` field to EMAIL_LOGS Airtable schema for cross-day dedup
- Localizing template copy to non-German
- Rewriting placeholder email copy (admin task)

## Definition of done

- All tests green: `npm test`
- Type-check green: `npm run type-check`
- Manual smoke test (Task 12) passed
- Both new templates visible in `/admin/emails` under "Registrierungen", default-inactive
- Branch `feat/registration-shortfall-emails` ready to PR via `superpowers:finishing-a-development-branch`
