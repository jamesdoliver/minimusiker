import { NextRequest, NextResponse } from 'next/server';
import { getTeacherService } from '@/lib/services/teacherService';
import { createTeacherSessionToken } from '@/lib/auth/verifyTeacherSession';
import { TeacherSession, TEACHER_SESSION_COOKIE, TEACHER_SESSION_EXPIRY_SECONDS } from '@/lib/types/teacher';
import sgMail from '@sendgrid/mail';

// Admin bypass email - creates session directly without magic link
const ADMIN_BYPASS_EMAIL = 'admin@minimusiker.de';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@minimusiker.de';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'MiniMusiker';

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
    const magicLinkUrl = `${APP_URL}/teacher-login?token=${token}`;

    // Send email via SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to: teacher.email,
          from: {
            email: FROM_EMAIL,
            name: FROM_NAME,
          },
          subject: 'Ihr Login-Link für das MiniMusiker Lehrer-Portal',
          html: generateMagicLinkEmail(teacher.name, magicLinkUrl),
          text: generateMagicLinkEmailText(teacher.name, magicLinkUrl),
        });

        console.log(`Magic link sent to ${teacher.email}`);
      } catch (emailError) {
        console.error('SendGrid error:', emailError);
        // Don't fail the request, token is generated
        // In production, you might want to handle this differently
      }
    } else {
      // Development mode - log the link
      console.log('========================================');
      console.log('MAGIC LINK (SendGrid not configured):');
      console.log(magicLinkUrl);
      console.log('========================================');
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

/**
 * Generate HTML email content for magic link
 */
function generateMagicLinkEmail(name: string, magicLinkUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MiniMusiker Login</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #e91e63; margin: 0;">MiniMusiker</h1>
    <p style="color: #666; margin: 5px 0;">Lehrer-Portal</p>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 10px;">
    <h2 style="margin-top: 0;">Hallo ${name},</h2>

    <p>Sie haben einen Login-Link für das MiniMusiker Lehrer-Portal angefordert.</p>

    <p>Klicken Sie auf den folgenden Button, um sich anzumelden:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLinkUrl}"
         style="background-color: #e91e63; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        Jetzt anmelden
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      Dieser Link ist 24 Stunden gültig. Falls Sie diesen Login nicht angefordert haben, können Sie diese E-Mail ignorieren.
    </p>

    <p style="color: #666; font-size: 14px;">
      Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
      <a href="${magicLinkUrl}" style="color: #e91e63; word-break: break-all;">${magicLinkUrl}</a>
    </p>
  </div>

  <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} MiniMusiker. Alle Rechte vorbehalten.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content for magic link
 */
function generateMagicLinkEmailText(name: string, magicLinkUrl: string): string {
  return `
Hallo ${name},

Sie haben einen Login-Link für das MiniMusiker Lehrer-Portal angefordert.

Klicken Sie auf den folgenden Link, um sich anzumelden:
${magicLinkUrl}

Dieser Link ist 24 Stunden gültig. Falls Sie diesen Login nicht angefordert haben, können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen,
Ihr MiniMusiker Team
  `.trim();
}
