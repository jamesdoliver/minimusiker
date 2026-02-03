import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getAirtableService } from '@/lib/services/airtableService';
import { ApiResponse, ParentSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PARENT_JWT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';

/**
 * Helper to verify parent session from request
 */
async function verifyParentSession(request: NextRequest): Promise<ParentSession | null> {
  const token = request.cookies.get('parent_session')?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, PARENT_JWT_SECRET) as ParentSession;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * GET /api/parent/registrations
 * Get all children registered for the current event
 */
export async function GET(request: NextRequest) {
  try {
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId') || session.bookingId;

    if (!eventId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const children = await airtableService.getChildrenByParentEmailForEvent(
      session.email,
      eventId
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        children,
        eventId,
      },
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parent/registrations
 * Add a new child registration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { eventId, classId, childName } = await request.json();

    // Validate required fields
    if (!eventId || !classId || !childName) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID, class ID, and child name are required' },
        { status: 400 }
      );
    }

    // Validate child name
    const trimmedName = childName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Child name must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Check for duplicate child name in this event
    const existingChildren = await airtableService.getChildrenByParentEmailForEvent(
      session.email,
      eventId
    );

    const isDuplicate = existingChildren.some(
      child => child.childName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `A child named "${trimmedName}" is already registered for this event`,
          data: { isDuplicate: true },
        },
        { status: 409 }
      );
    }

    // Add the registration
    const result = await airtableService.addChildRegistration(
      session.email,
      eventId,
      classId,
      trimmedName
    );

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error || 'Failed to add child' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        registrationId: result.registrationId,
        childName: trimmedName,
        eventId,
        classId,
      },
      message: `${trimmedName} has been registered successfully`,
    });
  } catch (error) {
    console.error('Error adding registration:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to add registration' },
      { status: 500 }
    );
  }
}
