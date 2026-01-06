import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * GET /api/staff/team
 * Fetch all staff members with "Team" role from Personen table
 * Used to populate the staff assignment dropdown in admin panel
 *
 * Note: No auth required as this returns only staff names (non-sensitive)
 * and is used by admin panel which follows the same pattern
 */
export async function GET(request: NextRequest) {
  try {
    const teamStaff = await getAirtableService().getTeamStaff();

    return NextResponse.json({
      success: true,
      data: teamStaff,
    });
  } catch (error) {
    console.error('Error fetching team staff:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team staff',
      },
      { status: 500 }
    );
  }
}
