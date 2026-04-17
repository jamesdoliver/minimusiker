# Schulsong Version Display & Rejection Bug Fix

**Date:** 2026-04-17

## Problem

1. **Bug**: When an engineer re-uploads a corrected schulsong via the engineer portal (`upload-mixed`), the `approval_status` field on the AudioFile record stays `'rejected'`. The teacher is permanently stuck seeing "Ihre Anmerkungen wurden an den Tontechniker weitergeleitet" and cannot review the new version. The admin replace path (`replace-audio`) correctly resets this, but the engineer path does not.

2. **Feature**: Teachers have no visual indication of which version they're reviewing or when it was uploaded. After a rejection/re-upload cycle, they need confidence they're hearing the corrected version.

## Root Cause (Bug)

In `src/app/api/engineer/events/[eventId]/upload-mixed/route.ts`, the `if (existingFile)` update path (lines 189-199) does not reset `approval_status` or clear `teacher_approved_at`. Since R2 keys are deterministic, re-uploading the same song in the same format always reuses the same key, hitting this path.

## Design

### Data Layer

- Add `schulsong_version` integer field to the AudioFiles Airtable table (`tbloCM4tmH7mYoyXR`) via a creation script
- Version is set on upload: `max(existing versions) + 1`, defaulting to 1

### Changes

1. **Script** (`scripts/create-schulsong-version-field.ts`): Create field via Airtable Meta API, auto-patch `teacher.ts` with field ID

2. **Types** (`src/lib/types/teacher.ts`): Add `schulsong_version` to `AUDIO_FILES_FIELD_IDS`

3. **Transform** (`teacherService.ts`, `transformAudioFileRecord`): Add `schulsongVersion` to the AudioFile return object

4. **Engineer upload** (`upload-mixed/route.ts`, inside `isSchulsong && type === 'final'` block):
   - Find max version among old schulsong files, set new file's version to `max + 1`
   - **Bug fix**: Reset `approval_status` to `'pending'` and clear `teacher_approved_at`

5. **Admin replace** (`replace-audio/route.ts`): Increment version on the replaced file (current version + 1)

6. **Status endpoint** (`schulsong-status/route.ts`): Return `version` and `uploadedAt` in the response

7. **Teacher UI** (`SchulsongApprovalSection.tsx`): Display version badge and upload date in `ready_for_approval` and `approved` states:
   ```
   V2  ·  Hochgeladen am 15. April 2026
   ```
   - Version badge: small neutral gray pill
   - Upload date: muted text, separated by centered dot
   - Not shown in `rejected` or `waiting` states

### Not in scope

- Version history / changelog for the teacher
- Admin-side version display (can be added later if needed)
- Reworking the admin `replace-audio` route's missing `clearTeacherApprovedAt` (separate lower-priority issue)
