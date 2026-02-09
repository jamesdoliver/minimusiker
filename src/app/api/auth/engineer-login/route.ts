import { NextRequest, NextResponse } from 'next/server';
import { createEngineerSessionToken } from '@/lib/auth/verifyEngineerSession';
import { EngineerSession, ENGINEER_SESSION_COOKIE } from '@/lib/types/engineer';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * Engineer login via Airtable Personen table
 * - Email: E-Mail field from Personen table
 * - Password: ID field (autonumber) from Personen table
 * - Additional check: User must have Engineer role
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
    const staff = await getAirtableService().getStaffByEmail(email);

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

    // Check if user has Engineer role
    const hasEngineerRole = await getAirtableService().hasEngineerRole(staff.id);
    if (!hasEngineerRole) {
      return NextResponse.json(
        { error: 'Access denied. Engineer role required.' },
        { status: 403 }
      );
    }

    // Create session with Personen record ID
    const session: EngineerSession = {
      engineerId: staff.id,
      email: staff.email,
      name: staff.name,
      loginTimestamp: Date.now(),
    };

    // Generate JWT token
    const token = createEngineerSessionToken(session);

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      engineer: {
        email: staff.email,
        name: staff.name,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set(ENGINEER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Engineer login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
