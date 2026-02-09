import { NextRequest, NextResponse } from 'next/server';
import { ENGINEER_SESSION_COOKIE } from '@/lib/types/engineer';

export const dynamic = 'force-dynamic';

/**
 * Engineer logout - clears the engineer session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear the engineer session cookie
    response.cookies.set(ENGINEER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Engineer logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed. Please try again.' },
      { status: 500 }
    );
  }
}
