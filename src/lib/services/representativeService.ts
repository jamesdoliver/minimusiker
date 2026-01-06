/**
 * Representative Service
 * Handles fetching Minimusiker representatives for teachers
 */

import Airtable from 'airtable';
import {
  PERSONEN_TABLE_ID,
  PERSONEN_FIELD_IDS,
  ROLLEN_IDS,
  MinimusikanRepresentative,
  AirtableAttachment,
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
 * 1. Get teacher's region from Teachers table
 * 2. Query Personen table for team members with matching teams_regionen
 * 3. Filter by "team" role (ROLLEN_IDS.team)
 * 4. Return first match, or null if no match
 *
 * @param teacherEmail - Teacher's email to look up their region
 * @returns MinimusikanRepresentative or null
 */
export async function getTeacherRepresentative(
  teacherEmail: string
): Promise<MinimusikanRepresentative | null> {
  try {
    // 1. Get teacher's region
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
    const teacherRegion = teacherRecord.fields[TEACHERS_FIELD_IDS.region] as string | undefined;

    // If teacher has no region, return null (will use default)
    if (!teacherRegion) {
      console.warn(`Teacher ${teacherEmail} has no region assigned`);
      return null;
    }

    // 2. Query Personen table for team members matching region
    // NOTE: teams_regionen is a linked record field, so we need to match the region name
    // For now, we'll fetch all team members and filter in memory
    // TODO: Optimize this with a better filter formula once we understand the teams_regionen structure

    const personenRecords = await base(PERSONEN_TABLE_ID)
      .select({
        filterByFormula: `FIND("${ROLLEN_IDS.team}", {${PERSONEN_FIELD_IDS.rollen}})`,
        returnFieldsByFieldId: true,
      })
      .firstPage();

    if (!personenRecords || personenRecords.length === 0) {
      console.warn('No team members found in Personen table');
      return null;
    }

    // 3. Filter by region (in-memory for now)
    // teams_regionen is a linked record field, so the value is an array of record IDs
    // We need to match this with the teacher's region text
    // For now, we'll just return the first team member (TODO: implement proper region matching)

    for (const record of personenRecords) {
      const fields = record.fields;

      // Extract fields
      const name = fields[PERSONEN_FIELD_IDS.staff_name] as string | undefined;
      const email = fields[PERSONEN_FIELD_IDS.email] as string | undefined;
      const telefon = fields[PERSONEN_FIELD_IDS.telefon] as string | undefined;
      const bio = fields[PERSONEN_FIELD_IDS.bio] as string | undefined;
      const profilePhotoAttachments = fields[PERSONEN_FIELD_IDS.profile_photo] as AirtableAttachment[] | undefined;

      // Get first profile photo URL if available
      const profilePhotoUrl = profilePhotoAttachments && profilePhotoAttachments.length > 0
        ? profilePhotoAttachments[0].url
        : undefined;

      // Skip if missing required fields
      if (!name || !email) {
        continue;
      }

      // Return first match (TODO: add proper region matching)
      return {
        id: record.id,
        name,
        email,
        phone: telefon,
        bio,
        profilePhotoUrl,
        region: teacherRegion,
      };
    }

    // No match found
    return null;
  } catch (error) {
    console.error('Error fetching representative:', error);
    throw error;
  }
}
