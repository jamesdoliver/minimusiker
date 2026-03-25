# Staff Event Detail Enrichment — Design

**Goal:** Staff event detail page shows all class types, groups, and schulsong with songs, plus a dedicated audio streaming/download section — so staff arrive at events fully prepared.

**Current state:** Staff only see a flat "Classes Overview" table that treats all class types identically. Groups are not fetched. No audio playback or download. Logic project upload already exists.

---

## API Changes

### Event Detail API (`/api/staff/events/[eventId]`)

Add one parallel fetch to the existing `Promise.all`:
- `teacherService.getGroupsByEventId(eventId)` — returns groups with member classes and songs

Add `groups` to the JSON response. Chors and Lehrerlied are already returned as classes with `classType` set — no extra fetch needed. Schulsong classes are also already in the classes array if the event has `isSchulsong`.

### New Audio Download API Routes (mirror teacher pattern)

1. `GET /api/staff/events/[eventId]/audio-downloads` — list final+ready tracks with metadata
2. `GET /api/staff/events/[eventId]/audio-downloads/[fileId]` — stream (`?stream=1`) or download individual track
3. `GET /api/staff/events/[eventId]/audio-downloads/zip` — download all as zip

All use `verifyStaffSession` for auth.

---

## Frontend: Event Detail Page Sections

### 1. Header Card (unchanged)
Event badge, date, school name, teacher, stats pills, registration progress bar.

### 2. Classes Table (regular classes only)
Filter to `classType === 'regular'` or missing. Same table format as today: class name, teacher, songs (as pill badges), children, registered parents, progress bar.

### 3. Groups Section (purple accent, if any)
Only shown if groups exist. Each group as a card:
- Group name + purple "Gruppe" badge
- Member classes listed (e.g. "Klasse 3a + Klasse 3b")
- Songs as pill badges

### 4. Chor Section (teal accent, if any)
Only shown if classes with `classType === 'choir'` exist. Each choir as a card:
- Choir name + teal "Chor" badge
- Songs as pill badges
- No children/registration columns

### 5. Lehrerlied Section (amber accent, if any)
Only shown if classes with `classType === 'teacher_song'` exist (excluding schulsong class). Each as a card:
- Name + amber "Lehrerlied" badge
- Songs as pill badges
- No children/registration columns

### 6. Schulsong Section (green accent, if applicable)
Only shown if `event.isSchulsong` is true. Card showing:
- "Schulsong" + green badge
- Song name(s) as pill badges

### 7. Audio Tracks Section (if any released)
Dedicated section, self-contained data fetching from `/api/staff/events/[eventId]/audio-downloads`.
- Section header with track count + "Download All" zip button
- Track list: class/group name, song title, CompactSongPlayer (play/pause + seekbar), download icon
- Tracks ordered: regular classes, groups, chor, lehrerlied, schulsong last
- Empty state: "No audio tracks available yet"
- Uses `CompactSongPlayer` from parent portal

### 8. Logic Project Upload Section (unchanged)
Already exists. Show MiniMusiker upload always, Schulsong upload only when `event.isSchulsong`.

---

## Color Scheme Reference (from admin portal)

| Type | Border | Badge BG | Badge Text |
|------|--------|----------|------------|
| Groups | `border-purple-200` | `bg-purple-100` | `text-purple-700` |
| Chor | `border-teal-200` | `bg-teal-100` | `text-teal-700` |
| Lehrerlied | `border-amber-200` | `bg-amber-100` | `text-amber-700` |
| Schulsong | `border-green-200` | `bg-green-100` | `text-green-700` |

---

## Reusable Infrastructure

- `CompactSongPlayer` (`src/components/parent-portal/CompactSongPlayer.tsx`) — inline audio player
- `r2Service.generateSignedUrl()` / `getFileBuffer()` — signed URL + zip buffer
- Teacher audio download routes — pattern to mirror for staff
- `teacherService.getGroupsByEventId()` / `getAudioFilesByEventId()` — data fetching
- `archiver` library + PassThrough stream — zip creation
