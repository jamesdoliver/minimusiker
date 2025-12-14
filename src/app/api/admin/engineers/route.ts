import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

/**
 * GET /api/admin/engineers
 * Get all staff members with Engineer role
 */
export async function GET(request: NextRequest) {
  try {
    // Note: In production, add admin authentication check here
    // const session = verifyAdminSession(request);
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
