import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);

    // Fetch event detail and songs in parallel — getSongsByEventId has its own
    // ID resolution logic, so it can accept the raw eventId directly.
    // Songs fetch is wrapped in .catch() to preserve error isolation:
    // a songs failure should not prevent showing the event detail.
    const [eventDetail, allSongs, groups] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      getTeacherService().getSongsByEventId(eventId).catch((err) => {
        console.error('Error fetching songs for staff event detail:', err);
        return [];
      }),
      getTeacherService().getGroupsByEventId(eventId).catch((err) => {
        console.error('Error fetching groups for staff event detail:', err);
        return [];
      }),
    ]);

    if (!eventDetail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event not found',
        },
        { status: 404 }
      );
    }

    // TODO: Once staff assignment is implemented, verify that this staff member
    // is assigned to this event before returning details

    // Attach songs to classes
    for (const cls of eventDetail.classes) {
      cls.songs = allSongs
        .filter(s => s.classId === cls.classId)
        .map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          publicNotes: s.publicNotes,
          order: s.order,
          hiddenByEngineer: s.hiddenByEngineer,
        }));
    }

    // Build simplified groups with songs attached
    const groupsWithSongs = groups.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      memberClasses: (group.memberClasses || []).map(c => ({
        classId: c.classId,
        className: c.className,
      })),
      songs: allSongs
        .filter(s => s.classId === group.groupId)
        .map(s => ({ id: s.id, title: s.title, artist: s.artist, publicNotes: s.publicNotes, order: s.order })),
    }));

    // Resolve linked SchoolBooking and attach contact info for the staff UI.
    // Wrapped in try/catch so a lookup failure here can never break the event detail response.
    const airtableService = getAirtableService();
    let bookingInfo: {
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      postalCode?: string;
      city?: string;
    } | undefined;

    try {
      // Try resolving the Event record by event_id first; fall back to SimplyBook lookup.
      let resolvedEventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
      if (!resolvedEventRecordId && /^\d+$/.test(eventId)) {
        const bookingFromSb = await airtableService.getSchoolBookingBySimplybookId(eventId);
        if (bookingFromSb) {
          const linkedEvent = await airtableService.getEventBySchoolBookingId(bookingFromSb.id);
          if (linkedEvent) {
            resolvedEventRecordId = linkedEvent.id;
          }
        }
      }

      if (resolvedEventRecordId) {
        const eventRecord = await airtableService.getEventById(resolvedEventRecordId);
        const linkedBookingId = eventRecord?.simplybook_booking?.[0];
        if (linkedBookingId) {
          const booking = await airtableService.getSchoolBookingById(linkedBookingId);
          if (booking) {
            bookingInfo = {
              contactPerson: booking.schoolContactName,
              contactEmail: booking.schoolContactEmail,
              contactPhone: booking.schoolPhone,
              address: booking.schoolAddress,
              postalCode: booking.schoolPostalCode,
              city: booking.city,
            };
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch bookingInfo for staff event detail:', err);
    }

    return NextResponse.json({
      success: true,
      data: { ...eventDetail, groups: groupsWithSongs, bookingInfo },
    });
  } catch (error) {
    console.error('Error fetching staff event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}
