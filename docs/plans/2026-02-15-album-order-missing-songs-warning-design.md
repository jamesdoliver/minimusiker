# Album Order: Missing Songs Warning + Admin Access

## Problem

1. Teachers can open the album ordering tool without any indication that some classes have no songs — those classes silently disappear from the track list.
2. Admins have no access to the album ordering tool at all.
3. Changes made by teachers or admins need to be coherent across both portals (already the case since both use the same Airtable `album_order` field).

## Design Decisions

- **Warning locations:** Both as a banner above class cards AND inside the AlbumLayoutModal header
- **Warning language:** German in both teacher and admin portals
- **Admin API:** Separate `/api/admin/events/[eventId]/album-order` route (consistent with existing admin/teacher separation)
- **Shared component:** Move `AlbumLayoutModal` to `src/components/shared/` with `apiBaseUrl` prop
- **Service layer:** Extract auth-free data methods from `teacherService` to avoid duplication

## Files to Change

| # | File | Action | What |
|---|------|--------|------|
| 1 | `src/lib/services/teacherService.ts` | Modify | Extract `getAlbumTracksData(eventId)` and `updateAlbumOrderData(eventId, tracks)` |
| 2 | `src/components/teacher/AlbumLayoutModal.tsx` | Move → `src/components/shared/AlbumLayoutModal.tsx` | Add `apiBaseUrl` and `classesWithoutSongs?: string[]` props |
| 3 | `src/app/paedagogen/events/[eventId]/page.tsx` | Modify | Update import, pass new props, add warning banner |
| 4 | `src/app/admin/events/[eventId]/page.tsx` | Modify | Import modal, add button + banner + modal state |
| 5 | `src/app/api/admin/events/[eventId]/album-order/route.ts` | Create | GET + PUT with admin auth |

## Implementation Steps

### Step 1: Extract data methods in teacherService

In `src/lib/services/teacherService.ts`:

- Extract `getAlbumTracksData(eventId): Promise<AlbumTrack[]>` — the core logic from `getAlbumTracks` (fetch songs, build class/group map, sort, return). No auth check.
- Extract `updateAlbumOrderData(eventId, tracks: AlbumTrackUpdate[]): Promise<void>` — the core update logic from `updateAlbumOrder`. No auth check.
- Refactor existing `getAlbumTracks(eventId, teacherEmail)` to: verify teacher access → call `getAlbumTracksData(eventId)`
- Refactor existing `updateAlbumOrder(eventId, teacherEmail, tracks)` to: verify teacher access → call `updateAlbumOrderData(eventId, tracks)`

### Step 2: Move and extend AlbumLayoutModal

Move `src/components/teacher/AlbumLayoutModal.tsx` → `src/components/shared/AlbumLayoutModal.tsx`

Add props:
```typescript
interface AlbumLayoutModalProps {
  eventId: string;
  apiBaseUrl: string;  // e.g. "/api/teacher/events/{eventId}/album-order" or "/api/admin/..."
  classesWithoutSongs?: string[];  // class names with no songs
  onClose: () => void;
  onSave?: () => void;
}
```

Replace hardcoded fetch URL with `apiBaseUrl`.

Add warning inside modal (below instructions text, above track list):
```
{classesWithoutSongs.length > 0 && (
  <yellow warning banner>
    "Folgende Klassen haben noch keine Lieder und fehlen in der Reihenfolge: {names}"
  </yellow warning banner>
)}
```

### Step 3: Update teacher event page

In `src/app/paedagogen/events/[eventId]/page.tsx`:

- Update import: `from '@/components/shared/AlbumLayoutModal'`
- Compute `classesWithoutSongs`:
  ```typescript
  const classesWithoutSongs = event.classes
    .filter(c => c.songs.length === 0)
    .map(c => c.className);
  ```
- Pass to modal: `apiBaseUrl={/api/teacher/events/${eventId}/album-order}` and `classesWithoutSongs={classesWithoutSongs}`
- Add warning banner between "Klassen & Lieder" header and class cards when `classesWithoutSongs.length > 0`:
  > "Folgende Klassen haben noch keine Lieder: Klasse 3b, Chor — diese fehlen in der Album-Reihenfolge."

### Step 4: Create admin album-order API route

New file: `src/app/api/admin/events/[eventId]/album-order/route.ts`

**GET:**
- `verifyAdminSession(request)`
- Call `teacherService.getAlbumTracksData(eventId)`
- Return `{ tracks }`

**PUT:**
- `verifyAdminSession(request)`
- Parse body `{ tracks: AlbumTrackUpdate[] }`
- Call `teacherService.updateAlbumOrderData(eventId, tracks)`
- Return `{ success: true }`

### Step 5: Add album ordering to admin event page

In `src/app/admin/events/[eventId]/page.tsx`:

- Import `AlbumLayoutModal` from `@/components/shared/AlbumLayoutModal`
- Add state: `const [showAlbumLayoutModal, setShowAlbumLayoutModal] = useState(false)`
- Add "Album-Reihenfolge" button next to "Classes & Songs" header (line ~1027)
- Compute `classesWithoutSongs` from `event.classes`
- Add warning banner (same as teacher portal)
- Render `AlbumLayoutModal` with admin API URL

## Data Coherence

Both portals write to the same Airtable fields:
- `Songs.album_order` (field `fldj1xXfAhsaWcEE7`)
- `Songs.title` (field `fldLjwkTwckDqT3Xl`)
- `Classes.display_order` (field `fldQnmVCJA1eQlFXg`)
- `Classes.class_name` (field `fld1kaSb8my7q5mHt`)

No caching layer exists — each page load fetches fresh data from Airtable. Changes from either portal are immediately visible on the other's next load.

## Verification

1. Teacher portal: Open album ordering with a class that has no songs → see warning banner + in-modal warning
2. Teacher portal: Add a song to the empty class → warning disappears
3. Admin portal: Open album ordering → see same tracks as teacher
4. Admin portal: Reorder tracks → teacher portal shows new order on refresh
5. Teacher portal: Reorder tracks → admin portal shows new order on refresh
6. Both portals: Classes without songs listed in warning text
