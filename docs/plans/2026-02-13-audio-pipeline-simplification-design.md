# Audio Pipeline Simplification

## Overview

Simplify the audio pipeline by removing the admin approval step for class songs. The new flow focuses on upload progress with automatic release, while keeping the schulsong approval flow intact. Add per-upload-type engineer notifications.

## New Pipeline Stages

| # | Stage | Emoji | Airtable Value | Condition | Tooltip |
|---|-------|-------|----------------|-----------|---------|
| 1 | Event hasn't happened | ⏳ | (computed) | Event date is in the future | "Event hasn't happened yet" |
| 2 | Staff not uploaded | ❌ | `not_started` | Event date is today or past, no raw audio | "Staff audio not uploaded" |
| 3 | Staff uploaded | ⚙️ | `staff_uploaded` | Raw audio uploaded, finals not submitted | "Waiting for engineer finals" |
| 4 | Finals uploaded | ✅ | `finals_submitted` | Engineer clicked "Submit Finals" | "Finals submitted" |

**Old values removed:** `in_progress`, `ready_for_review`, `approved`

## Changes

### 1. AudioPipelineIndicator (BookingsTable.tsx)

- Update stage values: `not_started` → ❌, `staff_uploaded` → ⚙️, `finals_submitted` → ✅
- Keep ⏳ for future events (computed from event date at render time)
- Update tooltips

### 2. AudioApprovalModal → AudioReviewModal

- Rename component and file
- Strip all per-track approve/reject buttons and rejection comment fields
- Strip "Save Changes" button, replace with just "Close"
- Keep audio players for final tracks only
- **Keep schulsong section** with its full approval/release flow intact
- Rename title from "Audio Approval" to "Audio Review"

### 3. BookingDetailsBreakdown

- Review button only enabled at ✅ (`finals_submitted`) stage
- Rename button from "Review & Approve" to "Review Audio"
- Remove the green `approved` status button styling

### 4. Engineer Page

- Rename "Submit for Review" → "Submit Finals"
- API endpoint sets stage to `finals_submitted` instead of `ready_for_review`

### 5. Type Updates

- `audio_pipeline_stage`: `'not_started' | 'staff_uploaded' | 'finals_submitted'`
- Remove or simplify `AdminApprovalStatus` (only schulsong uses approval now)
- Remove `all_tracks_approved` usage for class songs

### 6. Engineer Notification Emails

**Two separate notifications based on upload type:**

- **Schulsong uploaded** → email Micha (`ENGINEER_MICHA_ID`)
  - Trigger template: `engineer_schulsong_uploaded`
  - Includes: engineer name, school name, event date, engineer portal link

- **Minimusiker tracks uploaded** → email Jakob (`ENGINEER_JAKOB_ID`)
  - Trigger template: `engineer_minimusiker_uploaded`
  - Includes: engineer name, school name, event date, engineer portal link

**Routing:** Based on `projectType` param already passed during staff upload (`'schulsong'` or `'minimusiker'`)

**Dedup:** Each notification fires once per upload type per event (not on re-uploads)

**Replaces:** Existing single `notifyEngineerOfFirstUpload()` function

### 7. Auto-Release

- Class songs auto-release to parent portals 7 days after engineer clicks "Submit Finals"
- No admin action needed
- Schulsong keeps its separate release flow (teacher approval → admin approval → scheduled/instant release)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/bookings/BookingsTable.tsx` | Update AudioPipelineIndicator stages/emojis |
| `src/components/admin/bookings/AudioApprovalModal.tsx` | Rename, strip approval UI, keep schulsong flow |
| `src/components/admin/bookings/BookingDetailsBreakdown.tsx` | Update button label/enable logic |
| `src/lib/types/airtable.ts` | Update `audio_pipeline_stage` type union |
| `src/lib/types/audio-status.ts` | Simplify types, remove unused approval types |
| `src/app/engineer/events/[eventId]/page.tsx` | Rename submit button |
| `src/app/api/engineer/events/[eventId]/submit-for-review/route.ts` | Set `finals_submitted` stage |
| `src/lib/services/notificationService.ts` | Replace single notify with two type-specific functions |
| `src/lib/services/resendService.ts` | Add two new trigger email send functions |
| `src/components/staff/LogicProjectUploadSection.tsx` | Wire up type-specific engineer notifications on upload |

## What Stays the Same

- Engineer upload flow (raw files, final files, batch upload)
- Schulsong approval flow (teacher approval + admin release)
- Audio file storage in R2 with signed URLs
- Staff portal upload UI (two sections: Schulsong + Minimusiker)
- Engineer auto-assignment logic (Jakob always, Micha for schulsong)
