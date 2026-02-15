import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface AdminSession {
  userId: string;
  email: string;
  role: 'admin';
  loginTimestamp?: number;
}

/**
 * Verify admin session from JWT token in cookies
 * @param request - Next.js request object
 * @returns Decoded admin session or null if invalid
 */
export function verifyAdminSession(request: NextRequest): AdminSession | null {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return null;
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, getJwtSecret()) as AdminSession & { exp?: number; iat?: number };

    // Check if token is expired (jwt.verify should handle this, but double-check)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Return the admin session data
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      loginTimestamp: decoded.iat ? decoded.iat * 1000 : undefined,
    };
  } catch (error) {
    console.error('Admin session verification error:', error);
    return null;
  }
}

/**
 * Extract admin ID from request
 * @param request - Next.js request object
 * @returns Admin ID or null
 */
export function getAdminIdFromRequest(request: NextRequest): string | null {
  const session = verifyAdminSession(request);
  if (session) {
    return session.userId;
  }
  return null;
}

/**
 * Extract admin email from request
 * @param request - Next.js request object
 * @returns Admin email or null
 */
export function getAdminEmailFromRequest(request: NextRequest): string | null {
  const session = verifyAdminSession(request);
  if (session) {
    return session.email;
  }
  return null;
}

/**
 * Require admin authentication, returning the session or a 401 response.
 * Usage: const [admin, errorResponse] = requireAdmin(request);
 *        if (errorResponse) return errorResponse;
 */
export function requireAdmin(request: NextRequest): [AdminSession, null] | [null, NextResponse] {
  const admin = verifyAdminSession(request);
  if (!admin) {
    return [null, NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )];
  }
  return [admin, null];
}
