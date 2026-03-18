import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { hasMinicardForEvent } from '@/lib/utils/minicardAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/preview-data
 * Returns teacher info, classes with parents, and audio access status
 * for the "View Event As" admin modal.
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

    // 1. Fetch event by event_id
    const event = await airtableService.getEventByEventId(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
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

    // 3. Get classes and registrations using the Airtable record ID
    const [classes, registrations] = await Promise.all([
      airtableService.getClassesByEventId(event.id),
      airtableService.getRegistrationsByEventId(event.id),
    ]);

    // 4. Collect all unique parent record IDs from registrations
    const allParentIds = new Set<string>();
    for (const reg of registrations) {
      if (reg.parent_id?.[0]) {
        allParentIds.add(reg.parent_id[0]);
      }
    }

    // 5. Batch-fetch parent details
    const parents = await airtableService.getParentsByIds([...allParentIds]);
    const parentMap = new Map(parents.map(p => [p.id, p]));

    // 6. Batch-check minicard access for all parents
    const accessChecks = await Promise.all(
      [...allParentIds].map(async (parentRecordId) => {
        try {
          const hasAccess = await hasMinicardForEvent(parentRecordId, eventId);
          return [parentRecordId, hasAccess] as const;
        } catch {
          return [parentRecordId, false] as const;
        }
      })
    );
    const accessMap = new Map(accessChecks);

    // 7. Build class data with parents
    const classData = classes.map((cls) => {
      // Find registrations for this class
      const classRegistrations = registrations.filter(
        (reg) => reg.class_id?.[0] === cls.id
      );

      const classParents = classRegistrations
        .filter((reg) => reg.parent_id?.[0])
        .map((reg) => {
          const parentRecordId = reg.parent_id[0];
          const parent = parentMap.get(parentRecordId);
          return {
            parentId: parent?.parent_id || parentRecordId,
            parentName: parent?.parent_first_name || '',
            parentEmail: parent?.parent_email || '',
            childName: reg.registered_child || '',
            hasAudioAccess: accessMap.get(parentRecordId) || false,
          };
        });

      return {
        classId: cls.class_id,
        className: cls.class_name,
        childCount: cls.total_children,
        parents: classParents,
      };
    });

    return NextResponse.json({
      success: true,
      teacher: {
        name: teacherName,
        email: teacherEmail,
      },
      classes: classData,
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
