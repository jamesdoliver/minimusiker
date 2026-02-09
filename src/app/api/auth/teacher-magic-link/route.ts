import { NextRequest, NextResponse } from 'next/server';
import { getTeacherService } from '@/lib/services/teacherService';
import { createTeacherSessionToken } from '@/lib/auth/verifyTeacherSession';
import { TeacherSession, TEACHER_SESSION_COOKIE, TEACHER_SESSION_EXPIRY_SECONDS } from '@/lib/types/teacher';
import { sendTeacherMagicLinkEmail } from '@/lib/services/resendService';

export const dynamic = 'force-dynamic';

// Admin bypass email - creates session directly without magic link
const ADMIN_BYPASS_EMAIL = 'admin@minimusiker.de';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/auth/teacher-magic-link
 * Send magic link email to teacher for passwordless login
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get teacher service
    const teacherService = getTeacherService();

    // Find teacher by email
    const teacher = await teacherService.getTeacherByEmail(normalizedEmail);

    if (!teacher) {
      // Don't reveal whether email exists for security
      // But log for debugging
      console.log(`Magic link requested for unknown email: ${normalizedEmail}`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a magic link will be sent.',
      });
    }

    // Admin bypass - create session directly without magic link email
    if (normalizedEmail === ADMIN_BYPASS_EMAIL) {
      console.log('Admin bypass login for teacher portal');

      const session: TeacherSession = {
        teacherId: teacher.id,
        email: teacher.email,
        name: teacher.name,
        schoolName: teacher.schoolName,
        loginTimestamp: Date.now(),
      };

      const jwtToken = createTeacherSessionToken(session);

      const response = NextResponse.json({
        success: true,
        adminBypass: true,
      });

      response.cookies.set(TEACHER_SESSION_COOKIE, jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TEACHER_SESSION_EXPIRY_SECONDS,
        path: '/',
      });

      return response;
    }

    // Generate magic link token
    const token = await teacherService.generateMagicLinkToken(teacher.id);

    // Build magic link URL
    const magicLinkUrl = `${APP_URL}/paedagogen-login?token=${token}`;

    // Send email via Resend
    try {
      const result = await sendTeacherMagicLinkEmail(
        teacher.email,
        teacher.name,
        magicLinkUrl
      );

      if (result.success) {
        console.log(`Magic link sent to ${teacher.email}`);
      } else {
        console.error('Resend email error:', result.error);
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Don't fail the request, token is generated
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a magic link will be sent.',
      // In development, include the link for testing
      ...(process.env.NODE_ENV === 'development' && { debugLink: magicLinkUrl }),
    });
  } catch (error) {
    console.error('Magic link generation error:', error);
    return NextResponse.json({ error: 'Failed to send magic link. Please try again.' }, { status: 500 });
  }
}
