# Teacher Portal Rework Phase 3 — Popup Timing, Editable Schulsong, Admin Unlock, Trigger Email

## Overview

Four refinements to the tracklist confirmation feature: adjust popup/finalize timing to 1pm Berlin on event day, make both schulsong fields editable, add admin unlock/re-lock flow, and add a trigger email for tracklist confirmation.

## 1. Popup Timing — 1pm Berlin Time

### TracklistReminderPopup
Change show condition from "event date is today or past" to:
- Event date is today AND current Berlin time >= 13:00, OR
- Event date is in the past

Use `toLocaleString('en-US', { timeZone: 'Europe/Berlin' })` for Berlin time detection.

Keep `sessionStorage` dismissal (per-tab, reappears on new login/tab).

### Finalize Endpoint
Update the server-side date guard in `POST /api/teacher/events/[eventId]/album-order/finalize` to match: event date must be today with Berlin hour >= 13, or in the past.

### AlbumLayoutModal
Update `isEventDayOrPast` computed value to include the 1pm Berlin check. Finalisieren button stays greyed out until 1pm on event day.

## 2. Editable Schulsong Name + Class Name

### New Airtable Field
`schulsong_tracklist_class` (singleLineText) on Events table. Stores the editable class/school name for the schulsong track.

### Updated Defaults
- Title (song name): defaults to `"Schulsong"` (was `"{SchoolName} - Schulsong"`)
- Class name: defaults to `"{SchoolName}"` (was fixed `"Schulsong"`)

### Virtual Track Injection
In `getAlbumTracksData`, the schulsong virtual track uses:
```
songTitle: event.schulsong_tracklist_title || 'Schulsong'
className: event.schulsong_tracklist_class || event.school_name
```

### AlbumLayoutModal
Change the schulsong class name from a read-only `<span>` to an editable `<input>` with amber/gold styling.

### Save Flow
In `updateAlbumOrderData`, save both fields when schulsong entry is present:
- `schulsong_tracklist_title` ← edited title
- `schulsong_tracklist_class` ← edited class name

### Cross-Portal
All portals call `getAlbumTracksData` which reads both fields. Changes propagate automatically.

## 3. Admin Unlock / Re-lock

### UI — AdminLehrerStatusCard
When tracklist IS finalized:
- Show "Entsperren" button next to "Tracklist ansehen"
- Click triggers `confirm("Die Lieder-Reihenfolge wird entsperrt...")` then calls unlock endpoint

When tracklist is NOT finalized (after unlock):
- Show "Tracklist bearbeiten" button (opens editable AlbumLayoutModal)
- AlbumLayoutModal gets `showAdminFinalize?: boolean` prop — when true, shows a green "Bestätigen" button that calls the admin finalize endpoint (no date guard, no confirm dialog)

### New API Endpoints
`POST /api/admin/events/[eventId]/album-order/unlock`
- Admin auth only
- Clears `tracklist_finalized_at` to null
- Returns `{ success: true }`

`POST /api/admin/events/[eventId]/album-order/finalize`
- Admin auth only
- Sets `tracklist_finalized_at` to now
- NO date guard (admin can finalize anytime)
- Saves tracks if provided in body (same as teacher finalize)

### AlbumLayoutModal — showAdminFinalize Prop
When true: shows a green "Bestätigen" button in the footer. Clicking it calls `${apiBaseUrl}/finalize` with POST. No confirm dialog. The `hideFinalize` prop still hides the teacher's Finalisieren button separately.

## 4. Trigger Email — Tracklist Confirmation Reminder

### Template
New `tracklist_confirmation_reminder` in trigger-email-registry.ts:
- Audience: teacher
- Trigger type: cron
- Subject: "Lieder-Reihenfolge für {SchoolName} bestätigen"
- Body: Reminder with magic link to event page

### Cron Function
New `processTracklistConfirmationEmails(dryRun)` in emailAutomationService.ts:
1. Check Berlin hour === 13 — skip otherwise
2. Find events where:
   - `tracklist_finalized_at` is null
   - Event date >= `2026-03-20` (launch cutoff — prevents mass-send to old events)
   - Event date is today (with hour >= 13) or in the past
3. Get teacher recipients per event
4. Deduplicate via EMAIL_LOGS (24-hour window)
5. Send email with magic link

### Cron Integration
Called from `/api/cron/email-automation/route.ts` alongside existing schulsong handlers.

### Launch Cutoff
```typescript
const TRACKLIST_EMAIL_CUTOFF = '2026-03-20';
```
Only events on or after March 20, 2026 receive these emails. Prevents blasting old events.

## 5. File Changes

### New Files
- `src/app/api/admin/events/[eventId]/album-order/unlock/route.ts`
- `src/app/api/admin/events/[eventId]/album-order/finalize/route.ts`
- `scripts/create-schulsong-tracklist-class-field.ts`

### Modified Files
- `src/components/teacher/TracklistReminderPopup.tsx` — 1pm Berlin timing
- `src/components/shared/AlbumLayoutModal.tsx` — 1pm Berlin in isEventDayOrPast, editable schulsong class name, showAdminFinalize prop
- `src/app/api/teacher/events/[eventId]/album-order/finalize/route.ts` — 1pm Berlin date guard
- `src/lib/services/teacherService.ts` — updated schulsong defaults, save schulsong_tracklist_class
- `src/lib/types/airtable.ts` — schulsong_tracklist_class field ID + Event interface
- `src/lib/services/airtableService.ts` — wire new field
- `src/components/admin/AdminLehrerStatusCard.tsx` — unlock button, admin finalize, editable modal
- `src/lib/services/emailAutomationService.ts` — processTracklistConfirmationEmails
- `src/lib/config/trigger-email-registry.ts` — new template
- `src/app/api/cron/email-automation/route.ts` — call new processor
