# Teacher Portal Rework Phase 2 — Audit Fixes, Schulsong Track 1, Cross-Portal Integration

## Overview

Fix all audit issues from phase 1, add schulsong as pinned track 1 with gold styling, expose the album order to the engineer portal (read-only), embed the shared AlbumLayoutModal in the Master CD task, and add a Lehrer-Status card to the admin event detail page.

## 1. Audit Fixes

### Fix #1 — Partial failure in finalize endpoint
Wrap both operations (track save + timestamp write) in a try/catch. If track save succeeds but timestamp write fails, return a specific error so the frontend can indicate "order saved but finalization failed — please try again." If timestamp write succeeds but track save fails, clear the timestamp back to null and return error.

### Fix #2 — Admin AlbumLayoutModal
Add `hideFinalize?: boolean` prop to AlbumLayoutModal. When true, the Finalisieren button is not rendered. Admin contexts pass `hideFinalize={true}`. Clean and explicit.

### Fix #3 — Timezone in server-side date guard
Normalize both dates to `Europe/Berlin` using `Intl.DateTimeFormat` in the finalize endpoint. Frontend guards are advisory, left as-is.

### Fix #4 — classesWithoutSongs inconsistency
Change HinweiseSection integration in the teacher event page to use `event.classes` (all classes) instead of `regularClasses` only, matching AlbumLayoutModal's filter.

### Fix #5 — Console.log cleanup
Remove all `console.log('[AlbumLayout]...')` statements and the verification re-fetch from `handleSave` in AlbumLayoutModal.

### Fix #6 — sessionStorage per-tab
No code change. Intended behavior per design.

## 2. Schulsong as Track 1

### Data Layer
New Airtable field: `schulsong_tracklist_title` (text) on Events table. Stores the teacher's custom title for the schulsong track on the CD booklet. Default when empty: `"{SchoolName} - Schulsong"`.

Wired through: `EVENTS_FIELD_IDS` → `transformEventRecord` → `Event` interface → `TeacherEventView.schulsongTracklistTitle`.

### API — Track List Assembly
In `getAlbumTracksData`, when `event.isSchulsong === true`, inject a virtual track at position 0:

```typescript
{
  songId: '__schulsong__',
  songTitle: event.schulsong_tracklist_title || `${event.school_name} - Schulsong`,
  classId: '__schulsong__',
  className: 'Schulsong',
  classType: 'schulsong',
  albumOrder: 1,
  isSchulsong: true,
  originalTitle: event.schulsong_tracklist_title || `${event.school_name} - Schulsong`,
  originalClassName: 'Schulsong',
}
```

All other tracks get `albumOrder` starting at 2.

### API — Save Handlers
PUT album-order and POST finalize: Strip the `__schulsong__` entry from the tracks array before saving Songs. If the schulsong title was edited (differs from original), save it to `schulsong_tracklist_title` on the Event record. Re-number remaining tracks starting at 2.

### AlbumLayoutModal — Schulsong Rendering
When a track has `isSchulsong: true`:
- Gold glow styling: `ring-2 ring-amber-400 bg-amber-50`
- Drag handle hidden (excluded from SortableContext items)
- Title field editable, class name field read-only ("Schulsong")
- Always rendered first, above the sortable track list
- Track number shows "1."

### Master CD Service
Uses `getAlbumTracksData` which now injects the virtual schulsong. Master CD modal automatically gets it as track 1. Numbering is consistent with teacher view and CD booklet printing.

## 3. Engineer Portal — Read-Only Album Order

### UI
Add a "Lieder-Reihenfolge" button on the engineer event page. Opens the shared `AlbumLayoutModal` with `readOnly={true}` and `hideFinalize={true}`.

### New API Endpoint
`GET /api/engineer/events/[eventId]/album-order` — reuses `getAlbumTracksData` with engineer session auth. Returns same track array including virtual schulsong.

### AlbumLayoutModal — readOnly prop
New `readOnly?: boolean` prop forces read-only mode regardless of finalization status. Drag disabled, inputs read-only, no Save/Finalize buttons — only Abbrechen (close).

## 4. Master CD Task — Embedded AlbumLayoutModal

### Integration
Replace the custom tracklist in `MasterCdModal` with the shared `AlbumLayoutModal` embedded inline.

### AlbumLayoutModal — inline prop
New `inline?: boolean` prop renders without the fixed overlay/backdrop. Just the content (header text, tracks, footer) fitting into the parent container. The MasterCdModal keeps its outer shell (completion buttons, download ZIP, status summary).

### Props
```tsx
<AlbumLayoutModal
  eventId={eventId}
  apiBaseUrl={`/api/admin/events/${eventId}/album-order`}
  tracklistFinalizedAt={tracklistFinalizedAt}
  eventDate={eventDate}
  onSave={refreshTracklist}
  inline={true}
  hideFinalize={true}
/>
```

### Audio Status
Extend `AlbumTrack` with optional `audioStatus` field. Admin API populates it (ready/missing/processing), teacher/engineer APIs leave it empty. The Master CD modal displays status badges per track using this field.

## 5. Admin Event Detail — Lehrer-Status Card

### New Component
`AdminLehrerStatusCard` — placed after booking info section, before classes section in admin event detail page.

Contains:
- Header: "Lehrer-Status"
- The three HinweiseSection checklist rows (classes without songs, tracklist finalized, schulsong approved)
- "Tracklist ansehen" button → opens AlbumLayoutModal with `hideFinalize={true}`

### Data
- `tracklistFinalizedAt` — already on Event interface
- `schulsongApproved` — fetched from schulsong status endpoint
- `classesWithoutSongs` — derived from event.classes

## 6. AlbumLayoutModal Props Summary

| Prop | Type | Purpose |
|---|---|---|
| `readOnly` | `boolean?` | Forces read-only regardless of finalization (engineer) |
| `inline` | `boolean?` | Renders without overlay (Master CD embed) |
| `hideFinalize` | `boolean?` | Hides Finalisieren button (admin/engineer contexts) |
| `tracklistFinalizedAt` | `string?` | Shows finalization status banner |
| `eventDate` | `string?` | Controls Finalisieren enabled state |

Usage by context:

| Context | readOnly | inline | hideFinalize |
|---|---|---|---|
| Teacher portal | — | — | — |
| Engineer portal | true | — | true |
| Admin event detail | — | — | true |
| Admin Master CD | — | true | true |

## 7. File Changes

### New Files
- `src/app/api/engineer/events/[eventId]/album-order/route.ts`
- `src/components/admin/AdminLehrerStatusCard.tsx`
- `scripts/create-schulsong-tracklist-title-field.ts`

### Modified Files
- `src/lib/types/airtable.ts` — schulsong_tracklist_title field ID + Event interface
- `src/lib/types/teacher.ts` — schulsongTracklistTitle on TeacherEventView
- `src/lib/services/airtableService.ts` — wire new field
- `src/lib/services/teacherService.ts` — inject virtual schulsong in getAlbumTracksData, handle title save
- `src/lib/services/masterCdService.ts` — use getAlbumTracksData for tracklist
- `src/components/shared/AlbumLayoutModal.tsx` — readOnly/inline/hideFinalize props, schulsong gold styling, pinned track 1, remove console.logs + verification re-fetch
- `src/components/admin/tasks/MasterCdModal.tsx` — replace custom tracklist with embedded AlbumLayoutModal
- `src/app/admin/events/[eventId]/page.tsx` — add AdminLehrerStatusCard, pass props to AlbumLayoutModal
- `src/app/paedagogen/events/[eventId]/page.tsx` — fix classesWithoutSongs filter
- `src/app/engineer/events/[eventId]/page.tsx` — add Lieder-Reihenfolge button + read-only modal
- `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts` — fix atomicity, Berlin timezone
- `src/app/api/teacher/events/[eventId]/album-order/route.ts` — handle schulsong title save in PUT
