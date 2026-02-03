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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/parent/registrations/[id]
 * Update a child registration
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { childName, classId } = await request.json();

    // Validate at least one field to update
    if (!childName && !classId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'At least one field (childName or classId) required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Verify this registration belongs to the authenticated parent
    const registration = await airtableService.getRegistrationById(id);
    if (!registration) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.parentEmail.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authorized to update this registration' },
        { status: 403 }
      );
    }

    // Validate child name if provided
    const updates: { childName?: string; classId?: string } = {};
    if (childName) {
      const trimmedName = childName.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Child name must be between 2 and 100 characters' },
          { status: 400 }
        );
      }
      updates.childName = trimmedName;
    }

    if (classId) {
      updates.classId = classId;
    }

    // Perform update
    const result = await airtableService.updateChildRegistration(id, updates);

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error || 'Failed to update registration' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { registrationId: id, ...updates },
      message: 'Registration updated successfully',
    });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update registration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parent/registrations/[id]
 * Remove a child registration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const airtableService = getAirtableService();

    // Verify this registration belongs to the authenticated parent
    const registration = await airtableService.getRegistrationById(id);
    if (!registration) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.parentEmail.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authorized to delete this registration' },
        { status: 403 }
      );
    }

    // Check if this is the last child - prevent deletion
    const allChildren = await airtableService.getChildrenByParentEmailForEvent(
      session.email,
      registration.eventId
    );

    if (allChildren.length <= 1) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Cannot remove the last child. At least one child must remain registered.',
        },
        { status: 400 }
      );
    }

    // Perform deletion
    const result = await airtableService.deleteChildRegistration(id);

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error || 'Failed to delete registration' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `${registration.childName} has been removed from the registration`,
    });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete registration' },
      { status: 500 }
    );
  }
}
