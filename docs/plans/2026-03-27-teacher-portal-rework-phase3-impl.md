# Teacher Portal Rework Phase 3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **WORKTREE:** ALL work must be done in `/Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/teacher_portal_revamp` on branch `teacher_portal_revamp`.

**Goal:** Adjust popup/finalize timing to 1pm Berlin, make schulsong class name editable, add admin unlock/re-lock, and add tracklist confirmation trigger email.

**Architecture:** Update all time-gated logic to use 1pm Berlin threshold. Add `schulsong_tracklist_class` Airtable field for editable class name. Two new admin API endpoints for unlock/finalize. New cron email processor with 24-hour dedup and launch cutoff date.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Airtable, Resend (email)

---

### Task 1: Popup + Finalize Timing — 1pm Berlin

**Files:**
- Modify: `src/components/teacher/TracklistReminderPopup.tsx`
- Modify: `src/components/shared/AlbumLayoutModal.tsx`
- Modify: `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts`

**Step 1:** In `TracklistReminderPopup.tsx`, replace the show condition logic (lines 45-49) with 1pm Berlin check:

```typescript
  // Show from 1pm Berlin on event day, or always on past event days
  const berlinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const berlinHour = berlinNow.getHours();
  const berlinToday = new Date(berlinNow);
  berlinToday.setHours(0, 0, 0, 0);

  const eventDateObj = new Date(eventDate);
  eventDateObj.setHours(0, 0, 0, 0);

  const isEventDay = eventDateObj.getTime() === berlinToday.getTime();
  const isPastEvent = eventDateObj < berlinToday;
  const shouldShowByDate = isPastEvent || (isEventDay && berlinHour >= 13);
```

Replace `eventIsTodayOrPast` usage with `shouldShowByDate`.

**Step 2:** In `AlbumLayoutModal.tsx`, update the `isEventDayOrPast` computed value (lines 154-160):

```typescript
  const isEventDayOrPast = (() => {
    if (!eventDate) return false;
    const berlinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const berlinHour = berlinNow.getHours();
    const berlinToday = new Date(berlinNow);
    berlinToday.setHours(0, 0, 0, 0);
    const ed = new Date(eventDate);
    ed.setHours(0, 0, 0, 0);
    const isEventDay = ed.getTime() === berlinToday.getTime();
    const isPast = ed < berlinToday;
    return isPast || (isEventDay && berlinHour >= 13);
  })();
```

**Step 3:** In the finalize endpoint (lines 40-53), update the date guard to include the 1pm check:

```typescript
    // Server-side guard: event date must be today (after 1pm Berlin) or past
    const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const berlinHourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric', hour12: false,
    });
    const eventDateStr = event.eventDate.split('T')[0];
    const nowBerlinDate = berlinFormatter.format(new Date());
    const nowBerlinHour = parseInt(berlinHourFormatter.format(new Date()), 10);

    const isEventDay = eventDateStr === nowBerlinDate;
    const isPast = eventDateStr < nowBerlinDate;

    if (!isPast && !(isEventDay && nowBerlinHour >= 13)) {
      return NextResponse.json(
        { error: 'Cannot finalize before 13:00 on event day' },
        { status: 400 }
      );
    }
```

**Step 4:** Commit

```bash
git add src/components/teacher/TracklistReminderPopup.tsx \
        src/components/shared/AlbumLayoutModal.tsx \
        src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts
git commit -m "feat: change popup and finalize timing to 1pm Berlin on event day"
```

---

### Task 2: Editable Schulsong Class Name — Airtable Field + Data Layer

**Files:**
- Create: `scripts/create-schulsong-tracklist-class-field.ts`
- Modify: `src/lib/types/airtable.ts`
- Modify: `src/lib/services/airtableService.ts`
- Modify: `src/lib/services/teacherService.ts`

**Step 1:** Create `scripts/create-schulsong-tracklist-class-field.ts` following the pattern from `scripts/create-schulsong-tracklist-title-field.ts`:
- Field name: `schulsong_tracklist_class`
- Type: `singleLineText`
- Description: `Custom class/school name for the schulsong track on the CD booklet. Default: school name.`
- Placeholder: `fldTODO_SCHULSONG_CLASS`

**Step 2:** Add to `EVENTS_FIELD_IDS` in `airtable.ts`:
```typescript
  schulsong_tracklist_class: 'fldTODO_SCHULSONG_CLASS',
```
Add to `Event` interface:
```typescript
  schulsong_tracklist_class?: string;
```

**Step 3:** Wire through `airtableService.ts`:
- Add field to `getEventBySchoolBookingId` and `getAllEventsIndexedByBookingId` field arrays
- Add to `transformEventRecord`
- Add to `updateEventFields` type and logic

**Step 4:** Update `getAlbumTracksData` in `teacherService.ts` — change the virtual schulsong injection defaults:

From:
```typescript
songTitle: eventRecord.schulsong_tracklist_title || `${eventRecord.school_name} - Schulsong`,
className: 'Schulsong',
originalClassName: 'Schulsong',
```
To:
```typescript
songTitle: eventRecord.schulsong_tracklist_title || 'Schulsong',
className: eventRecord.schulsong_tracklist_class || eventRecord.school_name,
originalClassName: eventRecord.schulsong_tracklist_class || eventRecord.school_name,
```

**Step 5:** Update `updateAlbumOrderData` in `teacherService.ts` — save the schulsong class name. Find the section that saves `schulsong_tracklist_title` and extend it:

```typescript
      if (schulsongTrack) {
        const airtable = getAirtableService();
        const eventRecord = await airtable.getEventByEventId(eventId);
        if (eventRecord) {
          const updates: Record<string, string | null> = {};
          if (schulsongTrack.title !== undefined) {
            updates.schulsong_tracklist_title = schulsongTrack.title;
          }
          if (schulsongTrack.className !== undefined) {
            updates.schulsong_tracklist_class = schulsongTrack.className;
          }
          if (Object.keys(updates).length > 0) {
            await airtable.updateEventFields(eventRecord.id, updates);
          }
        }
      }
```

**Step 6:** Run the creation script:
```bash
npx tsx scripts/create-schulsong-tracklist-class-field.ts
```

**Step 7:** Commit

```bash
git add scripts/create-schulsong-tracklist-class-field.ts \
        src/lib/types/airtable.ts src/lib/services/airtableService.ts \
        src/lib/services/teacherService.ts
git commit -m "feat: add editable schulsong class name with schulsong_tracklist_class field"
```

---

### Task 3: Editable Schulsong Class Name — UI

**Files:**
- Modify: `src/components/shared/AlbumLayoutModal.tsx`

**Step 1:** In the pinned schulsong track rendering, change the class name from a read-only `<span>` to an editable `<input>`. Find the line:
```tsx
<span className="w-40 px-2 py-1 text-sm text-amber-600">Schulsong</span>
```

Replace with:
```tsx
<input
  type="text"
  value={schulsongTrack.editedClassName}
  onChange={(e) => handleClassNameChange(schulsongTrack.songId, e.target.value)}
  readOnly={isReadOnly}
  className={`w-40 px-2 py-1 text-sm rounded ${
    isReadOnly
      ? 'border-transparent bg-transparent text-amber-600'
      : 'border border-amber-300 bg-white text-amber-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400'
  }`}
  placeholder="Schulname"
/>
```

Note: `schulsongTrack` is an `EditableTrack` which has `editedClassName`. The `handleClassNameChange` function already exists and works with any songId including `__schulsong__`.

**Step 2:** Commit

```bash
git add src/components/shared/AlbumLayoutModal.tsx
git commit -m "feat: make schulsong class name editable in AlbumLayoutModal"
```

---

### Task 4: Admin Unlock/Re-lock API Endpoints

**Files:**
- Create: `src/app/api/admin/events/[eventId]/album-order/unlock/route.ts`
- Create: `src/app/api/admin/events/[eventId]/album-order/finalize/route.ts`

**Step 1:** Create the unlock endpoint:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();
    const eventRecord = await airtableService.getEventByEventId(eventId);

    if (!eventRecord) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await airtableService.updateEventFields(eventRecord.id, {
      tracklist_finalized_at: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlocking tracklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unlock' },
      { status: 500 }
    );
  }
}
```

**Step 2:** Create the admin finalize endpoint — similar to teacher finalize but NO date guard:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    // Save tracks if provided
    const body = await request.json().catch(() => ({}));
    const { tracks } = body as { tracks?: AlbumTrackUpdate[] };

    if (tracks && Array.isArray(tracks) && tracks.length > 0) {
      const teacherService = getTeacherService();
      await teacherService.updateAlbumOrderData(eventId, tracks);
    }

    const airtableService = getAirtableService();
    const eventRecord = await airtableService.getEventByEventId(eventId);
    if (!eventRecord) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const finalizedAt = new Date().toISOString();
    await airtableService.updateEventFields(eventRecord.id, {
      tracklist_finalized_at: finalizedAt,
    });

    return NextResponse.json({ success: true, finalizedAt });
  } catch (error) {
    console.error('Error admin-finalizing tracklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize' },
      { status: 500 }
    );
  }
}
```

IMPORTANT: Check the correct import for `verifyAdminSession`. Search `src/lib/auth/` for the admin auth function — it may be named differently.

**Step 3:** Commit

```bash
git add src/app/api/admin/events/[eventId]/album-order/unlock/route.ts \
        src/app/api/admin/events/[eventId]/album-order/finalize/route.ts
git commit -m "feat: add admin unlock and finalize endpoints for tracklist"
```

---

### Task 5: Admin Unlock/Re-lock UI + showAdminFinalize Prop

**Files:**
- Modify: `src/components/admin/AdminLehrerStatusCard.tsx`
- Modify: `src/components/shared/AlbumLayoutModal.tsx`

**Step 1:** Add `showAdminFinalize` prop to `AlbumLayoutModalProps`:
```typescript
  showAdminFinalize?: boolean;  // Shows admin "Bestätigen" button (no date guard)
```

In the footer, add a new button section (after the hideFinalize conditional block):
```typescript
{showAdminFinalize && !isFinalized && (
  <button
    onClick={handleAdminFinalize}
    disabled={state === 'saving' || state === 'loading' || tracks.length === 0}
    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Bestätigen
  </button>
)}
```

Add the `handleAdminFinalize` function (similar to `handleFinalize` but no confirm dialog, no date check):
```typescript
  const handleAdminFinalize = async () => {
    setState('saving');
    setError('');
    try {
      const updates: AlbumTrackUpdate[] = tracks.map((track, index) => ({
        songId: track.songId,
        albumOrder: index + 1,
        classId: track.classId,
        ...(track.editedTitle !== track.originalTitle && { title: track.editedTitle }),
        ...(track.editedClassName !== track.originalClassName && { className: track.editedClassName }),
      }));

      const finalizeUrl = `${apiBaseUrl}/finalize`;
      const response = await fetch(finalizeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Bestätigen');
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error admin-finalizing:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Bestätigen');
      setState('ready');
    }
  };
```

**Step 2:** Update `AdminLehrerStatusCard` with unlock/re-lock UI:

Add state:
```typescript
const [isUnlocking, setIsUnlocking] = useState(false);
const [localFinalizedAt, setLocalFinalizedAt] = useState(tracklistFinalizedAt);
```

Use `localFinalizedAt` instead of `tracklistFinalizedAt` for UI state (so it updates after unlock without prop change).

Add sync effect:
```typescript
useEffect(() => { setLocalFinalizedAt(tracklistFinalizedAt); }, [tracklistFinalizedAt]);
```

Add unlock handler:
```typescript
const handleUnlock = async () => {
  if (!confirm('Die Lieder-Reihenfolge wird entsperrt. Du kannst sie bearbeiten und erneut bestätigen. Fortfahren?')) return;
  setIsUnlocking(true);
  try {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/album-order/unlock`, {
      method: 'POST', credentials: 'include',
    });
    if (!res.ok) throw new Error('Unlock failed');
    setLocalFinalizedAt(undefined);
  } catch (err) {
    console.error('Unlock failed:', err);
  } finally {
    setIsUnlocking(false);
  }
};
```

Update the button area:
```typescript
<div className="flex items-center gap-2">
  {localFinalizedAt ? (
    <>
      <button onClick={() => setShowAlbumModal(true)} className="text-sm text-pink-600 hover:text-pink-700 font-medium">
        Tracklist ansehen
      </button>
      <button onClick={handleUnlock} disabled={isUnlocking} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
        {isUnlocking ? 'Entsperren...' : 'Entsperren'}
      </button>
    </>
  ) : (
    <button onClick={() => setShowAlbumModal(true)} className="text-sm text-pink-600 hover:text-pink-700 font-medium">
      Tracklist bearbeiten
    </button>
  )}
</div>
```

Update the AlbumLayoutModal render to pass `showAdminFinalize` when unlocked:
```typescript
{showAlbumModal && (
  <AlbumLayoutModal
    eventId={eventId}
    apiBaseUrl={`/api/admin/events/${encodeURIComponent(eventId)}/album-order`}
    onClose={() => setShowAlbumModal(false)}
    onSave={() => { setLocalFinalizedAt(undefined); /* will be set by Bestätigen */ }}
    hideFinalize={true}
    showAdminFinalize={!localFinalizedAt}
    tracklistFinalizedAt={localFinalizedAt}
    eventDate={eventDate}
  />
)}
```

**Step 3:** Commit

```bash
git add src/components/shared/AlbumLayoutModal.tsx \
        src/components/admin/AdminLehrerStatusCard.tsx
git commit -m "feat: add admin unlock/re-lock UI with showAdminFinalize prop"
```

---

### Task 6: Trigger Email — Template + Cron Processor

**Files:**
- Modify: `src/lib/config/trigger-email-registry.ts`
- Modify: `src/lib/services/emailAutomationService.ts`
- Modify: `src/app/api/cron/email-automation/route.ts`

**Step 1:** Add new template to the trigger email registry. Add to the `TRIGGER_EMAIL_REGISTRY` array:

```typescript
  // ─── Tracklist Confirmation Reminder ────────────────────────────────
  {
    slug: 'tracklist_confirmation_reminder',
    name: 'Lieder-Reihenfolge Bestätigung',
    description: 'Erinnert Lehrer nach dem Minimusikertag, die Lieder-Reihenfolge für das CD-Booklet zu bestätigen. Wird ab 13 Uhr am Eventtag alle 24 Stunden gesendet.',
    recipientType: 'teacher',
    defaultSubject: 'Lieder-Reihenfolge für {{schoolName}} bestätigen',
    defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{teacherName}},
</h2>

<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Euer Minimusikertag an der {{schoolName}} hat stattgefunden — vielen Dank für einen tollen Tag!
</p>

<p style="margin: 0 0 16px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Damit wir die CD-Booklets drucken können, benötigen wir noch die finale Bestätigung eurer Lieder-Reihenfolge. Bitte logge dich in dein Pädagogen-Portal ein und bestätige die Reihenfolge.
</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; padding: 14px 28px; background-color: #e91e8c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
    Jetzt bestätigen
  </a>
</div>

<p style="margin: 0 0 8px 0; color: #718096; font-size: 14px; line-height: 1.5;">
  Der Link ist 24 Stunden gültig. Falls er abgelaufen ist, kannst du dir auf der Login-Seite einen neuen Link zusenden lassen.
</p>`,
    availableVariables: ['teacherName', 'schoolName', 'eventDate', 'loginUrl'],
  },
```

**Step 2:** Add the cron processor function to `emailAutomationService.ts`. Add after `processSchulsongMerchLastChance`:

```typescript
// =============================================================================
// Tracklist Confirmation Reminder Processing (called by cron at 1pm Berlin)
// =============================================================================

const TRACKLIST_EMAIL_CUTOFF = '2026-03-20';

export async function processTracklistConfirmationEmails(
  dryRun: boolean = false
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const airtable = getAirtableService();
  const teacherService = getTeacherService();

  const allEvents = await airtable.getAllEvents();
  const berlinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const berlinToday = new Date(berlinNow);
  berlinToday.setHours(0, 0, 0, 0);

  // Filter events:
  // - tracklist not finalized
  // - event date >= cutoff (prevents mass-send to old events)
  // - event date is today or past
  // - not cancelled/deleted
  const pending = allEvents.filter((e) => {
    if (e.status === 'Cancelled' || e.status === 'Deleted') return false;
    if (e.tracklist_finalized_at) return false;
    if (!e.event_date) return false;
    if (e.event_date < TRACKLIST_EMAIL_CUTOFF) return false;

    const eventDate = new Date(e.event_date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate <= berlinToday;
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of pending) {
    try {
      // Dedup: check if already sent in last 24 hours
      const dedupKey = 'tracklist_confirmation_reminder';
      const alreadySent = await airtable.hasEmailBeenSentSince(dedupKey, event.event_id, '', 24);
      if (alreadySent) {
        skipped++;
        continue;
      }

      // Get teacher email from booking
      const bookingRecordId = event.simplybook_booking?.[0];
      let teacherEmail = '';
      let teacherName = '';
      if (bookingRecordId) {
        const booking = await airtable.getSchoolBookingById(bookingRecordId);
        teacherEmail = booking?.schoolContactEmail || '';
        teacherName = booking?.schoolContactName || '';
      }

      if (!teacherEmail) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[TracklistReminder] (dry-run) Would send to ${teacherEmail} for ${event.event_id}`);
        skipped++;
        continue;
      }

      // Generate magic link for teacher
      const teacher = await teacherService.getTeacherByEmail(teacherEmail);
      let loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.minimusiker.de';
      if (teacher) {
        const token = await teacherService.generateMagicLinkToken(teacher.id);
        loginUrl = `${loginUrl}/paedagogen-login?token=${token}`;
      } else {
        loginUrl = `${loginUrl}/paedagogen-login`;
      }

      // Get template from registry
      const { TRIGGER_EMAIL_REGISTRY } = await import('@/lib/config/trigger-email-registry');
      const template = TRIGGER_EMAIL_REGISTRY.find(t => t.slug === 'tracklist_confirmation_reminder');
      if (!template) {
        errors.push(`Template not found: tracklist_confirmation_reminder`);
        failed++;
        continue;
      }

      // Substitute variables
      const subject = template.defaultSubject
        .replace(/\{\{schoolName\}\}/g, event.school_name);
      const body = template.defaultBodyHtml
        .replace(/\{\{teacherName\}\}/g, teacherName || 'Lehrer/in')
        .replace(/\{\{schoolName\}\}/g, event.school_name)
        .replace(/\{\{eventDate\}\}/g, new Date(event.event_date).toLocaleDateString('de-DE'))
        .replace(/\{\{loginUrl\}\}/g, loginUrl);

      // Send via Resend
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Minimusiker <info@minimusiker.de>',
        to: teacherEmail,
        subject,
        html: body,
      });

      // Log for dedup
      await airtable.createEmailLog({
        templateName: dedupKey,
        eventId: event.event_id,
        recipientEmail: teacherEmail,
        recipientType: 'teacher',
        status: 'sent',
      });
      sent++;
    } catch (err) {
      const msg = `Failed for ${event.event_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[TracklistReminder] ${msg}`);
      errors.push(msg);
      failed++;
    }
  }

  console.log(`[TracklistReminder] Processed ${pending.length} events: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return { sent, skipped, failed, errors };
}
```

**Step 3:** Wire into the cron route. In `src/app/api/cron/email-automation/route.ts`:

Update import (line 17):
```typescript
import { processEmailAutomation, processSchulsongReleaseEmails, processSchulsongApprovalReminders, processSchulsongMerchLastChance, processTracklistConfirmationEmails, getCurrentBerlinHour } from '@/lib/services/emailAutomationService';
```

Add after the merch last chance block (around line 113):
```typescript
    // Process tracklist confirmation reminders — 1pm Berlin time
    let tracklistReminderResult: { sent: number; skipped: number; failed: number; errors: string[] } | undefined;
    if (berlinHour === 13) {
      console.log(`[Email Automation Cron] Processing tracklist confirmation reminders (Berlin hour: ${berlinHour})`);
      tracklistReminderResult = await processTracklistConfirmationEmails(isDryRun);
      if (tracklistReminderResult.errors.length > 0) {
        console.error('[Email Automation Cron] Tracklist reminder errors:', tracklistReminderResult.errors);
      }
    }
```

Add to the response JSON:
```typescript
    return NextResponse.json({
      success: true,
      mode: isDryRun ? 'dry-run' : 'live',
      result,
      schulsongResult,
      approvalReminderResult,
      merchLastChanceResult,
      tracklistReminderResult,
    });
```

Add logging:
```typescript
    if (tracklistReminderResult) {
      console.log(
        `[Email Automation Cron] Tracklist reminders: ${tracklistReminderResult.sent} sent, ${tracklistReminderResult.skipped} skipped, ${tracklistReminderResult.failed} failed`
      );
    }
```

**Step 4:** Commit

```bash
git add src/lib/config/trigger-email-registry.ts \
        src/lib/services/emailAutomationService.ts \
        src/app/api/cron/email-automation/route.ts
git commit -m "feat: add tracklist confirmation reminder trigger email with 1pm cron and launch cutoff"
```

---

### Task 7: TypeScript Verification & Final Fixes

**Step 1:** Run TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "tests/" | head -30
```

Fix any errors.

**Step 2:** Commit fixes if any.
