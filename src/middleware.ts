/**
 * Middleware: defense-in-depth auth backstop for admin surfaces.
 *
 * Every admin API route already calls `requireAdmin()` inline, but this
 * middleware ensures that any future route added under `/api/admin/*` (or any
 * admin page under `/admin/*`) cannot accidentally be exposed without auth.
 *
 * Edge runtime caveat: `verifyAdminSession` uses `jsonwebtoken`, which depends
 * on Node's `crypto` and is NOT compatible with the default Edge runtime. We
 * opt into the Node.js runtime so the existing helper can be reused as-is.
 *
 * Note on next-intl: a previous version of this file imported
 * `next-intl/middleware`, but its matcher was `[]` (effectively disabled). If
 * next-intl needs to be reactivated in the future, integrate its handler into
 * the `middleware` function below and update the `matcher` array accordingly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

// Use Node.js runtime so we can reuse the existing jsonwebtoken-based auth helper.
export const runtime = 'nodejs';

const ADMIN_API_PREFIX = '/api/admin';
const ADMIN_PAGE_PREFIX = '/admin';

// Paths that must remain reachable without an admin session.
// Note: `/api/auth/admin-login` lives outside `/api/admin/*` and is therefore
// not covered by the matcher, so it doesn't need to appear here. We list
// `/admin-login` for completeness even though it's a separate top-level route
// (not nested under `/admin/`), so the page check below excludes it.
const PUBLIC_ADMIN_PATHS = [
  '/admin-login',
];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip explicitly public admin paths (e.g. login page).
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const isAdminApi = pathname.startsWith(ADMIN_API_PREFIX);
  // `/admin-login` is a sibling, not a child, of `/admin`. The matcher's
  // `/admin/:path*` pattern won't match it, but we guard explicitly anyway.
  const isAdminPage =
    pathname.startsWith(ADMIN_PAGE_PREFIX) && !pathname.startsWith('/admin-login');

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const session = verifyAdminSession(request);
  if (session) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // Admin page — redirect to login, preserving the original target.
  const loginUrl = new URL('/admin-login', request.url);
  loginUrl.searchParams.set('returnTo', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/admin/:path*',
  ],
};
