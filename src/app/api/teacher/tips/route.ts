import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getPreparationTips } from '@/lib/services/preparationTipsService';

/**
 * GET /api/teacher/tips
 * Get all active preparation tips for teachers
 *
 * Returns tips ordered by the 'order' field
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get preparation tips
    const tips = await getPreparationTips();

    return NextResponse.json({
      success: true,
      tips,
    });
  } catch (error) {
    console.error('Error fetching preparation tips:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tips',
        tips: [],
      },
      { status: 500 }
    );
  }
}
