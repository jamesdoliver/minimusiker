import { NextRequest, NextResponse } from 'next/server';
import { createStaffSessionToken } from '@/lib/auth/verifyStaffSession';
import { StaffSession } from '@/lib/types/airtable';
import airtableService from '@/lib/services/airtableService';

/**
 * Staff login via Airtable Personen table
 * - Email: E-Mail field from Personen table
 * - Password: ID field (autonumber) from Personen table
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find staff member by email in Personen table
    const staff = await airtableService.getStaffByEmail(email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password matches the numeric ID field
    const expectedPassword = staff.numericId?.toString();
    if (!expectedPassword || password !== expectedPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session with Personen record ID for event filtering
    const session: StaffSession = {
      staffId: staff.id,  // Airtable record ID (e.g., rec1cGmWTLk4No5Ou)
      email: staff.email,
      name: staff.name,
      loginTimestamp: Date.now(),
    };

    // Generate JWT token
    const token = createStaffSessionToken(session);

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      staff: {
        email: staff.email,
        name: staff.name,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('staff_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Staff login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
