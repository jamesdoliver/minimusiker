// airtable is a transitive dep of emailAutomationService via airtableService;
// stub it so Jest can load the module graph without a real Airtable client.
jest.mock('airtable', () => ({
  __esModule: true,
  default: class AirtableStub {
    static configure() {}
    base() { return () => ({ select: () => ({ all: async () => [] }) }); }
  },
}));

import { eventMatchesTemplate } from './emailAutomationService';
import { EventThresholdMatch, EmailTemplate } from '@/lib/types/email-automation';

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
