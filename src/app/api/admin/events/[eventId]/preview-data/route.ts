import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { hasMinicardForEvent } from '@/lib/utils/minicardAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/preview-data
 * Returns teacher info and 1-2 representative parents for the "View Event As" modal.
 *
 * Parents returned:
 * - 1 "any" parent (first registered parent found)
 * - 1 "buyer" parent (first parent with minicard/audio purchase, if any)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { eventId } = await params;
    const airtableService = getAirtableService();

    // 1. Resolve event — same pattern as /api/admin/events/[eventId] route
    //    Supports event_id, legacy_booking_id, and SimplyBook ID formats
    let eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);

    if (!eventRecordId) {
      // Fallback: resolve via SimplyBook booking link
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const linkedEvent = await airtableService.getEventBySchoolBookingId(booking.id);
        if (linkedEvent) {
          eventRecordId = linkedEvent.id;
        }
      }
    }

    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = await airtableService.getEventById(eventRecordId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event record not found' },
        { status: 404 }
      );
    }

    // 2. Build teacher info from linked booking
    let teacherName = '';
    let teacherEmail = '';

    if (event.simplybook_booking?.[0]) {
      const booking = await airtableService.getSchoolBookingById(event.simplybook_booking[0]);
      if (booking) {
        teacherName = booking.schoolContactName || '';
        teacherEmail = booking.schoolContactEmail || '';
      }
    }

    // 3. Get registrations for this event
    const registrations = await airtableService.getRegistrationsByEventId(eventRecordId);

    // 4. Collect unique parent IDs from registrations
    const parentIdToRegistration = new Map<string, typeof registrations[0]>();
    for (const reg of registrations) {
      const pid = reg.parent_id?.[0];
      if (pid && !parentIdToRegistration.has(pid)) {
        parentIdToRegistration.set(pid, reg);
      }
    }

    const uniqueParentIds = [...parentIdToRegistration.keys()];
    if (uniqueParentIds.length === 0) {
      return NextResponse.json({
        success: true,
        teacher: { name: teacherName, email: teacherEmail },
        previewParent: null,
        buyerParent: null,
      });
    }

    // 5. Fetch parent details for all unique parents
    const parents = await airtableService.getParentsByIds(uniqueParentIds);
    const parentMap = new Map(parents.map(p => [p.id, p]));

    // Helper to build a parent preview object
    const buildParentPreview = (parentRecordId: string, hasAudio: boolean) => {
      const parent = parentMap.get(parentRecordId);
      const reg = parentIdToRegistration.get(parentRecordId);
      return {
        parentId: parentRecordId,
        parentName: parent?.parent_first_name || '',
        parentEmail: parent?.parent_email || '',
        childName: reg?.registered_child || '',
        hasAudioAccess: hasAudio,
      };
    };

    // 6. Pick the first parent as the "any" preview parent
    const firstParentId = uniqueParentIds[0];
    let previewParent: ReturnType<typeof buildParentPreview> | null = buildParentPreview(firstParentId, false);

    // 7. Find a buyer parent (check one at a time, stop at first hit)
    let buyerParent = null;
    for (const parentRecordId of uniqueParentIds) {
      try {
        const hasPurchased = await hasMinicardForEvent(parentRecordId, eventId);
        if (hasPurchased) {
          buyerParent = buildParentPreview(parentRecordId, true);
          // If the buyer is the same as the preview parent, update it and pick a different non-buyer
          if (parentRecordId === firstParentId) {
            previewParent = buyerParent;
            // Try to find a different non-buyer parent
            const otherParentId = uniqueParentIds.find(id => id !== parentRecordId);
            if (otherParentId) {
              previewParent = buildParentPreview(otherParentId, false);
            } else {
              // Only one parent exists — they're both the buyer and the preview
              previewParent = null;
            }
          }
          break;
        }
      } catch {
        // Skip this parent and try next
      }
    }

    return NextResponse.json({
      success: true,
      teacher: { name: teacherName, email: teacherEmail },
      previewParent,
      buyerParent,
    });
  } catch (error) {
    console.error('Error fetching preview data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch preview data',
      },
      { status: 500 }
    );
  }
}
