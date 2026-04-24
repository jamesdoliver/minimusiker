jest.mock('airtable', () => ({
  __esModule: true,
  default: class AirtableStub {
    static configure() {}
    base() { return () => ({ select: () => ({ all: async () => [] }) }); }
  },
}));

import { findInvalidTierFlagEvents } from './dataIntegrityService';
import { Event } from '@/lib/types/airtable';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'rec_default',
    event_id: 'evt_default',
    school_name: 'Default School',
    event_date: '2026-05-01',
    ...overrides,
  } as Event;
}

describe('findInvalidTierFlagEvents', () => {
  it('flags events with both is_plus=true AND is_minimusikertag=true', () => {
    const events = [
      makeEvent({ id: 'rec1', event_id: 'evt1', is_plus: true, is_minimusikertag: true }),
      makeEvent({ id: 'rec2', event_id: 'evt2', is_plus: true, is_minimusikertag: false }),
      makeEvent({ id: 'rec3', event_id: 'evt3', is_plus: false, is_minimusikertag: true }),
      makeEvent({ id: 'rec4', event_id: 'evt4' }),
    ];

    const invalid = findInvalidTierFlagEvents(events);

    expect(invalid).toHaveLength(1);
    expect(invalid[0].event_id).toBe('evt1');
  });

  it('returns empty array when no events have the invalid combo', () => {
    const events = [
      makeEvent({ is_plus: true }),
      makeEvent({ is_minimusikertag: true }),
      makeEvent({ is_schulsong: true }),
      makeEvent({ is_minimusikertag: true, is_schulsong: true }),
      makeEvent({ is_plus: true, is_schulsong: true }),
    ];

    expect(findInvalidTierFlagEvents(events)).toHaveLength(0);
  });

  it('excludes Cancelled events from results (they do not matter for email behaviour)', () => {
    const events = [
      makeEvent({ id: 'rec1', event_id: 'evt1', is_plus: true, is_minimusikertag: true, status: 'Cancelled' }),
      makeEvent({ id: 'rec2', event_id: 'evt2', is_plus: true, is_minimusikertag: true, status: 'Confirmed' }),
    ];

    const invalid = findInvalidTierFlagEvents(events);

    expect(invalid).toHaveLength(1);
    expect(invalid[0].event_id).toBe('evt2');
  });

  it('excludes Deleted events from results', () => {
    const events = [
      makeEvent({ id: 'rec1', event_id: 'evt1', is_plus: true, is_minimusikertag: true, status: 'Deleted' }),
      makeEvent({ id: 'rec2', event_id: 'evt2', is_plus: true, is_minimusikertag: true, status: 'Confirmed' }),
    ];

    const invalid = findInvalidTierFlagEvents(events);

    expect(invalid).toHaveLength(1);
    expect(invalid[0].event_id).toBe('evt2');
  });

  it('includes events with null/undefined status (treated as active)', () => {
    const events = [
      makeEvent({ id: 'rec1', event_id: 'evt1', is_plus: true, is_minimusikertag: true, status: undefined }),
    ];

    expect(findInvalidTierFlagEvents(events)).toHaveLength(1);
  });
});
