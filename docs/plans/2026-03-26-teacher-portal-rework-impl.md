# Teacher Portal Event View Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **WORKTREE:** ALL work must be done in `/Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/teacher_portal_revamp` on branch `teacher_portal_revamp`. Do NOT modify files in the main repo directory.

**Goal:** Restructure the teacher event page with a Hinweise checklist, prominent Lieder-Reihenfolge section, save/finalize flow for tracklists, and a blocking post-event popup for unconfirmed tracklists.

**Architecture:** New `tracklistFinalizedAt` field on Event records in Airtable, exposed through the existing teacher event API. Three new UI components (HinweiseSection, LiederReihenfolgeSection, TracklistReminderPopup) integrated into the existing event detail page. Modified AlbumLayoutModal with three-button footer and finalization logic. New POST endpoint for finalization with server-side date guard.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Airtable, @dnd-kit

---

### Task 1: Add `tracklistFinalizedAt` to Airtable Types & Event Interface

**Files:**
- Modify: `src/lib/types/airtable.ts:531-578` (EVENTS_FIELD_IDS)
- Modify: `src/lib/types/airtable.ts:798-850` (Event interface)
- Modify: `src/lib/types/teacher.ts:246-273` (TeacherEventView interface)

**Step 1: Add field ID to EVENTS_FIELD_IDS**

In `src/lib/types/airtable.ts`, add after `minicard_order_quantity` (line 577):

```typescript
  // Tracklist finalization
  tracklist_finalized_at: 'fldTODO_REPLACE_ME',    // DateTime - when teacher finalized album order
```

> **NOTE:** The Airtable field ID `fldTODO_REPLACE_ME` must be replaced with the actual field ID after creating the field in Airtable. For now, use a placeholder — the field must be created manually in the Airtable UI (Events table → add "tracklist_finalized_at" as a DateTime field), then copy the field ID here.

**Step 2: Add to Event interface**

In `src/lib/types/airtable.ts`, add after `minicard_order_quantity?: number;` (line 849):

```typescript
  // Tracklist finalization
  tracklist_finalized_at?: string;                   // ISO datetime when teacher finalized tracklist
```

**Step 3: Add to TeacherEventView interface**

In `src/lib/types/teacher.ts`, add after `estimatedChildren?: number;` (line 260):

```typescript
  tracklistFinalizedAt?: string; // ISO datetime when teacher finalized album order
```

**Step 4: Commit**

```bash
git add src/lib/types/airtable.ts src/lib/types/teacher.ts
git commit -m "feat: add tracklistFinalizedAt field to Event and TeacherEventView types"
```

---

### Task 2: Wire `tracklistFinalizedAt` Through Data Layer

**Files:**
- Modify: `src/lib/services/airtableService.ts:6149-6201` (getEventBySchoolBookingId — add field to query)
- Modify: `src/lib/services/airtableService.ts:6207-6260` (getAllEventsIndexedByBookingId — add field to query)
- Modify: `src/lib/services/airtableService.ts:6379-6437` (transformEventRecord — map new field)
- Modify: `src/lib/services/teacherService.ts:2806-2832` (getTeacherEvents — pass to TeacherEventView)
- Modify: `src/lib/services/teacherService.ts:3040-3060` (linked events section — same addition)

**Step 1: Add field to getEventBySchoolBookingId query**

In `src/lib/services/airtableService.ts`, inside `getEventBySchoolBookingId`, add to the `fields` array (after `EVENTS_FIELD_IDS.classes` around line 6178):

```typescript
          EVENTS_FIELD_IDS.tracklist_finalized_at,
```

**Step 2: Add field to getAllEventsIndexedByBookingId query**

In `src/lib/services/airtableService.ts`, inside `getAllEventsIndexedByBookingId`, add to the `fields` array (after `EVENTS_FIELD_IDS.classes` around line 6241):

```typescript
          EVENTS_FIELD_IDS.tracklist_finalized_at,
```

**Step 3: Map in transformEventRecord**

In `src/lib/services/airtableService.ts`, inside `transformEventRecord`, add before the closing `};` of the return object (around line 6436):

```typescript
      // Tracklist finalization
      tracklist_finalized_at: val(EVENTS_FIELD_IDS.tracklist_finalized_at, 'tracklist_finalized_at') as string | undefined,
```

**Step 4: Pass to TeacherEventView in getTeacherEvents**

In `src/lib/services/teacherService.ts`, inside the `events.push({...})` block (around line 2806-2832), add after `assignedStaff,` (line 2821):

```typescript
          tracklistFinalizedAt: eventRecord?.tracklist_finalized_at,
```

**Step 5: Pass to TeacherEventView in linked events section**

Find the second `events.push({...})` block for linked events (around line 3040-3060). Add after `assignedStaff:` line:

```typescript
          tracklistFinalizedAt: linkedEvent.tracklist_finalized_at,
```

**Step 6: Commit**

```bash
git add src/lib/services/airtableService.ts src/lib/services/teacherService.ts
git commit -m "feat: wire tracklistFinalizedAt through airtable service and teacher event detail"
```

---

### Task 3: Create Finalization API Endpoint

**Files:**
- Create: `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts`
- Modify: `src/app/api/teacher/events/[eventId]/album-order/route.ts:51-94` (add finalization guard to PUT)

**Step 1: Create the finalize endpoint**

Create `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { EVENTS_FIELD_IDS } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/events/[eventId]/album-order/finalize
 * Finalize the tracklist — saves current order and locks it permanently.
 * Server-side guard: event date must be today or in the past.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Verify teacher has access and get event details
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if already finalized
    if (event.tracklistFinalizedAt) {
      return NextResponse.json(
        { error: 'Tracklist already finalized' },
        { status: 400 }
      );
    }

    // Server-side guard: event date must be today or past
    const eventDate = new Date(event.eventDate);
    const now = new Date();
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (eventDateOnly > nowDateOnly) {
      return NextResponse.json(
        { error: 'Cannot finalize before event day' },
        { status: 400 }
      );
    }

    // Parse optional tracks from body (save order before finalizing)
    const body = await request.json().catch(() => ({}));
    const { tracks } = body as { tracks?: AlbumTrackUpdate[] };

    if (tracks && Array.isArray(tracks) && tracks.length > 0) {
      await teacherService.updateAlbumOrder(eventId, session.email, tracks);
    }

    // Set tracklistFinalizedAt on the Event record
    const airtableService = getAirtableService();
    const eventRecord = await airtableService.getEventByEventId(eventId);
    if (!eventRecord) {
      return NextResponse.json({ error: 'Event record not found' }, { status: 404 });
    }

    const finalizedAt = new Date().toISOString();
    await airtableService.updateEvent(eventRecord.id, {
      [EVENTS_FIELD_IDS.tracklist_finalized_at]: finalizedAt,
    });

    return NextResponse.json({
      success: true,
      finalizedAt,
    });
  } catch (error) {
    console.error('Error finalizing tracklist:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize tracklist',
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Add finalization guard to PUT endpoint**

In `src/app/api/teacher/events/[eventId]/album-order/route.ts`, inside the `PUT` handler, add after `const eventId = decodeURIComponent(params.eventId);` and before `const body = await request.json();` (around line 63-67):

```typescript
    // Check if tracklist is finalized — reject edits
    const teacherEvent = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (teacherEvent?.tracklistFinalizedAt) {
      return NextResponse.json(
        { error: 'Tracklist already finalized — no changes allowed' },
        { status: 400 }
      );
    }
```

**Step 3: Verify the `updateEvent` method exists and accepts raw field updates**

Check that `airtableService.updateEvent(recordId, fields)` exists. If it uses a typed `updates` param, use the raw Airtable base update instead. The existing `updateEvent` at line ~5809 accepts `updates` with typed keys, so we need to use the raw approach or extend it. Find the appropriate method — the method at line 5809 uses `updateFields[EVENTS_FIELD_IDS.xyz]` pattern, so we should add `tracklist_finalized_at` support to it.

Add to the `updateEvent` method's accepted fields in `src/lib/services/airtableService.ts` (around line 5809):

```typescript
      tracklist_finalized_at?: string | null;
```

And add the field update logic (around line 5860, after scs_shirts_included block):

```typescript
      if (updates.tracklist_finalized_at !== undefined) {
        updateFields[EVENTS_FIELD_IDS.tracklist_finalized_at] = updates.tracklist_finalized_at;
      }
```

**Step 4: Also check `getEventByEventId` exists**

Verify there's a method like `getEventByEventId(eventId: string)` in airtableService. If not, use the pattern from getEventBySchoolBookingId but filtering by event_id field instead. The finalize route can alternatively use the event's booking record ID to find the Event record.

**Step 5: Commit**

```bash
git add src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts \
        src/app/api/teacher/events/[eventId]/album-order/route.ts \
        src/lib/services/airtableService.ts
git commit -m "feat: add tracklist finalization endpoint and PUT guard"
```

---

### Task 4: Create HinweiseSection Component

**Files:**
- Create: `src/components/teacher/HinweiseSection.tsx`

**Step 1: Create the component**

```typescript
'use client';

interface HinweiseSectionProps {
  classesWithoutSongs: string[];   // Names of classes with 0 songs
  tracklistFinalized: boolean;
  isSchulsong: boolean;
  schulsongApproved: boolean;      // true if schulsong has been approved by teacher
}

export default function HinweiseSection({
  classesWithoutSongs,
  tracklistFinalized,
  isSchulsong,
  schulsongApproved,
}: HinweiseSectionProps) {
  const allClassesHaveSongs = classesWithoutSongs.length === 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Hinweise</h3>
      <div className="space-y-3">
        {/* Classes without songs */}
        <div className="flex items-start gap-3">
          {allClassesHaveSongs ? (
            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <p className={`text-sm ${allClassesHaveSongs ? 'text-green-700' : 'text-amber-700'}`}>
            {allClassesHaveSongs
              ? 'Alle Klassen haben Lieder'
              : <>Folgende Klassen haben noch keine Lieder: <span className="font-medium">{classesWithoutSongs.join(', ')}</span></>
            }
          </p>
        </div>

        {/* Tracklist status */}
        <div className="flex items-start gap-3">
          {tracklistFinalized ? (
            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <p className={`text-sm ${tracklistFinalized ? 'text-green-700 font-medium' : 'text-amber-700'}`}>
            {tracklistFinalized
              ? 'Die Lieder-Reihenfolge wurde bereits final festgelegt'
              : 'Die Lieder-Reihenfolge wurde noch nicht final festgelegt'
            }
          </p>
        </div>

        {/* Schulsong status — only if isSchulsong */}
        {isSchulsong && (
          <div className="flex items-start gap-3">
            {schulsongApproved ? (
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
            <p className={`text-sm ${schulsongApproved ? 'text-green-700' : 'text-amber-700'}`}>
              {schulsongApproved
                ? 'Euer Schulsong wurde freigegeben'
                : 'Euer Schulsong wartet auf Freigabe'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/teacher/HinweiseSection.tsx
git commit -m "feat: add HinweiseSection checklist component"
```

---

### Task 5: Create LiederReihenfolgeSection Component

**Files:**
- Create: `src/components/teacher/LiederReihenfolgeSection.tsx`

**Step 1: Create the component**

```typescript
'use client';

import Image from 'next/image';

interface LiederReihenfolgeSectionProps {
  tracklistFinalized: boolean;
  onOpenModal: () => void;
}

export default function LiederReihenfolgeSection({
  tracklistFinalized,
  onOpenModal,
}: LiederReihenfolgeSectionProps) {
  if (tracklistFinalized) {
    return (
      <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-5">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-green-800">Lieder-Reihenfolge</h3>
            <p className="text-sm text-green-700 mt-1">
              Die Reihenfolge wurde final festgelegt. Vielen Dank!
            </p>
          </div>
        </div>
        <button
          onClick={onOpenModal}
          className="mt-4 px-4 py-2 text-sm text-green-700 border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
        >
          Reihenfolge ansehen
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Lieder-Reihenfolge</h3>
          <p className="text-sm text-gray-600 mb-4">
            Für die Audioprodukte wie CD oder den Lautsprecher kannst du hier eine
            gewünschte Reihenfolge der Titel festlegen. Eine finale Bestätigung
            brauchen wir nach dem Minimusikertag, denn anhand dieser Reihenfolge
            drucken wir Booklets.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Die Reihenfolge der Titel muss nicht mit der Reihenfolge der Aufnahme am Tag vor Ort übereinstimmen.
          </p>
          <button
            onClick={onOpenModal}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
          >
            Jetzt festlegen
          </button>
        </div>
        <div className="hidden sm:block flex-shrink-0">
          <Image
            src="/images/booklet_asset.png"
            alt="CD-Booklet Beispiel"
            width={120}
            height={120}
            className="rounded-lg object-contain"
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/teacher/LiederReihenfolgeSection.tsx
git commit -m "feat: add LiederReihenfolgeSection component with booklet image"
```

---

### Task 6: Create TracklistReminderPopup Component

**Files:**
- Create: `src/components/teacher/TracklistReminderPopup.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface TracklistReminderPopupProps {
  eventId: string;
  eventDate: string;
  tracklistFinalizedAt?: string;
  onOpenTracklistModal: () => void;
}

export default function TracklistReminderPopup({
  eventId,
  eventDate,
  tracklistFinalizedAt,
  onOpenTracklistModal,
}: TracklistReminderPopupProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    const key = `tracklist-reminder-dismissed-${eventId}`;
    if (sessionStorage.getItem(key)) {
      setDismissed(true);
    }
  }, [eventId]);

  // Don't show if already finalized
  if (tracklistFinalizedAt) return null;

  // Don't show if event is in the future
  const eventDateObj = new Date(eventDate);
  const now = new Date();
  const eventDateOnly = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate());
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (eventDateOnly > nowDateOnly) return null;

  // Don't show if dismissed this session
  if (dismissed) return null;

  const handleDismiss = () => {
    const key = `tracklist-reminder-dismissed-${eventId}`;
    sessionStorage.setItem(key, 'true');
    setDismissed(true);
  };

  const handleOpenModal = () => {
    setDismissed(true); // hide popup when opening modal
    onOpenTracklistModal();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center">
          {/* Warning icon */}
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Lieder-Reihenfolge noch nicht bestätigt
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Dein Minimusikertag hat bereits stattgefunden, aber die Lieder-Reihenfolge
            wurde noch nicht finalisiert. Wir benötigen diese, um die CD-Booklets zu
            drucken. Bitte lege die Reihenfolge jetzt fest.
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Später erinnern
            </button>
            <button
              onClick={handleOpenModal}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
            >
              Jetzt festlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/teacher/TracklistReminderPopup.tsx
git commit -m "feat: add TracklistReminderPopup blocking modal component"
```

---

### Task 7: Modify AlbumLayoutModal — Three-Button Footer & Read-Only Mode

**Files:**
- Modify: `src/components/shared/AlbumLayoutModal.tsx`

This is the most complex task. The modal needs:
1. New header text from design spec
2. Finalization status indicator
3. Three footer buttons (Abbrechen, Speichern, Finalisieren)
4. Finalisieren greyed out before event day with hover tooltip
5. Read-only mode when already finalized (no drag, no edit)

**Step 1: Update the AlbumLayoutModal props interface**

Add new props (around line 23-29):

```typescript
interface AlbumLayoutModalProps {
  eventId: string;
  apiBaseUrl: string;
  classesWithoutSongs?: string[];
  onClose: () => void;
  onSave?: () => void;
  // New props for finalization
  tracklistFinalizedAt?: string;      // ISO datetime if already finalized
  eventDate?: string;                  // Event date for determining if finalize button is active
}
```

**Step 2: Update the component function signature**

Add the new props to the destructured params (around line 123-129):

```typescript
export default function AlbumLayoutModal({
  eventId,
  apiBaseUrl,
  classesWithoutSongs,
  onClose,
  onSave,
  tracklistFinalizedAt,
  eventDate,
}: AlbumLayoutModalProps) {
```

**Step 3: Add state and computed values for finalization**

After existing state declarations (around line 133), add:

```typescript
  const [showFinalizeTooltip, setShowFinalizeTooltip] = useState(false);

  const isFinalized = Boolean(tracklistFinalizedAt);

  // Determine if event day has passed (finalize button active)
  const isEventDayOrPast = (() => {
    if (!eventDate) return false;
    const ed = new Date(eventDate);
    const now = new Date();
    const edOnly = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return edOnly <= nowOnly;
  })();
```

**Step 4: Update SortableTrackItem to support read-only mode**

Update the `SortableTrackItem` component props interface (around line 39-48) to accept a `readOnly` prop:

```typescript
function SortableTrackItem({
  track,
  index,
  onTitleChange,
  onClassNameChange,
  readOnly,
}: {
  track: EditableTrack;
  index: number;
  onTitleChange: (songId: string, title: string) => void;
  onClassNameChange: (songId: string, className: string) => void;
  readOnly?: boolean;
}) {
```

In the SortableTrackItem JSX:
- Make the drag handle hidden when `readOnly`: add `className={... ${readOnly ? 'invisible' : ''}`}` to the drag handle button
- Make inputs read-only: add `readOnly={readOnly}` and adjust styling when readOnly (remove border, add `bg-transparent`)

**Step 5: Replace the header text**

Replace the existing `<p className="text-sm text-gray-600 mb-4">` text (around line 381-383) with:

```typescript
                  <p className="text-sm text-gray-600 mb-3">
                    Ziehe die Titel per Drag&amp;Drop in die gewünschte Reihenfolge, so wie sie
                    auf dem Tonträger (CD, Lautsprecherbox) zu hören sein sollen. Du kannst diese
                    Liste speichern und NACH dem Minimusikertag finalisieren, danach ist die
                    Reihenfolge fest und nicht mehr veränderbar. Achte auch auf die korrekte
                    Schreibweise, denn anhand dieser Informationen lassen wir die CD-Booklets drucken.
                  </p>

                  {/* Finalization status indicator */}
                  {isFinalized ? (
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700 font-medium">
                        Diese Lieder-Reihenfolge wurde final festgelegt
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-700 font-medium">
                        Diese Lieder-Reihenfolge wurde noch nicht final festgelegt
                      </p>
                    </div>
                  )}
```

**Step 6: Pass `readOnly` to SortableTrackItem**

In the track list rendering (around line 394-402), pass `readOnly={isFinalized}`:

```typescript
                        <SortableTrackItem
                          key={track.songId}
                          track={track}
                          index={index}
                          onTitleChange={handleTitleChange}
                          onClassNameChange={handleClassNameChange}
                          readOnly={isFinalized}
                        />
```

**Step 7: Add finalize handler**

After the existing `handleSave` function, add:

```typescript
  const handleFinalize = async () => {
    const confirmed = confirm(
      'Die Reihenfolge wird endgültig festgelegt und kann danach nicht mehr geändert werden. Fortfahren?'
    );
    if (!confirmed) return;

    setState('saving');
    setError('');

    try {
      // Build update payload (same as save)
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
        throw new Error(data.error || 'Fehler beim Finalisieren');
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error finalizing tracklist:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Finalisieren');
      setState('ready');
    }
  };
```

**Step 8: Replace the footer with three buttons**

Replace the entire footer `<div>` (lines 419-437) with:

```typescript
        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={state === 'saving'}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>

          {!isFinalized && (
            <button
              onClick={handleSave}
              disabled={state === 'saving' || state === 'loading' || !hasChanges || tracks.length === 0}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {state === 'saving' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Speichern
            </button>
          )}

          {!isFinalized && (
            <div className="relative">
              <button
                onClick={isEventDayOrPast ? handleFinalize : undefined}
                disabled={state === 'saving' || state === 'loading' || tracks.length === 0}
                onMouseEnter={() => !isEventDayOrPast && setShowFinalizeTooltip(true)}
                onMouseLeave={() => setShowFinalizeTooltip(false)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isEventDayOrPast
                    ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Finalisieren
              </button>
              {showFinalizeTooltip && !isEventDayOrPast && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap">
                  Verfügbar nach dem Minimusikertag
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
```

**Step 9: Disable DndContext when finalized**

Wrap the `DndContext` so drag is disabled when finalized. Add `disabled` check to the sensors — the simplest approach is to pass empty sensors when finalized:

At the top where sensors are defined (line 135-140), wrap:

```typescript
  const activeSensors = isFinalized ? [] : [
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  ];

  const sensors = useSensors(...activeSensors);
```

Actually, `useSensors` doesn't accept spread of empty array well. Instead, conditionally prevent drag in the handleDragEnd:

```typescript
  const handleDragEnd = (event: DragEndEvent) => {
    if (isFinalized) return;
    // ... existing logic
  };
```

And disable pointer events on drag handles via the `readOnly` prop in SortableTrackItem.

**Step 10: Commit**

```bash
git add src/components/shared/AlbumLayoutModal.tsx
git commit -m "feat: add save/finalize flow to AlbumLayoutModal with read-only mode"
```

---

### Task 8: Integrate New Components into Event Page

**Files:**
- Modify: `src/app/paedagogen/events/[eventId]/page.tsx`

This task wires everything together on the event detail page.

**Step 1: Add imports**

At the top of the file (around lines 7-15), add:

```typescript
import HinweiseSection from '@/components/teacher/HinweiseSection';
import LiederReihenfolgeSection from '@/components/teacher/LiederReihenfolgeSection';
import TracklistReminderPopup from '@/components/teacher/TracklistReminderPopup';
```

**Step 2: Add schulsong approval state**

In the `TeacherEventDetailPage` component, after existing state declarations (around line 1201), add:

```typescript
  const [schulsongApproved, setSchulsongApproved] = useState(false);
```

**Step 3: Fetch schulsong status**

Add a useEffect to fetch schulsong approval status (after `fetchCollections` function, around line 1262):

```typescript
  // Fetch schulsong approval status for Hinweise
  useEffect(() => {
    if (!event?.isSchulsong) return;

    async function fetchSchulsongStatus() {
      try {
        const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/schulsong-status`);
        if (response.ok) {
          const data = await response.json();
          setSchulsongApproved(data.status === 'approved');
        }
      } catch (err) {
        console.error('Error fetching schulsong status:', err);
      }
    }

    fetchSchulsongStatus();
  }, [event?.isSchulsong, eventId]);
```

**Step 4: Add two-column Hinweise + Lieder-Reihenfolge section**

In the JSX, AFTER the Header Card closing `</div>` (around line 1373) and BEFORE the SCS Clothing Order section (line 1375), insert:

```typescript
        {/* Hinweise + Lieder-Reihenfolge two-column section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <HinweiseSection
            classesWithoutSongs={
              regularClasses
                .filter(c => c.songs.length === 0)
                .map(c => c.className)
            }
            tracklistFinalized={Boolean(event.tracklistFinalizedAt)}
            isSchulsong={event.isSchulsong || false}
            schulsongApproved={schulsongApproved}
          />
          <LiederReihenfolgeSection
            tracklistFinalized={Boolean(event.tracklistFinalizedAt)}
            onOpenModal={() => setShowAlbumLayoutModal(true)}
          />
        </div>
```

**Step 5: Remove inline Album-Reihenfolge button from Klassen & Lieder header**

Delete the Album-Reihenfolge button block (lines 1399-1408):

```typescript
              <button
                onClick={() => setShowAlbumLayoutModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Album-Reihenfolge für das gedruckte Album festlegen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Album-Reihenfolge
              </button>
```

**Step 6: Pass new props to AlbumLayoutModal**

Update the AlbumLayoutModal rendering (around lines 1642-1650) to pass new props:

```typescript
        {showAlbumLayoutModal && (
          <AlbumLayoutModal
            eventId={event.eventId}
            apiBaseUrl={`/api/teacher/events/${encodeURIComponent(event.eventId)}/album-order`}
            classesWithoutSongs={event.classes.filter(c => c.songs.length === 0).map(c => c.className)}
            onClose={() => setShowAlbumLayoutModal(false)}
            onSave={handleRefresh}
            tracklistFinalizedAt={event.tracklistFinalizedAt}
            eventDate={event.eventDate}
          />
        )}
```

**Step 7: Add TracklistReminderPopup**

Add the popup just before the closing `</div>` of the main container (before line 1652), after the AlbumLayoutModal:

```typescript
        {/* Tracklist Reminder Popup — blocking modal on/after event day */}
        {!isLoading && event && (
          <TracklistReminderPopup
            eventId={event.eventId}
            eventDate={event.eventDate}
            tracklistFinalizedAt={event.tracklistFinalizedAt}
            onOpenTracklistModal={() => setShowAlbumLayoutModal(true)}
          />
        )}
```

**Step 8: Commit**

```bash
git add src/app/paedagogen/events/[eventId]/page.tsx
git commit -m "feat: integrate Hinweise, LiederReihenfolge, and TracklistReminderPopup into teacher event page"
```

---

### Task 9: Copy Booklet Asset & TypeScript Verification

**Files:**
- Copy: `context/teacher_portal_rework/booklet_asset.png` → `public/images/booklet_asset.png`

**Step 1: Copy the booklet asset**

The asset was already copied during worktree setup. Verify it exists:

```bash
ls -la public/images/booklet_asset.png
```

**Step 2: Run TypeScript type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v "tests/" | head -30
```

Fix any type errors that come up in the files we modified.

**Step 3: Commit the asset if not already tracked**

```bash
git add public/images/booklet_asset.png
git commit -m "feat: add booklet_asset.png for Lieder-Reihenfolge section"
```

---

### Task 10: Manual Testing & Final Verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Test the following scenarios**

Use the browser to navigate to a teacher event page (`/paedagogen/events/{eventId}`):

1. **Hinweise section** renders with correct states for classes, tracklist, and schulsong
2. **Lieder-Reihenfolge section** shows booklet image and "Jetzt festlegen" button
3. **Album-Reihenfolge modal** opens with new header text, three buttons visible
4. **Speichern** saves and closes modal
5. **Finalisieren** is greyed out for future events, shows tooltip on hover
6. **Finalisieren** is active for past/today events, shows confirm dialog
7. **TracklistReminderPopup** appears on past events with unfinalized tracklist
8. **"Später erinnern"** dismisses popup, doesn't reappear until new session
9. **"Jetzt festlegen"** in popup opens the tracklist modal
10. After finalization: Hinweise shows green checkmark, Lieder-Reihenfolge shows success state, modal is read-only
11. **Inline Album-Reihenfolge button** no longer appears in Klassen & Lieder header

**Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
