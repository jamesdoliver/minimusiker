import { uniqueLinkedRecordIds } from '@/lib/services/taskBatchHelpers';

/**
 * Lightweight Airtable record fixture: just the `get(field)` shape.
 * Mirrors the surface area uniqueLinkedRecordIds reads.
 */
function rec(fields: Record<string, unknown>) {
  return {
    id: 'rec_test',
    get: (field: string) => fields[field],
  };
}

describe('uniqueLinkedRecordIds', () => {
  const FIELD = 'fldEvent';

  it('returns an empty array for no records', () => {
    expect(uniqueLinkedRecordIds([], FIELD)).toEqual([]);
  });

  it('extracts IDs from a single record', () => {
    const records = [rec({ [FIELD]: ['rec0000000000001A'] })];
    expect(uniqueLinkedRecordIds(records, FIELD)).toEqual(['rec0000000000001A']);
  });

  it('deduplicates IDs across records', () => {
    const records = [
      rec({ [FIELD]: ['rec0000000000001A'] }),
      rec({ [FIELD]: ['rec0000000000001A'] }),
      rec({ [FIELD]: ['rec0000000000002B'] }),
    ];
    const ids = uniqueLinkedRecordIds(records, FIELD);
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toEqual(new Set(['rec0000000000001A', 'rec0000000000002B']));
  });

  it('skips records where the field is missing', () => {
    const records = [
      rec({ [FIELD]: ['rec0000000000001A'] }),
      rec({}), // missing
      rec({ [FIELD]: undefined }),
    ];
    expect(uniqueLinkedRecordIds(records, FIELD)).toEqual(['rec0000000000001A']);
  });

  it('skips records where the field is not an array', () => {
    const records = [
      rec({ [FIELD]: 'not-an-array' }),
      rec({ [FIELD]: 42 }),
      rec({ [FIELD]: { id: 'rec_xxx' } }),
      rec({ [FIELD]: ['rec0000000000003C'] }),
    ];
    expect(uniqueLinkedRecordIds(records, FIELD)).toEqual(['rec0000000000003C']);
  });

  it('handles multi-element linked-record arrays', () => {
    // Linked-record fields can hold N IDs (e.g. for batch tasks). Take all.
    const records = [
      rec({ [FIELD]: ['recA', 'recB', 'recC'] }),
      rec({ [FIELD]: ['recC', 'recD'] }),
    ];
    const ids = uniqueLinkedRecordIds(records, FIELD);
    expect(ids).toHaveLength(4);
    expect(new Set(ids)).toEqual(new Set(['recA', 'recB', 'recC', 'recD']));
  });

  it('skips non-string array entries', () => {
    const records = [rec({ [FIELD]: ['recA', 42, null, undefined, 'recB'] })];
    expect(new Set(uniqueLinkedRecordIds(records, FIELD))).toEqual(
      new Set(['recA', 'recB']),
    );
  });

  it('uses the requested fieldId (does not bleed across fields)', () => {
    const records = [
      rec({ fldEvent: ['recE'], fldGo: ['recG'] }),
      rec({ fldEvent: ['recE2'], fldGo: ['recG2'] }),
    ];
    expect(new Set(uniqueLinkedRecordIds(records, 'fldEvent'))).toEqual(
      new Set(['recE', 'recE2']),
    );
    expect(new Set(uniqueLinkedRecordIds(records, 'fldGo'))).toEqual(
      new Set(['recG', 'recG2']),
    );
  });
});
