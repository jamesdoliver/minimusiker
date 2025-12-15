import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { ParentSession } from '@/lib/types';

const PARENT_JWT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';

/**
 * Verify parent session from JWT token in cookies
 * @param request - Next.js request object
 * @returns Decoded parent session or null if invalid
 */
export function verifyParentSession(request: NextRequest): ParentSession | null {
  try {
    const token = request.cookies.get('parent_session')?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, PARENT_JWT_SECRET) as ParentSession & { exp?: number; iat?: number };

    // Check if token is expired (jwt.verify should handle this, but double-check)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Return the parent session data
    return {
      parentId: decoded.parentId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      eventId: decoded.eventId,
      schoolId: decoded.schoolId,
      studentIds: decoded.studentIds,
      loginTimestamp: decoded.loginTimestamp,
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

/**
 * Create a JWT token for parent session
 * @param session - Parent session data
 * @param expiresIn - Token expiration time (default: 7 days)
 * @returns JWT token string
 */
export function createParentSessionToken(
  session: ParentSession,
  expiresIn: string | number = '7d'
): string {
  return jwt.sign(session, PARENT_JWT_SECRET, { expiresIn });
}

/**
 * Check if a parent has access to specific event data
 * @param session - Parent session
 * @param eventId - Event ID to check access for
 * @returns True if parent has access, false otherwise
 */
export function parentHasEventAccess(session: ParentSession | null, eventId: string): boolean {
  if (!session) return false;

  // If session has a specific eventId, check if it matches
  if (session.eventId) {
    return session.eventId === eventId;
  }

  // Otherwise, parent may have access to multiple events
  // This would require additional logic based on your business rules
  return true;
}

/**
 * Extract parent ID from request (either from session or header)
 * @param request - Next.js request object
 * @returns Parent ID or null
 */
export function getParentIdFromRequest(request: NextRequest): string | null {
  // First try to get from session
  const session = verifyParentSession(request);
  if (session) {
    return session.parentId;
  }

  // Fallback to header (for API calls with session context)
  const headerParentId = request.headers.get('X-Parent-ID');
  if (headerParentId) {
    return headerParentId;
  }

  return null;
}