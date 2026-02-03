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
 * GET /api/parent/profile
 * Get current parent profile
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

    const airtableService = getAirtableService();
    const { parent } = await airtableService.getParentWithChildren(session.email);

    if (!parent) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Parent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        email: parent.parent_email,
        firstName: parent.parent_first_name,
        phone: parent.parent_telephone,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/parent/profile
 * Update parent profile (firstName, phone)
 * Note: Email cannot be changed
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { firstName, phone } = await request.json();

    // Validate at least one field to update
    if (!firstName && phone === undefined) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'At least one field (firstName or phone) required' },
        { status: 400 }
      );
    }

    const updates: { firstName?: string; phone?: string } = {};

    // Validate firstName if provided
    if (firstName !== undefined) {
      const trimmedName = firstName.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'First name must be between 1 and 100 characters' },
          { status: 400 }
        );
      }
      updates.firstName = trimmedName;
    }

    // Validate phone if provided (allow empty string to clear)
    if (phone !== undefined) {
      const trimmedPhone = phone.trim();
      // Basic phone validation - allow empty or reasonable phone format
      if (trimmedPhone && !/^[\d\s+\-()]{6,20}$/.test(trimmedPhone)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Please enter a valid phone number' },
          { status: 400 }
        );
      }
      updates.phone = trimmedPhone;
    }

    const airtableService = getAirtableService();
    const result = await airtableService.updateParentProfile(session.email, updates);

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error || 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        email: session.email,
        ...updates,
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
