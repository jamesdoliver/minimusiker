/**
 * Printables Health Check API
 *
 * GET /api/admin/printables/health
 *
 * Returns the health status of the printables system:
 * - Bucket accessibility
 * - Templates found/missing
 * - Fonts found/missing
 *
 * Used by the UI to validate before allowing printable generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get R2 service and run health check
    const r2Service = getR2Service();
    const health = await r2Service.checkAssetsHealth();

    return NextResponse.json({
      success: true,
      ...health,
    });
  } catch (error) {
    console.error('Error checking printables health:', error);
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
