import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '@/lib/types';
import { verifyAdminSession, AdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

const ADMIN_SESSION_COOKIE = 'admin_token';
const ADMIN_SESSION_EXPIRY = 60 * 60 * 8; // 8 hours in seconds

/**
 * GET /api/auth/admin-login
 * Verify admin session - returns user info if authenticated
 */
export async function GET(request: NextRequest) {
  const session = verifyAdminSession(request);

  if (!session) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      user: {
        id: session.userId,
        email: session.email,
        role: session.role,
      },
    },
  });
}

/**
 * POST /api/auth/admin-login
 * Admin login via Airtable Personen table
 * - Email: E-Mail field from Personen table
 * - Password: ID field (autonumber) from Personen table
 * - Additional check: User must have Admin role
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find staff member by email in Personen table
    const staff = await getAirtableService().getStaffByEmail(email);

    if (!staff) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password matches the numeric ID field
    const expectedPassword = staff.numericId?.toString();
    if (!expectedPassword || password !== expectedPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has Admin role
    const hasAdminRole = await getAirtableService().hasAdminRole(staff.id);
    if (!hasAdminRole) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }

    // Create session with Personen record ID
    const session: AdminSession = {
      userId: staff.id,
      email: staff.email,
      role: 'admin',
      loginTimestamp: Date.now(),
    };

    // Generate JWT token
    const token = jwt.sign(session, process.env.JWT_SECRET!, {
      expiresIn: ADMIN_SESSION_EXPIRY,
    });

    // Create response with cookie
    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: 'admin',
        },
      },
    });

    // Set HTTP-only cookie
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_SESSION_EXPIRY,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during admin login:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  // Logout endpoint
  const response = NextResponse.json<ApiResponse>({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.delete(ADMIN_SESSION_COOKIE);

  return response;
}
