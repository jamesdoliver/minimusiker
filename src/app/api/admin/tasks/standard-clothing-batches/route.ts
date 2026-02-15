import { NextRequest, NextResponse } from 'next/server';
import { getStandardClothingBatchService } from '@/lib/services/standardClothingBatchService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/standard-clothing-batches
 * Get all pending standard clothing batches
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const service = getStandardClothingBatchService();
    const batches = await service.getPendingStandardBatches();

    return NextResponse.json({
      success: true,
      data: { batches },
    });
  } catch (error) {
    console.error('Error fetching standard clothing batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standard clothing batches' },
      { status: 500 }
    );
  }
}
