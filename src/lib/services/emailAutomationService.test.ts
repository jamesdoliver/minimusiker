// airtable is a transitive dep of emailAutomationService via airtableService;
// stub it so Jest can load the module graph without a real Airtable client.
jest.mock('airtable', () => {
  const tableStub = () => ({ select: () => ({ all: async () => [], firstPage: async () => [] }) });
  return {
    __esModule: true,
    default: class AirtableStub {
      static configure() {}
      // airtableService uses BOTH `Airtable.base(baseId)` (static) and an
      // instance `.base()`; stub both so getAirtableService() can construct.
      static base() { return tableStub; }
      base() { return tableStub; }
    },
  };
});

import {
  eventMatchesTemplate,
  getEventTier,
  getEventsHittingThreshold,
  catchUpWindowDays,
} from './emailAutomationService';
import { EventThresholdMatch, EmailTemplate } from '@/lib/types/email-automation';
import { Event } from '@/lib/types/airtable';

// Minimal Event factory — getEventsHittingThreshold only reads a handful of
// fields, so cast a partial rather than spelling out the whole Airtable row.
function makeFullEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'rec_full',
    event_id: 'evt_full',
    school_name: 'Window School',
    event_date: '2026-06-26',
    status: 'Confirmed',
    is_kita: false,
    is_minimusikertag: true,
    is_plus: false,
    is_schulsong: false,
    is_under_100: false,
    ...overrides,
  } as unknown as Event;
}

function makeEvent(overrides: Partial<EventThresholdMatch> = {}): EventThresholdMatch {
  return {
    eventId: 'evt_test',
    eventRecordId: 'rec_test',
    schoolName: 'Test School',
    eventDate: '2026-05-01',
    eventType: 'Schule',
    daysUntilEvent: 30,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tmpl_test',
    name: 'Test Template',
    audience: ['teacher'],
    triggerDays: -29,
    triggerHour: 7,
    subject: 'Test',
    bodyHtml: '<p>Test</p>',
    active: true,
    is_minimusikertag: false,
    is_kita: false,
    is_plus: false,
    is_schulsong: false,
    only_under_100: false,
    ...overrides,
  };
}

describe('eventMatchesTemplate — tier hierarchy', () => {
  it('PLUS event matches a Minimusikertag-tier template (PLUS ⊇ Minimusikertag)', () => {
    // A PLUS event is a Minimusikertag event with upgraded pricing.
    // The old deal-builder comment put it: "PLUS is a pricing tier, not
    // a different event type." So a Minimusikertag-tier template should
    // still reach PLUS events — they're the same base product.
    const plusEvent = makeEvent({ isPlus: true });
    const mimuTemplate = makeTemplate({ is_minimusikertag: true });

    expect(eventMatchesTemplate(plusEvent, mimuTemplate)).toBe(true);
  });

  it('Minimusikertag event does NOT match a PLUS-tier template (no reverse hierarchy)', () => {
    // The superset relationship only goes one direction: PLUS events get
    // Mimu templates (plus Plus templates). A pure Mimu event does not
    // receive Plus-only content — that's by design, Plus-only implies
    // upgraded-pricing-specific messaging.
    const mimuEvent = makeEvent({ isMinimusikertag: true });
    const plusTemplate = makeTemplate({ is_plus: true });

    expect(eventMatchesTemplate(mimuEvent, plusTemplate)).toBe(false);
  });

  it('PLUS event still matches a PLUS-tier template (exact match)', () => {
    const plusEvent = makeEvent({ isPlus: true });
    const plusTemplate = makeTemplate({ is_plus: true });

    expect(eventMatchesTemplate(plusEvent, plusTemplate)).toBe(true);
  });

  it('Minimusikertag event matches a Minimusikertag-tier template (exact match)', () => {
    const mimuEvent = makeEvent({ isMinimusikertag: true });
    const mimuTemplate = makeTemplate({ is_minimusikertag: true });

    expect(eventMatchesTemplate(mimuEvent, mimuTemplate)).toBe(true);
  });

  it('Schulsong event does NOT match a Minimusikertag-tier template (schulsong is a different product, not in the hierarchy)', () => {
    const schulsongEvent = makeEvent({ isSchulsong: true });
    const mimuTemplate = makeTemplate({ is_minimusikertag: true });

    expect(eventMatchesTemplate(schulsongEvent, mimuTemplate)).toBe(false);
  });

  it('PLUS event does NOT match a Schulsong-tier template', () => {
    const plusEvent = makeEvent({ isPlus: true });
    const schulsongTemplate = makeTemplate({ is_schulsong: true });

    expect(eventMatchesTemplate(plusEvent, schulsongTemplate)).toBe(false);
  });

  it('only_under_100 filter still applies after tier hierarchy match', () => {
    // Hierarchy lets a PLUS event match a Mimu template, but an
    // only_under_100 template should still skip a large event.
    const largePlusEvent = makeEvent({ isPlus: true, isUnder100: false });
    const smallTemplate = makeTemplate({ is_minimusikertag: true, only_under_100: true });

    expect(eventMatchesTemplate(largePlusEvent, smallTemplate)).toBe(false);
  });
});

describe('catchUpWindowDays — pre-event-only catch-up policy', () => {
  it('gives pre-event steps (negative triggerDays) a 7-day catch-up window', () => {
    // The school journey steps fire before the event (-56…-10d). A missed
    // cron run for these should self-heal within a week.
    expect(catchUpWindowDays(-56)).toBe(7);
    expect(catchUpWindowDays(-10)).toBe(7);
  });

  it('gives day-0 steps no catch-up (same-day only)', () => {
    // "E-Mail" (teacher) and "Eltern - Wohoo" (parent) fire ON the event day.
    // Catching them up days later would send a stale "your event is today!".
    expect(catchUpWindowDays(0)).toBe(0);
  });

  it('gives post-event steps (positive triggerDays) no catch-up', () => {
    expect(catchUpWindowDays(7)).toBe(0);
  });
});

describe('getEventsHittingThreshold — catch-up look-back window', () => {
  // Freeze "now" so target-date arithmetic is deterministic. 10:00 UTC on
  // 2026-05-01 is comfortably mid-day in Berlin (12:00 CEST), same calendar day.
  beforeAll(() => {
    process.env.AIRTABLE_API_KEY ||= 'test-key';
    process.env.AIRTABLE_BASE_ID ||= 'test-base';
    jest.useFakeTimers().setSystemTime(new Date('2026-05-01T10:00:00Z'));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  // triggerDays = -56 → targetDate = today + 56 = 2026-06-26.
  // Window for lookBack=7 is [2026-06-19, 2026-06-26].
  const events: Event[] = [
    makeFullEvent({ event_id: 'exact', event_date: '2026-06-26' }), // == target
    makeFullEvent({ event_id: 'recent1', event_date: '2026-06-25' }), // target - 1
    makeFullEvent({ event_id: 'boundary', event_date: '2026-06-19' }), // target - 7 (inclusive)
    makeFullEvent({ event_id: 'tooOld', event_date: '2026-06-18' }), // target - 8 (excluded)
    makeFullEvent({ event_id: 'future', event_date: '2026-06-27' }), // target + 1 (excluded)
  ];

  it('with a 7-day look-back, catches the on-target day PLUS the 6 prior days (missed cohorts)', async () => {
    const matches = await getEventsHittingThreshold(-56, events, 7);
    expect(matches.map((m) => m.eventId).sort()).toEqual(['boundary', 'exact', 'recent1']);
  });

  it('with no look-back arg, preserves strict single-day equality (dry-run preview unchanged)', async () => {
    const matches = await getEventsHittingThreshold(-56, events);
    expect(matches.map((m) => m.eventId)).toEqual(['exact']);
  });

  it('with lookBackDays=0, is identical to strict equality', async () => {
    const matches = await getEventsHittingThreshold(-56, events, 0);
    expect(matches.map((m) => m.eventId)).toEqual(['exact']);
  });

  it('still excludes Cancelled/Deleted events inside the window', async () => {
    const withCancelled = [
      ...events,
      makeFullEvent({ event_id: 'cancelled', event_date: '2026-06-24', status: 'Cancelled' }),
    ];
    const matches = await getEventsHittingThreshold(-56, withCancelled, 7);
    expect(matches.map((m) => m.eventId)).not.toContain('cancelled');
  });
});

describe('getEventTier — invalid-flag-combo guard', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs a warning when isPlus AND isMinimusikertag are both true', () => {
    // isPlus and isMinimusikertag are meant to be mutually exclusive.
    // If both land true the API normalisation has been bypassed (e.g.
    // direct Airtable edit). We want loud logs so this surfaces in
    // Vercel within one cron cycle instead of weeks later via a complaint.
    getEventTier({ isPlus: true, isMinimusikertag: true });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid flag combo'),
      expect.any(Object)
    );
  });

  it('does NOT log a warning for valid tier combinations', () => {
    getEventTier({ isPlus: true });
    getEventTier({ isMinimusikertag: true });
    getEventTier({ isSchulsong: true });
    getEventTier({ isMinimusikertag: true, isSchulsong: true });
    getEventTier({ isPlus: true, isSchulsong: true });
    getEventTier({});

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still returns a tier (does not throw) when the invalid combo is detected', () => {
    // The guard is a tripwire, not a gate. It logs and lets the existing
    // priority chain pick a tier so downstream code keeps working.
    const tier = getEventTier({ isPlus: true, isMinimusikertag: true });
    expect(tier).toBe('plus');
  });
});
