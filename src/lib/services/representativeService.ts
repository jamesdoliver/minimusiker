/**
 * Representative Service
 * Handles fetching Minimusiker representatives for teachers
 *
 * Data Flow:
 * Teacher → region (linked record) → Teams/Regionen → staff_foto & staff_bio
 */

import Airtable from 'airtable';
import {
  TEAMS_REGIONEN_TABLE_ID,
  TEAMS_REGIONEN_FIELD_IDS,
  MinimusikanRepresentative,
} from '../types/airtable';
import { TEACHERS_TABLE_ID, TEACHERS_FIELD_IDS } from '../types/teacher';

// Configure Airtable
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY!,
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

/**
 * Get the assigned Minimusiker representative for a teacher
 *
 * Logic:
 * 1. Get teacher's region (linked record ID to Teams/Regionen)
 * 2. Fetch that Teams/Regionen record directly
 * 3. Return staff_foto URL and staff_bio from the region
 *
 * @param teacherEmail - Teacher's email to look up their region
 * @returns MinimusikanRepresentative or null
 */
export async function getTeacherRepresentative(
  teacherEmail: string
): Promise<MinimusikanRepresentative | null> {
  try {
    // 1. Get teacher's region (linked record ID)
    const teacherRecords = await base(TEACHERS_TABLE_ID)
      .select({
        filterByFormula: `{${TEACHERS_FIELD_IDS.email}} = "${teacherEmail}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      })
      .firstPage();

    if (!teacherRecords || teacherRecords.length === 0) {
      console.warn(`Teacher not found: ${teacherEmail}`);
      return null;
    }

    const teacherRecord = teacherRecords[0];

    // Region is a linked record field, so it's an array of record IDs
    const regionIds = teacherRecord.fields[TEACHERS_FIELD_IDS.region] as string[] | undefined;

    // If teacher has no region, return null (will use default)
    if (!regionIds || regionIds.length === 0) {
      console.warn(`Teacher ${teacherEmail} has no region assigned`);
      return null;
    }

    // Get the first region ID (teacher should only have one region)
    const regionId = regionIds[0];

    // 2. Fetch the Teams/Regionen record directly by ID
    const regionRecord = await base(TEAMS_REGIONEN_TABLE_ID).find(regionId);

    if (!regionRecord) {
      console.warn(`Region record not found: ${regionId}`);
      return null;
    }

    // 3. Extract staff info from the region record
    // Note: .find() returns field names, not IDs (unlike .select() with returnFieldsByFieldId)
    const fields = regionRecord.fields;
    const regionName = fields['Name'] as string | undefined;
    const staffName = fields['Personenname'] as string | undefined;
    const staffFoto = fields['staff_foto'] as string | undefined;
    const staffBio = fields['staff_bio'] as string | undefined;
    const staffEmail = fields['staff_email'] as string | undefined;

    // If no staff info configured for this region, return null
    if (!regionName) {
      console.warn(`Region ${regionId} has no name configured`);
      return null;
    }

    return {
      id: regionRecord.id,
      name: staffName || regionName, // Staff name, fallback to region name
      email: staffEmail || '', // Staff email for contact
      bio: staffBio,
      profilePhotoUrl: staffFoto, // Direct URL, no signing needed
      region: regionName,
    };
  } catch (error) {
    console.error('Error fetching representative:', error);
    throw error;
  }
}
