import { NextResponse } from 'next/server';
import { getStandardClothingBatchService } from '@/lib/services/standardClothingBatchService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/standard-clothing-batches
 * Get all pending standard clothing batches
 */
export async function GET() {
  try {
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
