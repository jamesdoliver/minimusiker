# Schulsong Release & Merch Timeline Control — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a unified release system where teacher approval gates audio release, merch window, and customer communications — creating one coordinated "moment" for parents.

**Architecture:** Teacher approval triggers computation of `schulsong_released_at` and `schulsong_merch_cutoff`. For combined events (M/PLUS + Schulsong), class audio is held until both the normal gate AND schulsong approval pass. A state-aware cron sends daily approval reminders when schulsong is pending, and a "last chance" email 24h before merch cutoff. Admin can override merch cutoff in event settings.

**Tech Stack:** Next.js 14 (App Router), Airtable, Resend (email), R2 (storage), TypeScript

**Design doc:** `docs/plans/2026-03-16-schulsong-release-timeline-control-design.md`

---

### Task 1: Airtable Field Setup Script

Create the `schulsong_merch_cutoff` field in Airtable Events table via a setup script.

**Files:**
- Create: `scripts/create-schulsong-merch-cutoff-field.ts`

**Step 1: Write the setup script**

```typescript
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID!);
const EVENTS_TABLE_ID = 'tblz7x6z5gy0ZZlEi';

async function createField() {
  console.log('Creating schulsong_merch_cutoff field on Events table...');

  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'schulsong_merch_cutoff',
        type: 'dateTime',
        options: {
          timeZone: 'Europe/Berlin',
          dateFormat: { name: 'european' },
          timeFormat: { name: '24hour' },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create field:', error);
    process.exit(1);
  }

  const field = await response.json();
  console.log('Field created successfully!');
  console.log(`Field ID: ${field.id}`);
  console.log(`\nAdd this to EVENTS_FIELD_IDS in src/lib/types/airtable.ts:`);
  console.log(`  schulsong_merch_cutoff: '${field.id}',`);
}

createField().catch(console.error);
```

**Step 2: Run the script**

```bash
npx tsx scripts/create-schulsong-merch-cutoff-field.ts
```

Expected: Field ID printed. Copy it for Task 2.

**Step 3: Commit**

```bash
git add scripts/create-schulsong-merch-cutoff-field.ts
git commit -m "chore: add Airtable setup script for schulsong_merch_cutoff field"
```

---

### Task 2: Add Field to Type System + Airtable Service

Wire `schulsong_merch_cutoff` through the type system and data layer.

**Files:**
- Modify: `src/lib/types/airtable.ts` (lines 560, 801)
- Modify: `src/lib/services/airtableService.ts` (lines 3936, 6204, 6465)

**Step 1: Add field ID to EVENTS_FIELD_IDS**

In `src/lib/types/airtable.ts`, after the `schulsong_released_at` line (~line 560):

```typescript
  // Schulsong merch cutoff (auto-computed on teacher approval, admin-overridable)
  schulsong_merch_cutoff: 'fld<FIELD_ID_FROM_SCRIPT>',
```

**Step 2: Add to Event interface**

In `src/lib/types/airtable.ts`, after `schulsong_released_at?: string;` (~line 801):

```typescript
  // Schulsong merch cutoff (auto-set on teacher approval, admin-overridable)
  schulsong_merch_cutoff?: string;
```

**Step 3: Add to transformEventRecord**

In `src/lib/services/airtableService.ts`, in `transformEventRecord()` after the `schulsong_released_at` line (~line 6204):

```typescript
      schulsong_merch_cutoff: record.get('schulsong_merch_cutoff') as string | undefined,
```

**Step 4: Add to getAllEvents**

In `src/lib/services/airtableService.ts`, in `getAllEvents()` after the `timeline_overrides` line (~line 6465):

```typescript
        schulsong_released_at: record.fields[EVENTS_FIELD_IDS.schulsong_released_at] as string | undefined,
        schulsong_merch_cutoff: record.fields[EVENTS_FIELD_IDS.schulsong_merch_cutoff] as string | undefined,
        admin_approval_status: record.fields[EVENTS_FIELD_IDS.admin_approval_status] as Event['admin_approval_status'] | undefined,
```

Note: `schulsong_released_at` and `admin_approval_status` are already in `transformEventRecord` but may be **missing** from `getAllEvents()`. Check and add if absent — the cron jobs need these fields.

**Step 5: Add setter function**

In `src/lib/services/airtableService.ts`, after `setSchulsongReleasedAt` (~line 3966):

```typescript
  async setSchulsongMerchCutoff(eventId: string, cutoffDate: string | null): Promise<void> {
    try {
      const events = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (events.length === 0) {
        console.log(`[setSchulsongMerchCutoff] Event not found: ${eventId}`);
        return;
      }

      await this.base(EVENTS_TABLE_ID).update(events[0].id, {
        [EVENTS_FIELD_IDS.schulsong_merch_cutoff]: cutoffDate ?? undefined,
      });

      console.log(`[setSchulsongMerchCutoff] Updated event ${eventId}: schulsong_merch_cutoff=${cutoffDate}`);
    } catch (error) {
      console.error('[setSchulsongMerchCutoff] Error:', error);
      throw new Error(`Failed to set schulsong merch cutoff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
```

**Step 6: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(airtable|EVENTS_FIELD)" | head -5
```

Expected: No new errors related to our changes.

**Step 7: Commit**

```bash
git add src/lib/types/airtable.ts src/lib/services/airtableService.ts
git commit -m "feat: add schulsong_merch_cutoff field to type system and data layer"
```

---

### Task 3: Add Email Templates to Registry

Add `schulsong_approval_reminder` and `schulsong_merch_last_chance` templates.

**Files:**
- Modify: `src/lib/config/trigger-email-registry.ts`

**Step 1: Add schulsong_approval_reminder template**

After the `schulsong_teacher_rejected` entry (approximately line 348, after our earlier addition), add:

```typescript
  // ─── 5c. Schulsong Approval Reminder (Teacher + Admin) ──────────────
  {
    slug: 'schulsong_approval_reminder',
    name: 'Schulsong Freigabe-Erinnerung',
    description: 'Wird täglich an Lehrer und Admins gesendet, solange der Schulsong noch nicht freigegeben wurde (24h+ nach Upload).',
    recipientType: 'teacher',
    triggerEventKey: 'cron:schulsong_approval_pending',
    defaultSubject: 'Schulsong wartet auf Freigabe – {{schoolName}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Schulsong bereit zur Freigabe
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Der Schulsong für die <strong>{{schoolName}}</strong> ({{eventDate}}) wurde vor {{daysPending}} Tagen hochgeladen und wartet auf Ihre Freigabe.
</p>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Bitte hören Sie sich den Song an und geben Sie ihn frei, damit die Eltern ihren Schulsong und das passende Merchandise erhalten können.
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0 32px 0;">
      <a href="{{teacherPortalUrl}}"
         style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
        Zum Pädagogen-Portal
      </a>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
  <a href="{{teacherPortalUrl}}" style="color: #d85a6a; word-break: break-all;">{{teacherPortalUrl}}</a>
</p>`,
    availableVariables: ['schoolName', 'eventDate', 'teacherPortalUrl', 'daysPending'],
  },
```

**Step 2: Add schulsong_merch_last_chance template**

After the above entry, add:

```typescript
  // ─── 5d. Schulsong Merch Last Chance (Parents) ─────────────────────
  {
    slug: 'schulsong_merch_last_chance',
    name: 'Letzte Chance: Schul-Merch',
    description: 'Wird 24 Stunden vor Ablauf der Schulsong-Merch-Frist an Eltern gesendet, die noch kein personalisiertes Merchandise bestellt haben.',
    recipientType: 'parent',
    triggerEventKey: 'cron:schulsong_merch_cutoff_reminder',
    defaultSubject: 'Letzte Chance: Schul-Merch für {{schoolName}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Letzte Chance für personalisiertes Schul-Merch!
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Hallo {{parentName}},
</p>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Die Bestellfrist für personalisierte T-Shirts und Hoodies mit dem Namen der <strong>{{schoolName}}</strong> endet morgen am <strong>{{cutoffDate}}</strong>.
</p>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Danach sind nur noch Standard-Designs verfügbar. Jetzt bestellen und ein einzigartiges Erinnerungsstück sichern!
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0 32px 0;">
      <a href="{{parentPortalLink}}"
         style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
        Zum Elternportal
      </a>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
  <a href="{{parentPortalLink}}" style="color: #d85a6a; word-break: break-all;">{{parentPortalLink}}</a>
</p>`,
    availableVariables: ['schoolName', 'parentName', 'parentPortalLink', 'cutoffDate'],
  },
```

**Step 3: Verify no syntax errors**

```bash
npx tsc --noEmit 2>&1 | grep "trigger-email-registry" | head -5
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/config/trigger-email-registry.ts
git commit -m "feat: add schulsong approval reminder and merch last chance email templates"
```

---

### Task 4: Add Send + Trigger Functions for New Templates

Wire the new templates through resendService and notificationService.

**Files:**
- Modify: `src/lib/services/resendService.ts`
- Modify: `src/lib/services/notificationService.ts`

**Step 1: Add send functions to resendService**

After `sendSchulsongTeacherRejectedNotification` (approximately line 320), add:

```typescript
// ============================================================================
// SCHULSONG APPROVAL REMINDER + MERCH LAST CHANCE
// ============================================================================

/**
 * Send schulsong approval reminder to teacher and admin recipients
 */
export async function sendSchulsongApprovalReminderEmail(
  recipients: string[],
  data: { schoolName: string; eventDate: string; daysPending: string }
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  const teacherPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/paedagogen`;
  return sendTriggerEmail(recipients, 'schulsong_approval_reminder', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    teacherPortalUrl,
    daysPending: data.daysPending,
  }, 'Schulsong approval reminder');
}

/**
 * Send last chance merch email to a single parent recipient
 */
export async function sendSchulsongMerchLastChanceEmail(
  recipientEmail: string,
  data: { schoolName: string; parentName: string; cutoffDate: string }
): Promise<SendEmailResult> {
  const parentPortalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/familie`;
  return sendTriggerEmail(recipientEmail, 'schulsong_merch_last_chance', {
    schoolName: data.schoolName,
    parentName: data.parentName,
    parentPortalLink,
    cutoffDate: data.cutoffDate,
  }, 'Schulsong merch last chance', {
    parentEmail: recipientEmail,
  });
}
```

Note: The `sendTriggerEmail` function is file-private (not exported). It's called from within `resendService.ts`. The `parentEmail` option triggers unsubscribe headers for parent emails.

**Step 2: Add trigger function for approval reminders to notificationService**

After `triggerSchulsongTeacherRejectedNotification` (approximately line 258), add:

```typescript
/**
 * Send schulsong approval reminder to teacher + admin recipients
 * Used by cron when schulsong is pending for >24h after upload
 */
export async function triggerSchulsongApprovalReminder(
  data: { schoolName: string; eventDate: string; eventId: string; daysPending: number; teacherEmail: string }
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Get admin recipients from notification settings (reuse same config as approval notification)
    const settings = await getNotificationSettings('schulsong_teacher_approved');
    const adminRecipients = settings?.enabled ? parseRecipientEmails(settings.recipientEmails) : [];

    // Combine teacher + admins, deduplicate
    const allRecipients = [...new Set([data.teacherEmail, ...adminRecipients].map(e => e.toLowerCase()))];

    if (allRecipients.length === 0) {
      return { sent: false, error: 'No recipients' };
    }

    const { sendSchulsongApprovalReminderEmail } = await import('./resendService');
    const result = await sendSchulsongApprovalReminderEmail(allRecipients, {
      schoolName: data.schoolName,
      eventDate: data.eventDate,
      daysPending: String(data.daysPending),
    });

    if (result.success) {
      console.log(`[NotificationService] Schulsong approval reminder sent for ${data.eventId} to ${allRecipients.length} recipients`);
      return { sent: true };
    }
    return { sent: false, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongApprovalReminder:', error);
    return { sent: false, error: errorMessage };
  }
}
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(resendService|notificationService)" | head -5
```

Expected: No new errors.

**Step 4: Commit**

```bash
git add src/lib/services/resendService.ts src/lib/services/notificationService.ts
git commit -m "feat: add send and trigger functions for approval reminder and merch last chance emails"
```

---

### Task 5: Unified Release + Merch Cutoff on Teacher Approval

When teacher approves, compute the correct `schulsong_released_at` and `schulsong_merch_cutoff` based on event type.

**Files:**
- Modify: `src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts`
- Modify: `src/lib/utils/schulsongRelease.ts`

**Step 1: Add helper function for next-day-7am computation**

In `src/lib/utils/schulsongRelease.ts`, add after the existing `computeSchulsongReleaseDate` function:

```typescript
/**
 * Compute the unified schulsong release date based on event type.
 *
 * Schulsong-only: next day at 7am Berlin (approval + 1 day)
 * Combined (M/PLUS + Schulsong): max(event_date + full_release_days, next day 7am Berlin)
 */
export function computeUnifiedReleaseDate(
  eventDate: string | undefined,
  fullReleaseDays: number,
  isCombined: boolean,
  now: Date = new Date()
): Date {
  const nextDay7am = computeSchulsongReleaseDate(now);

  if (!isCombined || !eventDate) {
    // Schulsong-only: always next day 7am
    return nextDay7am;
  }

  // Combined: max(event_date + full_release_days at 7am Berlin, next day 7am)
  const normalGate = new Date(eventDate);
  normalGate.setDate(normalGate.getDate() + fullReleaseDays);

  // Set normal gate to 7am Berlin for fair comparison
  // Use the same timezone logic as computeSchulsongReleaseDate
  const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [gYear, gMonth, gDay] = berlinFormatter.format(normalGate).split('-').map(Number);
  const midnightUtc = new Date(Date.UTC(gYear, gMonth - 1, gDay, 0, 0, 0));
  const berlinHourAtMidnight = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hour12: false,
    }).format(midnightUtc)
  );
  const normalGate7am = new Date(Date.UTC(gYear, gMonth - 1, gDay, 7 - berlinHourAtMidnight, 0, 0));

  return normalGate7am > nextDay7am ? normalGate7am : nextDay7am;
}

/**
 * Compute the schulsong merch cutoff date.
 *
 * Schulsong-only: release_date + 10 days
 * Combined: max(event_date + 14, release_date + 7 days)
 */
export function computeSchulsongMerchCutoff(
  releaseDate: Date,
  eventDate: string | undefined,
  isCombined: boolean
): Date {
  if (!isCombined || !eventDate) {
    // Schulsong-only: release + 10 days
    const cutoff = new Date(releaseDate);
    cutoff.setDate(cutoff.getDate() + 10);
    return cutoff;
  }

  // Combined: max(event_date + 14, release + 7)
  const eventGate = new Date(eventDate);
  eventGate.setDate(eventGate.getDate() + 14);

  const releaseGate = new Date(releaseDate);
  releaseGate.setDate(releaseGate.getDate() + 7);

  return eventGate > releaseGate ? eventGate : releaseGate;
}
```

**Step 2: Update the approve route to use unified release + set merch cutoff**

In `src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts`:

Replace the current import:
```typescript
import { computeSchulsongReleaseDate } from '@/lib/utils/schulsongRelease';
```
With:
```typescript
import { computeUnifiedReleaseDate, computeSchulsongMerchCutoff } from '@/lib/utils/schulsongRelease';
import { getThreshold, parseOverrides } from '@/lib/utils/eventThresholds';
```

Replace the release date computation block (~lines 47-52):
```typescript
    // Auto-schedule release for next working day 7am Berlin
    // (skip if already released — don't override an admin instant release)
    const airtableService = getAirtableService();
    const event = await airtableService.getEventByEventId(eventId);
    if (event && !event.schulsong_released_at) {
      const releaseDate = computeSchulsongReleaseDate();
      await airtableService.setSchulsongReleasedAt(eventId, releaseDate.toISOString());
    }
```

With:
```typescript
    const airtableService = getAirtableService();
    const event = await airtableService.getEventByEventId(eventId);
    if (event && !event.schulsong_released_at) {
      // Determine if this is a combined event (M/PLUS + Schulsong) or schulsong-only
      const isCombined = !!(event.is_minimusikertag || event.is_plus);
      const overrides = parseOverrides(event.timeline_overrides);
      const fullReleaseDays = getThreshold('full_release_days', overrides);

      // Unified release: schulsong-only = approval+1 day, combined = max(normal gate, approval+1)
      const releaseDate = computeUnifiedReleaseDate(event.event_date, fullReleaseDays, isCombined);
      await airtableService.setSchulsongReleasedAt(eventId, releaseDate.toISOString());

      // Auto-set merch cutoff: schulsong-only = release+10, combined = max(event+14, release+7)
      const merchCutoff = computeSchulsongMerchCutoff(releaseDate, event.event_date, isCombined);
      await airtableService.setSchulsongMerchCutoff(eventId, merchCutoff.toISOString());
    }
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(schulsongRelease|schulsong-approve)" | head -5
```

**Step 4: Commit**

```bash
git add src/lib/utils/schulsongRelease.ts src/app/api/teacher/events/\[eventId\]/schulsong-approve/route.ts
git commit -m "feat: unified release date + merch cutoff computation on teacher approval"
```

---

### Task 6: Hold Class Audio on Combined Events

When `is_schulsong=true` on an event, require `schulsong_released_at` to be set and in the past before releasing class audio to parents.

**Files:**
- Modify: `src/app/api/parent/audio-access/route.ts` (~lines 97-104)

**Step 1: Add schulsong gate to release check**

In `src/app/api/parent/audio-access/route.ts`, after `const audioHidden = ...` (line 101), modify the `isReleased` computation:

Replace:
```typescript
    const audioHidden = overrides?.audio_hidden === true;

    const hasPreviewsAvailable = previewDate ? now >= previewDate && !audioHidden : false;
    const isReleased = releaseDate ? now >= releaseDate && !audioHidden : false;
```

With:
```typescript
    const audioHidden = overrides?.audio_hidden === true;

    // Schulsong gate: if event has schulsong, also require schulsong_released_at to have passed
    // This holds class audio release until schulsong is approved (creating unified "moment")
    const schulsongGatePassed = event?.is_schulsong
      ? !!(event.schulsong_released_at && new Date(event.schulsong_released_at) <= now)
      : true; // Non-schulsong events: no gate

    const hasPreviewsAvailable = previewDate ? now >= previewDate && !audioHidden : false;
    const isReleased = releaseDate ? now >= releaseDate && !audioHidden && schulsongGatePassed : false;
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep "audio-access" | head -5
```

**Step 3: Commit**

```bash
git add src/app/api/parent/audio-access/route.ts
git commit -m "feat: hold class audio release until schulsong approved on combined events"
```

---

### Task 7: Shop Merch Cutoff from schulsong_merch_cutoff

When `schulsong_merch_cutoff` is set on an event, use that absolute date for the personalized clothing gate instead of computing from event_date.

**Files:**
- Modify: `src/app/api/parent/schulsong-status/route.ts` (add `schulsong_merch_cutoff` to response)
- Modify: `src/app/familie/shop/page.tsx` (~lines 149-162)

**Step 1: Add schulsong_merch_cutoff to schulsong-status API response**

In `src/app/api/parent/schulsong-status/route.ts`, in all the response objects that include `isSchulsong`, add:

```typescript
        schulsongMerchCutoff: event?.schulsong_merch_cutoff || null,
```

Add this field to every `NextResponse.json({...})` call that returns event data (there are ~4 response paths in this file).

**Step 2: Read schulsongMerchCutoff in shop page**

In `src/app/familie/shop/page.tsx`, in the `fetchEventProfile` function (~line 120), add after `setTimelineOverridesJson`:

```typescript
          if (data.schulsongMerchCutoff) {
            setSchulsongMerchCutoff(data.schulsongMerchCutoff);
          }
```

Add the state variable at the top of the component (near other state declarations):

```typescript
  const [schulsongMerchCutoff, setSchulsongMerchCutoff] = useState<string | null>(null);
```

**Step 3: Use absolute cutoff date when available**

In `src/app/familie/shop/page.tsx`, replace the cutoff computation (~lines 149-162):

Replace:
```typescript
  const excludedVariantIds = useMemo(() => {
    if (!shopProfile || !eventDate) return new Set<string>();

    const isSchulsongOnly = shopProfile.audioProducts.length === 0;
    const cutoffDays = isSchulsongOnly
      ? getThreshold('schulsong_clothing_cutoff_days', overrides)
      : getThreshold('personalized_clothing_cutoff_days', overrides);
    // Standard merch gate: under-100-kid schools only see standard clothing
    const showPersonalized = isStandardMerchOnly
      ? false
      : canOrderPersonalizedClothing(eventDate, cutoffDays);
```

With:
```typescript
  const excludedVariantIds = useMemo(() => {
    if (!shopProfile || !eventDate) return new Set<string>();

    let showPersonalized: boolean;
    if (isStandardMerchOnly) {
      showPersonalized = false;
    } else if (schulsongMerchCutoff) {
      // When schulsong_merch_cutoff is set, use that absolute date
      showPersonalized = new Date() < new Date(schulsongMerchCutoff);
    } else {
      // Fallback to relative days from event date
      const isSchulsongOnly = shopProfile.audioProducts.length === 0;
      const cutoffDays = isSchulsongOnly
        ? getThreshold('schulsong_clothing_cutoff_days', overrides)
        : getThreshold('personalized_clothing_cutoff_days', overrides);
      showPersonalized = canOrderPersonalizedClothing(eventDate, cutoffDays);
    }
```

Add `schulsongMerchCutoff` to the `useMemo` dependency array:
```typescript
  }, [shopProfile, eventDate, overrides, isStandardMerchOnly, schulsongMerchCutoff]);
```

**Step 4: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(shop/page|schulsong-status)" | head -5
```

**Step 5: Commit**

```bash
git add src/app/api/parent/schulsong-status/route.ts src/app/familie/shop/page.tsx
git commit -m "feat: use schulsong_merch_cutoff for shop personalized clothing gate"
```

---

### Task 8: Update Merch Deadline in Parent Release Email

Change `computeMerchandiseDeadline` in schulsongEmailService to read from `schulsong_merch_cutoff` field when available.

**Files:**
- Modify: `src/lib/services/schulsongEmailService.ts` (~lines 157-166, ~line 236)

**Step 1: Update computeMerchandiseDeadline**

Replace the existing function (~lines 157-166):

```typescript
function computeMerchandiseDeadline(eventDate: string, overrides?: EventTimelineOverrides | null): string {
  const date = new Date(eventDate);
  const days = getThreshold('merchandise_deadline_days', overrides);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
```

With:

```typescript
function computeMerchandiseDeadline(
  eventDate: string,
  overrides?: EventTimelineOverrides | null,
  schulsongMerchCutoff?: string | null
): string {
  // Prefer the auto-computed/admin-overridden absolute cutoff date
  if (schulsongMerchCutoff) {
    return new Date(schulsongMerchCutoff).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  // Fallback: compute from event_date + threshold days
  const date = new Date(eventDate);
  const days = getThreshold('merchandise_deadline_days', overrides);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
```

**Step 2: Pass schulsong_merch_cutoff to the function**

In `sendSchulsongParentReleaseEmailForEvent`, where `computeMerchandiseDeadline` is called (~line 236), update:

From:
```typescript
      merchandiseDeadline: computeMerchandiseDeadline(event.event_date, parseOverrides(event.timeline_overrides)),
```

To:
```typescript
      merchandiseDeadline: computeMerchandiseDeadline(event.event_date, parseOverrides(event.timeline_overrides), event.schulsong_merch_cutoff),
```

**Step 3: Commit**

```bash
git add src/lib/services/schulsongEmailService.ts
git commit -m "feat: use schulsong_merch_cutoff in parent release email merchandise deadline"
```

---

### Task 9: Approval Reminder Cron

Add `processSchulsongApprovalReminders()` to the email automation system.

**Files:**
- Modify: `src/lib/services/emailAutomationService.ts`
- Modify: `src/app/api/cron/email-automation/route.ts`

**Step 1: Add processSchulsongApprovalReminders to emailAutomationService**

After `processSchulsongReleaseEmails` function (~line 813), add:

```typescript
/**
 * Process schulsong approval reminders.
 * Sends daily email to teacher + admins when schulsong is pending review for >24h.
 *
 * State-aware: only sends when latest schulsong file has approvalStatus='pending'.
 * Pauses when rejected (engineer working). Stops when approved.
 */
export async function processSchulsongApprovalReminders(
  dryRun: boolean = false
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const airtable = getAirtableService();
  const { getTeacherService } = await import('@/lib/services/teacherService');
  const teacherService = getTeacherService();
  const { triggerSchulsongApprovalReminder } = await import('@/lib/services/notificationService');

  const allEvents = await airtable.getAllEvents();
  const now = new Date();

  // Filter: schulsong events that are not yet released and event_date has passed
  const pending = allEvents.filter(
    (e) =>
      e.is_schulsong &&
      e.status !== 'Cancelled' && e.status !== 'Deleted' &&
      !parseOverrides(e.timeline_overrides)?.communications_paused &&
      !e.schulsong_released_at &&
      e.event_date && new Date(e.event_date) <= now
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of pending) {
    try {
      // Find the latest schulsong final audio file
      const audioFiles = await teacherService.getAudioFilesByEventId(event.event_id);
      const schulsongFinal = audioFiles.find(
        (f) => f.isSchulsong && f.type === 'final' && f.status === 'ready'
      );

      if (!schulsongFinal) {
        // No schulsong uploaded yet — skip
        skipped++;
        continue;
      }

      if (schulsongFinal.approvalStatus === 'rejected') {
        // Engineer is working on revision — pause reminders
        skipped++;
        continue;
      }

      if (schulsongFinal.approvalStatus === 'approved') {
        // Already approved but not released yet — skip
        skipped++;
        continue;
      }

      // Check if uploaded >24h ago
      const uploadedAt = schulsongFinal.uploadedAt ? new Date(schulsongFinal.uploadedAt) : null;
      if (!uploadedAt || (now.getTime() - uploadedAt.getTime()) < 24 * 60 * 60 * 1000) {
        // Uploaded less than 24h ago — too early for reminder
        skipped++;
        continue;
      }

      // Check dedup: already sent today?
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const dedupKey = `schulsong_approval_reminder_${todayStr}`;
      const alreadySent = await airtable.hasEmailBeenSent(dedupKey, event.event_id, 'teacher+admin');
      if (alreadySent) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[ApprovalReminder] (dry-run) Would send for ${event.event_id} (${event.school_name})`);
        skipped++;
        continue;
      }

      // Compute days pending
      const daysPending = Math.floor((now.getTime() - uploadedAt.getTime()) / (24 * 60 * 60 * 1000));

      // Get teacher email from booking
      const bookingRecordId = event.simplybook_booking?.[0];
      let teacherEmail = '';
      if (bookingRecordId) {
        const booking = await airtable.getSchoolBookingById(bookingRecordId);
        teacherEmail = booking?.schoolContactEmail || '';
      }

      if (!teacherEmail) {
        console.warn(`[ApprovalReminder] No teacher email for ${event.event_id}`);
        skipped++;
        continue;
      }

      const result = await triggerSchulsongApprovalReminder({
        schoolName: event.school_name,
        eventDate: event.event_date,
        eventId: event.event_id,
        daysPending,
        teacherEmail,
      });

      if (result.sent) {
        // Log for dedup
        await airtable.createEmailLog({
          templateName: dedupKey,
          eventId: event.event_id,
          recipientEmail: 'teacher+admin',
          recipientType: 'admin',
          status: 'sent',
          sentAt: now.toISOString(),
        });
        sent++;
      } else {
        failed++;
        if (result.error) errors.push(`${event.event_id}: ${result.error}`);
      }
    } catch (err) {
      const msg = `Failed to process ${event.event_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[ApprovalReminder] ${msg}`);
      errors.push(msg);
      failed++;
    }
  }

  console.log(`[ApprovalReminder] Processed ${pending.length} events: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return { sent, skipped, failed, errors };
}
```

**Step 2: Wire into cron route**

In `src/app/api/cron/email-automation/route.ts`, add import and call alongside schulsong release emails.

After the import of `processSchulsongReleaseEmails`, add:
```typescript
import { processSchulsongApprovalReminders } from '@/lib/services/emailAutomationService';
```

Wait — `processSchulsongReleaseEmails` is likely already imported. Check if all functions are exported from the same file. If so, add `processSchulsongApprovalReminders` to the existing import.

In the cron handler, after the schulsong release processing (~line 87), add:

```typescript
    // Process schulsong approval reminders (runs every hour, dedup prevents duplicates)
    let approvalReminderResult: { sent: number; skipped: number; failed: number; errors: string[] } | undefined;
    approvalReminderResult = await processSchulsongApprovalReminders(isDryRun);
    if (approvalReminderResult.errors.length > 0) {
      console.error('[Email Automation Cron] Approval reminder errors:', approvalReminderResult.errors);
    }
```

Add to the results logging at the end:
```typescript
    if (approvalReminderResult) {
      console.log(
        `[Email Automation Cron] Approval reminders: ${approvalReminderResult.sent} sent, ${approvalReminderResult.skipped} skipped, ${approvalReminderResult.failed} failed`
      );
    }
```

Also add `approvalReminderResult` to the response JSON.

**Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(emailAutomation|email-automation)" | head -5
```

**Step 4: Commit**

```bash
git add src/lib/services/emailAutomationService.ts src/app/api/cron/email-automation/route.ts
git commit -m "feat: add state-aware schulsong approval reminder cron"
```

---

### Task 10: Last Chance Merch Email Cron

Add `processSchulsongMerchLastChance()` to the email automation system.

**Files:**
- Modify: `src/lib/services/emailAutomationService.ts`
- Modify: `src/app/api/cron/email-automation/route.ts`

**Step 1: Add processSchulsongMerchLastChance to emailAutomationService**

After `processSchulsongApprovalReminders` (from Task 9), add:

```typescript
/**
 * Process schulsong merch "last chance" emails.
 * Sends 24h before schulsong_merch_cutoff to parents who haven't ordered personalized merch.
 */
export async function processSchulsongMerchLastChance(
  dryRun: boolean = false
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const airtable = getAirtableService();
  const { sendSchulsongMerchLastChanceEmail } = await import('@/lib/services/resendService');

  const allEvents = await airtable.getAllEvents();
  const now = new Date();

  // Find events where schulsong_merch_cutoff is tomorrow (within 24-48h)
  const eligible = allEvents.filter((e) => {
    if (!e.is_schulsong || !e.schulsong_merch_cutoff) return false;
    if (e.status === 'Cancelled' || e.status === 'Deleted') return false;
    if (parseOverrides(e.timeline_overrides)?.communications_paused) return false;

    const cutoff = new Date(e.schulsong_merch_cutoff);
    const hoursUntilCutoff = (cutoff.getTime() - now.getTime()) / (60 * 60 * 1000);
    // Send when cutoff is 24-48h away (gives cron window flexibility)
    return hoursUntilCutoff > 0 && hoursUntilCutoff <= 48;
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of eligible) {
    try {
      // Get non-buyer parents
      const allParents = await getParentRecipientsForEvent(event.event_id, event.id, {
        event: event,
        daysUntilEvent: 0,
      } as any);
      const paidEmails = await getPaidParentEmailsForEvent(event.id);
      const nonBuyers = allParents.filter(p => !paidEmails.has(p.email.toLowerCase()));

      if (nonBuyers.length === 0) {
        skipped++;
        continue;
      }

      const cutoffDateStr = new Date(event.schulsong_merch_cutoff!).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      for (const parent of nonBuyers) {
        // Dedup check
        const alreadySent = await airtable.hasEmailBeenSent(
          'schulsong_merch_last_chance',
          event.event_id,
          parent.email
        );
        if (alreadySent) {
          skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`[MerchLastChance] (dry-run) Would send to ${parent.email} for ${event.event_id}`);
          skipped++;
          continue;
        }

        const result = await sendSchulsongMerchLastChanceEmail(parent.email, {
          schoolName: event.school_name,
          parentName: parent.name || '',
          cutoffDate: cutoffDateStr,
        });

        if (result.success) {
          await airtable.createEmailLog({
            templateName: 'schulsong_merch_last_chance',
            eventId: event.event_id,
            recipientEmail: parent.email,
            recipientType: 'parent',
            status: 'sent',
            sentAt: now.toISOString(),
            resendMessageId: result.messageId,
          });
          sent++;
        } else {
          failed++;
          if (result.error) errors.push(`${event.event_id}/${parent.email}: ${result.error}`);
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      const msg = `Failed to process ${event.event_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[MerchLastChance] ${msg}`);
      errors.push(msg);
      failed++;
    }
  }

  console.log(`[MerchLastChance] Processed ${eligible.length} events: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return { sent, skipped, failed, errors };
}
```

Note: `getParentRecipientsForEvent` and `getPaidParentEmailsForEvent` are already defined in `emailAutomationService.ts`. They may need to be made accessible (check if they're `async function` or `export async function`). If they're not exported, that's fine since we're adding code in the same file.

**Step 2: Wire into cron route**

In `src/app/api/cron/email-automation/route.ts`, add the call in the 6-8am Berlin window alongside schulsong release emails:

```typescript
    // Process merch last chance emails (run in same window as schulsong releases)
    let merchLastChanceResult: { sent: number; skipped: number; failed: number; errors: string[] } | undefined;
    if (berlinHour >= 6 && berlinHour <= 8) {
      merchLastChanceResult = await processSchulsongMerchLastChance(isDryRun);
      if (merchLastChanceResult.errors.length > 0) {
        console.error('[Email Automation Cron] Merch last chance errors:', merchLastChanceResult.errors);
      }
    }
```

Add logging and include in response JSON.

**Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep -E "(emailAutomation|email-automation)" | head -5
```

**Step 4: Commit**

```bash
git add src/lib/services/emailAutomationService.ts src/app/api/cron/email-automation/route.ts
git commit -m "feat: add last chance merch email cron for non-buying parents"
```

---

### Task 11: Admin UI — Merch Cutoff Display + Override

Show `schulsong_merch_cutoff` in admin event settings with override capability.

**Files:**
- Modify: `src/app/admin/events/[eventId]/settings/page.tsx`

**Step 1: Add merch cutoff display to Order Deadlines section**

In the settings page, after the existing `ORDER_DEADLINE_FIELDS` rendering (~line 439, after the `</SettingsSection>` for Bestellfristen), add a new section **only visible for schulsong events**:

```tsx
        {/* Section 1b: Schulsong Merch Cutoff (absolute date, only for schulsong events) */}
        {isSchulsong && (
          <SettingsSection
            title="Schulsong Merch-Frist"
            description="Absoluter Stichtag für personalisiertes Schulsong-Merchandise. Wird automatisch bei Lehrer-Freigabe gesetzt."
          >
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Merch-Frist</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {schulsongMerchCutoff
                      ? `${new Date(schulsongMerchCutoff).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      : 'Noch nicht festgelegt (wird bei Freigabe berechnet)'}
                  </p>
                  {schulsongMerchCutoff && (
                    <p className="text-xs text-amber-600 mt-1">
                      Manuell ändern überschreibt die automatische Berechnung
                    </p>
                  )}
                </div>
                {schulsongMerchCutoff && (
                  <input
                    type="date"
                    value={schulsongMerchCutoffOverride || schulsongMerchCutoff?.split('T')[0] || ''}
                    onChange={(e) => setSchulsongMerchCutoffOverride(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                  />
                )}
              </div>
            </div>
          </SettingsSection>
        )}
```

This requires:
- Adding state: `const [schulsongMerchCutoff, setSchulsongMerchCutoff] = useState<string | null>(null);`
- Adding state: `const [schulsongMerchCutoffOverride, setSchulsongMerchCutoffOverride] = useState<string | null>(null);`
- Fetching `schulsong_merch_cutoff` from the event data API (same as how `timeline_overrides` is fetched)
- Saving the override via a PATCH to the admin events API when the settings are saved

The exact implementation depends on how the settings page fetches/saves data. Follow the existing pattern for `timeline_overrides` saves. When saving, call `setSchulsongMerchCutoff` on the airtableService with the override date.

**Step 2: Verify the UI renders**

```bash
npm run build 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add src/app/admin/events/\[eventId\]/settings/page.tsx
git commit -m "feat: add schulsong merch cutoff display and override in admin settings"
```

---

### Task 12: Admin UI — Release Hold Banner

Show a banner on the event detail page when class audio is being held for schulsong approval.

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1: Add banner component**

In the event detail page, after the event status/type section but before the main content, add a conditional banner:

```tsx
        {/* Schulsong release hold banner */}
        {event.is_schulsong && !event.schulsong_released_at && (event.is_minimusikertag || event.is_plus) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 mt-0.5">⏳</div>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Audio-Veröffentlichung wartet auf Schulsong-Freigabe
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Die Klassen-Aufnahmen werden erst freigegeben, wenn der Lehrer den Schulsong genehmigt hat.
                </p>
              </div>
            </div>
          </div>
        )}
```

Also show merch cutoff if set:
```tsx
        {event.schulsong_merch_cutoff && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">🛍️</div>
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Schulsong Merch-Frist: {new Date(event.schulsong_merch_cutoff).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}
```

Note: The event object is already fetched in this page. Ensure `schulsong_merch_cutoff` is included in the API response (it should be via `transformEventRecord` from Task 2).

**Step 2: Commit**

```bash
git add src/app/admin/events/\[eventId\]/page.tsx
git commit -m "feat: add schulsong release hold banner and merch cutoff display in admin"
```

---

### Task 13: Clear Merch Cutoff on Rejection

When teacher rejects a previously-approved schulsong (re-upload cycle), clear the merch cutoff so it gets recomputed on next approval.

**Files:**
- Modify: `src/app/api/teacher/events/[eventId]/schulsong-reject/route.ts`

**Step 1: Clear merch cutoff alongside release date**

In the reject route, after clearing `schulsong_released_at` (~line 51):

```typescript
    if (event?.schulsong_released_at) {
      await airtableService.setSchulsongReleasedAt(eventId, '');
    }
```

Add:
```typescript
    if (event?.schulsong_merch_cutoff) {
      await airtableService.setSchulsongMerchCutoff(eventId, null);
    }
```

**Step 2: Commit**

```bash
git add src/app/api/teacher/events/\[eventId\]/schulsong-reject/route.ts
git commit -m "feat: clear schulsong merch cutoff on teacher rejection"
```

---

## Verification

### Manual Testing

1. **Create/find a schulsong-only event** with `is_schulsong=true`, `is_minimusikertag=false`
2. **Upload a schulsong final** via engineer portal → verify teacher gets "New schulsong ready" email
3. **Wait 24h** (or adjust cron timing for test) → verify daily approval reminder fires to teacher + admins
4. **Reject as teacher** → verify reminders pause, engineer gets rejection email
5. **Re-upload** → verify teacher gets "Updated schulsong ready", 24h clock resets
6. **Approve as teacher** → verify:
   - `schulsong_released_at` set to approval + 1 day
   - `schulsong_merch_cutoff` set to release + 10 days
   - Reminders stop
7. **Check parent portal shop** → personalized merch available, `schulsongMerchCutoff` used for gate
8. **Check parent release email** → `{{merchandiseDeadline}}` shows cutoff date from field
9. **24h before cutoff** → non-buying parents get "Last Chance" email
10. **After cutoff** → personalized merch hidden, standard shown

### Combined Event Testing

1. **Create event** with `is_schulsong=true`, `is_minimusikertag=true`
2. **Approve schulsong early** (before event_date + 14) → verify release held until normal gate
3. **Check audio-access API** → `isReleased=false` until both gates pass
4. **After both gates pass** → class audio + schulsong release together

### Admin UI Testing

1. **Event settings** → merch cutoff date visible for schulsong events
2. **Override cutoff** → save, verify shop respects new date
3. **Event detail** → "Audio held" banner visible on combined events before approval
