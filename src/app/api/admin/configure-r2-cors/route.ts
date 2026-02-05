import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/configure-r2-cors
 * One-shot endpoint to configure CORS rules on the R2 bucket.
 * Call once after deploy to enable browser presigned URL uploads.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await getR2Service().configureBucketCors();

    console.log(`[ConfigureR2CORS] CORS rules configured by ${admin.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ConfigureR2CORS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to configure CORS',
      },
      { status: 500 }
    );
  }
}
