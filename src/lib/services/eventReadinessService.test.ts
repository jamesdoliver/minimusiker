// airtable is a transitive dep of eventReadinessService via airtableService;
// stub it so Jest can load the module graph without a real Airtable client.
jest.mock('airtable', () => ({
  __esModule: true,
  default: class AirtableStub {
    static configure() {}
    base() { return () => ({ select: () => ({ all: async () => [] }) }); }
  },
}));

// Module-scoped mocks for the dependencies of checkRegistrationShortfall.
const mockSend = jest.fn(async () => ({ success: true, messageId: 'm1' }));
const mockGetAirtable = {
  getAllEvents: jest.fn(async () => [] as Array<Record<string, unknown>>),
  getRegistrationsByEventId: jest.fn(async () => [] as Array<Record<string, unknown>>),
  getSchoolBookingById: jest.fn(async () => null as Record<string, unknown> | null),
};
const mockGetTeacherRecipients = jest.fn(async () => [] as Array<{ email: string; name: string }>);
const mockGetTriggerTemplate = jest.fn(async () => ({
  active: true, subject: '', bodyHtml: '', isCustomized: false,
}));
const mockLogActivity = jest.fn();

jest.mock('./airtableService', () => ({
  getAirtableService: () => mockGetAirtable,
}));
jest.mock('./emailAutomationService', () => ({
  // Real getEventTier, eventMatchesTemplate exports may be needed by other tests in this file —
  // re-export the real module for everything except getTeacherRecipientsForEvent.
  ...jest.requireActual('./emailAutomationService'),
  getTeacherRecipientsForEvent: (...args: unknown[]) => mockGetTeacherRecipients(...(args as Parameters<typeof mockGetTeacherRecipients>)),
}));
jest.mock('./triggerTemplateService', () => ({
  getTriggerTemplate: (...args: unknown[]) => mockGetTriggerTemplate(...(args as Parameters<typeof mockGetTriggerTemplate>)),
}));
jest.mock('./resendService', () => ({
  sendRegistrationShortfallEmail: (...args: unknown[]) => mockSend(...(args as Parameters<typeof mockSend>)),
}));
jest.mock('./activityService', () => ({
  getActivityService: () => ({ logActivity: mockLogActivity }),
}));

// Import AFTER all mocks are set up.
import { checkRegistrationShortfall } from './eventReadinessService';

// Helper: build an event whose date is exactly today+7 (registration-eligible by default).
function makeEventAtT7(overrides: Record<string, unknown> = {}) {
  const t7 = new Date();
  t7.setDate(t7.getDate() + 7);
  return {
    id: 'rec_evt',
    event_id: 'evt_test',
    event_date: t7.toISOString().split('T')[0],
    school_name: 'Test',
    status: 'Confirmed',
    simplybook_booking: ['rec_book'],
    is_minimusikertag: true,
    is_kita: false,
    is_plus: false,
    is_schulsong: false,
    ...overrides,
  };
}

describe('checkRegistrationShortfall', () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockGetTeacherRecipients.mockClear();
    mockGetAirtable.getAllEvents.mockReset();
    mockGetAirtable.getRegistrationsByEventId.mockReset();
    mockGetAirtable.getSchoolBookingById.mockReset();
    mockGetTriggerTemplate.mockReset();
    mockLogActivity.mockClear();
    mockGetTriggerTemplate.mockResolvedValue({ active: true, subject: '', bodyHtml: '', isCustomized: false });
    mockGetTeacherRecipients.mockResolvedValue([{ email: 't@e.de', name: 'Frau X' }]);
  });

  it('skips when ratio >= 50% (no email)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });

  it('sends low slug at 40% ratio', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('pre');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_low_t7',
      expect.objectContaining({
        registeredCount: '40',
        expectedCount: '100',
        percentRegistered: '40',
        teacherPortalUrl: expect.stringContaining('/paedagogen/events/evt_test'),
      }),
    );
    expect(r.sent).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.failed).toBe(0);
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'email_sent',
        eventRecordId: 'rec_evt',
        metadata: expect.objectContaining({ slug: 'cron:registration_low_t7', phase: 'pre', ratio: 40 }),
      }),
    );
  });

  it('sends critical slug at 30% ratio', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('pre');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_critical_t7',
      expect.objectContaining({
        registeredCount: '30',
        expectedCount: '100',
        percentRegistered: '30',
        teacherPortalUrl: expect.stringContaining('/paedagogen/events/evt_test'),
      }),
    );
    expect(r.sent).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.failed).toBe(0);
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'email_sent',
        eventRecordId: 'rec_evt',
        metadata: expect.objectContaining({ slug: 'cron:registration_critical_t7', phase: 'pre', ratio: 30 }),
      }),
    );
  });

  it('counts only registered_complete=true rows in the numerator', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    // 60 in-flight + 30 complete → numerator should be 30, ratio = 30%, critical
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      ...Array.from({ length: 60 }, (_, i) => ({ registered_complete: false, id: `i${i}` })),
      ...Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `c${i}` })),
    ]);
    await checkRegistrationShortfall('pre');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_critical_t7',
      expect.any(Object),
    );
  });

  it('skips when estimatedChildren is 0 or missing', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 0 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      { registered_complete: true, id: 'r1' },
    ]);
    const r = await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });

  it('skips schulsong-only events (no registration flags set)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([
      makeEventAtT7({ is_minimusikertag: false, is_kita: false, is_plus: false, is_schulsong: true }),
    ]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips cancelled events', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7({ status: 'Cancelled' })]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips when teacher has no email', async () => {
    mockGetTeacherRecipients.mockResolvedValueOnce([]);
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does NOT call sender when template is inactive', async () => {
    mockGetTriggerTemplate.mockResolvedValue({ active: false, subject: '', bodyHtml: '', isCustomized: false });
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });

  it('dryRun=true does not call sender even when ratio matches', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7()]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('pre', true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not match events whose date is not exactly T+7', async () => {
    const tooEarly = new Date();
    tooEarly.setDate(tooEarly.getDate() + 5);
    mockGetAirtable.getAllEvents.mockResolvedValue([
      makeEventAtT7({ event_date: tooEarly.toISOString().split('T')[0] }),
    ]);
    await checkRegistrationShortfall('pre');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('matches T+7 events with ISO-timestamp event_date', async () => {
    const t7 = new Date();
    t7.setDate(t7.getDate() + 7);
    const isoDate = `${t7.toISOString().split('T')[0]}T08:00:00.000Z`;
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtT7({ event_date: isoDate })]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('pre');
    expect(mockSend).toHaveBeenCalled();
  });
});
