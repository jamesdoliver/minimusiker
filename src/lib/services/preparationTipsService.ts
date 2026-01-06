/**
 * Preparation Tips Service
 * Handles fetching preparation tips for teachers
 */

import Airtable from 'airtable';
import {
  PREPARATION_TIPS_TABLE_ID,
  PREPARATION_TIPS_FIELD_IDS,
  PreparationTip,
} from '../types/preparation-tips';

// Configure Airtable
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY!,
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

/**
 * Get all active preparation tips, ordered by the 'order' field
 *
 * @returns Array of PreparationTip objects
 */
export async function getPreparationTips(): Promise<PreparationTip[]> {
  try {
    const records = await base(PREPARATION_TIPS_TABLE_ID)
      .select({
        filterByFormula: `{${PREPARATION_TIPS_FIELD_IDS.active}} = TRUE()`,
        sort: [{ field: PREPARATION_TIPS_FIELD_IDS.order, direction: 'asc' }],
        returnFieldsByFieldId: true,
      })
      .all();

    const tips: PreparationTip[] = records.map((record) => {
      const fields = record.fields;

      return {
        id: record.id,
        title: (fields[PREPARATION_TIPS_FIELD_IDS.title] as string) || '',
        content: (fields[PREPARATION_TIPS_FIELD_IDS.content] as string) || '',
        order: (fields[PREPARATION_TIPS_FIELD_IDS.order] as number) || 0,
        active: (fields[PREPARATION_TIPS_FIELD_IDS.active] as boolean) || false,
        iconName: fields[PREPARATION_TIPS_FIELD_IDS.icon_name] as string | undefined,
      };
    });

    return tips;
  } catch (error) {
    console.error('Error fetching preparation tips:', error);
    throw error;
  }
}
