/**
 * Middleware (currently inert).
 *
 * Task 3.6 attempted to add an auth backstop on `/api/admin/*` and `/admin/*`
 * using the existing `verifyAdminSession` helper. That helper relies on
 * `jsonwebtoken` which depends on Node's `crypto` module — incompatible with
 * the Edge runtime that Next.js 14 forces on middleware regardless of any
 * `runtime = 'nodejs'` declaration.
 *
 * Until the JWT verification is re-implemented with an Edge-compatible
 * library (e.g. `jose`'s `jwtVerify`), the matcher is empty and this
 * middleware runs on no routes. Per-route `requireAdmin()` calls (added in
 * Phase 1) remain the actual auth enforcement; the middleware was only ever
 * intended as a defense-in-depth backstop.
 *
 * To re-enable: install `jose`, write `verifyAdminSessionEdge` using
 * `jose.jwtVerify(token, new TextEncoder().encode(JWT_SECRET))`, and restore
 * the matcher patterns below.
 */

import { NextResponse } from 'next/server';

export function middleware(): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
