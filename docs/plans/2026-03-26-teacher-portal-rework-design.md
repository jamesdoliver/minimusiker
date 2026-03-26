# Teacher Portal Event View Rework — Design

## Overview

Restructure the teacher event detail page to add a prominent Lieder-Reihenfolge section with booklet image, a Hinweise checklist, a two-step save/finalize flow for tracklists, and a blocking post-event popup for unconfirmed tracklists.

## 1. Page Layout Restructure

Insert a new two-column section between the **Team** section and the **Schulsong** section.

### Left Column — Hinweise (Checklist)

Always visible. Three rows (two if `isSchulsong === false`), each toggling between amber/pending and green/complete:

| Notice | Pending (amber) | Complete (green) |
|--------|-----------------|------------------|
| Classes without songs | "Folgende Klassen haben noch keine Lieder: {classList}" | "Alle Klassen haben Lieder" |
| Tracklist status | "Die Lieder-Reihenfolge wurde noch nicht final festgelegt" | "Die Lieder-Reihenfolge wurde bereits final festgelegt" |
| Schulsong (only if `isSchulsong`) | "Euer Schulsong wartet auf Freigabe" | "Euer Schulsong wurde freigegeben" |

### Right Column — Lieder-Reihenfolge

Card displaying:
- `booklet_asset.png` image (~120px, top-right)
- Header: "Lieder-Reihenfolge"
- Body text: "Für die Audioprodukte wie CD oder den Lautsprecher kannst du hier eine gewünschte Reihenfolge der Titel festlegen. Eine finale Bestätigung brauchen wir nach dem Minimusikertag, denn anhand dieser Reihenfolge drucken wir Booklets."
- "Jetzt festlegen" button (red/primary) → opens tracklist modal

**After finalization:** Green background tint, checkmark icon, confirmation text. Button hidden or replaced with "Reihenfolge ansehen" for read-only access.

The existing inline "Album-Reihenfolge" button in Klassen & Lieder section header is removed.

## 2. Tracklist Modal Rework

### Header Text (replaced)

"Ziehe die Titel per Drag&Drop in die gewünschte Reihenfolge, so wie sie auf dem Tonträger (CD, Lautsprecherbox) zu hören sein sollen. Du kannst diese Liste speichern und NACH dem Minimusikertag finalisieren, danach ist die Reihenfolge fest und nicht mehr veränderbar. Achte auch auf die korrekte Schreibweise, denn anhand dieser Informationen lassen wir die CD-Booklets drucken."

### Status Indicator (below header)

- Red/amber: "Diese Lieder-Reihenfolge wurde noch nicht final festgelegt"
- Green: "Diese Lieder-Reihenfolge wurde final festgelegt" → modal becomes read-only (drag disabled, titles not editable)

### Footer Buttons (three)

- **Abbrechen** — close modal, discard unsaved changes
- **Speichern** (red/primary) — save order and edits, keep tracklist editable, close modal
- **Finalisieren** (green):
  - **Before event day:** Greyed out. Hover tooltip: "Verfügbar nach dem Minimusikertag"
  - **On/after event day:** Active. Click triggers `confirm("Die Reihenfolge wird endgültig festgelegt und kann danach nicht mehr geändert werden. Fortfahren?")`. On confirm: saves + finalizes + closes modal.

Track list drag-and-drop UI unchanged.

## 3. Post-Event Blocking Popup

Renders when **all conditions met:**
1. Event date is today or in the past
2. `tracklistFinalizedAt` is null
3. Not dismissed this session

### Content

- Warning icon (amber)
- Heading: "Lieder-Reihenfolge noch nicht bestätigt"
- Body: "Dein Minimusikertag hat bereits stattgefunden, aber die Lieder-Reihenfolge wurde noch nicht finalisiert. Wir benötigen diese, um die CD-Booklets zu drucken. Bitte lege die Reihenfolge jetzt fest."
- **"Jetzt festlegen"** (primary) — closes popup, opens tracklist modal
- **"Später erinnern"** (secondary) — dismisses for this session

Dismissal stored in `sessionStorage` keyed by eventId. Reappears on next login.

Popup renders after page data loads (not during skeleton state).

## 4. API & Data Layer

### Airtable

New field: `tracklistFinalizedAt` (date) on Event table.

### New Endpoint

`POST /api/teacher/events/[eventId]/album-order/finalize`
- Validates teacher access
- Server-side guard: event date must be today or past
- Saves current track order
- Sets `tracklistFinalizedAt` to current timestamp
- Returns `{ success: true, finalizedAt: string }`

### Modified Endpoint

`PUT /api/teacher/events/[eventId]/album-order`
- New guard: if `tracklistFinalizedAt` is set → reject 400 "Tracklist already finalized"

### Frontend Data Flow

- `getTeacherEventDetail()` reads `tracklistFinalizedAt` from Airtable
- Value drives: Hinweise state, Lieder-Reihenfolge section appearance, popup logic, modal button states
- After finalization, page refreshes event data for immediate UI updates

GET album-order endpoint unchanged (needed for read-only modal view).

## 5. File Changes

### Modified

- `src/app/paedagogen/events/[eventId]/page.tsx` — Layout restructure, remove inline Album-Reihenfolge button, popup trigger
- `src/components/shared/AlbumLayoutModal.tsx` — New header text, status indicator, three-button footer, read-only mode, greyed Finalisieren with tooltip
- `src/lib/services/teacherService.ts` — Read `tracklistFinalizedAt`, include in response
- `src/lib/types/teacher.ts` — Add `tracklistFinalizedAt` to event type
- `src/app/api/teacher/events/[eventId]/album-order/route.ts` — Finalization guard on PUT

### New

- `src/components/teacher/HinweiseSection.tsx` — Checklist with three notice rows
- `src/components/teacher/LiederReihenfolgeSection.tsx` — Booklet image, text, button, success state
- `src/components/teacher/TracklistReminderPopup.tsx` — Blocking post-event popup
- `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts` — Finalization endpoint
- `public/images/booklet_asset.png` — Static booklet image
