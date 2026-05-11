import { mergeActivityWithEmailLogs } from '@/lib/utils/mergeActivityWithEmailLogs';
import type { EventActivity } from '@/lib/types/airtable';
import type { EmailLog } from '@/lib/types/email-automation';

function makeActivity(
  id: string,
  createdAt: string,
  metadata?: Record<string, unknown>,
): EventActivity {
  return {
    id,
    activityId: 1,
    eventId: 'evt_test',
    activityType: 'email_sent',
    description: `activity ${id}`,
    actorEmail: 'system@minimusiker.de',
    actorType: 'system',
    metadata,
    createdAt,
  };
}

function makeLog(
  id: string,
  status: 'sent' | 'failed' | 'skipped',
  sentAt: string,
  templateName: string,
  recipientEmail: string,
): EmailLog {
  return {
    id,
    templateName,
    eventId: 'evt_test',
    recipientEmail,
    recipientType: 'teacher',
    sentAt,
    status,
    resendMessageId: `msg_${id}`,
  };
}

describe('mergeActivityWithEmailLogs', () => {
  it('returns activities-only when no email logs', () => {
    const activities: EventActivity[] = [makeActivity('a1', '2026-05-10T12:00:00Z')];
    const result = mergeActivityWithEmailLogs(activities, []);
    expect(result).toEqual(activities);
  });

  it('synthesizes email_sent activities from EMAIL_LOGS sent rows', () => {
    const logs = [makeLog('log1', 'sent', '2026-05-09T10:00:00Z', 'T-14_teacher', 'a@b.de')];
    const result = mergeActivityWithEmailLogs([], logs);
    expect(result).toHaveLength(1);
    expect(result[0].activityType).toBe('email_sent');
    expect(result[0].description).toContain('T-14_teacher');
    expect(result[0].description).toContain('a@b.de');
    expect(result[0].createdAt).toBe('2026-05-09T10:00:00Z');
    expect(result[0].metadata?.emailLogId).toBe('log1');
  });

  it('skips EMAIL_LOGS rows with status failed or skipped', () => {
    const logs = [
      makeLog('log1', 'failed', '2026-05-09T10:00:00Z', 'T-14_teacher', 'a@b.de'),
      makeLog('log2', 'skipped', '2026-05-09T11:00:00Z', 'T-14_teacher', 'b@b.de'),
    ];
    expect(mergeActivityWithEmailLogs([], logs)).toHaveLength(0);
  });

  it('dedupes EMAIL_LOGS rows already referenced by activity.metadata.emailLogId', () => {
    const activity = makeActivity('a1', '2026-05-10T12:00:00Z', {
      emailLogId: 'log1',
      templateName: 'T-14_teacher',
    });
    const log = makeLog('log1', 'sent', '2026-05-10T12:00:00Z', 'T-14_teacher', 'a@b.de');
    const result = mergeActivityWithEmailLogs([activity], [log]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1'); // the activity wins, log filtered
  });

  it('sorts merged result by date descending', () => {
    const old = makeActivity('a1', '2026-05-01T00:00:00Z');
    const log = makeLog('log1', 'sent', '2026-05-09T00:00:00Z', 'X', 'a@b.de');
    const recent = makeActivity('a2', '2026-05-10T00:00:00Z');
    const result = mergeActivityWithEmailLogs([old, recent], [log]);
    expect(result.map((r) => r.id)).toEqual(['a2', expect.stringContaining('log1'), 'a1']);
  });
});
