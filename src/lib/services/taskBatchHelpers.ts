/**
 * Pure helpers for taskService batch enrichment. Kept in their own module
 * (with no Airtable SDK imports) so they can be unit-tested without
 * loading the full airtableService dependency chain.
 */

/**
 * Extract the unique linked-record IDs from a list of Airtable records,
 * reading the linked-record field directly (which is an array of record IDs).
 *
 * Generic over the record shape so it accepts both raw Airtable SDK records
 * (`Airtable.Record<FieldSet>`) and lightweight test fixtures.
 */
export function uniqueLinkedRecordIds<R extends { get: (field: string) => unknown }>(
  records: ReadonlyArray<R>,
  fieldId: string,
): string[] {
  const set = new Set<string>();
  for (const r of records) {
    // Airtable's Record.get is generically typed to keys of FieldSet; cast
    // to a permissive signature since we accept arbitrary string field IDs.
    const value = (r.get as (field: string) => unknown)(fieldId);
    if (Array.isArray(value)) {
      for (const id of value) {
        if (typeof id === 'string') set.add(id);
      }
    }
  }
  return Array.from(set);
}
