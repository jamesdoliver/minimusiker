# Design: Master CD Tracklist Modal

## Summary

Replace the small TaskMatrixPopover for `audio_master_cd` tasks with a full-screen centered modal. The modal shows an editable tracklist where admin staff can reorder tracks (up/down arrows), rename titles (inline edit), and remove tracks from the album (non-destructive — sets albumOrder to null). Changes persist to Airtable via the existing album-order API. The modal also handles downloading all tracks with numeric-prefixed filenames and task completion actions.

## Decisions

- **Modal, not popover:** Clicking a Master CD cell opens a full modal directly (no intermediate popover step)
- **Edits persist:** Changes save to Airtable, affecting both admin and teacher portals
- **Remove = exclude from album:** Removing a track clears its albumOrder but does not delete the song
- **Reorder via up/down arrows:** Simple arrow buttons, not drag-and-drop
- **Batch save:** Edits accumulate locally; explicit "Save Changes" button triggers one API call

## Modal Structure

```
┌──────────────────────────────────────────────────┐
│  Header: "Master CD — {schoolName}"         [X]  │
│  Subtitle: deadline, status badge                │
├──────────────────────────────────────────────────┤
│  Track readiness: "6/8 tracks ready"             │
│                                                  │
│  ┌──┬─#─┬─Title──────────┬─Class──┬─Dur──┬─St──┬──┐
│  │↕ │ 1 │ Schulsong      │ 3a    │ 3:24 │ ●  │ X│
│  │↕ │ 2 │ Lied 2         │ 3b    │ 2:15 │ ●  │ X│
│  │↕ │ 3 │ Mein Lied      │ 4a    │ 2:50 │ ○  │ X│
│  └──┴───┴────────────────┴───────┴──────┴────┴──┘
│                                                  │
│  [Save Changes]  [Download All (6)]              │
├──────────────────────────────────────────────────┤
│  [View Event]        [Skip] [Partial] [Complete] │
└──────────────────────────────────────────────────┘
```

Width: `max-w-2xl` (672px). Same modal pattern as TaskCompletionModal (backdrop, centered, Escape to close).

## Editable Tracklist

### Reorder (up/down arrows)
- Column of small up/down arrow buttons per row
- Top track hides up arrow, bottom track hides down arrow
- Swap updates local state immediately (optimistic)

### Inline rename
- Click title text to activate text input (click-to-edit)
- Enter or blur to confirm, Escape to cancel
- Subtle pencil icon on hover

### Remove from album
- Small X button at end of each row
- Removes from local list, renumbers remaining tracks sequentially
- Non-destructive: song remains in class setlist, only albumOrder cleared

### Save flow
- Edits tracked locally with a "dirty" flag
- "Save Changes" button appears when dirty
- Calls `PUT /api/admin/events/[eventId]/album-order` with `AlbumTrackUpdate[]`
- Removed tracks excluded from array (API clears their albumOrder)
- Refetches tracklist after save

## Download

- "Download All" button below tracklist, disabled when no ready tracks
- Filenames use edited order/titles: `{trackNumber}. {title} - {className}.mp3`
- Sequential downloads with 500ms delay, progress indicator
- If unsaved edits exist: prompt "Save changes first" (download uses saved state only)
- Button hidden when 0 tracks

## Task Completion (Footer)

- Same actions as popover: Complete, Skip, Partial, Revert
- Complete disabled when `!allReady`, amber message shown
- Partial opens inline notes textarea
- Complete sends `{ completion_data: { tracklist_verified: true } }`
- Successful action closes modal, parent refetches

## States

- **Loading:** Skeleton rows while tracklist loads
- **Error (no data):** Inline message with Retry button
- **Save error:** Inline error above save button, modal stays open
- **Download error:** Inline error below download button
- **Empty (0 tracks):** "No tracks configured" message, Complete available, Download hidden

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/tasks/MasterCdModal.tsx` | **New.** Full modal component with editable tracklist, download, and task actions |
| `src/components/admin/tasks/TaskMatrix.tsx` | Open modal instead of popover for `audio_master_cd` |
| `src/components/admin/tasks/TaskDateView.tsx` | Open modal instead of popover for `audio_master_cd` |
| `src/app/admin/tasks/page.tsx` | Handle Master CD modal action (completion) from matrix view |
| `src/app/api/admin/tasks/tracklist/route.ts` | Already exists (created in prior work) |
| `src/app/api/admin/tasks/download/route.ts` | Already exists (created in prior work) |

### Existing APIs reused (no changes needed)
- `PUT /api/admin/events/[eventId]/album-order` — save reorder/rename/remove
- `GET /api/admin/tasks/tracklist?eventId=recXXX` — fetch tracklist
- `GET /api/admin/tasks/download?eventId=recXXX` — get download URLs

## Edge Cases

- **Virtual cells (no Airtable task record):** Event-based APIs work without taskId
- **All tracks missing:** Table shows all-red statuses, Complete disabled, Download disabled
- **By Date view:** Same modal renders — both views call same component
- **Concurrent edits:** Save-then-refetch ensures consistency; last write wins
