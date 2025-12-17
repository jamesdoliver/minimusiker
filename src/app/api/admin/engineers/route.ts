import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

/**
 * GET /api/admin/engineers
 * Get all staff members with Engineer role
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const engineers = await airtableService.getEngineerStaff();

    return NextResponse.json({
      success: true,
      engineers,
    });
  } catch (error) {
    console.error('Error fetching engineers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch engineers',
      },
      { status: 500 }
    );
  }
}
