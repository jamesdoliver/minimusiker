import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

/**
 * POST /api/admin/events/[eventId]/assign-engineer
 * Assign an engineer to an event
 *
 * Request body: { engineerId: string | null }
 * Response: { success: boolean, updatedRecords: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Note: In production, add admin authentication check here
    // const session = verifyAdminSession(request);
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const eventId = decodeURIComponent(params.eventId);
    const { engineerId } = await request.json();

    // Validate engineerId is string or null
    if (engineerId !== null && typeof engineerId !== 'string') {
      return NextResponse.json(
        { error: 'engineerId must be a string or null' },
        { status: 400 }
      );
    }

    // Verify event exists
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // If engineerId provided, verify the engineer exists and has Engineer role
    if (engineerId) {
      const hasRole = await airtableService.hasEngineerRole(engineerId);
      if (!hasRole) {
        return NextResponse.json(
          { error: 'Selected person does not have Engineer role' },
          { status: 400 }
        );
      }
    }

    // Assign engineer to event
    const updatedRecords = await airtableService.assignEngineerToEvent(
      eventId,
      engineerId
    );

    // Get engineer name for response
    let engineerName: string | undefined;
    if (engineerId) {
      const engineers = await airtableService.getEngineerStaff();
      const engineer = engineers.find((e) => e.id === engineerId);
      engineerName = engineer?.name;
    }

    return NextResponse.json({
      success: true,
      updatedRecords,
      assignedEngineer: engineerId
        ? {
            id: engineerId,
            name: engineerName,
          }
        : null,
    });
  } catch (error) {
    console.error('Error assigning engineer:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign engineer',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/events/[eventId]/assign-engineer
 * Get currently assigned engineer for an event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const eventId = decodeURIComponent(params.eventId);

    // Get event detail which includes assigned engineer info
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Note: We need to add assigned_engineer info to SchoolEventDetail
    // For now, we'll query directly
    // TODO: Update getSchoolEventDetail to include assigned_engineer

    return NextResponse.json({
      success: true,
      eventId,
      // assignedEngineer will be added when we update the data model
      assignedEngineer: null,
    });
  } catch (error) {
    console.error('Error getting assigned engineer:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assigned engineer',
      },
      { status: 500 }
    );
  }
}
