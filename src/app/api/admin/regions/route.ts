import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { TEAMS_REGIONEN_TABLE_ID } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

interface Region {
  id: string;
  name: string;
}

interface RegionsResponse {
  success: true;
  regions: Region[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * GET /api/admin/regions
 * Fetch all Teams/Regionen records for dropdown selection
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<RegionsResponse | ErrorResponse>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    // Fetch all regions
    const records = await base(TEAMS_REGIONEN_TABLE_ID)
      .select({
        fields: ['Name'],
        sort: [{ field: 'Name', direction: 'asc' }],
      })
      .all();

    // Transform to Region interface
    const regions: Region[] = records
      .map((record) => ({
        id: record.id,
        name: (record.fields['Name'] as string) || '',
      }))
      .filter((region) => region.name); // Filter out empty names

    return NextResponse.json({
      success: true,
      regions,
    });
  } catch (error) {
    console.error('[Regions API] Error fetching regions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch regions',
      },
      { status: 500 }
    );
  }
}
