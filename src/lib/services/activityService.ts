import Airtable from 'airtable';
import {
  EVENT_ACTIVITY_TABLE_ID,
  EVENT_ACTIVITY_FIELD_IDS,
  EVENT_ACTIVITY_FIELD_NAMES,
  EventActivity,
  EventActivityType,
  ActorType,
  CreateEventActivityInput,
} from '@/lib/types/airtable';

/**
 * ActivityService - Handles event activity logging for audit trail
 *
 * IMPORTANT: Activity logging is fire-and-forget. It should NEVER
 * fail the main operation. All methods catch errors internally.
 */
class ActivityService {
  private base: Airtable.Base;

  constructor() {
    this.base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(process.env.AIRTABLE_BASE_ID!);
  }

  /**
   * Log an activity to the EventActivity table
   * This is fire-and-forget - errors are logged but never thrown
   */
  async logActivity(input: CreateEventActivityInput): Promise<void> {
    try {
      // Build fields object for Airtable
      const fields: Airtable.FieldSet = {
        [EVENT_ACTIVITY_FIELD_IDS.event_id]: [input.eventRecordId],
        [EVENT_ACTIVITY_FIELD_IDS.activity_type]: input.activityType,
        [EVENT_ACTIVITY_FIELD_IDS.description]: input.description,
        [EVENT_ACTIVITY_FIELD_IDS.actor_email]: input.actorEmail,
        [EVENT_ACTIVITY_FIELD_IDS.actor_type]: input.actorType,
      };

      if (input.metadata) {
        fields[EVENT_ACTIVITY_FIELD_IDS.metadata] = JSON.stringify(input.metadata);
      }

      await this.base(EVENT_ACTIVITY_TABLE_ID).create([{ fields }]);

      console.log(
        `[ActivityService] Logged: ${input.activityType} by ${input.actorEmail}`
      );
    } catch (error) {
      // Never throw - just log the error
      console.error('[ActivityService] Failed to log activity:', error);
    }
  }

  /**
   * Get activities for an event, ordered by most recent first
   */
  async getActivitiesForEvent(
    eventRecordId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ activities: EventActivity[]; hasMore: boolean }> {
    const { limit = 20, offset = 0 } = options;

    try {
      // Note: Airtable's SEARCH formula doesn't work reliably on linked record fields
      // We fetch all records and filter in code for reliability
      const records = await this.base(EVENT_ACTIVITY_TABLE_ID)
        .select({
          sort: [{ field: EVENT_ACTIVITY_FIELD_NAMES.created_at, direction: 'desc' }],
        })
        .all();

      // Filter records by event_id (linked record field contains array of record IDs)
      const filteredRecords = records.filter((record) => {
        const eventIds = record.get(EVENT_ACTIVITY_FIELD_NAMES.event_id) as string[] | undefined;
        return eventIds?.includes(eventRecordId);
      });

      // Apply pagination
      const paginatedRecords = filteredRecords.slice(offset, offset + limit);
      const hasMore = filteredRecords.length > offset + limit;

      const activities: EventActivity[] = paginatedRecords.map((record) => {
        // Use field names for .get() calls (Airtable SDK expects names, not IDs)
        const metadataRaw = record.get(EVENT_ACTIVITY_FIELD_NAMES.metadata) as string | undefined;
        let metadata: Record<string, unknown> | undefined;

        if (metadataRaw) {
          try {
            metadata = JSON.parse(metadataRaw);
          } catch {
            metadata = undefined;
          }
        }

        const eventIds = record.get(EVENT_ACTIVITY_FIELD_NAMES.event_id) as string[] | undefined;

        return {
          id: record.id,
          activityId: record.get(EVENT_ACTIVITY_FIELD_NAMES.activity_id) as number,
          eventId: eventIds?.[0] || '',
          activityType: record.get(EVENT_ACTIVITY_FIELD_NAMES.activity_type) as EventActivityType,
          description: (record.get(EVENT_ACTIVITY_FIELD_NAMES.description) as string) || '',
          actorEmail: (record.get(EVENT_ACTIVITY_FIELD_NAMES.actor_email) as string) || '',
          actorType: (record.get(EVENT_ACTIVITY_FIELD_NAMES.actor_type) as ActorType) || 'system',
          metadata,
          createdAt: (record.get(EVENT_ACTIVITY_FIELD_NAMES.created_at) as string) || '',
        };
      });

      return { activities, hasMore };
    } catch (error) {
      console.error('[ActivityService] Failed to fetch activities:', error);
      return { activities: [], hasMore: false };
    }
  }

  /**
   * Helper to generate description text for common activity types
   */
  static generateDescription(
    activityType: EventActivityType,
    details: Record<string, string | number | undefined>
  ): string {
    switch (activityType) {
      case 'event_created':
        return `Event created for "${details.schoolName}"`;
      case 'date_changed':
        return `Event date changed from ${details.oldDate} to ${details.newDate}`;
      case 'staff_assigned':
        return `Staff member "${details.staffName}" assigned to event`;
      case 'staff_unassigned':
        return `Staff member unassigned from event`;
      case 'class_added':
        return `Added class "${details.className}" with ${details.numChildren} children`;
      case 'class_updated':
        return `Updated class "${details.className}"`;
      case 'class_deleted':
        return `Deleted class "${details.className}"`;
      case 'group_created':
        return `Created group "${details.groupName}"`;
      case 'group_updated':
        return `Updated group "${details.groupName}"`;
      case 'group_deleted':
        return `Deleted group "${details.groupName}"`;
      case 'song_added':
        return `Added song "${details.songTitle}" to ${details.targetType} "${details.targetName}"`;
      case 'song_updated':
        return `Updated song "${details.songTitle}"`;
      case 'song_deleted':
        return `Deleted song "${details.songTitle}"`;
      case 'tasks_generated':
        return `Generated ${details.taskCount} tasks for event`;
      case 'booking_status_changed':
        return `Booking status changed to "${details.newStatus}"`;
      default:
        return 'Activity logged';
    }
  }
}

// Singleton instance
let activityServiceInstance: ActivityService | null = null;

export function getActivityService(): ActivityService {
  if (!activityServiceInstance) {
    activityServiceInstance = new ActivityService();
  }
  return activityServiceInstance;
}

// Re-export for convenience
export { ActivityService };
