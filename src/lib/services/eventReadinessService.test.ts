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

// Helper: build an event whose date is exactly today + offsetDays
// (registration-eligible by default).
function makeEventAtOffset(offsetDays: number, overrides: Record<string, unknown> = {}) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  return {
    id: 'rec_evt',
    event_id: 'evt_test',
    event_date: target.toISOString().split('T')[0],
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

describe('checkRegistrationShortfall — t_minus_14', () => {
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

  it('fires at 30% (under 33%) for an event 14 days out', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(14)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('t_minus_14');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_t_minus_14',
      expect.objectContaining({ percentRegistered: '30' }),
    );
    expect(r.sent).toBe(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ triggerKey: 't_minus_14', ratio: 30 }),
      }),
    );
  });

  it('does not fire at 33% (at threshold)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(14)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 33 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_minus_14');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not match events outside the T-14 window', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(7)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('t_minus_14');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips schulsong-only events', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([
      makeEventAtOffset(14, { is_minimusikertag: false, is_kita: false, is_plus: false, is_schulsong: true }),
    ]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('t_minus_14');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips when template is inactive', async () => {
    mockGetTriggerTemplate.mockResolvedValue({ active: false, subject: '', bodyHtml: '', isCustomized: false });
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(14)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    const r = await checkRegistrationShortfall('t_minus_14');
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe('checkRegistrationShortfall — t_minus_4', () => {
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

  it('fires at 30% for an event 4 days out (independent of T-14 history)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(4)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_minus_4');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_t_minus_4',
      expect.objectContaining({ percentRegistered: '30' }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ triggerKey: 't_minus_4', ratio: 30 }),
      }),
    );
  });

  it('does not fire at 33% (at threshold)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(4)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 33 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_minus_4');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not match events outside the T-4 window', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(14)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('t_minus_4');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('checkRegistrationShortfall — t_plus_3', () => {
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

  it('fires at 45% (under 50%) for an event 3 days ago', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-3)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 45 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_plus_3');
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_t_plus_3',
      expect.objectContaining({ percentRegistered: '45' }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ triggerKey: 't_plus_3', ratio: 45 }),
      }),
    );
  });

  it('does not fire at 50% (at threshold)', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-3)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_plus_3');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not match events outside the T+3 window', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-7)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([]);
    await checkRegistrationShortfall('t_plus_3');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('counts only registered_complete=true rows', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-3)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      ...Array.from({ length: 60 }, (_, i) => ({ registered_complete: false, id: `i${i}` })),
      ...Array.from({ length: 40 }, (_, i) => ({ registered_complete: true, id: `c${i}` })),
    ]);
    await checkRegistrationShortfall('t_plus_3');
    // numerator = 40 → ratio 40% → fires
    expect(mockSend).toHaveBeenCalledWith(
      't@e.de',
      'cron:registration_t_plus_3',
      expect.objectContaining({ percentRegistered: '40' }),
    );
  });

  it('skips when estimatedChildren is 0', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-3)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 0 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue([
      { registered_complete: true, id: 'r1' },
    ]);
    const r = await checkRegistrationShortfall('t_plus_3');
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThanOrEqual(1);
  });

  it('dryRun=true does not call sender', async () => {
    mockGetAirtable.getAllEvents.mockResolvedValue([makeEventAtOffset(-3)]);
    mockGetAirtable.getSchoolBookingById.mockResolvedValue({ estimatedChildren: 100 });
    mockGetAirtable.getRegistrationsByEventId.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ registered_complete: true, id: `r${i}` })),
    );
    await checkRegistrationShortfall('t_plus_3', true);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
