# Fix: Logic Project Upload Missing Engineer Auto-Assignment

**Date:** 2026-02-27
**Triggered by:** Hans-Elm-Schule upload incident — staff uploaded MiniMusiker Tracks Logic project, got error at ~100%, and engineer Jakob couldn't see the event in his portal.

## Root Cause

The logic project upload handlers (`upload-logic-project/route.ts` and `upload-logic-project/multipart/route.ts`) were missing the `autoAssignEngineerForUpload()` call that the batch audio upload handler (`upload-batch/route.ts:233`) already had.

Without this call, the `assigned_engineer` field on the Events table in Airtable was never set during logic project uploads. Since the engineer portal filters events by this field, the event was invisible to Jakob.

## What Was Fixed

Added `autoAssignEngineerForUpload(eventId, projectType === 'schulsong')` to both PUT handlers:

1. **Simple upload**: `src/app/api/staff/events/[eventId]/upload-logic-project/route.ts`
2. **Multipart upload**: `src/app/api/staff/events/[eventId]/upload-logic-project/multipart/route.ts`

The call is wrapped in try/catch (matching the batch upload pattern) so auto-assignment failures don't block the upload confirmation.

## Immediate Data Fix

Hans-Elm-Schule event was manually assigned to Jakob in Airtable (`assigned_engineer` and `auto_assigned_engineers` fields).

## How Auto-Assignment Works

- `autoAssignEngineerForUpload()` checks if an engineer is already assigned — if so, it does nothing (won't override)
- Maps `projectType === 'schulsong'` → Micha, `projectType === 'minimusiker'` → Jakob
- Sets the `assigned_engineer` linked record field on the Events table
