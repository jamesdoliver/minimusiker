import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up the staff member's Personen record by email
    const staffRecord = await getAirtableService().getStaffByEmail(session.email);

    if (!staffRecord) {
      // Staff member not found in Personen table - return empty list
      return NextResponse.json({
        success: true,
        events: [],
        staff: {
          email: session.email,
          name: session.name,
        },
        message: 'No Personen record found for your email. Please contact an administrator.',
      });
    }

    // Get only events assigned to this staff member
    const assignedEvents = await getAirtableService().getSchoolEventSummariesByStaff(staffRecord.id);

    return NextResponse.json({
      success: true,
      events: assignedEvents,
      staff: {
        email: session.email,
        name: session.name,
        personenId: staffRecord.id,
      },
    });
  } catch (error) {
    console.error('Error fetching staff events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        events: [],
      },
      { status: 500 }
    );
  }
}
