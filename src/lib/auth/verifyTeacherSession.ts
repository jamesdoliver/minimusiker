import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { TeacherSession, TEACHER_SESSION_COOKIE, TEACHER_SESSION_EXPIRY_SECONDS } from '@/lib/types/teacher';

const TEACHER_JWT_SECRET = process.env.TEACHER_JWT_SECRET || process.env.JWT_SECRET || 'teacher-secret-key';

/**
 * Verify teacher session from JWT token in cookies
 * @param request - Next.js request object
 * @returns Decoded teacher session or null if invalid
 */
export function verifyTeacherSession(request: NextRequest): TeacherSession | null {
  try {
    const token = request.cookies.get(TEACHER_SESSION_COOKIE)?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, TEACHER_JWT_SECRET) as TeacherSession & { exp?: number; iat?: number };

    // Check if token is expired (jwt.verify should handle this, but double-check)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Return the teacher session data
    return {
      teacherId: decoded.teacherId,
      email: decoded.email,
      name: decoded.name,
      schoolName: decoded.schoolName,
      loginTimestamp: decoded.loginTimestamp,
    };
  } catch (error) {
    console.error('Teacher session verification error:', error);
    return null;
  }
}

/**
 * Create a JWT token for teacher session
 * @param session - Teacher session data
 * @param expiresIn - Token expiration time (default: 7 days)
 * @returns JWT token string
 */
export function createTeacherSessionToken(
  session: TeacherSession,
  expiresIn: string | number = TEACHER_SESSION_EXPIRY_SECONDS
): string {
  return jwt.sign(session, TEACHER_JWT_SECRET, { expiresIn });
}

/**
 * Extract teacher ID from request
 * @param request - Next.js request object
 * @returns Teacher ID or null
 */
export function getTeacherIdFromRequest(request: NextRequest): string | null {
  const session = verifyTeacherSession(request);
  if (session) {
    return session.teacherId;
  }
  return null;
}

/**
 * Extract teacher email from request
 * @param request - Next.js request object
 * @returns Teacher email or null
 */
export function getTeacherEmailFromRequest(request: NextRequest): string | null {
  const session = verifyTeacherSession(request);
  if (session) {
    return session.email;
  }
  return null;
}
