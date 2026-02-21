# Bookings Expanded View Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the admin bookings expanded row into a 3-column layout (Information | Notes | Activity Log) with working activity logging and manual entry support.

**Architecture:** Modify the existing `BookingDetailsBreakdown` component to use a new 3-column layout. Fix the broken `ActivityService` so it actually writes to Airtable. Embed a slimmed-down `EventActivityTimeline` into the expanded card with an independently scrollable container and manual entry buttons. Add a POST endpoint for manual activity entries. Hook `audio_uploaded` and `email_sent` logging into existing endpoints.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind CSS, Airtable (via `airtable` npm), TypeScript

---

## Task 1: Add New Activity Types to Type System

**Files:**
- Modify: `src/lib/types/airtable.ts:940-979`

**Step 1: Add 4 new types to the EventActivityType union**

In `src/lib/types/airtable.ts`, find the `EventActivityType` union (line 940) and add the 4 new types:

```typescript
export type EventActivityType =
  | 'event_created'
  | 'date_changed'
  | 'staff_assigned'
  | 'staff_unassigned'
  | 'class_added'
  | 'class_updated'
  | 'class_deleted'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'song_added'
  | 'song_updated'
  | 'song_deleted'
  | 'tasks_generated'
  | 'booking_status_changed'
  | 'event_deleted'
  | 'phone_call'
  | 'email_discussion'
  | 'audio_uploaded'
  | 'email_sent';
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors (there may be pre-existing ones, but no errors referencing `EventActivityType`)

**Step 3: Commit**

```bash
git add src/lib/types/airtable.ts
git commit -m "feat: add phone_call, email_discussion, audio_uploaded, email_sent activity types"
```

---

## Task 2: Update ActivityService With New Descriptions

**Files:**
- Modify: `src/lib/services/activityService.ts:123-163`

**Step 1: Add description cases to `generateDescription` static method**

In `activityService.ts`, find `generateDescription` (line 123) and add 4 new cases before the `default`:

```typescript
      case 'phone_call':
        return `Call '${details.schoolName}': ${details.description}`;
      case 'email_discussion':
        return `Email '${details.schoolName}': ${details.description}`;
      case 'audio_uploaded':
        return `Audio uploaded for "${details.songTitle || 'event'}" by ${details.staffName || 'staff'}`;
      case 'email_sent':
        return `${details.emailType || 'Email'} sent to ${details.recipient}`;
```

**Step 2: Add temporary diagnostic logging to `logActivity`**

In the `logActivity` method (line 31), add a `console.log` before the `await` to see what's being sent, and enhance the error catch to log the full error:

Replace the try/catch body (lines 33-54) with:

```typescript
    try {
      const fields: Airtable.FieldSet = {
        [EVENT_ACTIVITY_FIELD_IDS.event_id]: [input.eventRecordId],
        [EVENT_ACTIVITY_FIELD_IDS.activity_type]: input.activityType,
        [EVENT_ACTIVITY_FIELD_IDS.description]: input.description,
        [EVENT_ACTIVITY_FIELD_IDS.actor_email]: input.actorEmail,
        [EVENT_ACTIVITY_FIELD_IDS.actor_type]: input.actorType,
      };

      if (input.metadata) {
        fields[EVENT_ACTIVITY_FIELD_IDS.metadata] = JSON.stringify(input.metadata);
      }

      console.log('[ActivityService] Creating record with fields:', JSON.stringify(fields, null, 2));

      const result = await this.base(EVENT_ACTIVITY_TABLE_ID).create([{ fields }]);

      console.log(
        `[ActivityService] Logged: ${input.activityType} by ${input.actorEmail} (record: ${result[0]?.id})`
      );
    } catch (error) {
      console.error('[ActivityService] Failed to log activity:', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        input: { ...input, metadata: undefined },
        tableId: EVENT_ACTIVITY_TABLE_ID,
      });
    }
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/lib/services/activityService.ts
git commit -m "feat: add new activity type descriptions and diagnostic logging"
```

---

## Task 3: Add POST Endpoint for Manual Activity Entries

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/activity/route.ts`

**Step 1: Add POST handler to the existing activity route**

Add a `POST` export function after the existing `GET`. This reuses the same event ID resolution logic:

```typescript
/**
 * POST /api/admin/events/[eventId]/activity
 * Create a manual activity entry (phone_call or email_discussion)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();

    const { activityType, description } = body;

    // Validate activity type
    if (!activityType || !['phone_call', 'email_discussion'].includes(activityType)) {
      return NextResponse.json(
        { success: false, error: 'activityType must be phone_call or email_discussion' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      );
    }

    // Resolve event record ID (same logic as GET)
    let eventRecordId: string | null = null;
    const airtableService = getAirtableService();

    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        }
      }
    }

    if (!eventRecordId) {
      if (eventId.startsWith('rec')) {
        eventRecordId = eventId;
      } else {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    // Log the manual activity
    const activityService = getActivityService();
    await activityService.logActivity({
      eventRecordId,
      activityType,
      description: description.trim(),
      actorEmail: admin.email,
      actorType: 'admin',
      metadata: { manualEntry: true },
    });

    return NextResponse.json({
      success: true,
      message: `${activityType} entry created`,
    });
  } catch (error) {
    console.error('Error creating manual activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create activity',
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/app/api/admin/events/[eventId]/activity/route.ts
git commit -m "feat: add POST endpoint for manual activity entries (phone_call, email_discussion)"
```

---

## Task 4: Update EventActivityTimeline for Embedded Use

**Files:**
- Modify: `src/components/admin/EventActivityTimeline.tsx`

**Step 1: Rewrite EventActivityTimeline for embedded card use**

The component needs to:
- Remove the outer card wrapper and expand/collapse toggle (it's always visible in the card)
- Add a `schoolName` prop for manual entry descriptions
- Add manual entry UI (+ Call, + Email buttons with inline form)
- Use a fixed-height scrollable container
- Accept an optional `compact` prop to control styling

Replace the entire file content with the new implementation:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventActivity, EventActivityType } from '@/lib/types/airtable';
import { toast } from 'sonner';

interface EventActivityTimelineProps {
  eventId: string;
  schoolName?: string;
  compact?: boolean;
}

const ACTIVITY_CONFIG: Record<
  EventActivityType,
  { icon: string; color: string; bgColor: string }
> = {
  event_created: { icon: '✨', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  date_changed: { icon: '📅', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  staff_assigned: { icon: '👤', color: 'text-green-600', bgColor: 'bg-green-100' },
  staff_unassigned: { icon: '👤', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  class_added: { icon: '📚', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  class_updated: { icon: '📚', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  class_deleted: { icon: '📚', color: 'text-red-600', bgColor: 'bg-red-100' },
  group_created: { icon: '👥', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  group_updated: { icon: '👥', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  group_deleted: { icon: '👥', color: 'text-red-600', bgColor: 'bg-red-100' },
  song_added: { icon: '🎵', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  song_updated: { icon: '🎵', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  song_deleted: { icon: '🎵', color: 'text-red-600', bgColor: 'bg-red-100' },
  tasks_generated: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-100' },
  booking_status_changed: { icon: '📋', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  event_deleted: { icon: '🗑️', color: 'text-red-600', bgColor: 'bg-red-100' },
  phone_call: { icon: '📞', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  email_discussion: { icon: '✉️', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  audio_uploaded: { icon: '🎤', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  email_sent: { icon: '📧', color: 'text-green-600', bgColor: 'bg-green-100' },
};

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatActorName(email: string, actorType: string): string {
  if (actorType === 'system') return 'System';
  if (email.includes('@')) {
    const namePart = email.split('@')[0];
    return namePart
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return email;
}

export default function EventActivityTimeline({ eventId, schoolName, compact }: EventActivityTimelineProps) {
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Manual entry state
  const [manualEntryType, setManualEntryType] = useState<'phone_call' | 'email_discussion' | null>(null);
  const [manualDescription, setManualDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const LIMIT = 20;

  const fetchActivities = useCallback(
    async (currentOffset: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch(
          `/api/admin/events/${encodeURIComponent(eventId)}/activity?limit=${LIMIT}&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('Failed to fetch activities');

        const data = await response.json();

        if (data.success) {
          if (append) {
            setActivities((prev) => [...prev, ...data.data.activities]);
          } else {
            setActivities(data.data.activities);
          }
          setHasMore(data.data.hasMore);
          setOffset(currentOffset + data.data.activities.length);
        } else {
          throw new Error(data.error || 'Failed to fetch activities');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    fetchActivities(0);
  }, [fetchActivities]);

  const handleLoadMore = () => {
    fetchActivities(offset, true);
  };

  const handleSubmitManualEntry = async () => {
    if (!manualEntryType || !manualDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/activity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            activityType: manualEntryType,
            description: schoolName
              ? `${manualEntryType === 'phone_call' ? 'Call' : 'Email'} '${schoolName}': ${manualDescription.trim()}`
              : manualDescription.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create entry');
      }

      toast.success(manualEntryType === 'phone_call' ? 'Call logged' : 'Email logged');
      setManualEntryType(null);
      setManualDescription('');
      // Refresh the timeline
      setOffset(0);
      fetchActivities(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
      {/* Manual entry buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setManualEntryType(manualEntryType === 'phone_call' ? null : 'phone_call')}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            manualEntryType === 'phone_call'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📞 + Call
        </button>
        <button
          onClick={() => setManualEntryType(manualEntryType === 'email_discussion' ? null : 'email_discussion')}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            manualEntryType === 'email_discussion'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✉️ + Email
        </button>
      </div>

      {/* Manual entry form */}
      {manualEntryType && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="text-xs font-medium text-blue-800 block mb-1">
            {manualEntryType === 'phone_call' ? 'Call notes' : 'Email notes'}
          </label>
          <textarea
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            rows={2}
            className="w-full text-xs border border-blue-300 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="What was discussed..."
            autoFocus
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSubmitManualEntry}
              disabled={isSubmitting || !manualDescription.trim()}
              className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setManualEntryType(null); setManualDescription(''); }}
              className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scrollable timeline */}
      <div className={`overflow-y-auto flex-1 ${compact ? 'max-h-[320px]' : 'max-h-[400px]'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-[#5a8a82]"></div>
            <span className="ml-2 text-xs text-gray-500">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-red-600 py-4 text-center">{error}</div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500">
            No activity recorded yet
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity) => {
              const config = ACTIVITY_CONFIG[activity.activityType] || {
                icon: '📝',
                color: 'text-gray-600',
                bgColor: 'bg-gray-100',
              };

              return (
                <div key={activity.id} className="flex gap-2 py-2 border-b border-gray-50 last:border-0">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center text-xs`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 leading-tight">{activity.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500">
                        {formatActorName(activity.actorEmail, activity.actorType)}
                      </span>
                      <span className="text-gray-300 text-[10px]">·</span>
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                      {activity.actorType === 'teacher' && (
                        <span className="text-[10px] bg-teal-100 text-teal-700 px-1 rounded">
                          Teacher
                        </span>
                      )}
                      {activity.actorType === 'system' && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-1.5 text-xs font-medium text-[#5a8a82] hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

**Step 3: Check the event detail page still uses the component**

The existing import in `src/app/admin/events/[eventId]/page.tsx` should still work since the component name and `eventId` prop are unchanged. The `compact` and `schoolName` props are optional.

**Step 4: Commit**

```bash
git add src/components/admin/EventActivityTimeline.tsx
git commit -m "feat: update EventActivityTimeline for embedded use with manual entry support"
```

---

## Task 5: Rewrite BookingDetailsBreakdown With New 3-Column Layout

**Files:**
- Modify: `src/components/admin/bookings/BookingDetailsBreakdown.tsx`

This is the largest task. The component is rewritten to the new layout:
- Column 1: Information (consolidated field list + Copy QR Link)
- Column 2: Notes (tall auto-save textarea)
- Column 3: Activity Log (embedded EventActivityTimeline)
- Below: Audio Setup (unchanged)
- Below: Compact action buttons

**Step 1: Rewrite the component**

Replace the entire file with the new layout. Key changes:
- Remove `QRCode` import and all QR generation code (`qrDataUrl`, `useEffect` for QR, `handleDownloadQr`)
- Remove Lead History section entirely
- Import `EventActivityTimeline`
- Consolidate contact info + location + booking details into one Information column
- Move notes to its own column with full height
- Embed EventActivityTimeline in the right column
- Make action buttons smaller

The full replacement content for `BookingDetailsBreakdown.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import ConfirmPrintablesModal from './ConfirmPrintablesModal';
import RefreshBookingModal from './RefreshBookingModal';
import OrderOverviewModal from './OrderOverviewModal';
import EditBookingModal from './EditBookingModal';
import DeleteConfirmModal from '@/components/shared/class-management/DeleteConfirmModal';
import StatusLight from './StatusLight';
import AudioReviewModal from './AudioReviewModal';
import EventActivityTimeline from '@/components/admin/EventActivityTimeline';
import { AudioStatusData } from '@/lib/types/audio-status';
import { toast } from 'sonner';

interface BookingDetailsBreakdownProps {
  booking: BookingWithDetails;
  onEventDeleted?: (bookingId: string) => void;
}

export default function BookingDetailsBreakdown({ booking, onEventDeleted }: BookingDetailsBreakdownProps) {
  const [showPrintablesModal, setShowPrintablesModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [discountCopied, setDiscountCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshData, setRefreshData] = useState<{
    updates: Array<{ field: string; label: string; current: string; new: string }>;
    stillMissing: Array<{ field: string; label: string }>;
    hasUpdates: boolean;
  } | null>(null);
  const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatusData | null>(null);
  const [audioStatusLoading, setAudioStatusLoading] = useState(false);
  const [showAudioReviewModal, setShowAudioReviewModal] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  // Admin notes state
  const [notesText, setNotesText] = useState(booking.adminNotes || '');
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setNotesText(booking.adminNotes || '');
  }, [booking.adminNotes]);

  const handleNotesChange = useCallback((value: string) => {
    setNotesText(value);
    setNotesSaveStatus('idle');

    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    notesTimerRef.current = setTimeout(async () => {
      setNotesSaveStatus('saving');
      try {
        const res = await fetch(`/api/admin/events/${encodeURIComponent(booking.code)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_notes: value }),
        });
        if (res.ok) {
          setNotesSaveStatus('saved');
        } else {
          setNotesSaveStatus('idle');
          toast.error('Failed to save notes');
        }
      } catch {
        setNotesSaveStatus('idle');
        toast.error('Failed to save notes');
      }
    }, 1000);
  }, [booking.code]);

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
      }
    };
  }, []);

  // Fetch audio status on mount
  useEffect(() => {
    const fetchAudioStatus = async () => {
      setAudioStatusLoading(true);
      try {
        const response = await fetch(`/api/admin/events/${encodeURIComponent(booking.code)}/audio-status`);
        if (response.ok) {
          const data = await response.json();
          setAudioStatus(data.data);
        }
      } catch (error) {
        console.error('Error fetching audio status:', error);
      } finally {
        setAudioStatusLoading(false);
      }
    };
    fetchAudioStatus();
  }, [booking.code]);

  const handleToggleAudioVisibility = async () => {
    if (!audioStatus || isTogglingVisibility) return;
    const newHidden = !audioStatus.audioHidden;
    setIsTogglingVisibility(true);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(booking.code)}/toggle-audio-visibility`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: newHidden }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle');
      }
      setAudioStatus(prev => prev ? { ...prev, audioHidden: newHidden } : null);
      toast.success(newHidden ? 'Audio für Eltern ausgeblendet' : 'Audio für Eltern sichtbar');
    } catch (error) {
      console.error('Error toggling audio visibility:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle audio visibility');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleCopyLink = () => {
    if (!booking.shortUrl) return;
    navigator.clipboard.writeText(`https://${booking.shortUrl}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyDiscount = () => {
    if (!booking.discountCode) return;
    navigator.clipboard.writeText(booking.discountCode);
    setDiscountCopied(true);
    setTimeout(() => setDiscountCopied(false), 2000);
  };

  const handleRefresh = async (forceRefreshOverride?: boolean) => {
    const useForceRefresh = forceRefreshOverride ?? forceRefresh;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=true&forceRefresh=${useForceRefresh}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to fetch data: ${errorData.error || response.statusText}`);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setRefreshData({
          updates: data.updates,
          stillMissing: data.stillMissing,
          hasUpdates: data.hasUpdates,
        });
        setShowRefreshModal(true);
      } else {
        alert(`Failed to fetch data: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect to SimplyBook');
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyRefresh = async () => {
    setIsApplyingRefresh(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=false&forceRefresh=${forceRefresh}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to apply updates: ${errorData.error || response.statusText}`);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setShowRefreshModal(false);
        setRefreshData(null);
        window.location.reload();
      } else {
        alert(`Failed to apply updates: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to apply updates');
      console.error('Apply refresh error:', error);
    } finally {
      setIsApplyingRefresh(false);
    }
  };

  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/events/${booking.code}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || 'Event deleted successfully');
        setIsDeleteModalOpen(false);
        onEventDeleted?.(booking.id);
      } else {
        toast.error(data.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Delete event error:', error);
      toast.error('Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
      {/* === Three-Column Layout === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Information</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2.5">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Contact Person</label>
              <p className="text-sm font-medium text-gray-900">{booking.contactPerson || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
              <p className="text-sm text-gray-900">
                {booking.contactEmail ? (
                  <a href={`mailto:${booking.contactEmail}`} className="text-blue-600 hover:underline">{booking.contactEmail}</a>
                ) : '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Phone</label>
              <p className="text-sm text-gray-900">
                {booking.phone ? (
                  <a href={`tel:${booking.phone}`} className="text-blue-600 hover:underline">{booking.phone}</a>
                ) : '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Address</label>
              <p className="text-sm text-gray-900">
                {[booking.address, [booking.postalCode, booking.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Region & Team</label>
              <p className="text-sm text-gray-900">
                {[booking.region, booking.assignedStaffNames?.join(', ')].filter(Boolean).join(' — ') || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Booking Code</label>
              <p className="text-sm font-mono text-gray-900">{booking.code}</p>
            </div>
            {booking.discountCode && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Discount Code</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-900">{booking.discountCode}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyDiscount(); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy discount code"
                  >
                    {discountCopied ? (
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Time</label>
              <p className="text-sm text-gray-900">
                {booking.startTime && booking.endTime
                  ? `${booking.startTime} - ${booking.endTime}`
                  : booking.startTime || '-'}
              </p>
            </div>
            {booking.shortUrl && (
              <div className="pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors w-full justify-center"
                >
                  {linkCopied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Copy QR Link
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Notes */}
        <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Notes</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col">
            <textarea
              value={notesText}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="flex-1 w-full text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[280px]"
              placeholder="Add notes about this booking..."
            />
            {notesSaveStatus !== 'idle' && (
              <p className={`text-xs mt-1 ${notesSaveStatus === 'saving' ? 'text-gray-400' : 'text-green-600'}`}>
                {notesSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
              </p>
            )}
          </div>
        </div>

        {/* Column 3: Activity Log */}
        <div className="flex flex-col">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Activity Log</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1">
            <EventActivityTimeline
              eventId={booking.code}
              schoolName={booking.schoolName}
              compact
            />
          </div>
        </div>
      </div>

      {/* === Audio Status Section === */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Audio Status</h4>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {audioStatusLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading audio status...</span>
            </div>
          ) : audioStatus ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <StatusLight label="Staff Upload" isComplete={audioStatus.staffUploadComplete} />
                <StatusLight label="Mix Master" isComplete={audioStatus.mixMasterUploadComplete} />
                <button
                  onClick={handleToggleAudioVisibility}
                  disabled={isTogglingVisibility}
                  className="flex items-center gap-2 group"
                  title={audioStatus.audioHidden ? 'Audio ist ausgeblendet – klicken zum Einblenden' : 'Audio ist sichtbar – klicken zum Ausblenden'}
                >
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${isTogglingVisibility ? 'opacity-50' : ''} ${audioStatus.audioHidden ? 'bg-gray-300' : 'bg-green-500'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${audioStatus.audioHidden ? '' : 'translate-x-4'}`} />
                  </div>
                  <span className={`text-xs font-medium ${audioStatus.audioHidden ? 'text-red-600' : 'text-green-700'}`}>
                    {audioStatus.audioHidden ? 'Ausgeblendet' : 'Sichtbar'}
                  </span>
                </button>
              </div>
              <button
                onClick={() => setShowAudioReviewModal(true)}
                disabled={!audioStatus || audioStatus.mixMasterUploadedCount === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  audioStatus && audioStatus.mixMasterUploadedCount > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                View Audio
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Unable to load audio status</p>
          )}
        </div>
      </div>

      {/* === Compact Action Buttons === */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
        <div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
          <button
            onClick={() => setShowPrintablesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#F4A261] text-white rounded-md hover:bg-[#E07B3A] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Printables
          </button>
          <button
            onClick={() => setShowOrdersModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Orders
          </button>
          <Link
            href={`/admin/events/${booking.code}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#94B8B3] text-white rounded-md hover:bg-[#7da39e] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Event
          </Link>
        </div>
      </div>

      {/* === Modals (unchanged) === */}
      {isDeleteModalOpen && (
        <DeleteConfirmModal
          title="Delete Event"
          message={`Are you sure you want to delete the event for "${booking.schoolName}" on ${booking.bookingDate}? (Access code: ${booking.code}) This will mark the event and booking as deleted.`}
          onConfirm={handleDeleteEvent}
          onCancel={() => setIsDeleteModalOpen(false)}
          isDeleting={isDeleting}
        />
      )}
      <ConfirmPrintablesModal
        isOpen={showPrintablesModal}
        onClose={() => setShowPrintablesModal(false)}
        booking={booking}
      />
      {refreshData && (
        <RefreshBookingModal
          isOpen={showRefreshModal}
          onClose={() => {
            setShowRefreshModal(false);
            setRefreshData(null);
            setForceRefresh(false);
          }}
          onApply={handleApplyRefresh}
          isApplying={isApplyingRefresh}
          updates={refreshData.updates}
          stillMissing={refreshData.stillMissing}
          hasUpdates={refreshData.hasUpdates}
          forceRefresh={forceRefresh}
          onForceRefreshChange={(value) => {
            setForceRefresh(value);
            handleRefresh(value);
          }}
        />
      )}
      <OrderOverviewModal
        isOpen={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        eventId={booking.code}
        schoolName={booking.schoolName}
        eventDate={booking.bookingDate}
      />
      <EditBookingModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        booking={booking}
        onSuccess={() => window.location.reload()}
      />
      <AudioReviewModal
        isOpen={showAudioReviewModal}
        onClose={() => setShowAudioReviewModal(false)}
        eventId={booking.code}
        schoolName={booking.schoolName}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

**Step 3: Run existing tests**

Run: `npx jest --passWithNoTests`
Expected: All 106 tests pass (no regressions)

**Step 4: Commit**

```bash
git add src/components/admin/bookings/BookingDetailsBreakdown.tsx
git commit -m "feat: rewrite BookingDetailsBreakdown with 3-column layout (Information, Notes, Activity Log)"
```

---

## Task 6: Diagnose and Fix Activity Logging Bug

**Files:**
- Modify: `src/lib/services/activityService.ts` (if needed)
- Modify: `src/lib/types/airtable.ts` (if field IDs are wrong)

This task requires running the dev server and triggering a log to read the diagnostic output from Task 2.

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Trigger an activity log write**

In a browser, open the admin panel, go to an event, and make a change that triggers logging (e.g., edit a class, change the date). Check the server console for the `[ActivityService]` log messages added in Task 2.

**Step 3: Diagnose the failure**

Read the error output. Common issues:
- **"INVALID_VALUE_FOR_COLUMN"**: The `activity_type` value doesn't match any option in the Airtable single-select. Fix: Add missing options in Airtable manually, or check for typos.
- **"INVALID_MULTIPLE_CHOICE_OPTIONS"**: Same as above for `actor_type`.
- **"INVALID_REQUEST_UNKNOWN"** on linked record: The `event_id` field expects `[recordId]` array format. Verify `eventRecordId` starts with `rec`.
- **No error logged at all**: The `logActivity` call may not be reached. Check the calling code.
- **Field ID mismatch**: Compare `EVENT_ACTIVITY_FIELD_IDS` with the actual Airtable table schema.

**Step 4: Apply the fix**

Based on the diagnosis, fix the issue (likely field ID mismatch or single-select option missing from Airtable).

**Step 5: Verify the fix**

Trigger another activity log write and confirm the record appears in Airtable.

**Step 6: Remove verbose diagnostic logging**

Remove the `console.log` for fields added in Task 2, keeping only the success and error logs.

**Step 7: Commit**

```bash
git add -A
git commit -m "fix: resolve activity logging not writing to Airtable"
```

---

## Task 7: Hook audio_uploaded Logging Into Upload Endpoints

**Files:**
- Modify: `src/app/api/staff/events/[eventId]/songs/[songId]/upload-raw/route.ts` (around line 145)

**Step 1: Add activity logging import**

Add at the top of the file:

```typescript
import { getActivityService } from '@/lib/services/activityService';
```

**Step 2: Add logging after successful upload confirmation**

After the successful AudioFile creation (line 142) and before the pipeline stage update (line 148), add:

```typescript
    // Log activity (fire-and-forget)
    getActivityService().logActivity({
      eventRecordId: song.classId ? eventId : eventId, // resolve to event record ID
      activityType: 'audio_uploaded',
      description: `Audio uploaded for "${song.title || filename}" by staff`,
      actorEmail: session.email || session.staffId,
      actorType: 'teacher',
      metadata: { songId, filename, type: 'raw' },
    });
```

Note: The `eventId` here is already the event identifier. The activity route resolves it, but `logActivity` needs the Airtable record ID. We may need to resolve it first. Check what format `eventId` is in this route — if it's the event_id code (like "MMT-123"), we need to look up the record ID. Add a lookup if needed:

```typescript
    // Resolve event record ID for activity logging
    const airtableService = getAirtableService();
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventRecordId) {
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'audio_uploaded',
        description: `Audio uploaded for "${song.title || filename}" by staff`,
        actorEmail: session.email || session.staffId,
        actorType: 'teacher',
        metadata: { songId, filename, type: 'raw' },
      });
    }
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**

```bash
git add src/app/api/staff/events/[eventId]/songs/[songId]/upload-raw/route.ts
git commit -m "feat: log audio_uploaded activity on staff raw audio upload"
```

---

## Task 8: Hook email_sent Logging Into Email Service

**Files:**
- Modify: `src/lib/services/resendService.ts` (around line 162)

The `sendTriggerEmail` function (line 115) is the central function for all trigger-based emails. Adding logging here covers all email types.

**Step 1: Add activity logging import**

```typescript
import { getActivityService } from '@/lib/services/activityService';
```

**Step 2: Add logging after successful send in `sendTriggerEmail`**

After the success log (line 162), before the return, add a fire-and-forget activity log. The challenge is we don't have `eventRecordId` in scope — we need to pass it as an optional parameter.

Add an optional `eventRecordId` to the function signature:

```typescript
async function sendTriggerEmail(
  to: string | string[],
  slug: string,
  variables: Record<string, string>,
  logLabel: string,
  options?: { parentEmail?: string; eventRecordId?: string },
): Promise<SendEmailResult> {
```

Then after the success log (line 162):

```typescript
    // Log email_sent activity (fire-and-forget)
    if (options?.eventRecordId) {
      getActivityService().logActivity({
        eventRecordId: options.eventRecordId,
        activityType: 'email_sent',
        description: `${logLabel} sent to ${Array.isArray(to) ? to.join(', ') : to}`,
        actorEmail: 'system@minimusiker.de',
        actorType: 'system',
        metadata: { slug, recipient: Array.isArray(to) ? to.join(', ') : to },
      });
    }
```

**Step 3: Thread eventRecordId through caller functions where available**

For each exported `send*` function that has access to an event/booking context, pass `eventRecordId` through options. This can be done incrementally — start with the ones where event context is readily available and skip the others.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 5: Commit**

```bash
git add src/lib/services/resendService.ts
git commit -m "feat: log email_sent activity for trigger emails with event context"
```

---

## Task 9: Create Lead History Migration Script

**Files:**
- Create: `scripts/migrate-lead-history.ts`

**Step 1: Write the migration script**

```typescript
/**
 * One-time migration: Parse Lead History from admin_notes and create
 * phone_call activity records in the EVENT_ACTIVITY table.
 *
 * Usage: npx tsx scripts/migrate-lead-history.ts [--dry-run]
 */
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';
const EVENT_ACTIVITY_TABLE = 'tbljy6InuG4xMngQg';

// Field IDs from src/lib/types/airtable.ts
const EVENTS_FIELDS = {
  admin_notes: 'fldmM5hxhsYFLPEPv',
  school_name: 'fldiqTGZX08n8GNWY',
};

const ACTIVITY_FIELDS = {
  event_id: 'fldHXdy9XckysZkN5',
  activity_type: 'fldkq8kGUpN1EGMEm',
  description: 'flduPDeYq7N5JAhGm',
  actor_email: 'fld8BkhP9HrERtKdD',
  actor_type: 'flduzSRoFPcJZrjM8',
  metadata: 'fldkpYFQYLiv281jX',
};

interface ParsedCall {
  callNumber: number;
  date: string;
  notes: string;
}

function parseLeadHistory(adminNotes: string): { calls: ParsedCall[]; cleanedNotes: string } {
  const separator = '--- Lead History ---';
  const idx = adminNotes.indexOf(separator);
  if (idx === -1) return { calls: [], cleanedNotes: adminNotes };

  const cleanedNotes = adminNotes.substring(0, idx).trim();
  const historyText = adminNotes.substring(idx + separator.length).trim();

  const calls: ParsedCall[] = [];
  const blocks = historyText.split(/\n\n/).filter(Boolean);

  for (const block of blocks) {
    const match = block.match(/^\[Call (\d+) - (.+)\]\n([\s\S]*)$/);
    if (match) {
      calls.push({
        callNumber: parseInt(match[1]),
        date: match[2],
        notes: match[3].trim(),
      });
    }
  }

  return { calls, cleanedNotes };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  // Fetch all events with admin_notes containing Lead History
  const records = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `FIND("--- Lead History ---", {admin_notes})`,
      fields: ['admin_notes', 'school_name'],
    })
    .all();

  console.log(`Found ${records.length} events with Lead History`);

  let migratedCalls = 0;
  let errors = 0;

  for (const record of records) {
    const adminNotes = record.get('admin_notes') as string;
    const schoolName = record.get('school_name') as string || 'Unknown School';

    if (!adminNotes) continue;

    const { calls, cleanedNotes } = parseLeadHistory(adminNotes);

    if (calls.length === 0) {
      console.log(`  [SKIP] ${record.id} (${schoolName}) - no parseable calls`);
      continue;
    }

    console.log(`  [PROCESS] ${record.id} (${schoolName}) - ${calls.length} calls`);

    for (const call of calls) {
      const description = `Call '${schoolName}': ${call.notes}`;

      if (dryRun) {
        console.log(`    [DRY] Would create: ${description.substring(0, 80)}...`);
        migratedCalls++;
        continue;
      }

      try {
        await base(EVENT_ACTIVITY_TABLE).create([{
          fields: {
            [ACTIVITY_FIELDS.event_id]: [record.id],
            [ACTIVITY_FIELDS.activity_type]: 'phone_call',
            [ACTIVITY_FIELDS.description]: description,
            [ACTIVITY_FIELDS.actor_email]: 'migrated@minimusiker.de',
            [ACTIVITY_FIELDS.actor_type]: 'admin',
            [ACTIVITY_FIELDS.metadata]: JSON.stringify({
              migrated: true,
              originalCallNumber: call.callNumber,
              originalDate: call.date,
            }),
          },
        }]);
        migratedCalls++;
      } catch (err) {
        console.error(`    [ERROR] Failed to create activity for call ${call.callNumber}:`, err);
        errors++;
      }
    }

    // Clean the admin_notes field
    if (!dryRun) {
      try {
        await base(EVENTS_TABLE).update(record.id, {
          [EVENTS_FIELDS.admin_notes]: cleanedNotes,
        });
        console.log(`    [CLEANED] admin_notes for ${schoolName}`);
      } catch (err) {
        console.error(`    [ERROR] Failed to clean admin_notes:`, err);
        errors++;
      }
    } else {
      console.log(`    [DRY] Would clean admin_notes, keeping: "${cleanedNotes.substring(0, 50)}..."`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Events processed: ${records.length}`);
  console.log(`Calls migrated: ${migratedCalls}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('(Dry run - no changes made)');
}

main().catch(console.error);
```

**Step 2: Test with dry run**

Run: `npx tsx scripts/migrate-lead-history.ts --dry-run`
Expected: Lists events and calls that would be migrated, no Airtable changes.

**Step 3: Run live migration (after verifying dry run looks correct)**

Run: `npx tsx scripts/migrate-lead-history.ts`
Expected: Creates activity records and cleans admin_notes.

**Step 4: Commit**

```bash
git add scripts/migrate-lead-history.ts
git commit -m "feat: add Lead History migration script to activity log"
```

---

## Task 10: Final Verification and Cleanup

**Step 1: Run all tests**

Run: `npx jest --passWithNoTests`
Expected: All tests pass.

**Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Start dev server and manually test**

Run: `npm run dev`

Verify:
- [ ] Expanded booking row shows 3-column layout (Information | Notes | Activity Log)
- [ ] Information column displays all fields correctly
- [ ] Copy QR Link button works
- [ ] Discount code copy button works
- [ ] Notes textarea auto-saves with "Saving..."/"Saved" indicator
- [ ] Activity Log shows timeline entries (if activity logging bug is fixed)
- [ ] "+ Call" button opens inline form, saves entry, refreshes timeline
- [ ] "+ Email" button opens inline form, saves entry, refreshes timeline
- [ ] Activity Log scrolls independently
- [ ] Audio Status section displays correctly below columns
- [ ] Action buttons are compact and all functional
- [ ] No QR code image displayed
- [ ] No Lead History section displayed

**Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final cleanup for bookings expanded view rework"
```
