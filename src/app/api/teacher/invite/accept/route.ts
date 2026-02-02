import { NextRequest, NextResponse } from 'next/server';
import { getTeacherService } from '@/lib/services/teacherService';
import { createTeacherSessionToken } from '@/lib/auth/verifyTeacherSession';
import { TEACHER_SESSION_COOKIE, TEACHER_SESSION_EXPIRY_SECONDS } from '@/lib/types/teacher';

/**
 * POST /api/teacher/invite/accept
 * Accept an invite and create a session for the teacher
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email, name } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const teacherService = getTeacherService();

    // Accept the invite
    const { teacher, eventId } = await teacherService.acceptInvite(token, email, name);

    // Create JWT session
    const sessionToken = createTeacherSessionToken({
      teacherId: teacher.id,
      email: teacher.email,
      name: teacher.name,
      schoolName: teacher.schoolName,
      loginTimestamp: Date.now(),
    });

    // Create response with redirect URL
    const response = NextResponse.json({
      success: true,
      redirectUrl: `/paedagogen/events/${encodeURIComponent(eventId)}`,
    });

    // Set session cookie
    response.cookies.set(TEACHER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TEACHER_SESSION_EXPIRY_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error accepting invite:', error);

    // Return specific error messages for known errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept invite';

    if (errorMessage.includes('already been used')) {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
    }

    if (errorMessage.includes('expired')) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
