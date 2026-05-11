/**
 * Canonical admin API response helpers.
 *
 * Success: `{ success: true, data: T, message?: string }`
 * Failure: `{ success: false, error: string }`
 *
 * Use these helpers in admin route handlers to keep response shapes consistent
 * across the API surface. Status codes and field names match the historical
 * admin contract — clients reading `{ success, data, error }` continue to work
 * unchanged.
 *
 * Pure module — only depends on next/server. Add new helpers here when a new
 * canonical response variant is needed (e.g. paginated list, accepted-but-async).
 */

import { NextResponse } from 'next/server';

export function apiOk<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function apiError(error: string, status = 500) {
  return NextResponse.json(
    { success: false, error },
    { status },
  );
}
