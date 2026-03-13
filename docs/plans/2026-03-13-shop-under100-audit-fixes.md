# Shop Under-100 Kids Merchandise Gate — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs that cause the `is_under_100` flag to be stale or missing, resulting in under-100-kid schools seeing personalized merchandise they shouldn't.

**Architecture:** All fixes are server-side changes to API routes and the Airtable service layer. No frontend changes needed — the parent shop already reads `isStandardMerchOnly` correctly.

**Tech Stack:** Next.js API routes, Airtable SDK, TypeScript

---

### Task 1: Propagate SimplyBook booking changes to linked Events

**Files:**
- Modify: `src/app/api/simplybook/webhook/route.ts:407-432`

The `handleBookingChange` function already looks up the linked Event (line 417) but only inside the `if (mappedData.contactEmail)` block for teacher creation. Move the event lookup before that block and add an `updateEventFields` call to sync `estimated_children` and `is_under_100`.

**Step 1: Restructure handleBookingChange to propagate kid count**

In `src/app/api/simplybook/webhook/route.ts`, replace lines 409-432 (from `console.log('[SimplyBook] Updated booking record:'...` through the end of the teacher block) with:

```typescript
    console.log('[SimplyBook] Updated booking record:', existingRecord.id);

    // Propagate estimated_children + is_under_100 to linked Event
    const airtableService = getAirtableService();
    const linkedEvent = await airtableService.getEventByBookingRecordId(existingRecord.id);
    if (linkedEvent) {
      try {
        await airtableService.updateEventFields(linkedEvent.id, {
          estimated_children: mappedData.numberOfChildren,
          is_under_100: mappedData.numberOfChildren < 100,
        });
        console.log(`[SimplyBook] Synced estimated_children=${mappedData.numberOfChildren} to Event ${linkedEvent.id}`);
      } catch (err) {
        console.error('[SimplyBook] Failed to sync estimated_children to Event:', err);
      }
    }

    // Ensure teacher exists for updated contact email
    if (mappedData.contactEmail) {
      try {
        const teacherService = getTeacherService();
        const teacher = await teacherService.findOrCreateTeacher({
          email: mappedData.contactEmail,
          name: mappedData.contactPerson || mappedData.schoolName,
          schoolName: mappedData.schoolName,
          simplybookBookingId: payload.booking_id,
          schoolAddress: mappedData.address,
          schoolPhone: mappedData.phone,
          regionRecordId: regionRecordId || undefined,
          eventRecordId: linkedEvent?.id,
        });
        console.log(`[SimplyBook] Teacher found/created: ${teacher.email}`);
      } catch (teacherError) {
        console.error('[SimplyBook] Failed to create teacher:', teacherError);
      }
    }
```

Key changes:
- `airtableService` and `linkedEvent` moved out of the `if (mappedData.contactEmail)` block
- New `updateEventFields` call syncs `estimated_children` and `is_under_100`
- Teacher block reuses the already-fetched `linkedEvent`

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `simplybook/webhook/route.ts`

**Step 3: Commit**

```bash
git add src/app/api/simplybook/webhook/route.ts
git commit -m "fix: propagate estimated_children from SimplyBook booking changes to linked Events"
```

---

### Task 2: Pass Einrichtung kid count when creating Schulsong events

**Files:**
- Modify: `src/lib/services/airtableService.ts:7967-8007`

`createEventFromSchulsong` receives `einrichtungId` but passes `undefined` for `estimatedChildren`. Fetch the Einrichtung and use its `numberOfChildren`.

**Step 1: Add Einrichtung lookup before event creation**

In `src/lib/services/airtableService.ts`, replace lines 7992-8007 (from `// Generate event ID` through the `createEventFromBooking` call) with:

```typescript
    // Fetch estimated children from Einrichtung
    let estimatedChildren: number | undefined;
    if (einrichtungId) {
      try {
        const einrichtung = await this.getEinrichtungById(einrichtungId);
        estimatedChildren = einrichtung?.numberOfChildren ?? undefined;
      } catch (err) {
        console.warn('Could not fetch Einrichtung for estimated children:', err);
      }
    }

    // Generate event ID and create Event record
    const eventId = generateEventId(schoolName, 'Schulsong', eventDate);
    const eventRecord = await this.createEventFromBooking(
      eventId,
      bookingRecord.id,
      schoolName,
      eventDate,
      undefined, // no staff
      'Schulsong',
      undefined, // address
      undefined, // phone
      undefined, // status
      estimatedChildren,
      true,      // isSchulsong
      false      // isMinimusikertag
    );
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `airtableService.ts`

**Step 3: Commit**

```bash
git add src/lib/services/airtableService.ts
git commit -m "fix: pass Einrichtung kid count when creating Schulsong events"
```

---

### Task 3: Fix falsy coercion at all call sites

**Files:**
- Modify: `src/app/api/admin/bookings/route.ts:423`
- Modify: `src/app/api/admin/bookings/[id]/route.ts:220`
- Modify: `src/app/api/admin/bookings/[id]/create-event/route.ts:68`
- Modify: `src/app/api/admin/events/[eventId]/route.ts:356`

**Step 1: Replace `||` with `??` at all 4 sites**

In each file, change:
```typescript
booking.estimatedChildren || undefined
```
to:
```typescript
booking.estimatedChildren ?? undefined
```

And in `src/app/api/admin/bookings/route.ts:423`, change:
```typescript
estimatedChildren || undefined
```
to:
```typescript
estimatedChildren ?? undefined
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/route.ts src/app/api/admin/bookings/\[id\]/route.ts src/app/api/admin/bookings/\[id\]/create-event/route.ts src/app/api/admin/events/\[eventId\]/route.ts
git commit -m "fix: use nullish coalescing for estimatedChildren to preserve 0"
```

---

### Task 4: Verify build passes

**Step 1: Run full build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors

**Step 2: Final commit (if any lint/build fixes needed)**

Only if build surfaced issues.
