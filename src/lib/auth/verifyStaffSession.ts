import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { StaffSession } from '@/lib/types/airtable';

const STAFF_JWT_SECRET = process.env.STAFF_JWT_SECRET || process.env.JWT_SECRET || 'staff-secret-key';

/**
 * Verify staff session from JWT token in cookies
 * @param request - Next.js request object
 * @returns Decoded staff session or null if invalid
 */
export function verifyStaffSession(request: NextRequest): StaffSession | null {
  try {
    const token = request.cookies.get('staff_session')?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, STAFF_JWT_SECRET) as StaffSession & { exp?: number; iat?: number };

    // Check if token is expired (jwt.verify should handle this, but double-check)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Return the staff session data
    return {
      staffId: decoded.staffId,
      email: decoded.email,
      name: decoded.name,
      loginTimestamp: decoded.loginTimestamp,
    };
  } catch (error) {
    console.error('Staff session verification error:', error);
    return null;
  }
}

/**
 * Create a JWT token for staff session
 * @param session - Staff session data
 * @param expiresIn - Token expiration time (default: 24 hours)
 * @returns JWT token string
 */
export function createStaffSessionToken(
  session: StaffSession,
  expiresIn: string | number = '24h'
): string {
  return jwt.sign(session, STAFF_JWT_SECRET, { expiresIn });
}

/**
 * Extract staff ID from request
 * @param request - Next.js request object
 * @returns Staff ID or null
 */
export function getStaffIdFromRequest(request: NextRequest): string | null {
  const session = verifyStaffSession(request);
  if (session) {
    return session.staffId;
  }
  return null;
}
