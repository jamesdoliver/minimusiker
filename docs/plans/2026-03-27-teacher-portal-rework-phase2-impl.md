# Teacher Portal Rework Phase 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **WORKTREE:** ALL work must be done in `/Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/teacher_portal_revamp` on branch `teacher_portal_revamp`. Do NOT modify files in the main repo directory.

**Goal:** Fix all phase 1 audit issues, add schulsong as pinned track 1 with gold styling, expose album order to engineer portal (read-only), embed shared AlbumLayoutModal in Master CD task, and add Lehrer-Status card to admin event detail.

**Architecture:** Extend `AlbumTrack` with `isSchulsong` flag. Inject virtual schulsong track in `getAlbumTracksData`. Add `readOnly`, `inline`, `hideFinalize` props to `AlbumLayoutModal` to support four contexts (teacher, engineer, admin, Master CD). New Airtable field `schulsong_tracklist_title` stores editable schulsong title.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Airtable, @dnd-kit

---

### Task 1: Audit Fix — Remove Console.logs and Verification Re-fetch

**Files:**
- Modify: `src/components/shared/AlbumLayoutModal.tsx`
- Modify: `src/lib/services/teacherService.ts`

**Step 1:** In `AlbumLayoutModal.tsx`, remove all `console.log('[AlbumLayout]...')` lines (around lines 166, 181-182, 262-269, 278, 298-304). Also remove the entire verification re-fetch block in `handleSave` (the `const verifyUrl = ...` through the `if (!orderMatch)` block, roughly lines 284-305).

**Step 2:** In `teacherService.ts`, remove the `console.log('[updateAlbumOrderData]...')` lines (around lines 3803-3812) and the `console.log('[updateAlbumOrder]...')` line (around line 3899).

**Step 3:** Commit

```bash
git add src/components/shared/AlbumLayoutModal.tsx src/lib/services/teacherService.ts
git commit -m "fix: remove debug console.logs and verification re-fetch from album order flow"
```

---

### Task 2: Audit Fix — Finalize Endpoint Atomicity & Timezone

**Files:**
- Modify: `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts`

**Step 1:** Fix atomicity — restructure the finalize handler so that if track save succeeds but timestamp write fails, the error is returned with a descriptive message. If timestamp write succeeds but track save then fails, clear the timestamp:

```typescript
    // Step 1: Save track order first (if provided)
    if (tracks && Array.isArray(tracks) && tracks.length > 0) {
      await teacherService.updateAlbumOrder(eventId, session.email, tracks);
    }

    // Step 2: Set tracklistFinalizedAt
    const airtableService = getAirtableService();
    const eventRecord = await airtableService.getEventByEventId(eventId);
    if (!eventRecord) {
      return NextResponse.json({ error: 'Event record not found' }, { status: 404 });
    }

    const finalizedAt = new Date().toISOString();
    try {
      await airtableService.updateEventFields(eventRecord.id, {
        tracklist_finalized_at: finalizedAt,
      });
    } catch (err) {
      console.error('Failed to set tracklist_finalized_at after saving tracks:', err);
      return NextResponse.json(
        { error: 'Reihenfolge gespeichert, aber Finalisierung fehlgeschlagen. Bitte erneut versuchen.' },
        { status: 500 }
      );
    }
```

**Step 2:** Fix timezone — replace the date guard with `Europe/Berlin` normalized comparison:

```typescript
    // Server-side guard: event date must be today or past (in Europe/Berlin timezone)
    const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const eventDateStr = event.eventDate.split('T')[0]; // YYYY-MM-DD
    const nowBerlin = berlinFormatter.format(new Date()); // YYYY-MM-DD in Berlin

    if (eventDateStr > nowBerlin) {
      return NextResponse.json(
        { error: 'Cannot finalize before event day' },
        { status: 400 }
      );
    }
```

**Step 3:** Commit

```bash
git add src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts
git commit -m "fix: improve finalize endpoint atomicity and use Europe/Berlin timezone guard"
```

---

### Task 3: Audit Fix — classesWithoutSongs Filter & AlbumLayoutModal hideFinalize Prop

**Files:**
- Modify: `src/components/shared/AlbumLayoutModal.tsx` (add `hideFinalize` prop)
- Modify: `src/app/paedagogen/events/[eventId]/page.tsx` (fix classesWithoutSongs)
- Modify: `src/app/admin/events/[eventId]/page.tsx` (pass `hideFinalize={true}`)

**Step 1:** In `AlbumLayoutModal.tsx`, add `hideFinalize?: boolean` to `AlbumLayoutModalProps`. Add `readOnly?: boolean` and `inline?: boolean` at the same time (needed for later tasks). Update the component destructuring.

In the footer JSX, change `{!isFinalized && (` before the Finalisieren button to `{!isFinalized && !hideFinalize && (`.

For the `readOnly` prop: when true, force `isFinalized = true` behavior (read-only inputs, no drag, no save/finalize buttons). Add:
```typescript
const isReadOnly = readOnly || isFinalized;
```
Use `isReadOnly` everywhere `isFinalized` was used for UI disabling (drag, inputs, button visibility). Keep `isFinalized` for the status banner text.

For the `inline` prop: when true, don't render the outer `fixed inset-0 bg-black/50` overlay div. Instead render just the inner card content without max-height constraints. The outer div becomes:
```typescript
inline
  ? 'flex flex-col'
  : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
```
And the inner card: when inline, remove `max-w-2xl` and `max-h-[90vh]`.

**Step 2:** In the teacher event page, change the HinweiseSection's `classesWithoutSongs` prop from:
```typescript
regularClasses.filter(c => c.songs.length === 0).map(c => c.className)
```
to:
```typescript
(event.classes || []).filter(c => c.songs.length === 0).map(c => c.className)
```

**Step 3:** In the admin event page, find the `AlbumLayoutModal` render (around line 2640) and add `hideFinalize={true}`:
```typescript
<AlbumLayoutModal
  eventId={eventId}
  apiBaseUrl={...}
  classesWithoutSongs={...}
  onClose={() => setShowAlbumLayoutModal(false)}
  onSave={fetchEventDetail}
  hideFinalize={true}
/>
```

**Step 4:** Commit

```bash
git add src/components/shared/AlbumLayoutModal.tsx \
        src/app/paedagogen/events/[eventId]/page.tsx \
        src/app/admin/events/[eventId]/page.tsx
git commit -m "fix: add hideFinalize/readOnly/inline props, fix classesWithoutSongs filter, hide admin Finalisieren"
```

---

### Task 4: Add `schulsong_tracklist_title` Airtable Field

**Files:**
- Create: `scripts/create-schulsong-tracklist-title-field.ts`
- Modify: `src/lib/types/airtable.ts` (EVENTS_FIELD_IDS + Event interface)
- Modify: `src/lib/types/teacher.ts` (TeacherEventView)
- Modify: `src/lib/services/airtableService.ts` (query fields, transform, updateEventFields)
- Modify: `src/lib/services/teacherService.ts` (event builders)

**Step 1:** Create `scripts/create-schulsong-tracklist-title-field.ts` following the existing pattern from `scripts/create-tracklist-finalized-field.ts`. Field config:
```typescript
{
  name: 'schulsong_tracklist_title',
  type: 'singleLineText',
  description: 'Custom title for the schulsong track on the CD booklet. Default: "{SchoolName} - Schulsong".',
  placeholder: 'fldTODO_SCHULSONG_TITLE',
}
```

**Step 2:** Add placeholder to `EVENTS_FIELD_IDS` in `airtable.ts`:
```typescript
  schulsong_tracklist_title: 'fldTODO_SCHULSONG_TITLE',
```

Add to `Event` interface:
```typescript
  schulsong_tracklist_title?: string;
```

Add to `TeacherEventView` in `teacher.ts`:
```typescript
  schulsongTracklistTitle?: string;
```

**Step 3:** Wire through `airtableService.ts`:
- Add `EVENTS_FIELD_IDS.schulsong_tracklist_title` to `getEventBySchoolBookingId` and `getAllEventsIndexedByBookingId` field arrays
- Add to `transformEventRecord`:
```typescript
schulsong_tracklist_title: val(EVENTS_FIELD_IDS.schulsong_tracklist_title, 'schulsong_tracklist_title') as string | undefined,
```
- Add to `updateEventFields` accepted fields and logic

**Step 4:** Wire through `teacherService.ts` — add to both `events.push({...})` blocks:
```typescript
schulsongTracklistTitle: eventRecord?.schulsong_tracklist_title,
```

**Step 5:** Run the creation script:
```bash
npx tsx scripts/create-schulsong-tracklist-title-field.ts
```

**Step 6:** Commit

```bash
git add scripts/create-schulsong-tracklist-title-field.ts \
        src/lib/types/airtable.ts src/lib/types/teacher.ts \
        src/lib/services/airtableService.ts src/lib/services/teacherService.ts
git commit -m "feat: add schulsong_tracklist_title field to Airtable and wire through data layer"
```

---

### Task 5: Inject Virtual Schulsong Track in `getAlbumTracksData`

**Files:**
- Modify: `src/lib/services/teacherService.ts` (getAlbumTracksData + AlbumTrack interface)

**Step 1:** Extend `AlbumTrack` interface (around line 4097):
```typescript
export interface AlbumTrack {
  songId: string;
  songTitle: string;
  classId: string;
  className: string;
  classType: ClassType | 'schulsong';
  albumOrder: number;
  originalTitle: string;
  originalClassName: string;
  isSchulsong?: boolean;
}
```

**Step 2:** Modify `getAlbumTracksData` (around line 3683). After building the tracks array and sorting/renumbering, inject the virtual schulsong track if applicable:

```typescript
    // Check if this event has a schulsong — inject as track 1
    const airtable = getAirtableService();
    const eventRecord = await airtable.getEventByEventId(eventId);

    if (eventRecord?.is_schulsong) {
      const schulsongTitle = eventRecord.schulsong_tracklist_title
        || `${eventRecord.school_name} - Schulsong`;

      // Shift all existing tracks by +1
      tracks.forEach(track => { track.albumOrder += 1; });

      // Insert virtual schulsong at position 1
      tracks.unshift({
        songId: '__schulsong__',
        songTitle: schulsongTitle,
        classId: '__schulsong__',
        className: 'Schulsong',
        classType: 'schulsong',
        albumOrder: 1,
        originalTitle: schulsongTitle,
        originalClassName: 'Schulsong',
        isSchulsong: true,
      });
    }
```

Note: `getAlbumTracksData` already fetches `eventRecord` earlier in the method (line 3694) — reuse that reference instead of fetching again.

**Step 3:** Commit

```bash
git add src/lib/services/teacherService.ts
git commit -m "feat: inject virtual schulsong as track 1 in getAlbumTracksData"
```

---

### Task 6: Handle Schulsong in Save/Finalize Flows

**Files:**
- Modify: `src/lib/services/teacherService.ts` (updateAlbumOrderData)
- Modify: `src/app/api/teacher/events/[eventId]/album-order/route.ts` (PUT handler)
- Modify: `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts`

**Step 1:** In `updateAlbumOrderData`, add logic at the top to strip the schulsong entry and handle its title:

```typescript
    // Strip virtual schulsong entry — it's not a real Song record
    const schulsongTrack = tracks.find(t => t.songId === '__schulsong__');
    const realTracks = tracks.filter(t => t.songId !== '__schulsong__');

    // Re-number real tracks starting at 1 (they'll be shifted to 2+ on read when schulsong is present)
    realTracks.forEach((t, i) => { t.albumOrder = i + 1; });
```

Then after saving songs/classes, if the schulsong title was edited, save it:
```typescript
    // Save schulsong title if changed
    if (schulsongTrack?.title) {
      const airtable = getAirtableService();
      const eventRecord = await airtable.getEventByEventId(eventId);
      if (eventRecord) {
        await airtable.updateEventFields(eventRecord.id, {
          schulsong_tracklist_title: schulsongTrack.title,
        });
      }
    }
```

Use `realTracks` instead of `tracks` for the rest of the method (song updates, class name updates, display order updates).

**Step 2:** The PUT handler in `album-order/route.ts` doesn't need changes — it calls `updateAlbumOrderData` which now handles the stripping.

**Step 3:** The finalize endpoint already passes tracks to `updateAlbumOrder` which calls `updateAlbumOrderData` — so it also gets the schulsong handling automatically.

**Step 4:** Commit

```bash
git add src/lib/services/teacherService.ts
git commit -m "feat: handle virtual schulsong track in album order save flow"
```

---

### Task 7: Schulsong Gold Styling in AlbumLayoutModal

**Files:**
- Modify: `src/components/shared/AlbumLayoutModal.tsx`

**Step 1:** Update `AlbumTrack` import to include `isSchulsong` (it's already on the interface from Task 5).

**Step 2:** In the track list rendering section, split the rendering into two parts: the pinned schulsong track (if present) rendered ABOVE the `SortableContext`, and the regular tracks inside `SortableContext`.

Before the `<DndContext>`:
```typescript
{/* Pinned schulsong track — not sortable */}
{tracks.length > 0 && tracks[0].isSchulsong && (
  <div className="flex items-center gap-3 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg mb-2 ring-2 ring-amber-400/50">
    {/* No drag handle — empty space for alignment */}
    <div className="w-5 h-5 flex-shrink-0" />
    <span className="w-8 text-sm font-medium text-amber-700">1.</span>
    <input
      type="text"
      value={tracks[0].editedTitle}
      onChange={(e) => onTitleChange(tracks[0].songId, e.target.value)}
      readOnly={isReadOnly}
      className={`flex-1 px-2 py-1 text-sm font-medium rounded ${
        isReadOnly ? 'border-transparent bg-transparent text-amber-800' : 'border border-amber-300 bg-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400'
      }`}
    />
    <span className="text-amber-400">-</span>
    <span className="w-40 px-2 py-1 text-sm text-amber-600">Schulsong</span>
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
      Schulsong
    </span>
  </div>
)}
```

**Step 3:** Filter the schulsong out of the `SortableContext` items:

```typescript
const sortableTracks = tracks.filter(t => !t.isSchulsong);
```

Use `sortableTracks` for the `SortableContext` items and rendering. Update the track numbers to show `index + 2` when a schulsong is present (since schulsong is track 1).

**Step 4:** Commit

```bash
git add src/components/shared/AlbumLayoutModal.tsx
git commit -m "feat: add schulsong gold styling pinned at track 1 in AlbumLayoutModal"
```

---

### Task 8: Update Master CD Service to Use Shared Track Data

**Files:**
- Modify: `src/lib/services/masterCdService.ts`

**Step 1:** The Master CD service already calls `getAlbumTracksData` for class name lookups (line 92). Now that `getAlbumTracksData` injects the schulsong, the service needs to incorporate this.

Modify `getTracklist()` to include the virtual schulsong in its output. The schulsong track won't have audio files matched by `songId` (since `__schulsong__` isn't a real song). Instead, look up the schulsong audio file via the `isSchulsong` flag on AudioFile records:

After building the `finalAudioBySongId` map, add:
```typescript
    // Find schulsong audio file (not matched by songId — matched by isSchulsong flag)
    const schulsongAudio = audioFiles.find(
      af => af.isSchulsong && af.type === 'final'
    );
```

When building the tracks array, check if the album track is the schulsong and use the schulsong audio:
```typescript
    for (const albumTrack of albumTracks) {
      let finalAudio: AudioFile | undefined;
      if (albumTrack.isSchulsong) {
        finalAudio = schulsongAudio;
      } else {
        // Find by songId in the sorted songs
        const song = sortedSongs.find(s => s.id === albumTrack.songId);
        if (song) {
          finalAudio = finalAudioBySongId.get(song.id);
        }
      }
      // ... build MasterCdTrack using albumTrack data + finalAudio
    }
```

This replaces the current approach of building from `sortedSongs` — instead build from `albumTracks` (which already has correct ordering and schulsong).

**Step 2:** Commit

```bash
git add src/lib/services/masterCdService.ts
git commit -m "feat: update Master CD service to use getAlbumTracksData with schulsong support"
```

---

### Task 9: Embed AlbumLayoutModal in MasterCdModal

**Files:**
- Modify: `src/components/admin/tasks/MasterCdModal.tsx`

**Step 1:** Import `AlbumLayoutModal`:
```typescript
import AlbumLayoutModal from '@/components/shared/AlbumLayoutModal';
```

**Step 2:** The MasterCdModal currently has its own tracklist rendering with move up/down arrows, inline title editing, remove track, etc. Replace the tracklist section (the track list rendering between the download buttons and the completion buttons) with:

```typescript
<AlbumLayoutModal
  eventId={displayEventId || eventId}
  apiBaseUrl={`/api/admin/events/${encodeURIComponent(displayEventId || eventId)}/album-order`}
  classesWithoutSongs={[]}
  onClose={() => {}}
  onSave={fetchTracklist}
  inline={true}
  hideFinalize={true}
  tracklistFinalizedAt={tracklistFinalizedAt}
  eventDate={eventDate}
/>
```

The MasterCdModal needs to fetch `tracklistFinalizedAt` and `eventDate`. Add these to the tracklist fetch — the MasterCdData response from `/api/admin/tasks/tracklist` can be extended to include these fields, OR fetch them separately from the event record.

The simpler approach: extend the tracklist API response to include `tracklistFinalizedAt` from the event record (the service already fetches the event).

**Step 3:** Remove the custom track list rendering code, move up/down helpers, inline title editing, and remove track functionality. Keep the completion buttons (Complete/Skip/Partial/Revert) and download ZIP functionality.

**Step 4:** Add a finalization status banner at the top of the modal:
```typescript
{tracklistFinalizedAt ? (
  <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
    <p className="text-sm text-green-700 font-medium">
      Lieder-Reihenfolge vom Lehrer bestätigt am {new Date(tracklistFinalizedAt).toLocaleDateString('de-DE')}
    </p>
  </div>
) : (
  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
    <p className="text-sm text-amber-700 font-medium">
      Lieder-Reihenfolge noch nicht vom Lehrer bestätigt
    </p>
  </div>
)}
```

**Step 5:** Commit

```bash
git add src/components/admin/tasks/MasterCdModal.tsx
git commit -m "feat: replace MasterCdModal custom tracklist with embedded AlbumLayoutModal"
```

---

### Task 10: Engineer Portal — Read-Only Album Order

**Files:**
- Create: `src/app/api/engineer/events/[eventId]/album-order/route.ts`
- Modify: `src/app/engineer/events/[eventId]/page.tsx`

**Step 1:** Create `src/app/api/engineer/events/[eventId]/album-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();
    const tracks = await teacherService.getAlbumTracksData(eventId);

    return NextResponse.json({ success: true, tracks }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching album tracks for engineer:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch album tracks' },
      { status: 500 }
    );
  }
}
```

**Step 2:** In the engineer event page, add a "Lieder-Reihenfolge" button and the AlbumLayoutModal. Add state:
```typescript
const [showAlbumLayoutModal, setShowAlbumLayoutModal] = useState(false);
```

Add button in the page header area and modal render at the bottom:
```typescript
<button
  onClick={() => setShowAlbumLayoutModal(true)}
  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
  Lieder-Reihenfolge
</button>

{showAlbumLayoutModal && (
  <AlbumLayoutModal
    eventId={eventId}
    apiBaseUrl={`/api/engineer/events/${encodeURIComponent(eventId)}/album-order`}
    onClose={() => setShowAlbumLayoutModal(false)}
    readOnly={true}
    hideFinalize={true}
  />
)}
```

**Step 3:** Import AlbumLayoutModal at the top of the engineer page.

**Step 4:** Commit

```bash
git add src/app/api/engineer/events/[eventId]/album-order/route.ts \
        src/app/engineer/events/[eventId]/page.tsx
git commit -m "feat: add read-only album order view to engineer portal"
```

---

### Task 11: Admin Event Detail — Lehrer-Status Card

**Files:**
- Create: `src/components/admin/AdminLehrerStatusCard.tsx`
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1:** Create `AdminLehrerStatusCard.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import HinweiseSection from '@/components/teacher/HinweiseSection';
import AlbumLayoutModal from '@/components/shared/AlbumLayoutModal';

interface AdminLehrerStatusCardProps {
  eventId: string;
  classes: Array<{ songs: Array<unknown>; className: string }>;
  isSchulsong: boolean;
  tracklistFinalizedAt?: string;
  eventDate: string;
}

export default function AdminLehrerStatusCard({
  eventId,
  classes,
  isSchulsong,
  tracklistFinalizedAt,
  eventDate,
}: AdminLehrerStatusCardProps) {
  const [schulsongApproved, setSchulsongApproved] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);

  useEffect(() => {
    if (!isSchulsong) return;

    async function fetchSchulsongStatus() {
      try {
        const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/schulsong-status`);
        if (response.ok) {
          const data = await response.json();
          setSchulsongApproved(data.status === 'approved');
        }
      } catch (err) {
        console.error('Error fetching schulsong status:', err);
      }
    }
    fetchSchulsongStatus();
  }, [isSchulsong, eventId]);

  const classesWithoutSongs = classes
    .filter(c => (c.songs || []).length === 0)
    .map(c => c.className);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lehrer-Status</h3>
          <button
            onClick={() => setShowAlbumModal(true)}
            className="text-sm text-pink-600 hover:text-pink-700 font-medium"
          >
            Tracklist ansehen
          </button>
        </div>
        <HinweiseSection
          classesWithoutSongs={classesWithoutSongs}
          tracklistFinalized={Boolean(tracklistFinalizedAt)}
          isSchulsong={isSchulsong}
          schulsongApproved={schulsongApproved}
        />
      </div>

      {showAlbumModal && (
        <AlbumLayoutModal
          eventId={eventId}
          apiBaseUrl={`/api/admin/events/${encodeURIComponent(eventId)}/album-order`}
          onClose={() => setShowAlbumModal(false)}
          hideFinalize={true}
          tracklistFinalizedAt={tracklistFinalizedAt}
          eventDate={eventDate}
        />
      )}
    </>
  );
}
```

Note: The `HinweiseSection` component renders without a heading when used inside `AdminLehrerStatusCard` since the card provides its own "Lehrer-Status" heading. Either pass a `hideHeading` prop or restructure `HinweiseSection` to accept an optional `title` prop that defaults to "Hinweise". Simplest: use the component as-is and accept the "Hinweise" sub-heading inside the "Lehrer-Status" card.

**Step 2:** In the admin event detail page, import and add the card. Find the classes section (around line 1397) and insert the card before it:

```typescript
import AdminLehrerStatusCard from '@/components/admin/AdminLehrerStatusCard';
```

Add the card before the Classes & Songs section:
```typescript
{event && (
  <AdminLehrerStatusCard
    eventId={eventId}
    classes={event.classes || []}
    isSchulsong={event.is_schulsong || false}
    tracklistFinalizedAt={event.tracklist_finalized_at}
    eventDate={event.event_date}
  />
)}
```

The admin event detail page already fetches the full Event record which includes `tracklist_finalized_at` and `is_schulsong` from the data layer wired in phase 1.

**Step 3:** Commit

```bash
git add src/components/admin/AdminLehrerStatusCard.tsx \
        src/app/admin/events/[eventId]/page.tsx
git commit -m "feat: add Lehrer-Status card with Hinweise checklist to admin event detail"
```

---

### Task 12: TypeScript Verification & Final Fixes

**Step 1:** Run TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "tests/" | head -30
```

Fix any type errors.

**Step 2:** Verify the `verifyEngineerSession` import is correct. Check:
```bash
grep -r "verifyEngineerSession" src/lib/auth/
```

**Step 3:** Commit any fixes:
```bash
git add -A
git commit -m "fix: address TypeScript errors from phase 2 implementation"
```

---

### Task 13: Manual Testing

**Step 1:** Start dev server:
```bash
npm run dev
```

**Step 2:** Test scenarios:

**Teacher portal:**
1. Event page shows Hinweise with all classes (not just regular)
2. AlbumLayoutModal shows schulsong as track 1 with gold styling
3. Schulsong title is editable, other tracks start at 2
4. Schulsong cannot be dragged
5. Save works (schulsong stripped, title saved to Event record)
6. Finalize works (for past events)
7. After finalize, modal is read-only with green banner
8. No console.logs in browser console during save

**Engineer portal:**
9. "Lieder-Reihenfolge" button appears
10. Opens read-only modal showing tracks + schulsong
11. No save/finalize buttons visible

**Admin event detail:**
12. Lehrer-Status card shows with correct checklist states
13. "Tracklist ansehen" opens AlbumLayoutModal with no Finalisieren button
14. Admin can still save reordered tracks

**Master CD task:**
15. Opens with embedded AlbumLayoutModal (no overlay)
16. Shows finalization status banner
17. Schulsong appears as track 1 with gold styling
18. Completion buttons still work

**Step 3:** Final commit with any fixes
