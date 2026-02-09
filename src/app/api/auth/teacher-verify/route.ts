import { NextRequest, NextResponse } from 'next/server';
import { getTeacherService } from '@/lib/services/teacherService';
import { createTeacherSessionToken } from '@/lib/auth/verifyTeacherSession';
import { TeacherSession, TEACHER_SESSION_COOKIE, TEACHER_SESSION_EXPIRY_SECONDS } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/teacher-verify
 * Verify magic link token and create session
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get teacher service
    const teacherService = getTeacherService();

    // Verify token and get teacher
    const teacher = await teacherService.verifyMagicLinkToken(token);

    if (!teacher) {
      return NextResponse.json(
        { error: 'Invalid or expired token. Please request a new magic link.' },
        { status: 401 }
      );
    }

    // Clear the used token (one-time use)
    await teacherService.clearMagicLinkToken(teacher.id);

    // Create session
    const session: TeacherSession = {
      teacherId: teacher.id,
      email: teacher.email,
      name: teacher.name,
      schoolName: teacher.schoolName,
      loginTimestamp: Date.now(),
    };

    // Generate JWT token
    const jwtToken = createTeacherSessionToken(session);

    // Create response
    const response = NextResponse.json({
      success: true,
      teacher: {
        email: teacher.email,
        name: teacher.name,
        schoolName: teacher.schoolName,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set(TEACHER_SESSION_COOKIE, jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TEACHER_SESSION_EXPIRY_SECONDS,
      path: '/',
    });

    console.log(`Teacher logged in: ${teacher.email}`);

    return response;
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}

/**
 * GET /api/auth/teacher-verify
 * Check if current session is valid
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(TEACHER_SESSION_COOKIE)?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Import verifyTeacherSession dynamically to avoid circular deps
    const { verifyTeacherSession } = await import('@/lib/auth/verifyTeacherSession');
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      teacher: {
        email: session.email,
        name: session.name,
        schoolName: session.schoolName,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
