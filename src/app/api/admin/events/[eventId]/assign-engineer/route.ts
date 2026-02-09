import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

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
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // If engineerId provided, verify the engineer exists and has Engineer role
    if (engineerId) {
      const hasRole = await getAirtableService().hasEngineerRole(engineerId);
      if (!hasRole) {
        return NextResponse.json(
          { error: 'Selected person does not have Engineer role' },
          { status: 400 }
        );
      }
    }

    // Assign engineer to event
    const updatedRecords = await getAirtableService().assignEngineerToEvent(
      eventId,
      engineerId
    );

    // Get engineer name for response
    let engineerName: string | undefined;
    if (engineerId) {
      const engineers = await getAirtableService().getEngineerStaff();
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
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);

    // Get event from Events table (includes assigned_engineer)
    const event = await getAirtableService().getEventByEventId(eventId);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // If there's an assigned engineer, get their details
    let assignedEngineer: { id: string; name: string } | null = null;
    if (event.assigned_engineer && event.assigned_engineer.length > 0) {
      const engineerId = event.assigned_engineer[0];
      const engineers = await getAirtableService().getEngineerStaff();
      const engineer = engineers.find((e) => e.id === engineerId);
      if (engineer) {
        assignedEngineer = {
          id: engineerId,
          name: engineer.name,
        };
      }
    }

    return NextResponse.json({
      success: true,
      eventId,
      assignedEngineer,
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
