# Schulsong Release & Merch Timeline Control — Design

## Problem

When schulsong is present on an event (standalone or combined with Minimusikertag/PLUS), the audio release, schulsong approval, and merch ordering window operate on disconnected timelines. If the teacher is slow to approve the schulsong, class audio releases without it, and the merch window may already be closing — breaking the coordinated "moment" we want customers to experience.

## Goal

Create a unified release system where **teacher approval is the single gating event** that unlocks audio, emails, and merch window together. Add a state-aware reminder loop that keeps the approval process on track.

## Event Types

Events use independent boolean flags. Two configurations involve schulsong:

| Config | Flags | Audio | Merch |
|--------|-------|-------|-------|
| **Schulsong-only** | `is_schulsong=true`, `is_minimusikertag=false`, `is_plus=false` | Schulsong only | Schulsong clothing |
| **Combined** | `is_schulsong=true` + `is_minimusikertag=true` or `is_plus=true` | Class recordings + schulsong | Full merch catalog |

## Unified Release Model

### Release Date Computation

On teacher approval, compute `schulsong_released_at`:

```
Schulsong-only:  release = approval_date + 1 day (next day 7am Berlin)
Combined:        release = max(event_date + full_release_days, approval_date + 1 day)
```

- Combined, approved early (e.g. day +10): audio held until normal gate (day +14)
- Combined, approved late (e.g. day +18): everything releases day +19 (approval + 1)
- Schulsong-only: always releases next day after approval

### Merch Cutoff Computation

On teacher approval, compute and store `schulsong_merch_cutoff`:

```
Schulsong-only:  cutoff = release_date + 10 days
Combined:        cutoff = max(event_date + 14, release_date + 7 days)
```

Admin can manually override this date in event settings.

### Hold Class Audio (Combined Events Only)

Parent audio access API (`/api/parent/audio-access`) currently releases at `event_date + full_release_days`. When `is_schulsong=true`, add requirement: `schulsong_released_at` must also be set and in the past. Both gates must pass.

### Merch Cutoff Behavior

After `schulsong_merch_cutoff` passes:
- Personalized schulsong clothing hidden from shop
- Standard clothing remains available

Currently `canOrderPersonalizedClothing(eventDate, cutoffDays)` computes from event_date. Change: when `schulsong_merch_cutoff` is set on the event, use that absolute date instead.

## State-Aware Reminder Loop

### State Machine

```
NO SCHULSONG FINAL UPLOADED → No reminders (engineer hasn't started)
        ↓ (engineer uploads)
WAITING FOR TEACHER (approvalStatus = 'pending')
  → Teacher gets "New schulsong ready" email (existing: schulsong_new_version)
  → After 24h: daily reminders to teacher + admins
        ↓ (teacher rejects)
ENGINEER WORKING (approvalStatus = 'rejected')
  → Engineer + admins get rejection feedback (existing: schulsong_teacher_action)
  → Reminders PAUSED
        ↓ (engineer re-uploads)
WAITING FOR TEACHER (new AudioFile, approvalStatus = 'pending')
  → Teacher gets "Updated schulsong ready" (existing: schulsong_new_version)
  → 24h clock RESETS
        ↓ (teacher approves)
APPROVED → Reminders STOP permanently → Release flow triggers
```

### Cron Implementation

Extend `processEmailAutomation()` with `processSchulsongApprovalReminders()`:

1. Query events: `is_schulsong=true` AND `schulsong_released_at` is empty
2. For each event, find latest schulsong final AudioFile (`isSchulsong=true`, `type='final'`, `status='ready'`)
3. Check `approvalStatus`:
   - `'rejected'` → skip (engineer working)
   - `'approved'` → skip (done)
   - `'pending'` / undefined → check upload timestamp
4. If uploaded >24h ago AND no reminder sent today (EMAIL_LOGS dedup) → send `schulsong_approval_reminder` to teacher + admins

### Last Chance Email

Extend cron with `processSchulsongMerchLastChance()`:

1. Query events: `is_schulsong=true` AND `schulsong_merch_cutoff` is tomorrow
2. For each event, get registered parents
3. Filter out parents who already ordered personalized clothing for this event
4. Send `schulsong_merch_last_chance` to remaining parents
5. Deduplicate via EMAIL_LOGS

## New Email Templates

### 1. `schulsong_approval_reminder`
- **To:** Teacher + admins
- **Subject:** "Schulsong wartet auf Freigabe – {{schoolName}}"
- **Content:** Reminder that schulsong is ready for review, link to teacher portal. Audio release and merch window are waiting on approval.
- **Frequency:** Daily, starting 24h after engineer upload
- **Admin-editable:** Yes (in trigger templates view)
- **Variables:** `schoolName`, `eventDate`, `teacherPortalUrl`, `daysPending`

### 2. `schulsong_merch_last_chance`
- **To:** Registered parents who haven't ordered personalized merch
- **Subject:** "Letzte Chance: Schul-Merch für {{schoolName}}"
- **Content:** Personalized merch ordering closes tomorrow, link to shop
- **Frequency:** Once per event, 24h before cutoff
- **Admin-editable:** Yes (in trigger templates view)
- **Variables:** `schoolName`, `parentName`, `parentPortalLink`, `cutoffDate`

## Existing Template Change

### `schulsong_parent_release`
- `{{merchandiseDeadline}}` currently computed from `event_date + merchandise_deadline_days`
- Change: read from `schulsong_merch_cutoff` field when set

## New Airtable Field

### `schulsong_merch_cutoff` (date) on Events table
- Auto-set when teacher approves schulsong
- Admin can override in event settings
- Read by shop for cutoff enforcement
- Read by cron for "Last Chance" email timing
- Cleared if schulsong is rejected after approval (reset cycle)

## Admin UI Changes

### Event Settings Page
- Show `schulsong_merch_cutoff` as editable date field
- Label: "Schulsong Merch-Frist"
- Show "(automatisch berechnet)" when auto-set, "(manuell überschrieben)" when overridden
- Override resets to auto-computed on next approval if admin hasn't locked it

### Event Detail / Bookings View
- Banner: "Audio-Veröffentlichung wartet auf Schulsong-Freigabe" when `is_schulsong=true` and `schulsong_released_at` empty and schulsong file exists
- Show timeline: upload date → approval pending → release date → merch cutoff

## Notification Summary

| Trigger | Recipients | Template | Status |
|---------|-----------|----------|--------|
| Engineer uploads schulsong final | Teacher | `schulsong_new_version` | EXISTS |
| Teacher hasn't reviewed (daily, 24h+ after upload) | Teacher + Admins | `schulsong_approval_reminder` | NEW |
| Teacher rejects | Engineer + Admins | `schulsong_teacher_action` | EXISTS |
| Teacher rejects | Admins | `schulsong_teacher_rejected` | EXISTS |
| Teacher approves | Admins | `schulsong_teacher_approved` | EXISTS |
| Teacher approves | Engineer | `schulsong_teacher_action` | EXISTS |
| Release moment | Teacher | `schulsong_audio_release` | EXISTS |
| Release moment | Parents | `schulsong_parent_release` | EXISTS (modify merchandiseDeadline) |
| 24h before merch cutoff | Non-buying parents | `schulsong_merch_last_chance` | NEW |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/parent/audio-access/route.ts` | Hold class audio when `is_schulsong` and not yet released |
| `src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts` | Compute release date per event type; set `schulsong_merch_cutoff` |
| `src/app/familie/shop/page.tsx` | Read `schulsong_merch_cutoff` for personalized clothing gate |
| `src/lib/services/emailAutomationService.ts` | Add `processSchulsongApprovalReminders()` + `processSchulsongMerchLastChance()` |
| `src/lib/config/trigger-email-registry.ts` | Add 2 new templates |
| `src/lib/services/resendService.ts` | Add send functions for new templates |
| `src/lib/services/notificationService.ts` | Add trigger function for approval reminder |
| `src/lib/services/schulsongEmailService.ts` | Read `schulsong_merch_cutoff` for merchandiseDeadline |
| `src/lib/services/airtableService.ts` | Add `schulsong_merch_cutoff` field mapping + getter/setter |
| `src/lib/types/airtable.ts` | Add field ID + type for `schulsong_merch_cutoff` |
| `src/app/admin/events/[eventId]/settings/page.tsx` | Show merch cutoff date with override control |
| `src/app/admin/events/[eventId]/page.tsx` | Show "held" banner + timeline state |
| `src/lib/utils/eventThresholds.ts` | Helper for absolute cutoff date check |
