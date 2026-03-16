# Activity Log Gap Fill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add activity logging to all untracked admin/teacher/system actions for a complete audit trail.

**Architecture:** Add `logActivity()` calls at each action site, register new activity types in the type system, and add icon/color mappings in the timeline UI. All logging is fire-and-forget (never blocks the main operation).

**Tech Stack:** Next.js API routes, TypeScript, Airtable (EventActivity table), ActivityService singleton

---

## Task 1: Register New Activity Types & UI Mappings

**Files:**
- Modify: `src/lib/types/airtable.ts` (~line 1064-1085, EventActivityType union)
- Modify: `src/components/admin/EventActivityTimeline.tsx` (~line 13-38, ACTIVITY_CONFIG)

**Step 1: Add new types to EventActivityType union**

In `src/lib/types/airtable.ts`, find the `EventActivityType` type (around line 1064) and add these new types to the union:

```typescript
  | 'status_changed'
  | 'event_type_changed'
  | 'children_updated'
  | 'merch_override_changed'
  | 'notes_updated'
  | 'timeline_updated'
  | 'merch_cutoff_changed'
  | 'bulk_order_updated'
  | 'deal_config_saved'
  | 'track_approved'
  | 'track_rejected'
  | 'schulsong_approved'
  | 'schulsong_rejected'
  | 'booking_created'
  | 'booking_changed'
  | 'booking_cancelled'
  | 'clothing_order_updated'
```

**Step 2: Add icon/color mappings in EventActivityTimeline**

In `src/components/admin/EventActivityTimeline.tsx`, find the `ACTIVITY_CONFIG` object and add entries for each new type. Follow the existing pattern (emoji + tailwind bg color class). Suggested mappings:

```typescript
  status_changed:         { icon: '📋', bg: 'bg-amber-100' },
  event_type_changed:     { icon: '🔄', bg: 'bg-cyan-100' },
  children_updated:       { icon: '👶', bg: 'bg-teal-100' },
  merch_override_changed: { icon: '👕', bg: 'bg-pink-100' },
  notes_updated:          { icon: '📝', bg: 'bg-gray-100' },
  timeline_updated:       { icon: '⏱️', bg: 'bg-purple-100' },
  merch_cutoff_changed:   { icon: '📅', bg: 'bg-orange-100' },
  bulk_order_updated:     { icon: '📦', bg: 'bg-blue-100' },
  deal_config_saved:      { icon: '💰', bg: 'bg-emerald-100' },
  track_approved:         { icon: '✅', bg: 'bg-green-100' },
  track_rejected:         { icon: '❌', bg: 'bg-red-100' },
  schulsong_approved:     { icon: '🎵', bg: 'bg-green-100' },
  schulsong_rejected:     { icon: '🎵', bg: 'bg-red-100' },
  booking_created:        { icon: '📥', bg: 'bg-purple-100' },
  booking_changed:        { icon: '🔄', bg: 'bg-blue-100' },
  booking_cancelled:      { icon: '🚫', bg: 'bg-red-100' },
  clothing_order_updated: { icon: '👕', bg: 'bg-teal-100' },
```

**Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/lib/types/airtable.ts src/components/admin/EventActivityTimeline.tsx
git commit -m "feat: register new activity types and timeline UI mappings"
```

---

## Task 2: Add Logging to Admin PATCH Route (Status, Type Toggles, Children, Merch)

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/route.ts`

This is the biggest task — the PATCH handler processes many field updates in a single request. We need to add logging after each field group is written.

**Step 1: Add logging for status changes**

Find where `hasStatusUpdate` is processed (around line 625-670). After the status is saved (after the `updateEventFields` call), add:

```typescript
if (hasStatusUpdate && body.status !== undefined) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'status_changed',
    description: `Status changed from "${existingEvent?.status || 'none'}" to "${body.status || 'none'}"`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { oldStatus: existingEvent?.status, newStatus: body.status },
  });
}
```

You'll need to fetch the existing event BEFORE the update to capture old values. Check if `existingEvent` is already available in scope — it may be fetched earlier for date change comparison. If not, fetch it at the top of the PATCH handler.

**Step 2: Add logging for event type toggle changes**

After the event type toggles are saved, add:

```typescript
if (hasEventTypeUpdates) {
  const changes: string[] = [];
  if (body.is_plus !== undefined) changes.push(`is_plus → ${body.is_plus}`);
  if (body.is_minimusikertag !== undefined) changes.push(`is_minimusikertag → ${body.is_minimusikertag}`);
  if (body.is_schulsong !== undefined) changes.push(`is_schulsong → ${body.is_schulsong}`);
  if (body.is_kita !== undefined) changes.push(`is_kita → ${body.is_kita}`);
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'event_type_changed',
    description: `Event type updated: ${changes.join(', ')}`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: {
      is_plus: body.is_plus,
      is_minimusikertag: body.is_minimusikertag,
      is_schulsong: body.is_schulsong,
      is_kita: body.is_kita,
    },
  });
}
```

**Step 3: Add logging for estimated children**

```typescript
if (hasChildrenUpdate) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'children_updated',
    description: `Estimated children updated to ${body.estimated_children}`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { estimatedChildren: body.estimated_children },
  });
}
```

**Step 4: Add logging for standard merch override**

```typescript
if (hasStandardMerchOverride) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'merch_override_changed',
    description: `Standard merch override set to "${body.standard_merch_override || 'auto'}"`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { standardMerchOverride: body.standard_merch_override },
  });
}
```

**Step 5: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 6: Commit**

```bash
git add src/app/api/admin/events/[eventId]/route.ts
git commit -m "feat: add activity logging for status, type toggles, children, merch override"
```

---

## Task 3: Add Logging to Admin PATCH Route (Notes, Timeline, Cutoff, Bulk Orders, Deal Config)

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/route.ts`

**Step 1: Add logging for admin notes**

After the admin notes update block (around line 737):

```typescript
if (hasNotesUpdate) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'notes_updated',
    description: 'Admin notes updated',
    actorEmail: admin.email,
    actorType: 'admin',
  });
}
```

**Step 2: Add logging for timeline overrides**

After the timeline overrides update block (around line 745):

```typescript
if (hasOverridesUpdate) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'timeline_updated',
    description: 'Timeline overrides updated',
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { overrides: body.timeline_overrides },
  });
}
```

**Step 3: Add logging for merch cutoff**

After the merch cutoff update block (around line 755):

```typescript
if (hasMerchCutoffUpdate) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'merch_cutoff_changed',
    description: `Schulsong merch cutoff ${body.schulsong_merch_cutoff ? `set to ${body.schulsong_merch_cutoff}` : 'cleared'}`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { schulsongMerchCutoff: body.schulsong_merch_cutoff },
  });
}
```

**Step 4: Add logging for bulk order updates**

After the bulk order update block (around line 841):

```typescript
if (hasBulkOrderUpdate) {
  const changes: string[] = [];
  if (body.scs_shirts_included !== undefined) changes.push(`SCS shirts: ${body.scs_shirts_included ? 'enabled' : 'disabled'}`);
  if (body.minicard_order_enabled !== undefined) changes.push(`Minicard order: ${body.minicard_order_enabled ? 'enabled' : 'disabled'}`);
  if (body.minicard_order_quantity !== undefined) changes.push(`Minicard quantity: ${body.minicard_order_quantity}`);
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'bulk_order_updated',
    description: `Bulk order updated: ${changes.join(', ')}`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: {
      scsShirtsIncluded: body.scs_shirts_included,
      minicardOrderEnabled: body.minicard_order_enabled,
      minicardOrderQuantity: body.minicard_order_quantity,
    },
  });
}
```

**Step 5: Add logging for deal config save**

The deal_type_changed logging already exists (line 813). Enhance it to also fire when only `deal_config` changes (no type change). After the existing deal type logging block, add:

```typescript
if (body.deal_config !== undefined && body.deal_type === undefined) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'deal_config_saved',
    description: `Deal configuration updated${body.deal_config?.calculated_fee != null ? ` (total: €${body.deal_config.calculated_fee})` : ''}`,
    actorEmail: admin.email,
    actorType: 'admin',
    metadata: { calculatedFee: body.deal_config?.calculated_fee },
  });
}
```

**Step 6: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 7: Commit**

```bash
git add src/app/api/admin/events/[eventId]/route.ts
git commit -m "feat: add activity logging for notes, timeline, cutoff, bulk orders, deal config"
```

---

## Task 4: Add Logging to Audio/Schulsong Approval Routes

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/approve-tracks/route.ts`
- Modify: `src/app/api/admin/events/[eventId]/approve-schulsong/route.ts`

**Step 1: Add logging for track approvals**

In `approve-tracks/route.ts`, after each track is processed in the approval loop (around line 62), add logging. Also log a summary after the loop.

Import `getActivityService` at top, then after the approval loop completes:

```typescript
// Log each approval/rejection
for (const approval of approvals) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: approval.status === 'approved' ? 'track_approved' : 'track_rejected',
    description: `Track ${approval.status}${approval.comment ? `: ${approval.comment}` : ''}`,
    actorEmail: session.email,
    actorType: 'admin',
    metadata: { audioFileId: approval.audioFileId, status: approval.status, comment: approval.comment },
  });
}
```

**Step 2: Add logging for admin schulsong approval (POST)**

In `approve-schulsong/route.ts`, after the schulsong is approved (around line 74), add:

```typescript
getActivityService().logActivity({
  eventRecordId: resolvedEventId,
  activityType: 'schulsong_approved',
  description: `Schulsong approved by admin (${mode}${isOverride ? ', override' : ''})`,
  actorEmail: session.email,
  actorType: 'admin',
  metadata: { mode, isOverride, releasedAt },
});
```

**Step 3: Add logging for admin schulsong rejection (DELETE)**

In `approve-schulsong/route.ts`, after the schulsong is rejected (around line 155), add:

```typescript
getActivityService().logActivity({
  eventRecordId,
  activityType: 'schulsong_rejected',
  description: `Schulsong rejected by admin${comment ? `: ${comment}` : ''}`,
  actorEmail: session.email,
  actorType: 'admin',
  metadata: { comment },
});
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/app/api/admin/events/[eventId]/approve-tracks/route.ts src/app/api/admin/events/[eventId]/approve-schulsong/route.ts
git commit -m "feat: add activity logging for track and schulsong approvals"
```

---

## Task 5: Add Logging to Teacher Schulsong Actions

**Files:**
- Modify: `src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts`
- Modify: `src/app/api/teacher/events/[eventId]/schulsong-reject/route.ts`

**Step 1: Add logging for teacher schulsong approval**

In `schulsong-approve/route.ts`, after the approval + release date/cutoff are set (around line 60), add:

```typescript
getActivityService().logActivity({
  eventRecordId: event.recordId, // or however the event record ID is available
  activityType: 'schulsong_approved',
  description: 'Schulsong approved by teacher',
  actorEmail: session.email,
  actorType: 'teacher',
  metadata: { approvedAt: result.approvedAt },
});
```

Check how the event record ID is available in scope — it may be on the event object fetched earlier in the handler.

**Step 2: Add logging for teacher schulsong rejection**

In `schulsong-reject/route.ts`, after the rejection + clearing of dates (around line 55), add:

```typescript
getActivityService().logActivity({
  eventRecordId: event.recordId,
  activityType: 'schulsong_rejected',
  description: `Schulsong rejected by teacher${notes ? `: ${notes}` : ''}`,
  actorEmail: session.email,
  actorType: 'teacher',
  metadata: { rejectedAt: result.rejectedAt, notes },
});
```

**Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/api/teacher/events/[eventId]/schulsong-approve/route.ts src/app/api/teacher/events/[eventId]/schulsong-reject/route.ts
git commit -m "feat: add activity logging for teacher schulsong approve/reject"
```

---

## Task 6: Add Logging to SimplyBook Webhook

**Files:**
- Modify: `src/app/api/simplybook/webhook/route.ts`

**Step 1: Add logging for booking creation**

After a new Event is created from a SimplyBook webhook (around line 185), add:

```typescript
if (eventRecordId) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'booking_created',
    description: `Booking created from SimplyBook (${mappedData.schoolName || 'unknown school'})`,
    actorEmail: 'simplybook@system',
    actorType: 'system',
    metadata: { simplybookId: booking.id, schoolName: mappedData.schoolName, eventDate: mappedData.eventDate },
  });
}
```

Note: The event record ID may need to be captured from the creation step. Check the code flow to find where the new event record ID is available.

**Step 2: Add logging for booking changes**

After the booking is updated (around line 437), add:

```typescript
if (eventRecordId) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'booking_changed',
    description: `Booking updated from SimplyBook`,
    actorEmail: 'simplybook@system',
    actorType: 'system',
    metadata: { simplybookId: booking.id, updatedFields: Object.keys(mappedData) },
  });
}
```

**Step 3: Add logging for booking cancellation**

After the booking is cancelled (around line 528), add:

```typescript
if (eventRecordId) {
  getActivityService().logActivity({
    eventRecordId,
    activityType: 'booking_cancelled',
    description: `Booking cancelled from SimplyBook`,
    actorEmail: 'simplybook@system',
    actorType: 'system',
    metadata: { simplybookId: booking.id },
  });
}
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/app/api/simplybook/webhook/route.ts
git commit -m "feat: add activity logging for SimplyBook webhook events"
```

---

## Task 7: Add Logging to Clothing Order Routes

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/clothing-order/route.ts`
- Modify: `src/app/api/teacher/events/[eventId]/clothing-order/route.ts`

**Step 1: Add logging for admin clothing order save**

In the admin clothing order PUT handler, after the order is created/updated (around line 134), add:

```typescript
getActivityService().logActivity({
  eventRecordId,
  activityType: 'clothing_order_updated',
  description: `Clothing order updated (${totalQuantity} items total)`,
  actorEmail: admin.email,
  actorType: 'admin',
  metadata: { totalQuantity, notes: body.notes },
});
```

Use whatever `totalQuantity` variable is available (sum of sizes), or calculate it.

**Step 2: Add logging for teacher clothing order save**

In the teacher clothing order PUT handler, after the order is created/updated (around line 154), add:

```typescript
getActivityService().logActivity({
  eventRecordId,
  activityType: 'clothing_order_updated',
  description: `Clothing order updated by teacher (${totalQuantity} items total)`,
  actorEmail: session.email,
  actorType: 'teacher',
  metadata: { totalQuantity, notes: body.notes },
});
```

**Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add src/app/api/admin/events/[eventId]/clothing-order/route.ts src/app/api/teacher/events/[eventId]/clothing-order/route.ts
git commit -m "feat: add activity logging for clothing order saves"
```

---

## Task 8: Final Build & Verification

**Step 1: Full build**

Run: `npx next build --no-lint`

Expected: Clean build, no errors.

**Step 2: Verify all new activity types are registered**

Run: `grep -c "activityType:" src/app/api/ -r --include="*.ts"` — count should be significantly higher than before.

**Step 3: Verify no logActivity calls are awaited (fire-and-forget)**

Run: `grep -rn "await.*logActivity\|await.*getActivityService" src/ --include="*.ts"` — should return zero results.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```

---

## Execution Notes

- **Tasks 2-7 are all independent** — they touch different files and can be dispatched in parallel (or at least in rapid sequence)
- **Task 1 must go first** — it registers the types that Tasks 2-7 reference
- **Task 8 is final verification** — depends on all others
- All logging is fire-and-forget — errors in logging never block the main operation
- The `eventRecordId` must be available at each logging point — verify it's in scope
- Import `getActivityService` from `@/lib/services/activityService` at top of each modified file
