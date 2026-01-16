import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import {
  updateTeacherSchoolInfo,
  updateSchoolBookingInfo,
  updateSchoolBookingById,
} from '@/lib/services/teacherService';

/**
 * PUT /api/teacher/school/info
 * Update school contact information for the authenticated teacher
 *
 * This endpoint updates:
 * 1. Teachers table (for teacher portal display - backward compatibility)
 * 2. School Bookings table:
 *    - If bookingId provided: updates ONLY that specific booking
 *    - If no bookingId: updates ALL bookings for this teacher (legacy behavior)
 *
 * Request body:
 * {
 *   address?: string,
 *   phone?: string,
 *   bookingId?: string  // Airtable record ID of specific booking to update
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { address, phone, bookingId } = body;

    // Validate input
    if (!address && !phone) {
      return NextResponse.json(
        { error: 'At least one field (address or phone) must be provided' },
        { status: 400 }
      );
    }

    // Validate address (minimum 10 characters if provided)
    if (address && address.length < 10) {
      return NextResponse.json(
        { error: 'Address must be at least 10 characters long' },
        { status: 400 }
      );
    }

    // Validate phone format (German phone format if provided)
    if (phone) {
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
    }

    // Update school info in Teachers table (for backward compatibility)
    await updateTeacherSchoolInfo(session.email, {
      address,
      phone,
    });

    // Update School Bookings table
    // If bookingId provided, update only that specific booking
    // Otherwise, update all bookings for this teacher (legacy behavior)
    if (bookingId) {
      await updateSchoolBookingById(bookingId, {
        address,
        phone,
      });
    } else {
      // Legacy: update all bookings for this teacher
      await updateSchoolBookingInfo(session.email, {
        address,
        phone,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'School information updated successfully',
    });
  } catch (error) {
    console.error('Error updating school info:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update school information',
      },
      { status: 500 }
    );
  }
}
