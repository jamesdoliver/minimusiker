import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_SESSION_COOKIE } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/teacher-logout
 * Clear teacher session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });

    // Clear the session cookie
    response.cookies.set(TEACHER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
