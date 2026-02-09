import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  PERSONEN_TABLE_ID,
  PERSONEN_FIELD_IDS,
  TEAMS_REGIONEN_TABLE_ID,
  TEAMS_REGIONEN_FIELD_IDS,
  ROLLEN_IDS,
} from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

interface StaffMemberWithRegions {
  id: string;
  name: string;
  email: string;
  regions: string[];
}

/**
 * GET /api/admin/staff
 * Fetch all staff members with "Team" role, including their region assignments
 *
 * Response: { staff: [{ id: "recXXX", name: "Max Müller", email: "...", regions: ["Köln/Bonn"] }] }
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

    const airtableService = getAirtableService();
    const base = airtableService['base'];

    // First, fetch all regions to build a lookup map
    const regionRecords = await base(TEAMS_REGIONEN_TABLE_ID)
      .select({
        fields: [TEAMS_REGIONEN_FIELD_IDS.name],
        returnFieldsByFieldId: true,
      })
      .all();

    const regionMap = new Map<string, string>();
    regionRecords.forEach((record) => {
      regionMap.set(record.id, record.fields[TEAMS_REGIONEN_FIELD_IDS.name] as string || 'Unknown');
    });

    // Fetch all staff with "Team" role
    const staffRecords = await base(PERSONEN_TABLE_ID)
      .select({
        // Filter by Team role
        filterByFormula: `FIND('Team', ARRAYJOIN({${PERSONEN_FIELD_IDS.rollen}}))`,
        fields: [
          PERSONEN_FIELD_IDS.staff_name,
          PERSONEN_FIELD_IDS.email,
          PERSONEN_FIELD_IDS.teams_regionen,
        ],
        returnFieldsByFieldId: true,
      })
      .all();

    const staff: StaffMemberWithRegions[] = staffRecords.map((record) => {
      const regionIds = (record.fields[PERSONEN_FIELD_IDS.teams_regionen] as string[]) || [];
      const regionNames = regionIds
        .map((id) => regionMap.get(id))
        .filter((name): name is string => !!name);

      return {
        id: record.id,
        name: (record.fields[PERSONEN_FIELD_IDS.staff_name] as string) || '',
        email: (record.fields[PERSONEN_FIELD_IDS.email] as string) || '',
        regions: regionNames,
      };
    });

    // Sort by name
    staff.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      staff,
    });
  } catch (error) {
    console.error('Error fetching staff with regions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch staff',
      },
      { status: 500 }
    );
  }
}
