# Audio Pipeline Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the audio pipeline by removing the admin approval step for class songs, updating the 4-stage emoji indicator, converting the approval modal to a listen-only review modal, and adding per-upload-type engineer notifications.

**Architecture:** Replace the 4-stage approval pipeline (`not_started → in_progress → ready_for_review → approved`) with a 3-stage upload-progress pipeline (`not_started → staff_uploaded → finals_submitted`). The "event hasn't happened" state is computed at render time from event date, not stored. The review modal keeps schulsong approval intact but strips class-song approval UI.

**Tech Stack:** Next.js (App Router), React, TypeScript, Airtable, Resend emails, R2 storage

---

### Task 1: Update Airtable type definitions

**Files:**
- Modify: `src/lib/types/airtable.ts:556` (field comment)
- Modify: `src/lib/types/airtable.ts:706` (Event interface)

**Step 1: Update the field ID comment**

In `src/lib/types/airtable.ts`, change the comment on line 556:

```typescript
// OLD:
audio_pipeline_stage: 'fldlW3jUcGmhbkhug', // Single Select - not_started | in_progress | ready_for_review | approved

// NEW:
audio_pipeline_stage: 'fldlW3jUcGmhbkhug', // Single Select - not_started | staff_uploaded | finals_submitted
```

**Step 2: Update the Event interface type union**

In `src/lib/types/airtable.ts`, change line 706:

```typescript
// OLD:
audio_pipeline_stage?: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved';

// NEW:
audio_pipeline_stage?: 'not_started' | 'staff_uploaded' | 'finals_submitted';
```

**Step 3: Build to check for type errors**

Run: `npx tsc --noEmit 2>&1 | head -80`
Expected: Type errors in files still using old stage values — this is expected and will be fixed in subsequent tasks.

**Step 4: Commit**

```
feat: update audio_pipeline_stage types to new 3-stage pipeline
```

---

### Task 2: Update airtableService pipeline stage function

**Files:**
- Modify: `src/lib/services/airtableService.ts:3943` (updateEventAudioPipelineStage parameter type)

**Step 1: Update the stage parameter type**

In `src/lib/services/airtableService.ts`, find `updateEventAudioPipelineStage` at line ~3941 and change the `stage` parameter:

```typescript
// OLD:
async updateEventAudioPipelineStage(
  eventId: string,
  stage: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved'
): Promise<void> {

// NEW:
async updateEventAudioPipelineStage(
  eventId: string,
  stage: 'not_started' | 'staff_uploaded' | 'finals_submitted'
): Promise<void> {
```

**Step 2: Commit**

```
feat: update airtableService pipeline stage function signature
```

---

### Task 3: Update AudioPipelineIndicator emoji component

**Files:**
- Modify: `src/components/admin/bookings/BookingsTable.tsx:14-37`

**Step 1: Update the AudioPipelineIndicator component**

Replace the entire function (lines 14-37):

```typescript
function AudioPipelineIndicator({ stage, eventDate }: { stage?: 'not_started' | 'staff_uploaded' | 'finals_submitted'; eventDate?: string }) {
  let isFuture = false;
  if (eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate + 'T00:00:00');
    eventDay.setHours(0, 0, 0, 0);
    isFuture = eventDay > today;
  }

  if (isFuture) {
    return <span title="Event hasn't happened yet" className="text-gray-400">&#x23F3;</span>;
  }
  if (!stage || stage === 'not_started') {
    return <span title="Staff audio not uploaded">&#x274C;</span>;
  }
  if (stage === 'staff_uploaded') {
    return <span title="Waiting for engineer finals">&#x2699;&#xFE0F;</span>;
  }
  if (stage === 'finals_submitted') {
    return <span title="Finals submitted">&#x2705;</span>;
  }
  return <span>—</span>;
}
```

Key changes:
- Stage type updated from old values to new values
- `not_started` on a past event now shows ❌ instead of ⏳
- `staff_uploaded` shows ⚙️ (gear)
- `finals_submitted` shows ✅
- Future events still show ⏳

**Step 2: Commit**

```
feat: update AudioPipelineIndicator with new pipeline emojis
```

---

### Task 4: Update BookingsTable type reference

**Files:**
- Modify: `src/app/api/admin/bookings/route.ts:52` (BookingWithDetails interface)

**Step 1: Update the audioPipelineStage type in BookingWithDetails**

Find the `audioPipelineStage` field in the `BookingWithDetails` interface and update:

```typescript
// OLD:
audioPipelineStage?: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved';

// NEW:
audioPipelineStage?: 'not_started' | 'staff_uploaded' | 'finals_submitted';
```

**Step 2: Commit**

```
feat: update BookingWithDetails pipeline stage type
```

---

### Task 5: Update BookingDetailsBreakdown (review button + audio status section)

**Files:**
- Modify: `src/components/admin/bookings/BookingDetailsBreakdown.tsx`

**Step 1: Update the import — rename AudioApprovalModal to AudioReviewModal**

Change line 13:
```typescript
// OLD:
import AudioApprovalModal from './AudioApprovalModal';

// NEW:
import AudioReviewModal from './AudioReviewModal';
```

**Step 2: Rename state variable**

Change line 42:
```typescript
// OLD:
const [showAudioApprovalModal, setShowAudioApprovalModal] = useState(false);

// NEW:
const [showAudioReviewModal, setShowAudioReviewModal] = useState(false);
```

**Step 3: Update the audio status section (lines 456-472)**

Replace the button logic. The button should:
- Only be enabled when `booking.audioPipelineStage === 'finals_submitted'` (instead of checking `audioStatus.staffUploadComplete && mixMasterUploadComplete`)
- Be labelled "Review Audio" (instead of "Review & Approve" / "Approved ✓" / "Pending")
- Use a simple blue style when enabled, gray when disabled

```typescript
<button
  onClick={() => setShowAudioReviewModal(true)}
  disabled={booking.audioPipelineStage !== 'finals_submitted'}
  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
    booking.audioPipelineStage === 'finals_submitted'
      ? 'bg-blue-500 text-white hover:bg-blue-600'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }`}
>
  {booking.audioPipelineStage === 'finals_submitted'
    ? 'Review Audio'
    : 'Pending'}
</button>
```

Note: The `booking` prop (BookingWithDetails) already has `audioPipelineStage` directly — no need to check `audioStatus` for the button enable state. Keep the StatusLight indicators for visual reference but the button logic is now pipeline-stage driven.

**Step 4: Update the modal instance (lines 621-641)**

Replace the `AudioApprovalModal` usage:

```typescript
{/* Audio Review Modal */}
<AudioReviewModal
  isOpen={showAudioReviewModal}
  onClose={() => setShowAudioReviewModal(false)}
  eventId={booking.code}
  schoolName={booking.schoolName}
/>
```

Remove the `onApprovalComplete` callback and the inline fetchAudioStatus function — no longer needed since there's no approval action.

**Step 5: Commit**

```
feat: update BookingDetailsBreakdown to use simplified review modal
```

---

### Task 6: Create AudioReviewModal (simplified listen-only modal)

**Files:**
- Modify: `src/components/admin/bookings/AudioApprovalModal.tsx` → Rename to `AudioReviewModal.tsx`

**Step 1: Rename the file**

```bash
mv src/components/admin/bookings/AudioApprovalModal.tsx src/components/admin/bookings/AudioReviewModal.tsx
```

**Step 2: Rewrite the component**

The new `AudioReviewModal` should:
- Keep the same props minus `onApprovalComplete`
- Keep `fetchAudioStatus()` and `fetchSchulsongStatus()` for loading data
- Keep the entire schulsong section with its approval/release flow **unchanged**
- Strip ALL class-song approval UI:
  - Remove `pendingApprovals`, `rejectionComments`, `showRejectInput` state
  - Remove `handleApprovalChange`, `handleRejectComment`, `handleSave`, `getStatusBadge`
  - Remove per-track Approve/Reject buttons
  - Remove rejection comment textareas
  - Remove "Save Changes" footer button
- Keep audio players for final tracks
- Change the summary grid from 3 cols (Expected/Final Uploaded/Approved) to 2 cols (Expected/Final Uploaded)
- Change title from "Audio Approval" to "Audio Review"
- Footer: just a "Close" button (no Save)

Interface:
```typescript
interface AudioReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  schoolName: string;
}
```

Track list rendering (simplified, no approval actions):
```tsx
{audioStatus.tracks.map((track) => (
  <div
    key={track.audioFileId || track.songId}
    className={`border rounded-lg p-4 ${
      track.hasFinalAudio ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
    }`}
  >
    <div className="mb-3">
      <h4 className="font-medium text-gray-900">{track.songTitle}</h4>
      <p className="text-sm text-gray-500">{track.className}</p>
    </div>

    {!track.hasFinalAudio ? (
      <p className="text-sm text-gray-400">No final audio uploaded yet</p>
    ) : track.finalAudioUrl ? (
      <audio controls className="w-full h-10" src={track.finalAudioUrl}>
        Your browser does not support the audio element.
      </audio>
    ) : null}
  </div>
))}
```

Footer:
```tsx
<div className="px-6 py-4 border-t border-gray-200 flex justify-end">
  <button
    onClick={onClose}
    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
  >
    Close
  </button>
</div>
```

**Step 3: Commit**

```
feat: convert AudioApprovalModal to listen-only AudioReviewModal
```

---

### Task 7: Update engineer page — rename button and update stage references

**Files:**
- Modify: `src/app/engineer/events/[eventId]/page.tsx`

**Step 1: Update the audioPipelineStage type references**

Line 100 — update the type:
```typescript
audioPipelineStage?: 'not_started' | 'staff_uploaded' | 'finals_submitted';
```

**Step 2: Update the status display (lines 443-464)**

Replace the status badge logic:
```typescript
{(() => {
  const stage = event.audioPipelineStage;
  if (stage === 'finals_submitted') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Finals Submitted
      </span>
    );
  }
  if (stage === 'staff_uploaded') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Staff Uploaded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      {event.mixingStatus === 'completed' ? 'Completed' : event.mixingStatus === 'in-progress' ? 'In Progress' : 'Pending'}
    </span>
  );
})()}
```

**Step 3: Update showFooter condition (line 370)**

```typescript
// OLD:
const showFooter = event && event.audioPipelineStage !== 'approved' && event.audioPipelineStage !== 'ready_for_review';

// NEW:
const showFooter = event && event.audioPipelineStage !== 'finals_submitted';
```

**Step 4: Update the submit button text (line 835)**

```typescript
// OLD:
'Submit Audio'

// NEW:
'Submit Finals'
```

**Step 5: Update `handleSubmitForReview` alerts (lines 351, 357)**

```typescript
// OLD:
alert(data.error || 'Failed to submit for review');
// ...
alert('Failed to submit for review');

// NEW:
alert(data.error || 'Failed to submit finals');
// ...
alert('Failed to submit finals');
```

**Step 6: Update delete button visibility checks**

Lines 656, 702, 1064, 1110 — change `audioPipelineStage !== 'approved'` to `audioPipelineStage !== 'finals_submitted'`.

**Step 7: Commit**

```
feat: update engineer page with new pipeline stages and Submit Finals button
```

---

### Task 8: Update engineer types

**Files:**
- Modify: `src/lib/types/engineer.ts:100`

**Step 1: Update audioPipelineStage type**

```typescript
// OLD:
audioPipelineStage?: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved';

// NEW:
audioPipelineStage?: 'not_started' | 'staff_uploaded' | 'finals_submitted';
```

**Step 2: Commit**

```
feat: update engineer type definitions for new pipeline stages
```

---

### Task 9: Update submit-for-review API endpoint

**Files:**
- Modify: `src/app/api/engineer/events/[eventId]/submit-for-review/route.ts`

**Step 1: Update the stage check and set**

Line 31 — change the "already approved" check:
```typescript
// OLD:
if (event.audio_pipeline_stage === 'approved') {
  return NextResponse.json(
    { error: 'Event has already been approved' },
    { status: 400 }
  );
}

// NEW:
if (event.audio_pipeline_stage === 'finals_submitted') {
  return NextResponse.json(
    { error: 'Finals have already been submitted' },
    { status: 400 }
  );
}
```

Line 61 — change the stage being set:
```typescript
// OLD:
await airtableService.updateEventAudioPipelineStage(eventId, 'ready_for_review');

// NEW:
await airtableService.updateEventAudioPipelineStage(eventId, 'finals_submitted');
```

**Step 2: Commit**

```
feat: update submit-for-review endpoint to set finals_submitted stage
```

---

### Task 10: Update staff upload routes — change pipeline stage from in_progress to staff_uploaded

**Files:**
- Modify: `src/app/api/staff/events/[eventId]/upload-logic-project/multipart/route.ts:176`
- Modify: `src/app/api/staff/events/[eventId]/songs/[songId]/upload-raw/route.ts:149`
- Modify: `src/app/api/staff/events/[eventId]/classes/[classId]/upload-batch/route.ts:239`

**Step 1: Update multipart route (line 176)**

```typescript
// OLD:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'in_progress');

// NEW:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');
```

**Step 2: Update upload-raw route (line 149)**

```typescript
// OLD:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'in_progress');

// NEW:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');
```

**Step 3: Update upload-batch route (line 239)**

```typescript
// OLD:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'in_progress');

// NEW:
await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');
```

**Step 4: Commit**

```
feat: update staff upload routes to set staff_uploaded pipeline stage
```

---

### Task 11: Add per-upload-type engineer notifications

**Files:**
- Modify: `src/lib/services/notificationService.ts` (replace `notifyEngineerOfFirstUpload`)
- Modify: `src/lib/services/resendService.ts` (add two new email send functions)

**Step 1: Add two new email send functions in resendService.ts**

After `sendEngineerAudioUploadedEmail` (line 392), add:

```typescript
/**
 * Send engineer notification when Schulsong Logic Project is uploaded
 */
export async function sendEngineerSchulsongUploadedEmail(
  email: string,
  data: EngineerAudioUploadedData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'engineer_schulsong_uploaded', {
    engineerName: data.engineerName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    eventId: data.eventId,
    engineerPortalUrl: data.engineerPortalUrl,
  }, 'Engineer schulsong uploaded');
}

/**
 * Send engineer notification when MiniMusiker Logic Project is uploaded
 */
export async function sendEngineerMinimusikerUploadedEmail(
  email: string,
  data: EngineerAudioUploadedData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'engineer_minimusiker_uploaded', {
    engineerName: data.engineerName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    eventId: data.eventId,
    engineerPortalUrl: data.engineerPortalUrl,
  }, 'Engineer minimusiker uploaded');
}
```

**Step 2: Update notificationService.ts imports**

```typescript
// OLD:
import {
  sendNewBookingNotification,
  sendDateChangeNotification,
  sendCancellationNotification,
  sendSchulsongTeacherApprovedNotification,
  SchulsongTeacherApprovedData,
  sendEngineerAudioUploadedEmail,
} from './resendService';

// NEW:
import {
  sendNewBookingNotification,
  sendDateChangeNotification,
  sendCancellationNotification,
  sendSchulsongTeacherApprovedNotification,
  SchulsongTeacherApprovedData,
  sendEngineerSchulsongUploadedEmail,
  sendEngineerMinimusikerUploadedEmail,
} from './resendService';
```

**Step 3: Replace `notifyEngineerOfFirstUpload` with `notifyEngineerOfUpload`**

Replace the entire function (lines 219-268):

```typescript
/**
 * Notify the appropriate engineer when a Logic Project is uploaded.
 * - Schulsong upload → notifies Micha (ENGINEER_MICHA_ID)
 * - Minimusiker upload → notifies Jakob (ENGINEER_JAKOB_ID)
 * Dedup: only sends if audio_pipeline_stage is 'not_started' (first upload of any type).
 */
export async function notifyEngineerOfUpload(
  eventId: string,
  projectType: 'schulsong' | 'minimusiker'
): Promise<void> {
  try {
    const airtable = getAirtableService();
    const event = await airtable.getEventByEventId(eventId);
    if (!event) {
      console.log(`[NotificationService] notifyEngineerOfUpload: Event not found: ${eventId}`);
      return;
    }

    // Determine which engineer to notify based on project type
    const engineerId = projectType === 'schulsong'
      ? process.env.ENGINEER_MICHA_ID
      : process.env.ENGINEER_JAKOB_ID;

    if (!engineerId) {
      console.warn(`[NotificationService] No engineer ID configured for ${projectType}`);
      return;
    }

    // Look up engineer from Personen table
    const engineer = await airtable.getPersonById(engineerId);
    if (!engineer || !engineer.email) {
      console.warn(`[NotificationService] Engineer ${engineerId} has no email, skipping notification`);
      return;
    }

    const eventDate = event.event_date
      ? new Date(event.event_date).toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    const engineerPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.minimusiker.de'}/engineer/events/${eventId}`;

    const emailData = {
      engineerName: engineer.staff_name,
      schoolName: event.school_name,
      eventDate,
      eventId,
      engineerPortalUrl,
    };

    if (projectType === 'schulsong') {
      await sendEngineerSchulsongUploadedEmail(engineer.email, emailData);
    } else {
      await sendEngineerMinimusikerUploadedEmail(engineer.email, emailData);
    }

    console.log(`[NotificationService] Engineer ${projectType} uploaded notification sent to ${engineer.email} for event ${eventId}`);
  } catch (error) {
    console.error('[NotificationService] Error in notifyEngineerOfUpload:', error);
  }
}
```

**Step 4: Commit**

```
feat: add per-upload-type engineer notifications (Micha for schulsong, Jakob for minimusiker)
```

---

### Task 12: Wire up per-type notifications in staff upload routes

**Files:**
- Modify: `src/app/api/staff/events/[eventId]/upload-logic-project/multipart/route.ts`
- Modify: `src/app/api/staff/events/[eventId]/songs/[songId]/upload-raw/route.ts`
- Modify: `src/app/api/staff/events/[eventId]/classes/[classId]/upload-batch/route.ts`

**Step 1: Update multipart route import and notification call**

Change import:
```typescript
// OLD:
import { notifyEngineerOfFirstUpload } from '@/lib/services/notificationService';

// NEW:
import { notifyEngineerOfUpload } from '@/lib/services/notificationService';
```

Change notification call (line ~174-177). The current code waits for BOTH uploads before notifying. Now we notify per upload type:

```typescript
// OLD:
if (bothUploaded) {
  notifyEngineerOfFirstUpload(eventId).catch(err => console.error('Engineer notification error:', err));
  await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');
}

// NEW:
// Notify the appropriate engineer for this specific upload type
notifyEngineerOfUpload(eventId, projectType as 'schulsong' | 'minimusiker').catch(err =>
  console.error('Engineer notification error:', err)
);
// Update pipeline stage when any project is uploaded
await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');
```

Note: Remove the `bothUploaded` check — we notify per upload type now, and stage moves to `staff_uploaded` on first upload.

**Step 2: Update upload-raw route**

Change import:
```typescript
// OLD:
import { notifyEngineerOfFirstUpload } from '@/lib/services/notificationService';

// NEW:
import { notifyEngineerOfUpload } from '@/lib/services/notificationService';
```

Change notification call (line ~145). Raw uploads are individual song files — determine project type from context. Since raw uploads go through the song-per-class flow (not logic project), these are minimusiker tracks by default. Check if the song is a schulsong:

```typescript
// OLD:
notifyEngineerOfFirstUpload(eventId).catch(err => console.error('Engineer notification error:', err));

// NEW:
// Raw uploads are individual song recordings — notify minimusiker engineer
notifyEngineerOfUpload(eventId, 'minimusiker').catch(err => console.error('Engineer notification error:', err));
```

**Step 3: Update upload-batch route**

Change import:
```typescript
// OLD:
import { notifyEngineerOfFirstUpload } from '@/lib/services/notificationService';

// NEW:
import { notifyEngineerOfUpload } from '@/lib/services/notificationService';
```

Change notification call (line ~237). The batch upload has an `isSchulsong` variable:

```typescript
// OLD:
notifyEngineerOfFirstUpload(eventId).catch(err => console.error('Engineer notification error:', err));

// NEW:
notifyEngineerOfUpload(eventId, isSchulsong ? 'schulsong' : 'minimusiker').catch(err =>
  console.error('Engineer notification error:', err)
);
```

**Step 4: Commit**

```
feat: wire per-type engineer notifications into staff upload routes
```

---

### Task 13: Update remaining references to old pipeline stages

**Files:**
- Modify: `src/app/api/engineer/events/[eventId]/audio-files/[audioFileId]/route.ts`
- Modify: `src/app/api/admin/set-pipeline-stage/route.ts`
- Modify: `src/app/api/admin/events/[eventId]/approve-tracks/route.ts`

**Step 1: Check and update audio-files DELETE route**

This route auto-reverts stage when a file is deleted. Find references to `ready_for_review` and update to `finals_submitted`, and `in_progress` to `staff_uploaded`.

**Step 2: Check and update set-pipeline-stage route**

This is an admin override endpoint. Update the allowed stage values.

**Step 3: Check approve-tracks route**

This endpoint may set `approved` stage. Since class song approval is being removed, this endpoint can either be left (for schulsong) or simplified. If it only handles class songs, it can be deprecated.

**Step 4: Commit**

```
feat: update remaining API routes with new pipeline stage values
```

---

### Task 14: Build and verify

**Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Verify no remaining old stage references**

Run: `grep -rn "in_progress\|ready_for_review" --include="*.ts" --include="*.tsx" src/ | grep -v node_modules | grep -v ".d.ts"`
Expected: No matches (except possibly in comments)

**Step 3: Run dev server and quick smoke test**

Run: `npm run dev`
Verify the admin bookings page loads without errors.

**Step 4: Commit any remaining fixes**

```
fix: resolve remaining type errors from pipeline stage migration
```

---

### Task 15: Final cleanup — remove unused approval code

**Files:**
- Modify: `src/lib/types/audio-status.ts` — Remove `TrackApprovalRequest`, `ApproveTracksRequest`, `ApproveTracksResponse` types (only used by class song approval)
- Keep `ApprovalStatus` and `AdminApprovalStatus` if still used by schulsong

**Step 1: Check what's still used**

Search for imports of removed types to ensure nothing breaks.

**Step 2: Remove unused types and imports**

**Step 3: Final build check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
chore: remove unused class song approval types
```
