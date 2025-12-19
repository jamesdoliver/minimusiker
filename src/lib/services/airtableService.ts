import Airtable, { FieldSet, Table } from 'airtable';
import {
  ParentJourney,
  AirtableRecord,
  QueryFilter,
  ParentPortalData,
  AIRTABLE_FIELD_IDS,
  PERSONEN_TABLE_ID,
  PERSONEN_FIELD_IDS,
  ROLLEN_IDS,
  BundleProduct,
  Order,
  SchoolEventSummary,
  SchoolEventDetail,
  EventClassDetail,
  TeamStaffMember,
  SchoolBooking,
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
  EINRICHTUNGEN_TABLE_ID,
  EINRICHTUNGEN_FIELD_IDS,
  Einrichtung,
} from '@/lib/types/airtable';

// Single table name in Airtable
export const TABLE_NAME = 'parent_journey_table';

class AirtableService {
  private base: Airtable.Base;
  private static instance: AirtableService;

  private constructor() {
    // Configure with Personal Access Token (PAT)
    // The apiKey parameter accepts both old API keys and new PATs
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY!, // This is actually the PAT
    });
    this.base = Airtable.base(process.env.AIRTABLE_BASE_ID!);
  }

  public static getInstance(): AirtableService {
    if (!AirtableService.instance) {
      AirtableService.instance = new AirtableService();
    }
    return AirtableService.instance;
  }

  // Helper method to transform Airtable record to typed object
  private transformRecord(record: any): ParentJourney & { id: string } {
    return {
      id: record.id,
      booking_id: record.fields.booking_id || record.fields[AIRTABLE_FIELD_IDS.booking_id],
      class_id: record.fields.class_id || record.fields[AIRTABLE_FIELD_IDS.class_id],
      school_name: record.fields.school_name || record.fields[AIRTABLE_FIELD_IDS.school_name],
      main_teacher: record.fields.main_teacher || record.fields[AIRTABLE_FIELD_IDS.main_teacher],
      other_teachers: record.fields.other_teachers || record.fields[AIRTABLE_FIELD_IDS.other_teachers],
      class: record.fields.class || record.fields[AIRTABLE_FIELD_IDS.class],
      registered_child: record.fields.registered_child || record.fields[AIRTABLE_FIELD_IDS.registered_child],
      parent_first_name: record.fields.parent_first_name || record.fields[AIRTABLE_FIELD_IDS.parent_first_name],
      parent_email: record.fields.parent_email || record.fields[AIRTABLE_FIELD_IDS.parent_email],
      parent_telephone: record.fields.parent_telephone || record.fields[AIRTABLE_FIELD_IDS.parent_telephone],
      email_campaigns: record.fields.email_campaigns || record.fields[AIRTABLE_FIELD_IDS.email_campaigns],
      order_number: record.fields.order_number || record.fields[AIRTABLE_FIELD_IDS.order_number],
      school_recording: record.fields.school_recording || record.fields[AIRTABLE_FIELD_IDS.school_recording],
      event_type: record.fields.event_type || record.fields[AIRTABLE_FIELD_IDS.event_type],
      parent_id: record.fields.parent_id || record.fields[AIRTABLE_FIELD_IDS.parent_id],
      booking_date: record.fields.booking_date || record.fields[AIRTABLE_FIELD_IDS.booking_date],
      child_id: record.fields.child_id || record.fields[AIRTABLE_FIELD_IDS.child_id],
      registered_complete: record.fields.registered_complete || record.fields[AIRTABLE_FIELD_IDS.registered_complete],
      total_children: record.fields.total_children || record.fields[AIRTABLE_FIELD_IDS.total_children],
      assigned_staff: record.fields.assigned_staff || record.fields[AIRTABLE_FIELD_IDS.assigned_staff],
    };
  }

  // Generic query method
  private async query(filter?: QueryFilter): Promise<(ParentJourney & { id: string })[]> {
    try {
      // Build select options, only including defined values
      const selectOptions: any = {
        pageSize: filter?.pageSize || 100,
      };

      // Only add optional parameters if they are defined
      if (filter?.filterByFormula) {
        selectOptions.filterByFormula = filter.filterByFormula;
      }
      if (filter?.sort) {
        selectOptions.sort = filter.sort;
      }
      if (filter?.maxRecords) {
        selectOptions.maxRecords = filter.maxRecords;
      }
      if (filter?.returnFieldsByFieldId !== undefined) {
        selectOptions.returnFieldsByFieldId = filter.returnFieldsByFieldId;
      }

      const records = await this.base(TABLE_NAME)
        .select(selectOptions)
        .all();

      return records.map((record) => this.transformRecord(record));
    } catch (error) {
      console.error(`Error querying ${TABLE_NAME}:`, error);
      throw new Error(`Failed to query ${TABLE_NAME}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create a new record
  async create(data: Partial<ParentJourney>): Promise<ParentJourney & { id: string }> {
    try {
      // Map the data to field names (not IDs) for creation
      const recordData: any = {};
      if (data.booking_id !== undefined) recordData.booking_id = data.booking_id;
      if (data.class_id !== undefined) recordData.class_id = data.class_id;
      if (data.school_name !== undefined) recordData.school_name = data.school_name;
      if (data.main_teacher !== undefined) recordData.main_teacher = data.main_teacher;
      if (data.other_teachers !== undefined) recordData.other_teachers = data.other_teachers;
      if (data.class !== undefined) recordData.class = data.class;
      if (data.registered_child !== undefined) recordData.registered_child = data.registered_child;
      if (data.parent_first_name !== undefined) recordData.parent_first_name = data.parent_first_name;
      if (data.parent_email !== undefined) recordData.parent_email = data.parent_email;
      if (data.parent_telephone !== undefined) recordData.parent_telephone = data.parent_telephone;
      if (data.email_campaigns !== undefined) recordData.email_campaigns = data.email_campaigns;
      if (data.order_number !== undefined) recordData.order_number = data.order_number;
      if (data.event_type !== undefined) recordData.event_type = data.event_type;
      if (data.parent_id !== undefined) recordData.parent_id = data.parent_id;
      if (data.booking_date !== undefined) recordData.booking_date = data.booking_date;
      if (data.child_id !== undefined) recordData.child_id = data.child_id;
      if (data.registered_complete !== undefined) recordData.registered_complete = data.registered_complete;
      if (data.total_children !== undefined) recordData.total_children = data.total_children;

      const record = await this.base(TABLE_NAME).create(recordData);
      return this.transformRecord(record);
    } catch (error) {
      console.error(`Error creating record in ${TABLE_NAME}:`, error);
      throw new Error(`Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update an existing record
  async update(id: string, data: Partial<ParentJourney>): Promise<ParentJourney & { id: string }> {
    try {
      const recordData: any = {};
      if (data.booking_id !== undefined) recordData.booking_id = data.booking_id;
      if (data.class_id !== undefined) recordData.class_id = data.class_id;
      if (data.school_name !== undefined) recordData.school_name = data.school_name;
      if (data.main_teacher !== undefined) recordData.main_teacher = data.main_teacher;
      if (data.other_teachers !== undefined) recordData.other_teachers = data.other_teachers;
      if (data.class !== undefined) recordData.class = data.class;
      if (data.registered_child !== undefined) recordData.registered_child = data.registered_child;
      if (data.parent_first_name !== undefined) recordData.parent_first_name = data.parent_first_name;
      if (data.parent_email !== undefined) recordData.parent_email = data.parent_email;
      if (data.parent_telephone !== undefined) recordData.parent_telephone = data.parent_telephone;
      if (data.email_campaigns !== undefined) recordData.email_campaigns = data.email_campaigns;
      if (data.order_number !== undefined) recordData.order_number = data.order_number;
      if (data.event_type !== undefined) recordData.event_type = data.event_type;
      if (data.parent_id !== undefined) recordData.parent_id = data.parent_id;
      if (data.booking_date !== undefined) recordData.booking_date = data.booking_date;
      if (data.child_id !== undefined) recordData.child_id = data.child_id;
      if (data.registered_complete !== undefined) recordData.registered_complete = data.registered_complete;
      if (data.total_children !== undefined) recordData.total_children = data.total_children;

      const record = await this.base(TABLE_NAME).update(id, recordData);
      return this.transformRecord(record);
    } catch (error) {
      console.error(`Error updating record in ${TABLE_NAME}:`, error);
      throw new Error(`Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete a record
  async delete(id: string): Promise<void> {
    try {
      await this.base(TABLE_NAME).destroy(id);
    } catch (error) {
      console.error(`Error deleting record from ${TABLE_NAME}:`, error);
      throw new Error(`Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== Specific Query Methods ====================

  // Get parent journey by email (for login) - returns first match
  async getParentByEmail(email: string): Promise<ParentJourney | null> {
    // Use field ID for more reliable filtering
    const records = await this.query({
      filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      maxRecords: 1,
    });
    return records[0] || null;
  }

  // Get ALL parent journey records by email (for multi-event support)
  async getParentRecordsByEmail(email: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      sort: [{ field: 'booking_date', direction: 'desc' }], // Most recent first
    });
  }

  // Get the most recent parent journey record for a given email
  async getMostRecentParentRecord(email: string): Promise<ParentJourney | null> {
    const records = await this.getParentRecordsByEmail(email);

    if (records.length === 0) {
      return null;
    }

    // Filter and sort by date logic
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Split into past/current and future events
    const pastOrCurrentEvents = records.filter(r => {
      if (!r.booking_date) return false;
      return r.booking_date <= nowStr;
    });

    const futureEvents = records.filter(r => {
      if (!r.booking_date) return false;
      return r.booking_date > nowStr;
    });

    // Priority:
    // 1. Most recent past/current event (just happened or happening today)
    // 2. Nearest future event (about to happen)
    // 3. Fallback to most recent overall

    if (pastOrCurrentEvents.length > 0) {
      return pastOrCurrentEvents[0]; // Already sorted desc, so first is most recent
    } else if (futureEvents.length > 0) {
      return futureEvents[futureEvents.length - 1]; // Last one is nearest future
    }

    return records[0]; // Fallback to most recent by date
  }

  // Get parent journey by parent ID
  async getParentById(parentId: string): Promise<ParentJourney | null> {
    const records = await this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.parent_id}} = '${parentId}'`,
      maxRecords: 1,
    });
    return records[0] || null;
  }

  // Get parent journey by booking ID
  async getParentByBookingId(bookingId: string): Promise<ParentJourney | null> {
    const records = await this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
      maxRecords: 1,
    });
    return records[0] || null;
  }

  // Get all parent journeys for a specific school
  async getParentsBySchool(schoolName: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.school_name}} = '${schoolName}'`,
      sort: [{ field: 'parent_first_name', direction: 'asc' }],
    });
  }

  // Get all parent journeys for a specific event type
  async getParentsByEventType(eventType: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.event_type}} = '${eventType}'`,
      sort: [{ field: 'school_name', direction: 'asc' }],
    });
  }

  // Get all parent journeys for a specific class
  async getParentsByClass(className: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.class}} = '${className}'`,
      sort: [{ field: 'registered_child', direction: 'asc' }],
    });
  }

  // Get all parent journeys for a specific class_id
  async getRecordsByClassId(classId: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.class_id}} = '${classId}'`,
      sort: [{ field: 'registered_child', direction: 'asc' }],
    });
  }

  // Get all unique classes for a specific booking_id (event)
  async getClassesByBookingId(bookingId: string): Promise<Array<{
    class_id: string;
    class_name: string;
    main_teacher?: string;
    other_teachers?: string;
    parent_count: number;
  }>> {
    const records = await this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
    });

    // Group by class_id to get unique classes
    const classesMap = new Map<string, {
      class_id: string;
      class_name: string;
      main_teacher?: string;
      other_teachers?: string;
      parent_count: number;
    }>();

    records.forEach((record) => {
      if (!record.class_id) return;

      if (!classesMap.has(record.class_id)) {
        classesMap.set(record.class_id, {
          class_id: record.class_id,
          class_name: record.class,
          main_teacher: record.main_teacher,
          other_teachers: record.other_teachers,
          parent_count: 1,
        });
      } else {
        const existing = classesMap.get(record.class_id)!;
        existing.parent_count += 1;
      }
    });

    return Array.from(classesMap.values());
  }

  // Update class_id for specific records (used during migration or event creation)
  async updateClassIdForRecords(
    recordIds: string[],
    classId: string
  ): Promise<void> {
    try {
      const updates = recordIds.map((id) => ({
        id,
        fields: {
          class_id: classId,
        },
      }));

      // Airtable allows updating up to 10 records at once
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        await this.base(TABLE_NAME).update(batch as any);
      }
    } catch (error) {
      console.error('Error updating class_id:', error);
      throw new Error(`Failed to update class_id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Bulk update class_id for records matching criteria
  async assignClassIdToRecords(
    schoolName: string,
    bookingDate: string,
    className: string,
    classId: string
  ): Promise<number> {
    try {
      // Find all records matching the criteria
      const records = await this.query({
        filterByFormula: `AND(
          {${AIRTABLE_FIELD_IDS.school_name}} = '${schoolName}',
          {booking_date} = '${bookingDate}',
          {${AIRTABLE_FIELD_IDS.class}} = '${className}'
        )`,
      });

      if (records.length === 0) {
        return 0;
      }

      // Update all matching records with the class_id
      const updates = records.map((record) => ({
        id: record.id,
        fields: {
          class_id: classId,
        },
      }));

      // Update in batches of 10
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        await this.base(TABLE_NAME).update(batch as any);
      }

      return records.length;
    } catch (error) {
      console.error('Error assigning class_id:', error);
      throw new Error(`Failed to assign class_id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Search parent journeys by child name
  async searchByChildName(childName: string): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `SEARCH(LOWER('${childName}'), LOWER({${AIRTABLE_FIELD_IDS.registered_child}}))`,
    });
  }

  // Get parent journeys with orders
  async getParentsWithOrders(): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `NOT({${AIRTABLE_FIELD_IDS.order_number}} = '')`,
      sort: [{ field: 'order_number', direction: 'desc' }],
    });
  }

  // Get parent journeys opted into email campaigns
  async getEmailCampaignOptIns(): Promise<ParentJourney[]> {
    return this.query({
      filterByFormula: `{${AIRTABLE_FIELD_IDS.email_campaigns}} = 'yes'`,
    });
  }

  // ==================== Parent Portal Data Methods ====================

  // Get complete parent portal data
  async getParentPortalData(email: string): Promise<ParentPortalData | null> {
    const parentJourney = await this.getParentByEmail(email);

    if (!parentJourney) {
      return null;
    }

    // Mock bundle products for now (these would come from Shopify or another source)
    const bundleProducts: BundleProduct[] = [
      {
        id: 'bundle-1',
        name: `${parentJourney.school_name} T-Shirt`,
        type: 'tshirt',
        price: 19.99,
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        description: 'Premium quality event t-shirt',
      },
      {
        id: 'recording-1',
        name: `${parentJourney.event_type} Recording`,
        type: 'recording',
        price: 9.99,
        description: 'Full digital recording of the event',
      },
    ];

    return {
      parentJourney,
      hasActiveBundle: true,
      bundleProducts,
      // School recording URL would come from R2 storage
      schoolRecordingUrl: parentJourney.school_recording?.[0]?.url,
    };
  }

  // ==================== Bulk Operations ====================

  // Get all records (with pagination support)
  async getAllRecords(offset?: string): Promise<{ records: ParentJourney[]; offset?: string }> {
    try {
      const selectOptions: any = {
        pageSize: 100,
      };

      // Only add offset if it's provided
      if (offset) {
        selectOptions.offset = offset;
      }

      const result = await this.base(TABLE_NAME)
        .select(selectOptions)
        .firstPage();

      const records = result.map((record) => this.transformRecord(record));

      // Airtable provides offset if there are more pages
      const newOffset = result.length === 100 ? result[result.length - 1].id : undefined;

      return {
        records,
        offset: newOffset,
      };
    } catch (error) {
      console.error('Error fetching all records:', error);
      throw new Error(`Failed to fetch records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update email campaign preference for multiple parents
  async updateEmailCampaignPreferences(parentIds: string[], preference: string): Promise<void> {
    try {
      const updates = parentIds.map((parentId) => ({
        id: parentId,
        fields: {
          [AIRTABLE_FIELD_IDS.email_campaigns]: preference,
        },
      }));

      // Airtable allows updating up to 10 records at once
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        await this.base(TABLE_NAME).update(batch as any);
      }
    } catch (error) {
      console.error('Error updating email preferences:', error);
      throw new Error(`Failed to update email preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== Event Management ====================

  // Get unique class sessions from parent journey records
  // Groups by school + date + class to get unique class recordings
  async getUniqueEvents(): Promise<Array<{
    booking_id: string;
    class_id?: string;
    school_name: string;
    booking_date?: string;
    event_type: string;
    main_teacher?: string;
    other_teachers?: string;
    class: string;
    parent_count: number;
    booking_ids: string[]; // All booking IDs for this class session
  }>> {
    try {
      const allRecords = await this.query({
        sort: [{ field: 'booking_date', direction: 'desc' }],
      });

      // Group by class_id if available, otherwise fall back to school + date + class
      const eventsMap = new Map<string, {
        booking_id: string;
        class_id?: string;
        school_name: string;
        booking_date?: string;
        event_type: string;
        main_teacher?: string;
        other_teachers?: string;
        class: string;
        parent_count: number;
        booking_ids: string[];
      }>();

      allRecords.forEach((record) => {
        // Prefer class_id for grouping if available, otherwise use legacy key
        const key = record.class_id ||
                    `${record.school_name}|${record.booking_date || 'no-date'}|${record.class}`;

        // Check if this is a real parent registration or a placeholder
        const isRealParent = record.parent_id !== 'PLACEHOLDER' && record.parent_id;

        if (!eventsMap.has(key)) {
          eventsMap.set(key, {
            booking_id: record.booking_id,
            class_id: record.class_id,
            school_name: record.school_name,
            booking_date: record.booking_date,
            event_type: record.event_type,
            main_teacher: record.main_teacher,
            other_teachers: record.other_teachers,
            class: record.class,
            parent_count: isRealParent ? 1 : 0, // Only count real parents
            booking_ids: [record.booking_id],
          });
        } else {
          const existing = eventsMap.get(key)!;
          if (isRealParent) {
            existing.parent_count += 1; // Only increment for real parents
          }
          existing.booking_ids.push(record.booking_id);
        }
      });

      return Array.from(eventsMap.values()).sort((a, b) => {
        // Sort by date descending (most recent first)
        if (!a.booking_date) return 1;
        if (!b.booking_date) return -1;
        return new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime();
      });
    } catch (error) {
      console.error('Error fetching unique events:', error);
      throw new Error(`Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get school-level event summaries for admin cards view
  // Groups by booking_id (school + date) and aggregates stats
  async getSchoolEventSummaries(): Promise<SchoolEventSummary[]> {
    try {
      const allRecords = await this.query({
        sort: [{ field: 'booking_date', direction: 'desc' }],
      });

      // Group by booking_id (which represents school + date)
      const eventsMap = new Map<string, {
        eventId: string;
        schoolName: string;
        eventDate: string;
        eventType: string;
        mainTeacher: string;
        classIds: Set<string>;
        totalChildren: number;
        parentCount: number;
        seenClassIds: Set<string>; // Track which classes we've counted children for
        assignedStaffId?: string;
      }>();

      allRecords.forEach((record) => {
        if (!record.booking_id) return;

        const isRealParent = record.parent_id !== 'PLACEHOLDER' && record.parent_id;

        if (!eventsMap.has(record.booking_id)) {
          const classIdSet = new Set<string>();
          const seenClassIds = new Set<string>();
          if (record.class_id) {
            classIdSet.add(record.class_id);
            seenClassIds.add(record.class_id);
          }

          eventsMap.set(record.booking_id, {
            eventId: record.booking_id,
            schoolName: record.school_name,
            eventDate: record.booking_date || '',
            eventType: record.event_type,
            mainTeacher: record.main_teacher || '',
            classIds: classIdSet,
            totalChildren: record.total_children || 0,
            parentCount: isRealParent ? 1 : 0,
            seenClassIds,
            assignedStaffId: record.assigned_staff?.[0], // Get first linked staff ID
          });
        } else {
          const existing = eventsMap.get(record.booking_id)!;

          // Add class_id to set and count children only once per class
          if (record.class_id && !existing.seenClassIds.has(record.class_id)) {
            existing.classIds.add(record.class_id);
            existing.seenClassIds.add(record.class_id);
            existing.totalChildren += record.total_children || 0;
          }

          // Count real parents
          if (isRealParent) {
            existing.parentCount += 1;
          }

          // Capture assigned staff if not already set
          if (!existing.assignedStaffId && record.assigned_staff?.[0]) {
            existing.assignedStaffId = record.assigned_staff[0];
          }
        }
      });

      // Collect all unique staff IDs to resolve names
      const staffIds = new Set<string>();
      eventsMap.forEach(event => {
        if (event.assignedStaffId) {
          staffIds.add(event.assignedStaffId);
        }
      });

      // Fetch staff names if there are any assigned staff
      const staffNames = new Map<string, string>();
      if (staffIds.size > 0) {
        try {
          const staffRecords = await this.base(PERSONEN_TABLE_ID)
            .select({
              filterByFormula: `OR(${Array.from(staffIds).map(id => `RECORD_ID() = '${id}'`).join(',')})`,
            })
            .all();

          staffRecords.forEach(record => {
            // Airtable returns fields by display name, not field ID
            const name = record.fields['staff_name'] as string;
            if (name) {
              staffNames.set(record.id, name);
            }
          });
        } catch (error) {
          console.error('Error fetching staff names:', error);
          // Continue without staff names if fetch fails
        }
      }

      // Convert to array with computed fields
      return Array.from(eventsMap.values())
        .map(event => ({
          eventId: event.eventId,
          schoolName: event.schoolName,
          eventDate: event.eventDate,
          eventType: event.eventType,
          mainTeacher: event.mainTeacher,
          classCount: event.classIds.size,
          totalChildren: event.totalChildren,
          totalParents: event.parentCount,
          assignedStaffId: event.assignedStaffId,
          assignedStaffName: event.assignedStaffId ? staffNames.get(event.assignedStaffId) : undefined,
        }))
        .sort((a, b) => {
          // Sort by date descending
          if (!a.eventDate) return 1;
          if (!b.eventDate) return -1;
          return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
        });
    } catch (error) {
      console.error('Error fetching school event summaries:', error);
      throw new Error(`Failed to fetch school events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get full event detail including all classes for detail page
  async getSchoolEventDetail(eventId: string): Promise<SchoolEventDetail | null> {
    try {
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId}'`,
      });

      if (records.length === 0) return null;

      // Build class-level aggregations
      const classesMap = new Map<string, {
        classId: string;
        className: string;
        mainTeacher?: string;
        totalChildren: number;
        registeredParents: number;
      }>();

      let schoolName = '';
      let eventDate = '';
      let eventType = '';
      let mainTeacher = '';
      let assignedStaffId: string | undefined;

      records.forEach((record) => {
        // Capture event-level data from first record
        if (!schoolName) {
          schoolName = record.school_name;
          eventDate = record.booking_date || '';
          eventType = record.event_type;
          mainTeacher = record.main_teacher || '';
          assignedStaffId = record.assigned_staff?.[0];
        }
        // Also capture assigned staff if not yet set
        if (!assignedStaffId && record.assigned_staff?.[0]) {
          assignedStaffId = record.assigned_staff[0];
        }

        if (!record.class_id) return;

        const isRealParent = record.parent_id !== 'PLACEHOLDER' && record.parent_id;

        if (!classesMap.has(record.class_id)) {
          classesMap.set(record.class_id, {
            classId: record.class_id,
            className: record.class,
            mainTeacher: record.main_teacher,
            totalChildren: record.total_children || 0,
            registeredParents: isRealParent ? 1 : 0,
          });
        } else {
          const existing = classesMap.get(record.class_id)!;
          if (isRealParent) {
            existing.registeredParents += 1;
          }
        }
      });

      // Convert classes to array with computed fields
      const classes: EventClassDetail[] = Array.from(classesMap.values()).map(cls => ({
        ...cls,
        registrationRate: cls.totalChildren > 0
          ? Math.round((cls.registeredParents / cls.totalChildren) * 100)
          : 0,
      })).sort((a, b) => a.className.localeCompare(b.className));

      // Compute totals
      const totalChildren = classes.reduce((sum, c) => sum + c.totalChildren, 0);
      const totalParents = classes.reduce((sum, c) => sum + c.registeredParents, 0);

      // Fetch assigned staff name if there's an assigned staff
      let assignedStaffName: string | undefined;
      if (assignedStaffId) {
        try {
          const staffRecords = await this.base(PERSONEN_TABLE_ID)
            .select({
              filterByFormula: `RECORD_ID() = '${assignedStaffId}'`,
              maxRecords: 1,
            })
            .all();

          if (staffRecords.length > 0) {
            // Airtable returns fields by display name, not field ID
            assignedStaffName = staffRecords[0].fields['staff_name'] as string;
          }
        } catch (error) {
          console.error('Error fetching assigned staff name:', error);
        }
      }

      return {
        eventId,
        schoolName,
        eventDate,
        eventType,
        mainTeacher,
        classCount: classes.length,
        totalChildren,
        totalParents,
        assignedStaffId,
        assignedStaffName,
        classes,
        overallRegistrationRate: totalChildren > 0
          ? Math.round((totalParents / totalChildren) * 100)
          : 0,
      };
    } catch (error) {
      console.error('Error fetching school event detail:', error);
      throw new Error(`Failed to fetch event detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== Registration Methods ====================

  /**
   * Check if a parent email is already registered for a specific event
   */
  async isParentRegisteredForEvent(
    email: string,
    bookingId: string
  ): Promise<boolean> {
    try {
      const records = await this.query({
        filterByFormula: `AND(
          LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}'),
          {${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'
        )`,
        maxRecords: 1,
      });
      return records.length > 0;
    } catch (error) {
      console.error('Error checking parent registration:', error);
      throw new Error(`Failed to check registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get event and class details for registration validation
   */
  async getEventAndClassDetails(
    bookingId: string,
    classId: string
  ): Promise<import('@/lib/types/airtable').EventClassDetails | null> {
    try {
      const records = await this.query({
        filterByFormula: `AND(
          {${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}',
          {${AIRTABLE_FIELD_IDS.class_id}} = '${classId}'
        )`,
        maxRecords: 1,
      });

      if (records.length === 0) return null;

      const record = records[0];
      return {
        schoolName: record.school_name,
        eventType: record.event_type,
        bookingDate: record.booking_date,
        className: record.class,
        teacherName: record.main_teacher || '',
        otherTeachers: record.other_teachers,
        bookingId: record.booking_id,
      };
    } catch (error) {
      console.error('Error fetching event details:', error);
      throw new Error(`Failed to fetch event details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk create parent journey records
   * Used during registration to create one record per child
   */
  async createBulkParentJourneys(
    records: Partial<ParentJourney>[]
  ): Promise<(ParentJourney & { id: string })[]> {
    try {
      const createdRecords: (ParentJourney & { id: string })[] = [];

      // Create in batches of 10 (Airtable limit)
      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(async (record, idx) => {
            try {
              return await this.create(record);
            } catch (error) {
              // Log detailed error information for debugging
              console.error(`Failed to create record at index ${i + idx}:`, {
                recordData: record,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                errorDetails: error,
              });
              // Re-throw to maintain existing behavior
              throw error;
            }
          })
        );
        createdRecords.push(...results);
      }

      return createdRecords;
    } catch (error) {
      console.error('Error creating bulk parent journeys:', error);
      throw new Error(`Failed to create records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== School Search & Registration ====================

  // Search for active schools with upcoming events
  async searchActiveSchools(searchQuery: string): Promise<Array<{
    schoolName: string;
    eventCount: number;
  }>> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all records with future booking dates
      const allRecords = await this.query({
        filterByFormula: `IS_AFTER({booking_date}, '${today}')`,
      });

      // Filter by search query (case-insensitive)
      const matchingRecords = allRecords.filter(r =>
        r.school_name &&
        r.school_name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Group by school and count unique events
      const schoolMap = new Map<string, Set<string>>();
      matchingRecords.forEach(r => {
        if (r.school_name && r.booking_id) {
          if (!schoolMap.has(r.school_name)) {
            schoolMap.set(r.school_name, new Set());
          }
          schoolMap.get(r.school_name)!.add(r.booking_id);
        }
      });

      // Convert to array and sort by event count
      return Array.from(schoolMap.entries())
        .map(([schoolName, events]) => ({
          schoolName,
          eventCount: events.size,
        }))
        .sort((a, b) => b.eventCount - a.eventCount);
    } catch (error) {
      console.error('Error searching active schools:', error);
      return [];
    }
  }

  // Get events for a specific school
  async getSchoolEvents(schoolName: string): Promise<Array<{
    bookingId: string;
    eventType: string;
    eventDate: string;
    classCount: number;
  }>> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all records for this school with future dates
      const records = await this.query({
        filterByFormula: `AND(
          {school_name} = '${schoolName.replace(/'/g, "\\'")}',
          IS_AFTER({booking_date}, '${today}')
        )`,
      });

      // Group by booking_id to get unique events
      const eventMap = new Map<string, {
        eventType: string;
        eventDate: string;
        classes: Set<string>;
      }>();

      records.forEach(r => {
        if (r.booking_id) {
          if (!eventMap.has(r.booking_id)) {
            eventMap.set(r.booking_id, {
              eventType: r.event_type || 'Event',
              eventDate: r.booking_date || '',
              classes: new Set(),
            });
          }
          if (r.class_id) {
            eventMap.get(r.booking_id)!.classes.add(r.class_id);
          }
        }
      });

      // Convert to array and sort by date
      return Array.from(eventMap.entries())
        .map(([bookingId, data]) => ({
          bookingId,
          eventType: data.eventType,
          eventDate: data.eventDate,
          classCount: data.classes.size,
        }))
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    } catch (error) {
      console.error('Error getting school events:', error);
      return [];
    }
  }

  // Get classes for a specific event
  async getEventClasses(bookingId: string): Promise<Array<{
    classId: string;
    className: string;
    teacherName: string;
    registeredCount: number;
  }>> {
    try {
      // Get all records for this event
      const records = await this.query({
        filterByFormula: `{booking_id} = '${bookingId}'`,
      });

      // Group by class_id
      const classMap = new Map<string, {
        className: string;
        teacherName: string;
        registeredCount: number;
      }>();

      records.forEach(r => {
        if (r.class_id) {
          if (!classMap.has(r.class_id)) {
            classMap.set(r.class_id, {
              className: r.class || 'Unknown Class',
              teacherName: r.main_teacher || '',
              registeredCount: 0,
            });
          }
          // Only count non-placeholder records
          if (r.parent_id && r.parent_id !== 'PLACEHOLDER') {
            const current = classMap.get(r.class_id)!;
            current.registeredCount++;
          }
        }
      });

      // Convert to array and sort by class name
      return Array.from(classMap.entries())
        .map(([classId, data]) => ({
          classId,
          className: data.className,
          teacherName: data.teacherName,
          registeredCount: data.registeredCount,
        }))
        .sort((a, b) => a.className.localeCompare(b.className));
    } catch (error) {
      console.error('Error getting event classes:', error);
      return [];
    }
  }

  // ==================== Dashboard Stats ====================

  // Get dashboard statistics for admin panel
  async getDashboardStats(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    totalParents: number;
    emailsSent: number;
    emailOpenRate: number;
    conversionRate: number;
    activeEvents: number;
  }> {
    try {
      // Get all records to calculate stats
      const allRecords = await this.query({});

      // Count unique parents
      const uniqueParents = new Set(
        allRecords
          .filter(r => r.parent_email)
          .map(r => r.parent_email)
      );

      // Count unique events
      const uniqueEvents = new Set(
        allRecords
          .filter(r => r.booking_id)
          .map(r => r.booking_id)
      );

      // Count orders (records with order_number)
      const orders = allRecords.filter(r => r.order_number);

      // Calculate total revenue from orders (would need actual order data)
      const totalRevenue = 0; // Placeholder - actual revenue would come from order system

      // Count emails sent (using email_campaigns field as proxy)
      const emailsSent = allRecords.filter(r => r.email_campaigns === 'yes').length;

      // Calculate email open rate (mock for now)
      const emailOpenRate = emailsSent > 0 ? 0.65 : 0;

      // Calculate conversion rate
      const conversionRate = uniqueParents.size > 0
        ? (orders.length / uniqueParents.size) * 100
        : 0;

      return {
        totalRevenue,
        totalOrders: orders.length,
        totalParents: uniqueParents.size,
        emailsSent,
        emailOpenRate,
        conversionRate: Math.round(conversionRate * 100) / 100,
        activeEvents: uniqueEvents.size,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return default stats on error
      return {
        totalRevenue: 0,
        totalOrders: 0,
        totalParents: 0,
        emailsSent: 0,
        emailOpenRate: 0,
        conversionRate: 0,
        activeEvents: 0,
      };
    }
  }

  // Get analytics for a specific event
  async getEventAnalytics(eventId: string): Promise<{
    eventId: string;
    eventName: string;
    totalRegistrations: number;
    totalRevenue: number;
    conversionRate: number;
  }> {
    try {
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId}'`,
      });

      const eventName = records[0]?.school_name || 'Unknown Event';
      const orders = records.filter(r => r.order_number);
      const totalRevenue = 0; // Placeholder - actual revenue would come from order system

      const conversionRate = records.length > 0
        ? (orders.length / records.length) * 100
        : 0;

      return {
        eventId,
        eventName,
        totalRegistrations: records.length,
        totalRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching event analytics:', error);
      return {
        eventId,
        eventName: 'Unknown',
        totalRegistrations: 0,
        totalRevenue: 0,
        conversionRate: 0,
      };
    }
  }

  // ==================== Test Connection ====================

  // Test the Airtable connection
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Try to fetch one record to test the connection
      const records = await this.query({
        maxRecords: 1,
      });

      return {
        success: true,
        message: `Successfully connected to Airtable. Found ${records.length > 0 ? '1 record' : 'no records'} in ${TABLE_NAME}.`,
        data: {
          tableName: TABLE_NAME,
          baseId: process.env.AIRTABLE_BASE_ID,
          recordFound: records.length > 0,
          sampleRecord: records[0] || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Airtable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==================== Staff Management ====================

  /**
   * Get all staff members with "Team" role from Personen table
   * These are the staff that can be assigned to events
   */
  async getTeamStaff(): Promise<TeamStaffMember[]> {
    try {
      const records = await this.base(PERSONEN_TABLE_ID)
        .select({
          // Use display name 'Team' since ARRAYJOIN returns names, not record IDs
          filterByFormula: `FIND('Team', ARRAYJOIN({${PERSONEN_FIELD_IDS.rollen}}))`,
        })
        .all();

      // Use display names to access fields since Airtable returns fields by name, not ID
      return records.map(record => ({
        id: record.id,
        name: record.fields['staff_name'] as string || '',
        email: record.fields['E-Mail'] as string || '',
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching team staff:', error);
      throw new Error(`Failed to fetch team staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a staff member by email from Personen table
   * Used to match logged-in staff to their Personen record
   */
  async getStaffByEmail(email: string): Promise<TeamStaffMember | null> {
    try {
      const records = await this.base(PERSONEN_TABLE_ID)
        .select({
          filterByFormula: `LOWER({${PERSONEN_FIELD_IDS.email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        })
        .all();

      if (records.length === 0) return null;

      // Use display names to access fields since Airtable returns fields by name, not ID
      const record = records[0];
      return {
        id: record.id,
        name: record.fields['staff_name'] as string || '',
        email: record.fields['E-Mail'] as string || '',
        numericId: record.fields['ID'] as number | undefined,
      };
    } catch (error) {
      console.error('Error fetching staff by email:', error);
      throw new Error(`Failed to fetch staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign a staff member to all records with a given booking_id
   * If no records exist in parent_journey_table, falls back to SchoolBookings table
   * @param bookingId - The event's booking_id (SimplyBook ID)
   * @param staffId - The Personen record ID to assign, or null to unassign
   */
  async assignStaffToEvent(bookingId: string, staffId: string | null): Promise<number> {
    try {
      // First, try to find records in parent_journey_table
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
      });

      if (records.length > 0) {
        // Has class data - update parent_journey_table records
        const updates = records.map(record => ({
          id: record.id,
          fields: {
            'assigned_staff': staffId ? [staffId] : [],
          },
        }));

        // Update in batches of 10 (Airtable limit)
        for (let i = 0; i < updates.length; i += 10) {
          const batch = updates.slice(i, i + 10);
          await this.base(TABLE_NAME).update(batch as any);
        }

        return records.length;
      }

      // No class data - try to update SchoolBookings table instead
      const bookingRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = '${bookingId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (bookingRecords.length === 0) {
        return 0;
      }

      // Update the SchoolBookings record
      await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(bookingRecords[0].id, {
        [SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff]: staffId ? [staffId] : [],
      });

      return 1;
    } catch (error) {
      console.error('Error assigning staff to event:', error);
      throw new Error(`Failed to assign staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get school event summaries filtered by assigned staff
   * Used for Staff Portal to show only assigned events
   */
  async getSchoolEventSummariesByStaff(staffId: string): Promise<SchoolEventSummary[]> {
    try {
      // Get all events first
      const allEvents = await this.getSchoolEventSummaries();

      // Filter to only events assigned to this staff member
      return allEvents.filter(event => event.assignedStaffId === staffId);
    } catch (error) {
      console.error('Error fetching staff event summaries:', error);
      throw new Error(`Failed to fetch staff events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== Engineer Management ====================

  /**
   * Get all staff members with "Engineer" role from Personen table
   */
  async getEngineerStaff(): Promise<TeamStaffMember[]> {
    try {
      const records = await this.base(PERSONEN_TABLE_ID)
        .select({
          filterByFormula: `FIND('Engineer', ARRAYJOIN({${PERSONEN_FIELD_IDS.rollen}}))`,
        })
        .all();

      return records.map(record => ({
        id: record.id,
        name: record.fields['staff_name'] as string || '',
        email: record.fields['E-Mail'] as string || '',
        numericId: record.fields['ID'] as number | undefined,
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching engineer staff:', error);
      throw new Error(`Failed to fetch engineers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a staff member has the Engineer role
   */
  async hasEngineerRole(staffId: string): Promise<boolean> {
    try {
      const record = await this.base(PERSONEN_TABLE_ID).find(staffId);
      // Airtable returns fields by display name, not field ID
      const roles = record.fields['Rollen'] as string[] | undefined;

      if (!roles || !Array.isArray(roles)) {
        return false;
      }

      // Check if Engineer role is in the linked roles
      return roles.includes(ROLLEN_IDS.engineer);
    } catch (error) {
      console.error('Error checking engineer role:', error);
      return false;
    }
  }

  /**
   * Check if a staff member has the Admin role
   */
  async hasAdminRole(staffId: string): Promise<boolean> {
    try {
      const record = await this.base(PERSONEN_TABLE_ID).find(staffId);
      // Airtable returns fields by display name, not field ID
      const roles = record.fields['Rollen'] as string[] | undefined;

      if (!roles || !Array.isArray(roles)) {
        return false;
      }

      // Check if Admin role is in the linked roles
      return roles.includes(ROLLEN_IDS.admin);
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  }

  /**
   * Get a staff member by email and verify they have Engineer role
   */
  async getEngineerByEmail(email: string): Promise<TeamStaffMember | null> {
    try {
      const staff = await this.getStaffByEmail(email);
      if (!staff) return null;

      // Check if they have the Engineer role
      const hasRole = await this.hasEngineerRole(staff.id);
      if (!hasRole) return null;

      return staff;
    } catch (error) {
      console.error('Error fetching engineer by email:', error);
      return null;
    }
  }

  /**
   * Assign an engineer to all records with a given booking_id
   * @param bookingId - The event's booking_id
   * @param engineerId - The Personen record ID to assign, or null to unassign
   */
  async assignEngineerToEvent(bookingId: string, engineerId: string | null): Promise<number> {
    try {
      // Find all records with this booking_id
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
      });

      if (records.length === 0) {
        return 0;
      }

      // Prepare updates - assigned_engineer is a linked record field (array)
      const updates = records.map(record => ({
        id: record.id,
        fields: {
          'assigned_engineer': engineerId ? [engineerId] : [],
        },
      }));

      // Update in batches of 10 (Airtable limit)
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        await this.base(TABLE_NAME).update(batch as any);
      }

      return records.length;
    } catch (error) {
      console.error('Error assigning engineer to event:', error);
      throw new Error(`Failed to assign engineer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get school event summaries filtered by assigned engineer
   * Used for Engineer Portal to show only assigned events
   */
  async getSchoolEventSummariesByEngineer(engineerId: string): Promise<SchoolEventSummary[]> {
    try {
      const allRecords = await this.query({
        sort: [{ field: 'booking_date', direction: 'desc' }],
      });

      // Group by booking_id and filter for assigned engineer
      const eventsMap = new Map<string, {
        eventId: string;
        schoolName: string;
        eventDate: string;
        eventType: string;
        mainTeacher: string;
        classIds: Set<string>;
        totalChildren: number;
        parentCount: number;
        seenClassIds: Set<string>;
        assignedEngineerId?: string;
      }>();

      allRecords.forEach((record) => {
        if (!record.booking_id) return;

        // Check if this record has the engineer assigned
        const recordEngineerId = record.assigned_engineer?.[0];

        const isRealParent = record.parent_id !== 'PLACEHOLDER' && record.parent_id;

        if (!eventsMap.has(record.booking_id)) {
          const classIdSet = new Set<string>();
          const seenClassIds = new Set<string>();
          if (record.class_id) {
            classIdSet.add(record.class_id);
            seenClassIds.add(record.class_id);
          }

          eventsMap.set(record.booking_id, {
            eventId: record.booking_id,
            schoolName: record.school_name,
            eventDate: record.booking_date || '',
            eventType: record.event_type,
            mainTeacher: record.main_teacher || '',
            classIds: classIdSet,
            totalChildren: record.total_children || 0,
            parentCount: isRealParent ? 1 : 0,
            seenClassIds,
            assignedEngineerId: recordEngineerId,
          });
        } else {
          const existing = eventsMap.get(record.booking_id)!;

          if (record.class_id && !existing.seenClassIds.has(record.class_id)) {
            existing.classIds.add(record.class_id);
            existing.seenClassIds.add(record.class_id);
            existing.totalChildren += record.total_children || 0;
          }

          if (isRealParent) {
            existing.parentCount += 1;
          }

          // Capture assigned engineer if not already set
          if (!existing.assignedEngineerId && recordEngineerId) {
            existing.assignedEngineerId = recordEngineerId;
          }
        }
      });

      // Filter to only events assigned to this engineer
      const filteredEvents = Array.from(eventsMap.values())
        .filter(event => event.assignedEngineerId === engineerId);

      // Convert to SchoolEventSummary format
      return filteredEvents.map(event => ({
        eventId: event.eventId,
        schoolName: event.schoolName,
        eventDate: event.eventDate,
        eventType: event.eventType,
        mainTeacher: event.mainTeacher,
        classCount: event.classIds.size,
        totalChildren: event.totalChildren,
        totalParents: event.parentCount,
      })).sort((a, b) => {
        if (!a.eventDate) return 1;
        if (!b.eventDate) return -1;
        return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      });
    } catch (error) {
      console.error('Error fetching engineer event summaries:', error);
      throw new Error(`Failed to fetch engineer events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an engineer is assigned to a specific event
   */
  async isEngineerAssignedToEvent(engineerId: string, bookingId: string): Promise<boolean> {
    try {
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
        maxRecords: 1,
      });

      if (records.length === 0) return false;

      return records[0].assigned_engineer?.includes(engineerId) || false;
    } catch (error) {
      console.error('Error checking engineer assignment:', error);
      return false;
    }
  }

  /**
   * Get parent emails for a specific event
   * Used for notifications when audio is uploaded
   */
  async getParentEmailsByEventId(eventId: string): Promise<string[]> {
    try {
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId}'`,
      });

      // Get unique, valid parent emails (excluding placeholders)
      const emails = new Set<string>();
      records.forEach(record => {
        if (record.parent_email &&
            record.parent_id !== 'PLACEHOLDER' &&
            record.parent_email.includes('@')) {
          emails.add(record.parent_email.toLowerCase());
        }
      });

      return Array.from(emails);
    } catch (error) {
      console.error('Error fetching parent emails:', error);
      return [];
    }
  }

  /**
   * Get parent emails for a specific class within an event
   */
  async getParentEmailsByClassId(classId: string): Promise<string[]> {
    try {
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.class_id}} = '${classId}'`,
      });

      const emails = new Set<string>();
      records.forEach(record => {
        if (record.parent_email &&
            record.parent_id !== 'PLACEHOLDER' &&
            record.parent_email.includes('@')) {
          emails.add(record.parent_email.toLowerCase());
        }
      });

      return Array.from(emails);
    } catch (error) {
      console.error('Error fetching parent emails by class:', error);
      return [];
    }
  }

  // ==========================================
  // SchoolBookings (SimplyBook) Methods
  // ==========================================

  /**
   * Transform Airtable record to SchoolBooking type
   */
  private transformSchoolBookingRecord(record: any): SchoolBooking {
    return {
      id: record.id,
      simplybookId: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id] || '',
      simplybookHash: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash],
      schoolContactName: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] || '',
      schoolContactEmail: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email] || '',
      schoolPhone: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone],
      schoolAddress: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_address],
      schoolPostalCode: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code],
      region: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region],
      city: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.city],
      estimatedChildren: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.estimated_children],
      schoolSizeCategory: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_size_category],
      simplybookStatus: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] || 'pending',
      parentJourneyBookings: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.parent_journey_bookings],
      einrichtung: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.einrichtung],
      mainContactPerson: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person],
      createdAt: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.created_at],
      lastModified: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.last_modified],
      startDate: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date],
      endDate: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.end_date],
      startTime: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_time],
      endTime: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.end_time],
      portalStatus: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.portal_status],
      assignedStaff: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff],
    };
  }

  /**
   * Get bookings for a teacher by email (for teacher portal)
   * Returns future bookings where the teacher email matches the school contact email
   */
  async getBookingsForTeacher(teacherEmail: string): Promise<SchoolBooking[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Use returnFieldsByFieldId to match our field IDs
      const allRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          pageSize: 100,
          returnFieldsByFieldId: true,
        })
        .all();

      // Filter for:
      // 1. School contact email matches teacher email
      // 2. Start date is in the future (or today)
      // 3. Booking is confirmed
      const teacherRecords = allRecords.filter(record => {
        const contactEmail = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email] as string | undefined;
        const startDateStr = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string | undefined;
        const status = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] as string | undefined;

        if (!contactEmail || !startDateStr) return false;

        // Case-insensitive email match
        if (contactEmail.toLowerCase() !== teacherEmail.toLowerCase()) return false;

        // Check if booking is confirmed
        if (status !== 'confirmed') return false;

        // Check if start date is today or in the future
        const startDate = new Date(startDateStr);
        return startDate >= today;
      });

      // Sort by start date
      teacherRecords.sort((a, b) => {
        const dateA = new Date(a.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        const dateB = new Date(b.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        return dateA.getTime() - dateB.getTime();
      });

      return teacherRecords.map((record) => this.transformSchoolBookingRecord(record));
    } catch (error) {
      console.error('Error fetching bookings for teacher:', error);
      throw new Error(`Failed to fetch bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update portal status for a school booking
   */
  async updateBookingPortalStatus(
    bookingId: string,
    portalStatus: 'pending_setup' | 'classes_added' | 'ready'
  ): Promise<SchoolBooking> {
    try {
      const record = await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(bookingId, {
        [SCHOOL_BOOKINGS_FIELD_IDS.portal_status]: portalStatus,
      });
      return this.transformSchoolBookingRecord(record);
    } catch (error) {
      console.error('Error updating booking portal status:', error);
      throw new Error(`Failed to update portal status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a school booking by its Airtable record ID
   */
  async getSchoolBookingById(bookingId: string): Promise<SchoolBooking | null> {
    try {
      const record = await this.base(SCHOOL_BOOKINGS_TABLE_ID).find(bookingId);
      return this.transformSchoolBookingRecord(record);
    } catch (error) {
      console.error('Error fetching school booking by ID:', error);
      return null;
    }
  }

  /**
   * Get all school bookings with optional filters
   */
  async getSchoolBookings(filters?: {
    status?: 'pending' | 'confirmed' | 'cancelled';
    fromDate?: string;
    toDate?: string;
  }): Promise<SchoolBooking[]> {
    try {
      const conditions: string[] = [];

      if (filters?.status) {
        conditions.push(`{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status}} = '${filters.status}'`);
      }

      if (filters?.fromDate) {
        conditions.push(`IS_AFTER({${SCHOOL_BOOKINGS_FIELD_IDS.start_date}}, '${filters.fromDate}')`);
      }

      if (filters?.toDate) {
        conditions.push(`IS_BEFORE({${SCHOOL_BOOKINGS_FIELD_IDS.start_date}}, '${filters.toDate}')`);
      }

      const filterFormula = conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : `AND(${conditions.join(', ')})`
        : '';

      const selectOptions: any = {
        pageSize: 100,
        sort: [{ field: SCHOOL_BOOKINGS_FIELD_IDS.start_date, direction: 'asc' }],
      };

      if (filterFormula) {
        selectOptions.filterByFormula = filterFormula;
      }

      const records = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select(selectOptions)
        .all();

      return records.map((record) => this.transformSchoolBookingRecord(record));
    } catch (error) {
      console.error('Error fetching school bookings:', error);
      throw new Error(`Failed to fetch school bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get future bookings (start_date >= today)
   * Only returns records that have a valid start_date
   */
  async getFutureBookings(): Promise<SchoolBooking[]> {
    try {
      // Use returnFieldsByFieldId to get field IDs in response (matching our SCHOOL_BOOKINGS_FIELD_IDS)
      const allRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          pageSize: 100,
          returnFieldsByFieldId: true,
        })
        .all();

      // Filter for records with future start_date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureRecords = allRecords.filter(record => {
        const startDateStr = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string | undefined;
        if (!startDateStr) return false;

        const startDate = new Date(startDateStr);
        return startDate >= today;
      });

      // Sort by start_date descending (newest first)
      futureRecords.sort((a, b) => {
        const dateA = new Date(a.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        const dateB = new Date(b.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        return dateB.getTime() - dateA.getTime();
      });

      return futureRecords.map((record) => this.transformSchoolBookingRecord(record));
    } catch (error) {
      console.error('Error fetching future bookings:', error);
      throw new Error(`Failed to fetch future bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single school booking by SimplyBook ID
   */
  async getSchoolBookingBySimplybookId(simplybookId: string): Promise<SchoolBooking | null> {
    try {
      const records = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = '${simplybookId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        return null;
      }

      return this.transformSchoolBookingRecord(records[0]);
    } catch (error) {
      console.error('Error fetching school booking by SimplyBook ID:', error);
      return null;
    }
  }

  /**
   * Get booking statistics
   */
  async getBookingStats(): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  }> {
    try {
      const records = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({ pageSize: 100 })
        .all();

      const stats = {
        total: records.length,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
      };

      records.forEach((record) => {
        const status = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] as string;
        if (status === 'confirmed') stats.confirmed++;
        else if (status === 'cancelled') stats.cancelled++;
        else stats.pending++;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching booking stats:', error);
      return { total: 0, confirmed: 0, pending: 0, cancelled: 0 };
    }
  }

  // ==================== Einrichtungen (Schools) Management ====================

  /**
   * Transform an Airtable Einrichtung record to typed object
   */
  private transformEinrichtungRecord(record: Airtable.Record<FieldSet>): Einrichtung {
    return {
      id: record.id,
      customerName: record.fields[EINRICHTUNGEN_FIELD_IDS.customer_name] as string || '',
      type: record.fields[EINRICHTUNGEN_FIELD_IDS.type] as string | undefined,
      address: record.fields[EINRICHTUNGEN_FIELD_IDS.address] as string | undefined,
      plz: record.fields[EINRICHTUNGEN_FIELD_IDS.plz] as string | undefined,
      ort: record.fields[EINRICHTUNGEN_FIELD_IDS.ort] as string | undefined,
      bundesland: record.fields[EINRICHTUNGEN_FIELD_IDS.bundesland] as string | undefined,
      numberOfChildren: record.fields[EINRICHTUNGEN_FIELD_IDS.number_of_children] as number | undefined,
      email: record.fields[EINRICHTUNGEN_FIELD_IDS.email] as string | undefined,
      telephoneNumber: record.fields[EINRICHTUNGEN_FIELD_IDS.telephone_number] as string | undefined,
      teamRegion: record.fields[EINRICHTUNGEN_FIELD_IDS.team_region] as string[] | undefined,
      mainContact: record.fields[EINRICHTUNGEN_FIELD_IDS.main_contact] as string[] | undefined,
      status: record.fields[EINRICHTUNGEN_FIELD_IDS.status] as string | undefined,
      logoUrl: record.fields[EINRICHTUNGEN_FIELD_IDS.logo_url] as string | undefined,
      logoUploadedAt: record.fields[EINRICHTUNGEN_FIELD_IDS.logo_uploaded_at] as string | undefined,
      logoUploadedBy: record.fields[EINRICHTUNGEN_FIELD_IDS.logo_uploaded_by] as string | undefined,
    };
  }

  /**
   * Get Einrichtung by ID
   */
  async getEinrichtungById(einrichtungId: string): Promise<Einrichtung | null> {
    try {
      const record = await this.base(EINRICHTUNGEN_TABLE_ID).find(einrichtungId);
      return this.transformEinrichtungRecord(record);
    } catch (error) {
      console.error('Error fetching Einrichtung by ID:', error);
      return null;
    }
  }

  /**
   * Find Einrichtung for a teacher by searching SchoolBookings linkage or name match
   * @param teacherEmail - The teacher's email
   * @param schoolName - The school name from the teacher's profile
   */
  async getEinrichtungForTeacher(teacherEmail: string, schoolName: string): Promise<Einrichtung | null> {
    try {
      // First, try to find via SchoolBookings linkage
      const bookingRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `LOWER({${SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email}}) = LOWER('${teacherEmail.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        })
        .firstPage();

      if (bookingRecords.length > 0) {
        const einrichtungIds = bookingRecords[0].fields[SCHOOL_BOOKINGS_FIELD_IDS.einrichtung] as string[];
        if (einrichtungIds && einrichtungIds.length > 0) {
          return await this.getEinrichtungById(einrichtungIds[0]);
        }
      }

      // Fall back to name matching
      if (schoolName) {
        const escapedName = schoolName.replace(/'/g, "\\'");
        const einrichtungRecords = await this.base(EINRICHTUNGEN_TABLE_ID)
          .select({
            filterByFormula: `LOWER({${EINRICHTUNGEN_FIELD_IDS.customer_name}}) = LOWER('${escapedName}')`,
            maxRecords: 1,
          })
          .firstPage();

        if (einrichtungRecords.length > 0) {
          return this.transformEinrichtungRecord(einrichtungRecords[0]);
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding Einrichtung for teacher:', error);
      return null;
    }
  }

  /**
   * Find or create an Einrichtung record for a school
   * Creates a minimal record if none exists
   */
  async findOrCreateEinrichtung(schoolName: string, createdByEmail: string): Promise<Einrichtung> {
    // First try to find existing
    const escapedName = schoolName.replace(/'/g, "\\'");
    const existingRecords = await this.base(EINRICHTUNGEN_TABLE_ID)
      .select({
        filterByFormula: `LOWER({${EINRICHTUNGEN_FIELD_IDS.customer_name}}) = LOWER('${escapedName}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length > 0) {
      return this.transformEinrichtungRecord(existingRecords[0]);
    }

    // Create new minimal record
    const newRecord = await this.base(EINRICHTUNGEN_TABLE_ID).create({
      [EINRICHTUNGEN_FIELD_IDS.customer_name]: schoolName,
      [EINRICHTUNGEN_FIELD_IDS.email]: createdByEmail,
    });

    return this.transformEinrichtungRecord(newRecord);
  }

  /**
   * Update logo URL for an Einrichtung
   */
  async updateEinrichtungLogo(
    einrichtungId: string,
    logoUrl: string,
    uploadedBy: string
  ): Promise<Einrichtung> {
    try {
      const record = await this.base(EINRICHTUNGEN_TABLE_ID).update(einrichtungId, {
        [EINRICHTUNGEN_FIELD_IDS.logo_url]: logoUrl,
        [EINRICHTUNGEN_FIELD_IDS.logo_uploaded_at]: new Date().toISOString(),
        [EINRICHTUNGEN_FIELD_IDS.logo_uploaded_by]: uploadedBy,
      });

      return this.transformEinrichtungRecord(record);
    } catch (error) {
      console.error('Error updating Einrichtung logo:', error);
      throw new Error(`Failed to update logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear logo URL for an Einrichtung
   */
  async clearEinrichtungLogo(einrichtungId: string): Promise<void> {
    try {
      await this.base(EINRICHTUNGEN_TABLE_ID).update(einrichtungId, {
        [EINRICHTUNGEN_FIELD_IDS.logo_url]: '',
        [EINRICHTUNGEN_FIELD_IDS.logo_uploaded_at]: '',
        [EINRICHTUNGEN_FIELD_IDS.logo_uploaded_by]: '',
      });
    } catch (error) {
      console.error('Error clearing Einrichtung logo:', error);
      throw new Error(`Failed to clear logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AirtableService.getInstance();