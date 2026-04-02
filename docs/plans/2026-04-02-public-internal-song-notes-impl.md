# Public & Internal Song Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the single `notes` field on songs into `publicNotes` (visible to parents, editable by admin/engineer/teacher) and `internalNotes` (admin/engineer only). Existing data becomes internal notes.

**Architecture:** Rename the existing Airtable `notes` field to `internal_notes` in code (same field ID), add a new `public_notes` Airtable field. Update types, service layer, API routes, and UI components across all four portals.

**Tech Stack:** Next.js, TypeScript, Airtable, Tailwind CSS

---

### Task 1: Add `public_notes` field in Airtable

**Manual step** — create a new Long Text field called `public_notes` in the Songs table (`tblPjGWQlHuG8jp5X`) via the Airtable UI. Record the field ID (starts with `fld...`).

---

### Task 2: Update type definitions and field IDs

**Files:**
- Modify: `src/lib/types/teacher.ts:34-45` (SONGS_FIELD_IDS)
- Modify: `src/lib/types/teacher.ts:115-127` (Song interface)
- Modify: `src/lib/types/teacher.ts:217-222` (UpsertSongRequest)
- Modify: `src/lib/types/engineer.ts:57-66` (EngineerSongView)

**Step 1: Update SONGS_FIELD_IDS**

In `src/lib/types/teacher.ts`, replace the `notes` field mapping:

```typescript
// Before:
  notes: 'fldZRLk0JP05VRDm6', // Special notes/arrangement details

// After:
  internal_notes: 'fldZRLk0JP05VRDm6', // Internal notes (was 'notes') — admin/engineer only
  public_notes: 'fldXXXXXXXXXXXXXXX', // Public notes — visible to parents (REPLACE WITH REAL FIELD ID)
```

**Step 2: Update Song interface**

```typescript
// Before:
  notes?: string; // Special notes/arrangement details

// After:
  publicNotes?: string; // Public notes — visible to parents
  internalNotes?: string; // Internal notes — admin/engineer only
```

**Step 3: Update UpsertSongRequest**

```typescript
// Before:
export interface UpsertSongRequest {
  title: string;
  artist?: string;
  notes?: string;
  order?: number;
}

// After:
export interface UpsertSongRequest {
  title: string;
  artist?: string;
  publicNotes?: string;
  internalNotes?: string;
  order?: number;
}
```

**Step 4: Update EngineerSongView**

In `src/lib/types/engineer.ts`, add notes fields:

```typescript
export interface EngineerSongView {
  songId: string;
  songTitle: string;
  artist?: string;
  order: number;
  hiddenByEngineer?: boolean;
  publicNotes?: string;       // ADD
  internalNotes?: string;     // ADD
  previewFile?: AudioFileWithUrl;
  finalMp3File?: AudioFileWithUrl;
  finalWavFile?: AudioFileWithUrl;
}
```

**Step 5: Commit**

```bash
git add src/lib/types/teacher.ts src/lib/types/engineer.ts
git commit -m "feat: split song notes into publicNotes and internalNotes types"
```

---

### Task 3: Update service layer (teacherService)

**Files:**
- Modify: `src/lib/services/teacherService.ts:532-546` (transformSongRecord)
- Modify: `src/lib/services/teacherService.ts:749-810` (createSong)
- Modify: `src/lib/services/teacherService.ts:815-837` (updateSong)

**Step 1: Update transformSongRecord**

```typescript
// Before (line 539):
  notes: record.fields.notes || record.fields[SONGS_FIELD_IDS.notes],

// After:
  publicNotes: record.fields.public_notes || record.fields[SONGS_FIELD_IDS.public_notes],
  internalNotes: record.fields.internal_notes || record.fields[SONGS_FIELD_IDS.internal_notes],
```

**Step 2: Update createSong**

Replace the `notes` parameter and field assignment:

```typescript
// Parameters — replace notes with:
  publicNotes?: string;
  internalNotes?: string;

// Fields object (around line 771) — replace:
//   notes: data.notes,
// With:
  public_notes: data.publicNotes,
  internal_notes: data.internalNotes,
```

**Step 3: Update updateSong**

```typescript
// Parameters — replace:
//   notes?: string;
// With:
  publicNotes?: string;
  internalNotes?: string;

// Conditional updates (around line 828) — replace:
//   if (data.notes !== undefined) updateData.notes = data.notes;
// With:
  if (data.publicNotes !== undefined) updateData.public_notes = data.publicNotes;
  if (data.internalNotes !== undefined) updateData.internal_notes = data.internalNotes;
```

**Step 4: Commit**

```bash
git add src/lib/services/teacherService.ts
git commit -m "feat: update teacherService for publicNotes and internalNotes"
```

---

### Task 4: Update teacher API routes

**Files:**
- Modify: `src/app/api/teacher/songs/[songId]/route.ts:52-141` (PUT handler)
- Modify: `src/app/api/teacher/classes/[classId]/songs/route.ts:45-165` (POST handler)

Teachers can only write `publicNotes`. `internalNotes` must not be accepted.

**Step 1: Update PUT `/api/teacher/songs/[songId]`**

```typescript
// Line 63 — replace:
//   const { title, artist, notes } = await request.json();
const { title, artist, publicNotes } = await request.json();

// Line 94-98 — replace notes with publicNotes in the updateSong call:
const updatedSong = await teacherService.updateSong(songId, {
  title: title?.trim(),
  artist: artist?.trim(),
  publicNotes: publicNotes?.trim(),
});

// Line ~122 — update metadata logging if it references notes:
// Replace any `notes` references with `publicNotes`
```

**Step 2: Update POST `/api/teacher/classes/[classId]/songs`**

```typescript
// Line 56 — replace:
//   const { title, artist, notes, eventId } = body;
const { title, artist, publicNotes, eventId } = body;

// Line 110-117 — replace notes with publicNotes in createSong call:
const song = await teacherService.createSong({
  classId,
  eventId,
  title: title.trim(),
  artist: artist?.trim(),
  publicNotes: publicNotes?.trim(),
  // ... other fields
});
```

**Step 3: Commit**

```bash
git add src/app/api/teacher/songs/[songId]/route.ts src/app/api/teacher/classes/[classId]/songs/route.ts
git commit -m "feat: teacher API routes use publicNotes only"
```

---

### Task 5: Update admin API routes

**Files:**
- Modify: `src/app/api/admin/songs/[songId]/route.ts:13-88` (PUT handler)
- Modify: `src/app/api/admin/classes/[classId]/songs/route.ts:13-135` (POST handler)

Admin can read/write both `publicNotes` and `internalNotes`.

**Step 1: Update PUT `/api/admin/songs/[songId]`**

```typescript
// Line 25 — replace:
//   const { title, artist, notes } = await request.json();
const { title, artist, publicNotes, internalNotes } = await request.json();

// Lines 41-45 — replace notes in updateSong call:
const updatedSong = await teacherService.updateSong(songId, {
  title: title?.trim(),
  artist: artist?.trim(),
  publicNotes: publicNotes?.trim(),
  internalNotes: internalNotes?.trim(),
});
```

**Step 2: Update POST `/api/admin/classes/[classId]/songs`**

```typescript
// Line 25 — replace:
//   const { title, artist, notes, eventId } = body;
const { title, artist, publicNotes, internalNotes, eventId } = body;

// Lines 78-84 — replace notes in createSong call:
const song = await teacherService.createSong({
  classId,
  eventId,
  title: title.trim(),
  artist: artist?.trim(),
  publicNotes: publicNotes?.trim(),
  internalNotes: internalNotes?.trim(),
  // ... other fields
});
```

**Step 3: Commit**

```bash
git add src/app/api/admin/songs/[songId]/route.ts src/app/api/admin/classes/[classId]/songs/route.ts
git commit -m "feat: admin API routes use publicNotes and internalNotes"
```

---

### Task 6: Update engineer API route

**Files:**
- Modify: `src/app/api/engineer/events/[eventId]/songs/[songId]/route.ts:13-68` (PUT handler)
- Modify: `src/app/api/engineer/events/[eventId]/route.ts:138-145,172-179` (EngineerSongView building)

**Step 1: Update PUT handler to accept notes**

Currently only accepts `title`. Expand to accept both notes fields:

```typescript
// Line 25 — replace:
//   const { title } = await request.json();
const { title, publicNotes, internalNotes } = await request.json();

// Relax validation — title is no longer the only field:
if (!title && publicNotes === undefined && internalNotes === undefined) {
  return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
}

// Build update object:
const updateFields: any = {};
if (title && typeof title === 'string' && title.trim().length > 0) updateFields.title = title.trim();
if (publicNotes !== undefined) updateFields.publicNotes = publicNotes?.trim() || '';
if (internalNotes !== undefined) updateFields.internalNotes = internalNotes?.trim() || '';

const updatedSong = await teacherService.updateSong(songId, updateFields);
```

**Step 2: Add notes to EngineerSongView building**

In `src/app/api/engineer/events/[eventId]/route.ts`, at lines ~140-145 and ~174-179, add notes to the returned objects:

```typescript
// After artist: song.artist, add:
  publicNotes: song.publicNotes,
  internalNotes: song.internalNotes,
```

This appears in two places (classes songs at ~140 and groups songs at ~174).

**Step 3: Commit**

```bash
git add src/app/api/engineer/events/[eventId]/songs/[songId]/route.ts src/app/api/engineer/events/[eventId]/route.ts
git commit -m "feat: engineer API routes support publicNotes and internalNotes"
```

---

### Task 7: Update parent API routes (read-only, publicNotes only)

**Files:**
- Modify: `src/app/api/parent/collections/route.ts:56-60` (song mapping)
- Modify: `src/app/api/parent/audio-access/route.ts:28-38` (TrackEntry interface)
- Modify: `src/app/api/parent/audio-access/route.ts:468-478,529-539` (track building)
- Modify: `src/components/parent-portal/EventAudioTracklist.tsx:7-17` (TrackEntry interface)

**Step 1: Add publicNotes to parent collections response**

```typescript
// Lines 56-60 — add publicNotes:
songs: collection.songs.map(s => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  publicNotes: s.publicNotes,
})),
```

**Step 2: Add publicNotes to TrackEntry in audio-access route**

```typescript
// Lines 28-38 — add to interface:
interface TrackEntry {
  songId?: string;
  title: string;
  artist?: string;
  publicNotes?: string;  // ADD
  order: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  audioUrl: string;
  downloadUrl: string;
  filename: string;
}
```

**Step 3: Add publicNotes to track building**

In the two places where TrackEntry objects are constructed (~lines 468-478 and 529-539), add:

```typescript
  publicNotes: song?.publicNotes,
```

**Step 4: Add publicNotes to client-side TrackEntry**

In `src/components/parent-portal/EventAudioTracklist.tsx`:

```typescript
// Lines 7-17 — add to interface:
interface TrackEntry {
  songId?: string;
  title: string;
  artist?: string;
  publicNotes?: string;  // ADD
  order: number;
  // ... rest
}
```

**Step 5: Commit**

```bash
git add src/app/api/parent/collections/route.ts src/app/api/parent/audio-access/route.ts src/components/parent-portal/EventAudioTracklist.tsx
git commit -m "feat: expose publicNotes in parent API and tracklist types"
```

---

### Task 8: Update shared modals (AddSongModal, EditSongModal)

**Files:**
- Modify: `src/components/shared/class-management/AddSongModal.tsx`
- Modify: `src/components/shared/class-management/EditSongModal.tsx`

These modals are used by both admin and teacher portals via `apiBasePath`. The modal needs to show different fields based on who's using it.

**Step 1: Update AddSongModal**

Add a `showInternalNotes` prop. When true (admin), show both textareas. When false (teacher), show only public notes.

```typescript
interface AddSongModalProps {
  classId: string;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
  apiBasePath: string;
  showInternalNotes?: boolean; // ADD — true for admin, false for teacher
}

// State (replace notes with):
const [publicNotes, setPublicNotes] = useState('');
const [internalNotes, setInternalNotes] = useState('');

// API call body (replace notes):
body: JSON.stringify({
  title: title.trim(),
  artist: artist.trim(),
  publicNotes: publicNotes.trim(),
  ...(showInternalNotes && { internalNotes: internalNotes.trim() }),
  eventId,
}),

// Form — replace single Notes textarea with:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Public Notes
  </label>
  <textarea
    value={publicNotes}
    onChange={(e) => setPublicNotes(e.target.value)}
    rows={2}
    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
    placeholder="Visible to parents, e.g., With actions, slow tempo..."
  />
</div>
{showInternalNotes && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Internal Notes
    </label>
    <textarea
      value={internalNotes}
      onChange={(e) => setInternalNotes(e.target.value)}
      rows={2}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
      placeholder="Only visible to admin & engineer..."
    />
  </div>
)}
```

**Step 2: Update EditSongModal**

Same pattern — add `showInternalNotes` prop, split state and form fields:

```typescript
interface EditSongModalProps {
  songId: string;
  title: string;
  artist?: string;
  publicNotes?: string;       // RENAME from notes
  internalNotes?: string;     // ADD
  onClose: () => void;
  onSuccess: () => void;
  apiBasePath: string;
  showInternalNotes?: boolean; // ADD
}

// State:
const [publicNotes, setPublicNotes] = useState(initialPublicNotes || '');
const [internalNotes, setInternalNotes] = useState(initialInternalNotes || '');

// API call body:
body: JSON.stringify({
  title: title.trim(),
  artist: artist.trim(),
  publicNotes: publicNotes.trim(),
  ...(showInternalNotes && { internalNotes: internalNotes.trim() }),
}),
```

Form fields same as AddSongModal.

**Step 3: Commit**

```bash
git add src/components/shared/class-management/AddSongModal.tsx src/components/shared/class-management/EditSongModal.tsx
git commit -m "feat: split notes into publicNotes and internalNotes in song modals"
```

---

### Task 9: Update admin event page

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1: Update local types**

Lines 59, 68 — update song type in ClassGroup and Collection interfaces:

```typescript
// Replace: notes?: string
// With:
  publicNotes?: string;
  internalNotes?: string;
```

**Step 2: Update selectedSong state** (lines 118-123)

```typescript
const [selectedSong, setSelectedSong] = useState<{
  id: string;
  title: string;
  artist?: string;
  publicNotes?: string;
  internalNotes?: string;
} | null>(null);
```

**Step 3: Update handleEditSong** (lines 589-597)

```typescript
setSelectedSong({
  id: song.id,
  title: song.title,
  artist: song.artist,
  publicNotes: song.publicNotes,
  internalNotes: song.internalNotes,
});
```

**Step 4: Update song display** (lines 1616-1617, 1842-1843, 2084-2085, 2330-2331)

Replace all 4 occurrences of the notes display. Each currently reads:

```tsx
{song.notes && (
  <div className="text-xs text-gray-400 mt-1 truncate">{song.notes}</div>
)}
```

Replace with:

```tsx
{song.publicNotes && (
  <div className="text-xs text-green-500 mt-1 truncate">Public: {song.publicNotes}</div>
)}
{song.internalNotes && (
  <div className="text-xs text-gray-400 mt-1 truncate">Internal: {song.internalNotes}</div>
)}
```

**Step 5: Update EditSongModal usage**

Where `EditSongModal` is rendered, pass the new props:

```tsx
<EditSongModal
  songId={selectedSong.id}
  title={selectedSong.title}
  artist={selectedSong.artist}
  publicNotes={selectedSong.publicNotes}
  internalNotes={selectedSong.internalNotes}
  showInternalNotes={true}
  apiBasePath="/api/admin"
  onClose={() => setShowEditSong(false)}
  onSuccess={fetchEventData}
/>
```

**Step 6: Update AddSongModal usage**

```tsx
<AddSongModal
  classId={selectedClass!.id}
  eventId={eventId}
  showInternalNotes={true}
  apiBasePath="/api/admin"
  onClose={() => setShowAddSong(false)}
  onSuccess={fetchEventData}
/>
```

**Step 7: Commit**

```bash
git add src/app/admin/events/[eventId]/page.tsx
git commit -m "feat: admin event page shows and edits both publicNotes and internalNotes"
```

---

### Task 10: Update teacher event page

**Files:**
- Modify: `src/app/paedagogen/events/[eventId]/page.tsx`

**Step 1: Update song notes display** (line 331)

Replace:

```tsx
{song.notes && <p className="text-sm text-gray-400 mt-1">{song.notes}</p>}
```

With:

```tsx
{song.publicNotes && <p className="text-sm text-gray-400 mt-1">{song.publicNotes}</p>}
```

**Step 2: Update EditSongModal/AddSongModal props**

Wherever these modals are rendered in the teacher page, ensure:
- `publicNotes` is passed instead of `notes`
- `showInternalNotes={false}` (or omit, since it defaults to false)

**Step 3: Commit**

```bash
git add src/app/paedagogen/events/[eventId]/page.tsx
git commit -m "feat: teacher event page uses publicNotes, hides internalNotes"
```

---

### Task 11: Update engineer event page (inline notes editing)

**Files:**
- Modify: `src/app/engineer/events/[eventId]/page.tsx`

**Step 1: Add notes state variables** (near line 68-69)

```typescript
const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
const [editingPublicNotes, setEditingPublicNotes] = useState('');
const [editingInternalNotes, setEditingInternalNotes] = useState('');
```

**Step 2: Add save notes handler**

```typescript
const handleSaveNotes = async (songId: string) => {
  try {
    const response = await fetch(
      `/api/engineer/events/${encodeURIComponent(eventId)}/songs/${encodeURIComponent(songId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicNotes: editingPublicNotes.trim(),
          internalNotes: editingInternalNotes.trim(),
        }),
      }
    );
    if (!response.ok) throw new Error('Failed to save notes');
    setEditingNotesId(null);
    refreshData(); // or however the page refreshes event data
  } catch (error) {
    console.error('Error saving notes:', error);
  }
};
```

**Step 3: Pass notes state through ClassCard to SongRow**

Add new props to `ClassCardProps` and `SongRowProps`:

```typescript
// SongRowProps — add:
  publicNotes?: string;
  internalNotes?: string;
  isEditingNotes: boolean;
  editingPublicNotes: string;
  editingInternalNotes: string;
  onStartEditNotes: (songId: string, publicNotes: string, internalNotes: string) => void;
  onEditPublicNotesChange: (value: string) => void;
  onEditInternalNotesChange: (value: string) => void;
  onSaveNotes: (songId: string) => void;
  onCancelEditNotes: () => void;
```

**Step 4: Add notes display and inline editing to SongRow**

After the artist line (line 1181), add:

```tsx
{/* Notes display / inline edit */}
{isEditingNotes ? (
  <div className="mt-2 space-y-2">
    <div>
      <label className="text-xs text-gray-500">Public Notes</label>
      <input
        type="text"
        value={editingPublicNotes}
        onChange={(e) => onEditPublicNotesChange(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Visible to parents..."
      />
    </div>
    <div>
      <label className="text-xs text-gray-500">Internal Notes</label>
      <input
        type="text"
        value={editingInternalNotes}
        onChange={(e) => onEditInternalNotesChange(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Admin/engineer only..."
      />
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => onSaveNotes(song.songId)}
        className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
      >
        Save
      </button>
      <button
        onClick={onCancelEditNotes}
        className="px-2 py-0.5 text-gray-500 text-xs hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  <>
    {song.publicNotes && (
      <p className="text-xs text-green-500 mt-1">Public: {song.publicNotes}</p>
    )}
    {song.internalNotes && (
      <p className="text-xs text-gray-400 mt-1">Internal: {song.internalNotes}</p>
    )}
  </>
)}
```

**Step 5: Add a notes edit button** next to the existing rename pencil button (around line 1184-1193):

```tsx
{!isEditing && !isEditingNotes && (
  <>
    <button
      onClick={() => onStartEdit(song.songId, song.songTitle)}
      className="p-1 text-gray-300 hover:text-gray-600 rounded transition-colors"
      title="Rename song"
    >
      {/* existing pencil SVG */}
    </button>
    <button
      onClick={() => onStartEditNotes(song.songId, song.publicNotes || '', song.internalNotes || '')}
      className="p-1 text-gray-300 hover:text-gray-600 rounded transition-colors"
      title="Edit notes"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    </button>
  </>
)}
```

**Step 6: Commit**

```bash
git add src/app/engineer/events/[eventId]/page.tsx
git commit -m "feat: engineer event page shows and edits both notes inline"
```

---

### Task 12: Update parent tracklist display

**Files:**
- Modify: `src/components/parent-portal/EventAudioTracklist.tsx:139-146` (track rendering)

**Step 1: Add publicNotes display**

After the artist span (line 144), add:

```tsx
{track.artist && (
  <span className="text-xs text-gray-500">{track.artist}</span>
)}
{track.publicNotes && (
  <p className="text-xs text-gray-500 mt-0.5">{track.publicNotes}</p>
)}
```

**Step 2: Commit**

```bash
git add src/components/parent-portal/EventAudioTracklist.tsx
git commit -m "feat: display publicNotes in parent tracklist"
```

---

### Task 13: Update SongAudioRow (shared component)

**Files:**
- Modify: `src/components/shared/audio-management/SongAudioRow.tsx:162-164`

**Step 1: Update notes display**

Replace:

```tsx
{song.notes && (
  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{song.notes}</p>
)}
```

With:

```tsx
{song.publicNotes && (
  <p className="text-xs text-green-500 mt-1 line-clamp-2">Public: {song.publicNotes}</p>
)}
{song.internalNotes && (
  <p className="text-xs text-gray-400 mt-1 line-clamp-2">Internal: {song.internalNotes}</p>
)}
```

**Step 2: Commit**

```bash
git add src/components/shared/audio-management/SongAudioRow.tsx
git commit -m "feat: SongAudioRow displays both publicNotes and internalNotes"
```

---

### Task 14: Fix any remaining references to old `notes` field

**Step 1: Search for remaining references**

```bash
grep -rn "\.notes\b" src/ --include="*.ts" --include="*.tsx" | grep -i song | grep -v node_modules | grep -v ".d.ts"
grep -rn "notes:" src/ --include="*.ts" --include="*.tsx" | grep -i song | grep -v node_modules | grep -v ".d.ts"
```

Fix any remaining references to the old `notes` field on songs (but be careful not to change `notes` on other types like registrations or audio rejection comments).

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining references to old song notes field"
```

---

### Task 15: Test and deploy

**Step 1: Run dev server and test**

```bash
npm run dev
```

Manually verify:
- Admin event page: both notes fields visible and editable via modal
- Engineer event page: both notes fields visible and editable inline
- Teacher event page: only public notes visible and editable
- Parent tracklist: only public notes shown below artist

**Step 2: Push to deploy**

```bash
git push origin main
```
