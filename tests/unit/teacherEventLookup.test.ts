/**
 * Test for teacher event lookup fix
 * Verifies that getTeacherEventDetail can find events by both eventId and simplybookId
 */

import { TeacherEventView } from '@/lib/types/teacher';

// Simulated getTeacherEventDetail logic (mirrors the actual implementation)
function getTeacherEventDetail(
  eventId: string,
  events: TeacherEventView[]
): TeacherEventView | null {
  // First try exact match on eventId
  let event = events.find((e) => e.eventId === eventId);
  // If not found, try matching by simplybookId (for setup-booking page compatibility)
  if (!event) {
    event = events.find((e) => e.simplybookId === eventId);
  }
  return event || null;
}

describe('Teacher Event Lookup', () => {
  const mockEvents: TeacherEventView[] = [
    {
      eventId: 'evt_kindergarten_st_bruno_minimusiker_20260324_25e789',
      simplybookId: '1727',
      schoolName: 'Kindergarten St.Bruno',
      eventDate: '2026-03-24',
      eventType: 'MiniMusiker Day',
      classes: [],
      status: 'upcoming',
    },
    {
      eventId: 'evt_another_school_20260401_abc123',
      simplybookId: '1850',
      schoolName: 'Another School',
      eventDate: '2026-04-01',
      eventType: 'MiniMusiker Day',
      classes: [],
      status: 'upcoming',
    },
    {
      // Event without simplybookId (legacy/directly linked)
      eventId: 'evt_legacy_event_20260415_xyz789',
      schoolName: 'Legacy School',
      eventDate: '2026-04-15',
      eventType: 'MiniMusiker Day',
      classes: [],
      status: 'upcoming',
    },
  ];

  describe('getTeacherEventDetail', () => {
    it('should find event by canonical eventId', () => {
      const result = getTeacherEventDetail(
        'evt_kindergarten_st_bruno_minimusiker_20260324_25e789',
        mockEvents
      );
      expect(result).not.toBeNull();
      expect(result?.schoolName).toBe('Kindergarten St.Bruno');
    });

    it('should find event by simplybookId when eventId does not match', () => {
      // This is the fix - setup page uses simplybookId "1727"
      const result = getTeacherEventDetail('1727', mockEvents);
      expect(result).not.toBeNull();
      expect(result?.schoolName).toBe('Kindergarten St.Bruno');
      expect(result?.eventId).toBe('evt_kindergarten_st_bruno_minimusiker_20260324_25e789');
    });

    it('should find another event by simplybookId', () => {
      const result = getTeacherEventDetail('1850', mockEvents);
      expect(result).not.toBeNull();
      expect(result?.schoolName).toBe('Another School');
    });

    it('should return null for non-existent eventId', () => {
      const result = getTeacherEventDetail('non_existent_id', mockEvents);
      expect(result).toBeNull();
    });

    it('should return null for non-existent simplybookId', () => {
      const result = getTeacherEventDetail('9999', mockEvents);
      expect(result).toBeNull();
    });

    it('should still find legacy events without simplybookId by eventId', () => {
      const result = getTeacherEventDetail(
        'evt_legacy_event_20260415_xyz789',
        mockEvents
      );
      expect(result).not.toBeNull();
      expect(result?.schoolName).toBe('Legacy School');
    });

    it('should prioritize eventId match over simplybookId match', () => {
      // If an eventId happens to equal another event's simplybookId,
      // the eventId match should take priority
      const eventsWithConflict: TeacherEventView[] = [
        {
          eventId: '1727', // eventId that looks like a simplybookId
          schoolName: 'Event With Numeric ID',
          eventDate: '2026-05-01',
          eventType: 'MiniMusiker Day',
          classes: [],
          status: 'upcoming',
        },
        {
          eventId: 'evt_other_event',
          simplybookId: '1727', // Same as first event's eventId
          schoolName: 'Event With SimplybookId 1727',
          eventDate: '2026-05-02',
          eventType: 'MiniMusiker Day',
          classes: [],
          status: 'upcoming',
        },
      ];

      const result = getTeacherEventDetail('1727', eventsWithConflict);
      // Should find the first one (eventId match takes priority)
      expect(result?.schoolName).toBe('Event With Numeric ID');
    });
  });
});
