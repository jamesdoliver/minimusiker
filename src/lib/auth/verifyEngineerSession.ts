import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import {
  EngineerSession,
  ENGINEER_SESSION_COOKIE,
  ENGINEER_SESSION_EXPIRY_SECONDS,
} from '@/lib/types/engineer';

const ENGINEER_JWT_SECRET =
  process.env.ENGINEER_JWT_SECRET || process.env.JWT_SECRET || 'engineer-secret-key';

/**
 * Verify engineer session from JWT token in cookies
 * @param request - Next.js request object
 * @returns Decoded engineer session or null if invalid
 */
export function verifyEngineerSession(request: NextRequest): EngineerSession | null {
  try {
    const token = request.cookies.get(ENGINEER_SESSION_COOKIE)?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, ENGINEER_JWT_SECRET) as EngineerSession & {
      exp?: number;
      iat?: number;
    };

    // Check if token is expired (jwt.verify should handle this, but double-check)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Return the engineer session data
    return {
      engineerId: decoded.engineerId,
      email: decoded.email,
      name: decoded.name,
      loginTimestamp: decoded.loginTimestamp,
    };
  } catch (error) {
    console.error('Engineer session verification error:', error);
    return null;
  }
}

/**
 * Create a JWT token for engineer session
 * @param session - Engineer session data
 * @param expiresIn - Token expiration time (default: 24 hours)
 * @returns JWT token string
 */
export function createEngineerSessionToken(
  session: EngineerSession,
  expiresIn: number = ENGINEER_SESSION_EXPIRY_SECONDS
): string {
  return jwt.sign(session, ENGINEER_JWT_SECRET, { expiresIn });
}

/**
 * Extract engineer ID from request
 * @param request - Next.js request object
 * @returns Engineer ID or null
 */
export function getEngineerIdFromRequest(request: NextRequest): string | null {
  const session = verifyEngineerSession(request);
  if (session) {
    return session.engineerId;
  }
  return null;
}
