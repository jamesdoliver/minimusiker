import Airtable, { FieldSet, Table } from 'airtable';
import { ENGINEER_IDS, getEngineerIdForTrack } from '@/lib/config/engineers';
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
  // Teams/Regionen table
  TEAMS_REGIONEN_TABLE_ID,
  TEAMS_REGIONEN_FIELD_IDS,
  // Leads CRM types and IDs
  Lead,
  CallNote,
  LeadStage,
  LeadSource,
  EventTypeInterest,
  LEADS_TABLE_ID,
  LEADS_FIELD_IDS,
  // New normalized table types and IDs
  Event,
  Class,
  Parent,
  Registration,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
  REGISTRATIONS_TABLE_ID,
  REGISTRATIONS_FIELD_IDS,
  EVENT_MANUAL_COSTS_TABLE_ID,
  EVENT_MANUAL_COSTS_FIELD_IDS,
  isRegistrableClassType,
  SONGS_LINKED_FIELD_IDS,
  CalendarEntry,
} from '@/lib/types/airtable';
import { SONGS_TABLE_ID } from '@/lib/types/teacher';
import { ManualCost } from '@/lib/types/analytics';
import {
  TeacherResource,
  TEACHER_RESOURCES_TABLE_ID,
  TEACHER_RESOURCES_FIELD_NAMES,
} from '@/lib/types/teacher-resources';
import {
  EmailTemplate,
  EmailLog,
  Audience,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  CreateEmailLogInput,
  EMAIL_TEMPLATES_TABLE_ID,
  EMAIL_TEMPLATES_FIELD_IDS,
  EMAIL_LOGS_TABLE_ID,
  EMAIL_LOGS_FIELD_IDS,
} from '@/lib/types/email-automation';

// Single table name in Airtable
export const TABLE_NAME = 'parent_journey_table';

class AirtableService {
  private base: Airtable.Base;
  private static instance: AirtableService;

  // Normalized tables (initialized when feature flag is enabled)
  private eventsTable: Table<FieldSet> | null = null;
  private classesTable: Table<FieldSet> | null = null;
  private parentsTable: Table<FieldSet> | null = null;
  private registrationsTable: Table<FieldSet> | null = null;

  // Email automation tables (lazy initialized)
  private emailTemplatesTable: Table<FieldSet> | null = null;
  private emailLogsTable: Table<FieldSet> | null = null;

  private constructor() {
    // Configure with Personal Access Token (PAT)
    // The apiKey parameter accepts both old API keys and new PATs
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY!, // This is actually the PAT
    });
    this.base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

    // Tables will be lazy-initialized on first use to avoid race condition
    // with environment variable loading
  }

  public static getInstance(): AirtableService {
    if (!AirtableService.instance) {
      AirtableService.instance = new AirtableService();
    }
    return AirtableService.instance;
  }

  /**
   * Check if normalized tables should be used (feature flag)
   */
  private useNormalizedTables(): boolean {
    return process.env.USE_NORMALIZED_TABLES === 'true';
  }

  /**
   * Ensure normalized tables are initialized (lazy initialization)
   * Called at the start of every method that needs normalized tables
   * to avoid race condition with environment variable loading
   */
  private ensureNormalizedTablesInitialized(): void {
    if (this.useNormalizedTables() && !this.eventsTable) {
      this.eventsTable = this.base(EVENTS_TABLE_ID);
      this.classesTable = this.base(CLASSES_TABLE_ID);
      this.parentsTable = this.base(PARENTS_TABLE_ID);
      this.registrationsTable = this.base(REGISTRATIONS_TABLE_ID);
    }
  }

  /**
   * Ensure email automation tables are initialized (lazy initialization)
   * Returns true if tables are properly configured, false otherwise
   */
  private ensureEmailTablesInitialized(): boolean {
    if (!EMAIL_TEMPLATES_TABLE_ID || !EMAIL_LOGS_TABLE_ID) {
      console.warn('Email automation tables not configured. Set EMAIL_TEMPLATES_TABLE_ID and EMAIL_LOGS_TABLE_ID environment variables.');
      return false;
    }

    if (!this.emailTemplatesTable) {
      this.emailTemplatesTable = this.base(EMAIL_TEMPLATES_TABLE_ID);
      this.emailLogsTable = this.base(EMAIL_LOGS_TABLE_ID);
    }
    return true;
  }

  /**
   * Helper: Query parent by email from Parents table
   */
  private async queryParentByEmail(email: string): Promise<Parent | null> {
    this.ensureNormalizedTablesInitialized();

    if (!this.parentsTable) return null;

    try {
      const records = await this.parentsTable.select({
        filterByFormula: `LOWER({${PARENTS_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        parents_id: record.fields[PARENTS_FIELD_IDS.parents_id] as string,
        parent_id: record.fields[PARENTS_FIELD_IDS.parent_id] as string,
        parent_email: record.fields[PARENTS_FIELD_IDS.parent_email] as string,
        parent_first_name: record.fields[PARENTS_FIELD_IDS.parent_first_name] as string,
        parent_telephone: record.fields[PARENTS_FIELD_IDS.parent_telephone] as string,
        email_campaigns: record.fields[PARENTS_FIELD_IDS.email_campaigns] as 'yes' | 'no',
        created_at: record.fields[PARENTS_FIELD_IDS.created_at] as string,
      };
    } catch (error) {
      console.error('Error querying parent by email:', error);
      return null;
    }
  }

  /**
   * Helper: Query registrations by parent record ID
   */
  private async queryRegistrationsByParent(parentRecordId: string): Promise<Registration[]> {
    this.ensureNormalizedTablesInitialized();

    if (!this.registrationsTable) return [];

    try {
      // Note: Airtable formulas don't work reliably on linked record fields
      // (ARRAYJOIN, SEARCH, FIND all fail). So we fetch all and filter in JavaScript.
      const records = await this.registrationsTable.select({
        returnFieldsByFieldId: true
      }).all();

      // Filter in JavaScript by checking if parent_id array includes the parentRecordId
      const filteredRecords = records.filter(record => {
        const parentIds = record.fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[] | undefined;
        return parentIds && parentIds.includes(parentRecordId);
      });

      return filteredRecords.map(record => ({
        id: record.id,
        Id: record.fields[REGISTRATIONS_FIELD_IDS.Id] as number,
        event_id: record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[],
        parent_id: record.fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[],
        class_id: record.fields[REGISTRATIONS_FIELD_IDS.class_id] as string[],
        registered_child: record.fields[REGISTRATIONS_FIELD_IDS.registered_child] as string,
        child_id: record.fields[REGISTRATIONS_FIELD_IDS.child_id] as string,
        registered_complete: record.fields[REGISTRATIONS_FIELD_IDS.registered_complete] as boolean,
        order_number: record.fields[REGISTRATIONS_FIELD_IDS.order_number] as string,
        legacy_record: record.fields[REGISTRATIONS_FIELD_IDS.legacy_record] as string,
        registration_date: record.fields[REGISTRATIONS_FIELD_IDS.registration_date] as string,
        registration_status: record.fields[REGISTRATIONS_FIELD_IDS.registration_status] as string,
      }));
    } catch (error) {
      console.error('Error querying registrations by parent:', error);
      return [];
    }
  }

  /**
   * Helper: Query event by record ID
   */
  private async queryEventById(eventRecordId: string): Promise<Event | null> {
    this.ensureNormalizedTablesInitialized();

    if (!this.eventsTable) return null;

    try {
      // Use .select() with RECORD_ID() filter instead of .find() to support returnFieldsByFieldId
      const records = await this.eventsTable.select({
        filterByFormula: `RECORD_ID() = '${eventRecordId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (records.length === 0) return null;
      const record = records[0];

      return {
        id: record.id,
        event_id: record.fields[EVENTS_FIELD_IDS.event_id] as string,
        school_name: record.fields[EVENTS_FIELD_IDS.school_name] as string,
        event_date: record.fields[EVENTS_FIELD_IDS.event_date] as string,
        event_type: record.fields[EVENTS_FIELD_IDS.event_type] as 'concert' | 'recital' | 'competition' | 'showcase',
        assigned_staff: record.fields[EVENTS_FIELD_IDS.assigned_staff] as string[],
        assigned_engineer: record.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[],
        created_at: record.fields[EVENTS_FIELD_IDS.created_at] as string,
        legacy_booking_id: record.fields[EVENTS_FIELD_IDS.legacy_booking_id] as string,
        simplybook_booking: record.fields[EVENTS_FIELD_IDS.simplybook_booking] as string[],
        teachers: record.fields[EVENTS_FIELD_IDS.teachers] as string[],
      };
    } catch (error) {
      console.error('Error querying event by ID:', error);
      return null;
    }
  }

  /**
   * Helper: Query class by record ID
   */
  private async queryClassById(classRecordId: string): Promise<Class | null> {
    this.ensureNormalizedTablesInitialized();

    if (!this.classesTable) return null;

    try {
      // Use .select() with RECORD_ID() filter instead of .find() to support returnFieldsByFieldId
      const records = await this.classesTable.select({
        filterByFormula: `RECORD_ID() = '${classRecordId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (records.length === 0) return null;
      const record = records[0];

      return {
        id: record.id,
        class_id: record.fields[CLASSES_FIELD_IDS.class_id] as string,
        event_id: record.fields[CLASSES_FIELD_IDS.event_id] as string[],
        class_name: record.fields[CLASSES_FIELD_IDS.class_name] as string,
        main_teacher: record.fields[CLASSES_FIELD_IDS.main_teacher] as string,
        other_teachers: record.fields[CLASSES_FIELD_IDS.other_teachers] as string,
        total_children: record.fields[CLASSES_FIELD_IDS.total_children] as number,
        created_at: record.fields[CLASSES_FIELD_IDS.created_at] as string,
        legacy_booking_id: record.fields[CLASSES_FIELD_IDS.legacy_booking_id] as string,
      };
    } catch (error) {
      console.error('Error querying class by ID:', error);
      return null;
    }
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
    if (this.useNormalizedTables()) {
      // NEW: Create in normalized tables (Parents + Registrations)
      this.ensureNormalizedTablesInitialized();
      try {
        if (!data.parent_email || !data.booking_id || !data.class_id) {
          throw new Error('parent_email, booking_id, and class_id are required for registration');
        }

        // Step 1: Find or create Parent record
        let parentRecord = await this.queryParentByEmail(data.parent_email);
        let parentRecordId: string;

        if (!parentRecord) {
          // Create new parent
          const parentFields: any = {
            [PARENTS_FIELD_IDS.parent_email]: data.parent_email,
          };
          if (data.parent_id) parentFields[PARENTS_FIELD_IDS.parent_id] = data.parent_id;
          if (data.parent_first_name) parentFields[PARENTS_FIELD_IDS.parent_first_name] = data.parent_first_name;
          if (data.parent_telephone) parentFields[PARENTS_FIELD_IDS.parent_telephone] = data.parent_telephone;
          if (data.email_campaigns) parentFields[PARENTS_FIELD_IDS.email_campaigns] = data.email_campaigns;

          const newParentRecords = await this.parentsTable!.create([{ fields: parentFields }]);
          parentRecordId = newParentRecords[0].id;
        } else {
          parentRecordId = parentRecord.id;
        }

        // Step 2: Find Event record by event_id (booking_id)
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.booking_id}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) {
          throw new Error(`Event not found for booking_id: ${data.booking_id}`);
        }
        const eventRecordId = eventRecords[0].id;

        // Step 3: Find Class record by class_id
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.class_id}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) {
          throw new Error(`Class not found for class_id: ${data.class_id}`);
        }
        const classRecordId = classRecords[0].id;

        // Step 4: Create Registration record
        const registrationFields: any = {
          [REGISTRATIONS_FIELD_IDS.parent_id]: [parentRecordId],
          [REGISTRATIONS_FIELD_IDS.event_id]: [eventRecordId],
          [REGISTRATIONS_FIELD_IDS.class_id]: [classRecordId],
        };
        if (data.registered_child) registrationFields[REGISTRATIONS_FIELD_IDS.registered_child] = data.registered_child;
        if (data.child_id) registrationFields[REGISTRATIONS_FIELD_IDS.child_id] = data.child_id;
        if (data.order_number) registrationFields[REGISTRATIONS_FIELD_IDS.order_number] = data.order_number;
        if (data.registered_complete !== undefined) registrationFields[REGISTRATIONS_FIELD_IDS.registered_complete] = data.registered_complete;

        // Always set registration_date to current timestamp
        registrationFields[REGISTRATIONS_FIELD_IDS.registration_date] = new Date().toISOString();

        const registrationRecords = await this.registrationsTable!.create([{ fields: registrationFields }]);
        const registrationRecord = registrationRecords[0];

        // Step 5: Transform to ParentJourney format for backward compatibility
        const eventFields = eventRecords[0].fields as Record<string, any>;
        const classFields = classRecords[0].fields as Record<string, any>;

        return {
          id: registrationRecord.id,
          booking_id: data.booking_id,
          class_id: data.class_id,
          school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
          main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
          other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
          class: classFields[CLASSES_FIELD_IDS.class_name] || '',
          registered_child: data.registered_child || '',
          parent_first_name: data.parent_first_name || '',
          parent_email: data.parent_email,
          parent_telephone: data.parent_telephone || '',
          email_campaigns: data.email_campaigns,
          order_number: data.order_number || '',
          school_recording: [],
          event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
          parent_id: data.parent_id || '',
          booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
          child_id: data.child_id || '',
          registered_complete: data.registered_complete || false,
          total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
          assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
        };
      } catch (error) {
        console.error('Error creating registration in normalized tables:', error);
        throw new Error(`Failed to create registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Create in parent_journey_table
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
  }

  // Update an existing record
  async update(id: string, data: Partial<ParentJourney>): Promise<ParentJourney & { id: string }> {
    if (this.useNormalizedTables()) {
      // NEW: Update in normalized tables (Registration + optionally Parent)
      try {
        // Get the existing registration record
        const registrationRecord = await this.registrationsTable!.find(id);
        const regFields = registrationRecord.fields as Record<string, any>;

        // Step 1: Update Registration record fields (child-specific data)
        const registrationUpdates: any = {};
        if (data.registered_child !== undefined) registrationUpdates[REGISTRATIONS_FIELD_IDS.registered_child] = data.registered_child;
        if (data.child_id !== undefined) registrationUpdates[REGISTRATIONS_FIELD_IDS.child_id] = data.child_id;
        if (data.order_number !== undefined) registrationUpdates[REGISTRATIONS_FIELD_IDS.order_number] = data.order_number;
        if (data.registered_complete !== undefined) registrationUpdates[REGISTRATIONS_FIELD_IDS.registered_complete] = data.registered_complete;

        if (Object.keys(registrationUpdates).length > 0) {
          await this.registrationsTable!.update(id, registrationUpdates);
        }

        // Step 2: Update Parent record if parent fields changed
        const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
        if (parentRecordId) {
          const parentUpdates: any = {};
          if (data.parent_first_name !== undefined) parentUpdates[PARENTS_FIELD_IDS.parent_first_name] = data.parent_first_name;
          if (data.parent_email !== undefined) parentUpdates[PARENTS_FIELD_IDS.parent_email] = data.parent_email;
          if (data.parent_telephone !== undefined) parentUpdates[PARENTS_FIELD_IDS.parent_telephone] = data.parent_telephone;
          if (data.email_campaigns !== undefined) parentUpdates[PARENTS_FIELD_IDS.email_campaigns] = data.email_campaigns;

          if (Object.keys(parentUpdates).length > 0) {
            await this.parentsTable!.update(parentRecordId, parentUpdates);
          }
        }

        // Step 3: Fetch updated data and transform to ParentJourney format
        const updatedRegistration = await this.registrationsTable!.find(id);
        const updatedRegFields = updatedRegistration.fields as Record<string, any>;

        const eventRecordId = updatedRegFields[REGISTRATIONS_FIELD_IDS.event_id]?.[0];
        const classRecordId = updatedRegFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];
        const updatedParentRecordId = updatedRegFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];

        const event = eventRecordId ? await this.eventsTable!.find(eventRecordId) : null;
        const classInfo = classRecordId ? await this.classesTable!.find(classRecordId) : null;
        const parent = updatedParentRecordId ? await this.parentsTable!.find(updatedParentRecordId) : null;

        const eventFields = event?.fields as Record<string, any> || {};
        const classFields = classInfo?.fields as Record<string, any> || {};
        const parentFields = parent?.fields as Record<string, any> || {};

        return {
          id: id,
          booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
          class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
          school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
          main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
          other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
          class: classFields[CLASSES_FIELD_IDS.class_name] || '',
          registered_child: updatedRegFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
          parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
          parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
          parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
          email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
          order_number: updatedRegFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
          school_recording: [],
          event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
          parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
          booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
          child_id: updatedRegFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
          registered_complete: updatedRegFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
          total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
          assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
        };
      } catch (error) {
        console.error('Error updating registration in normalized tables:', error);
        throw new Error(`Failed to update registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Update in parent_journey_table
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
  }

  // Delete a record
  async delete(id: string): Promise<void> {
    if (this.useNormalizedTables()) {
      // NEW: Delete Registration record only (not Parent, Event, or Class)
      try {
        await this.registrationsTable!.destroy(id);
      } catch (error) {
        console.error('Error deleting registration from Registrations table:', error);
        throw new Error(`Failed to delete registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Delete from parent_journey_table
      try {
        await this.base(TABLE_NAME).destroy(id);
      } catch (error) {
        console.error(`Error deleting record from ${TABLE_NAME}:`, error);
        throw new Error(`Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // ==================== Specific Query Methods ====================

  // Get parent journey by email (for login) - returns first match
  async getParentByEmail(email: string): Promise<ParentJourney | null> {
    if (this.useNormalizedTables()) {
      // NEW: Query normalized Parents table
      const parent = await this.queryParentByEmail(email);
      if (!parent) return null;

      // Get registrations for this parent to populate legacy fields
      const registrations = await this.queryRegistrationsByParent(parent.id);

      if (registrations.length === 0) {
        // Parent exists but has no registrations - return minimal data
        return {
          id: parent.id,
          parent_id: parent.parent_id,
          parent_email: parent.parent_email,
          parent_first_name: parent.parent_first_name,
          parent_telephone: parent.parent_telephone,
          email_campaigns: parent.email_campaigns,
          booking_id: '',
          class_id: '',
          school_name: '',
          main_teacher: '',
          other_teachers: '',
          class: '',
          registered_child: '',
          order_number: '',
          school_recording: [],
          event_type: '',
          booking_date: '',
          child_id: '',
          registered_complete: false,
          total_children: 0,
          assigned_staff: [],
        };
      }

      // Get the most recent registration
      const latestRegistration = registrations[0];

      // Get event and class details
      const eventId = latestRegistration.event_id?.[0];
      const classId = latestRegistration.class_id?.[0];

      const event = eventId ? await this.queryEventById(eventId) : null;
      const classInfo = classId ? await this.queryClassById(classId) : null;

      // Transform to ParentJourney format for backward compatibility
      return {
        id: parent.id,
        booking_id: event?.event_id || '',
        class_id: classInfo?.class_id || '',
        school_name: event?.school_name || '',
        main_teacher: classInfo?.main_teacher || '',
        other_teachers: classInfo?.other_teachers || '',
        class: classInfo?.class_name || '',
        registered_child: latestRegistration.registered_child,
        parent_first_name: parent.parent_first_name,
        parent_email: parent.parent_email,
        parent_telephone: parent.parent_telephone,
        email_campaigns: parent.email_campaigns,
        order_number: latestRegistration.order_number || '',
        school_recording: [],
        event_type: event?.event_type || '',
        parent_id: parent.parent_id,
        booking_date: event?.event_date || '',
        child_id: latestRegistration.child_id || '',
        registered_complete: latestRegistration.registered_complete,
        total_children: classInfo?.total_children || 0,
        assigned_staff: event?.assigned_staff || [],
      };
    } else {
      // LEGACY: Query parent_journey_table
      const records = await this.query({
        filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
        maxRecords: 1,
      });
      return records[0] || null;
    }
  }

  // Get ALL parent journey records by email (for multi-event support)
  async getParentRecordsByEmail(email: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      this.ensureNormalizedTablesInitialized();

      // NEW: Query normalized tables
      const parent = await this.queryParentByEmail(email);
      if (!parent) return [];

      const registrations = await this.queryRegistrationsByParent(parent.id);
      if (registrations.length === 0) return [];

      // Convert each registration to ParentJourney format
      const journeys: ParentJourney[] = [];

      for (const reg of registrations) {
        const eventId = reg.event_id?.[0];
        const classId = reg.class_id?.[0];

        const event = eventId ? await this.queryEventById(eventId) : null;
        const classInfo = classId ? await this.queryClassById(classId) : null;

        journeys.push({
          id: reg.id,
          booking_id: event?.event_id || '',
          class_id: classInfo?.class_id || '',
          school_name: event?.school_name || '',
          main_teacher: classInfo?.main_teacher || '',
          other_teachers: classInfo?.other_teachers || '',
          class: classInfo?.class_name || '',
          registered_child: reg.registered_child,
          parent_first_name: parent.parent_first_name,
          parent_email: parent.parent_email,
          parent_telephone: parent.parent_telephone,
          email_campaigns: parent.email_campaigns,
          order_number: reg.order_number || '',
          school_recording: [],
          event_type: event?.event_type || '',
          parent_id: parent.parent_id,
          booking_date: event?.event_date || '',
          child_id: reg.child_id || '',
          registered_complete: reg.registered_complete,
          total_children: classInfo?.total_children || 0,
          assigned_staff: event?.assigned_staff || [],
        });
      }

      // Sort by booking_date descending (most recent first)
      return journeys.sort((a, b) => {
        const dateA = new Date(a.booking_date || 0).getTime();
        const dateB = new Date(b.booking_date || 0).getTime();
        return dateB - dateA;
      });
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
        sort: [{ field: 'booking_date', direction: 'desc' }],
      });
    }
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
    if (this.useNormalizedTables()) {
      // NEW: Query Parents table by parent_id field
      try {
        const parentRecords = await this.parentsTable!.select({
          filterByFormula: `{${PARENTS_FIELD_IDS.parent_id}} = '${parentId}'`,
          maxRecords: 1,
        }).firstPage();

        if (parentRecords.length === 0) return null;

        const parentRecord = parentRecords[0];
        const parentFields = parentRecord.fields as Record<string, any>;

        // Get first registration for this parent to populate event/class data
        const registrations = await this.queryRegistrationsByParent(parentRecord.id);

        if (registrations.length === 0) {
          // Parent exists but has no registrations
          return {
            id: parentRecord.id,
            parent_id: parentId,
            parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
            parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
            parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
            email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
            booking_id: '',
            class_id: '',
            school_name: '',
            main_teacher: '',
            other_teachers: '',
            class: '',
            registered_child: '',
            order_number: '',
            school_recording: [],
            event_type: '',
            booking_date: '',
            child_id: '',
            registered_complete: false,
            total_children: 0,
            assigned_staff: [],
          };
        }

        const latestReg = registrations[0];
        const eventId = latestReg.event_id?.[0];
        const classId = latestReg.class_id?.[0];

        const event = eventId ? await this.queryEventById(eventId) : null;
        const classInfo = classId ? await this.queryClassById(classId) : null;

        return {
          id: parentRecord.id,
          booking_id: event?.event_id || '',
          class_id: classInfo?.class_id || '',
          school_name: event?.school_name || '',
          main_teacher: classInfo?.main_teacher || '',
          other_teachers: classInfo?.other_teachers || '',
          class: classInfo?.class_name || '',
          registered_child: latestReg.registered_child,
          parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
          parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
          parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
          email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
          order_number: latestReg.order_number || '',
          school_recording: [],
          event_type: event?.event_type || '',
          parent_id: parentId,
          booking_date: event?.event_date || '',
          child_id: latestReg.child_id || '',
          registered_complete: latestReg.registered_complete,
          total_children: classInfo?.total_children || 0,
          assigned_staff: event?.assigned_staff || [],
        };
      } catch (error) {
        console.error('Error fetching parent by ID from normalized tables:', error);
        return null;
      }
    } else {
      // LEGACY: Query parent_journey_table
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.parent_id}} = '${parentId}'`,
        maxRecords: 1,
      });
      return records[0] || null;
    }
  }

  // Get parent journey by booking ID
  async getParentByBookingId(bookingId: string): Promise<ParentJourney | null> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events → Registrations → Parents
      try {
        // Find event by event_id (booking_id)
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) return null;

        const eventRecord = eventRecords[0];
        const eventFields = eventRecord.fields as Record<string, any>;

        // Get first registration for this event
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${eventRecord.id}'`,
          maxRecords: 1,
        }).firstPage();

        if (registrations.length === 0) return null;

        const regRecord = registrations[0];
        const regFields = regRecord.fields as Record<string, any>;

        // Get parent, class details
        const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
        const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

        const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId) : null;
        const classInfo = classRecordId ? await this.classesTable!.find(classRecordId) : null;

        const parentFields = parent?.fields as Record<string, any> || {};
        const classFields = classInfo?.fields as Record<string, any> || {};

        return {
          id: regRecord.id,
          booking_id: bookingId,
          class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
          school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
          main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
          other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
          class: classFields[CLASSES_FIELD_IDS.class_name] || '',
          registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
          parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
          parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
          parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
          email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
          order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
          school_recording: [],
          event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
          parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
          booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
          child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
          registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
          total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
          assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
        };
      } catch (error) {
        console.error('Error fetching parent by booking ID from normalized tables:', error);
        return null;
      }
    } else {
      // LEGACY: Query parent_journey_table
      const records = await this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.booking_id}} = '${bookingId}'`,
        maxRecords: 1,
      });
      return records[0] || null;
    }
  }

  // Get all parent journeys for a specific school
  async getParentsBySchool(schoolName: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events by school → Registrations → Parents
      try {
        // Find all events for this school
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.school_name}} = '${schoolName}'`,
        }).all();

        if (events.length === 0) return [];

        const journeys: ParentJourney[] = [];

        for (const event of events) {
          const eventFields = event.fields as Record<string, any>;

          // Get all registrations for this event
          const registrations = await this.registrationsTable!.select({
            filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${event.id}'`,
          }).all();

          for (const reg of registrations) {
            const regFields = reg.fields as Record<string, any>;
            const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
            const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

            const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
            const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

            const parentFields = parent?.fields as Record<string, any> || {};
            const classFields = classInfo?.fields as Record<string, any> || {};

            journeys.push({
              id: reg.id,
              booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
              class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
              school_name: schoolName,
              main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
              other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
              class: classFields[CLASSES_FIELD_IDS.class_name] || '',
              registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
              parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
              parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
              parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
              email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
              order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
              school_recording: [],
              event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
              parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
              booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
              child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
              registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
              total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
              assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
            });
          }
        }

        // Sort by parent_first_name
        return journeys.sort((a, b) => (a.parent_first_name || '').localeCompare(b.parent_first_name || ''));
      } catch (error) {
        console.error('Error fetching parents by school from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.school_name}} = '${schoolName}'`,
        sort: [{ field: 'parent_first_name', direction: 'asc' }],
      });
    }
  }

  // Get all parent journeys for a specific event type
  async getParentsByEventType(eventType: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events by event_type → Registrations → Parents
      try {
        // Find all events for this event type
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_type}} = '${eventType}'`,
        }).all();

        if (events.length === 0) return [];

        const journeys: ParentJourney[] = [];

        for (const event of events) {
          const eventFields = event.fields as Record<string, any>;

          // Get all registrations for this event
          const registrations = await this.registrationsTable!.select({
            filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${event.id}'`,
          }).all();

          for (const reg of registrations) {
            const regFields = reg.fields as Record<string, any>;
            const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
            const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

            const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
            const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

            const parentFields = parent?.fields as Record<string, any> || {};
            const classFields = classInfo?.fields as Record<string, any> || {};

            journeys.push({
              id: reg.id,
              booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
              class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
              school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
              main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
              other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
              class: classFields[CLASSES_FIELD_IDS.class_name] || '',
              registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
              parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
              parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
              parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
              email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
              order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
              school_recording: [],
              event_type: eventType,
              parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
              booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
              child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
              registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
              total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
              assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
            });
          }
        }

        // Sort by school_name
        return journeys.sort((a, b) => (a.school_name || '').localeCompare(b.school_name || ''));
      } catch (error) {
        console.error('Error fetching parents by event type from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.event_type}} = '${eventType}'`,
        sort: [{ field: 'school_name', direction: 'asc' }],
      });
    }
  }

  // Get all parent journeys for a specific class
  async getParentsByClass(className: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Classes by class_name → Registrations → Parents
      try {
        // Find all classes with this name
        const classes = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_name}} = '${className}'`,
        }).all();

        if (classes.length === 0) return [];

        const journeys: ParentJourney[] = [];

        for (const classInfo of classes) {
          const classFields = classInfo.fields as Record<string, any>;
          const eventRecordId = classFields[CLASSES_FIELD_IDS.event_id]?.[0];

          // Get event details
          const event = eventRecordId ? await this.eventsTable!.find(eventRecordId).catch(() => null) : null;
          const eventFields = event?.fields as Record<string, any> || {};

          // Get all registrations for this class
          const registrations = await this.registrationsTable!.select({
            filterByFormula: `{${REGISTRATIONS_FIELD_IDS.class_id}} = '${classInfo.id}'`,
          }).all();

          for (const reg of registrations) {
            const regFields = reg.fields as Record<string, any>;
            const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];

            const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
            const parentFields = parent?.fields as Record<string, any> || {};

            journeys.push({
              id: reg.id,
              booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
              class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
              school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
              main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
              other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
              class: className,
              registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
              parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
              parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
              parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
              email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
              order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
              school_recording: [],
              event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
              parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
              booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
              child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
              registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
              total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
              assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
            });
          }
        }

        // Sort by registered_child
        return journeys.sort((a, b) => (a.registered_child || '').localeCompare(b.registered_child || ''));
      } catch (error) {
        console.error('Error fetching parents by class from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.class}} = '${className}'`,
        sort: [{ field: 'registered_child', direction: 'asc' }],
      });
    }
  }

  // Get all parent journeys for a specific class_id
  async getRecordsByClassId(classId: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query normalized tables
      try {
        // Find the class by class_id field
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
            returnFieldsByFieldId: true,
            maxRecords: 1,
          })
          .firstPage();

        if (classRecords.length === 0) return [];

        const classRecord = classRecords[0];
        const eventRecordId = (classRecord.fields[CLASSES_FIELD_IDS.event_id] as string[])?.[0];

        // Get event details
        const event = eventRecordId ? await this.queryEventById(eventRecordId) : null;

        // Get all registrations for this class
        const registrations = await this.base(REGISTRATIONS_TABLE_ID)
          .select({
            filterByFormula: `SEARCH('${classRecord.id}', {${REGISTRATIONS_FIELD_IDS.class_id}})`,
            returnFieldsByFieldId: true,
          })
          .all();

        // Convert each registration to ParentJourney format
        const journeys: ParentJourney[] = [];

        for (const reg of registrations) {
          const parentRecordId = (reg.fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[])?.[0];

          // Get parent details
          let parent: Parent | null = null;
          if (parentRecordId) {
            try {
              const parentRecord = await this.base(PARENTS_TABLE_ID).find(parentRecordId);
              parent = {
                id: parentRecord.id,
                parents_id: parentRecord.fields[PARENTS_FIELD_IDS.parents_id] as string,
                parent_id: parentRecord.fields[PARENTS_FIELD_IDS.parent_id] as string,
                parent_email: parentRecord.fields[PARENTS_FIELD_IDS.parent_email] as string,
                parent_first_name: parentRecord.fields[PARENTS_FIELD_IDS.parent_first_name] as string,
                parent_telephone: parentRecord.fields[PARENTS_FIELD_IDS.parent_telephone] as string,
                email_campaigns: parentRecord.fields[PARENTS_FIELD_IDS.email_campaigns] as 'yes' | 'no' | undefined,
                created_at: parentRecord.fields[PARENTS_FIELD_IDS.created_at] as string,
              };
            } catch (error) {
              console.error('Error fetching parent:', error);
            }
          }

          journeys.push({
            id: reg.id,
            booking_id: event?.event_id || '',
            class_id: classId,
            school_name: event?.school_name || '',
            main_teacher: classRecord.fields[CLASSES_FIELD_IDS.main_teacher] as string,
            other_teachers: classRecord.fields[CLASSES_FIELD_IDS.other_teachers] as string,
            class: classRecord.fields[CLASSES_FIELD_IDS.class_name] as string,
            registered_child: reg.fields[REGISTRATIONS_FIELD_IDS.registered_child] as string,
            parent_first_name: parent?.parent_first_name || '',
            parent_email: parent?.parent_email || '',
            parent_telephone: parent?.parent_telephone || '',
            email_campaigns: parent?.email_campaigns || '',
            order_number: reg.fields[REGISTRATIONS_FIELD_IDS.order_number] as string || '',
            school_recording: [],
            event_type: event?.event_type || '',
            parent_id: parent?.parent_id || '',
            booking_date: event?.event_date || '',
            child_id: reg.fields[REGISTRATIONS_FIELD_IDS.child_id] as string || '',
            registered_complete: reg.fields[REGISTRATIONS_FIELD_IDS.registered_complete] as boolean,
            total_children: classRecord.fields[CLASSES_FIELD_IDS.total_children] as number,
            assigned_staff: event?.assigned_staff || [],
          });
        }

        // Sort by registered_child name
        return journeys.sort((a, b) =>
          a.registered_child.localeCompare(b.registered_child)
        );
      } catch (error) {
        console.error('Error fetching records by class ID:', error);
        throw error;
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.class_id}} = '${classId}'`,
        sort: [{ field: 'registered_child', direction: 'asc' }],
      });
    }
  }

  // Get all unique classes for a specific booking_id (event)
  async getClassesByBookingId(bookingId: string): Promise<Array<{
    class_id: string;
    class_name: string;
    main_teacher?: string;
    other_teachers?: string;
    parent_count: number;
  }>> {
    if (this.useNormalizedTables()) {
      // NEW: Query normalized tables
      try {
        // Find the event by event_id (booking_id)
        const eventRecords = await this.base(EVENTS_TABLE_ID)
          .select({
            filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
            returnFieldsByFieldId: true,
            maxRecords: 1,
          })
          .firstPage();

        if (eventRecords.length === 0) return [];

        const eventRecord = eventRecords[0];

        // Get all classes for this event
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `SEARCH('${eventRecord.id}', {${CLASSES_FIELD_IDS.event_id}})`,
            returnFieldsByFieldId: true,
          })
          .all();

        const results = [];

        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;

          // Count registrations for this class
          const registrations = await this.base(REGISTRATIONS_TABLE_ID)
            .select({
              filterByFormula: `SEARCH('${classRecord.id}', {${REGISTRATIONS_FIELD_IDS.class_id}})`,
              returnFieldsByFieldId: true,
            })
            .all();

          results.push({
            class_id: classId,
            class_name: classRecord.fields[CLASSES_FIELD_IDS.class_name] as string,
            main_teacher: classRecord.fields[CLASSES_FIELD_IDS.main_teacher] as string,
            other_teachers: classRecord.fields[CLASSES_FIELD_IDS.other_teachers] as string,
            parent_count: registrations.length,
          });
        }

        return results;
      } catch (error) {
        console.error('Error fetching classes by booking ID:', error);
        throw error;
      }
    } else {
      // LEGACY: Query parent_journey_table
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
  }

  // Update class_id for specific records (used during migration or event creation)
  async updateClassIdForRecords(
    recordIds: string[],
    classId: string
  ): Promise<void> {
    if (this.useNormalizedTables()) {
      // NEW: Update class_id link in Registrations table
      try {
        // First, find the Classes record by its class_id field
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) {
          throw new Error(`Class with ID ${classId} not found`);
        }

        const classRecordId = classRecords[0].id;

        // Update registrations to link to this class (recordIds are Registration table IDs)
        const updates = recordIds.map((id) => ({
          id,
          fields: {
            [REGISTRATIONS_FIELD_IDS.class_id]: [classRecordId], // Linked record array
          },
        }));

        // Update in batches of 10
        for (let i = 0; i < updates.length; i += 10) {
          const batch = updates.slice(i, i + 10);
          await this.registrationsTable!.update(batch as any);
        }
      } catch (error) {
        console.error('Error updating class_id in Registrations:', error);
        throw new Error(`Failed to update class_id: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Update class_id field in parent_journey_table
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
  }

  // Bulk update class_id for records matching criteria
  async assignClassIdToRecords(
    schoolName: string,
    bookingDate: string,
    className: string,
    classId: string
  ): Promise<number> {
    if (this.useNormalizedTables()) {
      // NEW: Find registrations and update class_id link
      try {
        // First, find the Classes record by its class_id field
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) {
          return 0;
        }

        const classRecordId = classRecords[0].id;

        // Find the event by school_name and booking_date
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `AND(
            {${EVENTS_FIELD_IDS.school_name}} = '${schoolName.replace(/'/g, "\\'")}',
            {${EVENTS_FIELD_IDS.event_date}} = '${bookingDate}'
          )`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) {
          return 0;
        }

        const eventRecordId = eventRecords[0].id;

        // Find all registrations for this event (we can't filter by className in registrations directly)
        // So we'll need to fetch registrations and check their class link
        const allRegistrations = await this.registrationsTable!.select({
          filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${eventRecordId}'`,
        }).all();

        // Filter by matching class name (need to lookup each registration's class)
        const matchingRegistrations: string[] = [];

        for (const reg of allRegistrations) {
          const regFields = reg.fields as Record<string, any>;
          const regClassRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

          if (regClassRecordId) {
            const regClass = await this.classesTable!.find(regClassRecordId).catch(() => null);
            const regClassFields = regClass?.fields as Record<string, any> || {};

            if (regClassFields[CLASSES_FIELD_IDS.class_name] === className) {
              matchingRegistrations.push(reg.id);
            }
          }
        }

        if (matchingRegistrations.length === 0) {
          return 0;
        }

        // Update all matching registrations with the new class_id link
        const updates = matchingRegistrations.map((id) => ({
          id,
          fields: {
            [REGISTRATIONS_FIELD_IDS.class_id]: [classRecordId],
          },
        }));

        // Update in batches of 10
        for (let i = 0; i < updates.length; i += 10) {
          const batch = updates.slice(i, i + 10);
          await this.registrationsTable!.update(batch as any);
        }

        return matchingRegistrations.length;
      } catch (error) {
        console.error('Error assigning class_id in Registrations:', error);
        throw new Error(`Failed to assign class_id: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query and update parent_journey_table
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
  }

  // Search parent journeys by child name
  async searchByChildName(childName: string): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Search Registrations by registered_child field
      try {
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `SEARCH(LOWER('${childName}'), LOWER({${REGISTRATIONS_FIELD_IDS.registered_child}}))`,
        }).all();

        const journeys: ParentJourney[] = [];

        for (const reg of registrations) {
          const regFields = reg.fields as Record<string, any>;
          const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
          const eventRecordId = regFields[REGISTRATIONS_FIELD_IDS.event_id]?.[0];
          const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

          const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
          const event = eventRecordId ? await this.eventsTable!.find(eventRecordId).catch(() => null) : null;
          const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

          const parentFields = parent?.fields as Record<string, any> || {};
          const eventFields = event?.fields as Record<string, any> || {};
          const classFields = classInfo?.fields as Record<string, any> || {};

          journeys.push({
            id: reg.id,
            booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
            class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
            school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
            main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
            other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
            class: classFields[CLASSES_FIELD_IDS.class_name] || '',
            registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
            parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
            parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
            parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
            email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
            order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
            school_recording: [],
            event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
            parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
            booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
            child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
            registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
            total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
            assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
          });
        }

        return journeys;
      } catch (error) {
        console.error('Error searching by child name from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `SEARCH(LOWER('${childName}'), LOWER({${AIRTABLE_FIELD_IDS.registered_child}}))`,
      });
    }
  }

  // Get parent journeys with orders
  async getParentsWithOrders(): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Registrations with order_number
      try {
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `NOT({${REGISTRATIONS_FIELD_IDS.order_number}} = '')`,
        }).all();

        const journeys: ParentJourney[] = [];

        for (const reg of registrations) {
          const regFields = reg.fields as Record<string, any>;
          const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
          const eventRecordId = regFields[REGISTRATIONS_FIELD_IDS.event_id]?.[0];
          const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

          const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
          const event = eventRecordId ? await this.eventsTable!.find(eventRecordId).catch(() => null) : null;
          const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

          const parentFields = parent?.fields as Record<string, any> || {};
          const eventFields = event?.fields as Record<string, any> || {};
          const classFields = classInfo?.fields as Record<string, any> || {};

          journeys.push({
            id: reg.id,
            booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
            class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
            school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
            main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
            other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
            class: classFields[CLASSES_FIELD_IDS.class_name] || '',
            registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
            parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
            parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
            parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
            email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
            order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
            school_recording: [],
            event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
            parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
            booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
            child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
            registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
            total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
            assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
          });
        }

        // Sort by order_number descending
        return journeys.sort((a, b) => (b.order_number || '').localeCompare(a.order_number || ''));
      } catch (error) {
        console.error('Error fetching parents with orders from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `NOT({${AIRTABLE_FIELD_IDS.order_number}} = '')`,
        sort: [{ field: 'order_number', direction: 'desc' }],
      });
    }
  }

  // Get parent journeys opted into email campaigns
  async getEmailCampaignOptIns(): Promise<ParentJourney[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Parents with email_campaigns = 'yes' → Get their registrations
      try {
        const parents = await this.parentsTable!.select({
          filterByFormula: `{${PARENTS_FIELD_IDS.email_campaigns}} = 'yes'`,
        }).all();

        const journeys: ParentJourney[] = [];

        for (const parent of parents) {
          const parentFields = parent.fields as Record<string, any>;

          // Get all registrations for this parent
          const registrations = await this.registrationsTable!.select({
            filterByFormula: `SEARCH('${parent.id}', {${REGISTRATIONS_FIELD_IDS.parent_id}})`,
          }).all();

          for (const reg of registrations) {
            const regFields = reg.fields as Record<string, any>;
            const eventRecordId = regFields[REGISTRATIONS_FIELD_IDS.event_id]?.[0];
            const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

            const event = eventRecordId ? await this.eventsTable!.find(eventRecordId).catch(() => null) : null;
            const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

            const eventFields = event?.fields as Record<string, any> || {};
            const classFields = classInfo?.fields as Record<string, any> || {};

            journeys.push({
              id: reg.id,
              booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
              class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
              school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
              main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
              other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
              class: classFields[CLASSES_FIELD_IDS.class_name] || '',
              registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
              parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
              parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
              parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
              email_campaigns: 'yes',
              order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
              school_recording: [],
              event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
              parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
              booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
              child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
              registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
              total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
              assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
            });
          }
        }

        return journeys;
      } catch (error) {
        console.error('Error fetching email campaign opt-ins from normalized tables:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      return this.query({
        filterByFormula: `{${AIRTABLE_FIELD_IDS.email_campaigns}} = 'yes'`,
      });
    }
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
    if (this.useNormalizedTables()) {
      // NEW: Get all registrations with pagination
      try {
        // Get one page of registrations (100 records)
        const selectOptions: any = {
          pageSize: 100,
        };

        if (offset) {
          // In new structure, offset would be a registration record ID
          // Airtable doesn't support offset by ID in the same way, so we'll fetch from beginning
          // This is a limitation - proper pagination would require cursor-based approach
          console.warn('Offset-based pagination not fully supported in normalized tables');
        }

        const registrations = await this.registrationsTable!.select(selectOptions).firstPage();
        const journeys: ParentJourney[] = [];

        for (const reg of registrations) {
          const regFields = reg.fields as Record<string, any>;
          const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];
          const eventRecordId = regFields[REGISTRATIONS_FIELD_IDS.event_id]?.[0];
          const classRecordId = regFields[REGISTRATIONS_FIELD_IDS.class_id]?.[0];

          const parent = parentRecordId ? await this.parentsTable!.find(parentRecordId).catch(() => null) : null;
          const event = eventRecordId ? await this.eventsTable!.find(eventRecordId).catch(() => null) : null;
          const classInfo = classRecordId ? await this.classesTable!.find(classRecordId).catch(() => null) : null;

          const parentFields = parent?.fields as Record<string, any> || {};
          const eventFields = event?.fields as Record<string, any> || {};
          const classFields = classInfo?.fields as Record<string, any> || {};

          journeys.push({
            id: reg.id,
            booking_id: eventFields[EVENTS_FIELD_IDS.event_id] || '',
            class_id: classFields[CLASSES_FIELD_IDS.class_id] || '',
            school_name: eventFields[EVENTS_FIELD_IDS.school_name] || '',
            main_teacher: classFields[CLASSES_FIELD_IDS.main_teacher] || '',
            other_teachers: classFields[CLASSES_FIELD_IDS.other_teachers] || '',
            class: classFields[CLASSES_FIELD_IDS.class_name] || '',
            registered_child: regFields[REGISTRATIONS_FIELD_IDS.registered_child] || '',
            parent_first_name: parentFields[PARENTS_FIELD_IDS.parent_first_name] || '',
            parent_email: parentFields[PARENTS_FIELD_IDS.parent_email] || '',
            parent_telephone: parentFields[PARENTS_FIELD_IDS.parent_telephone] || '',
            email_campaigns: parentFields[PARENTS_FIELD_IDS.email_campaigns] || '',
            order_number: regFields[REGISTRATIONS_FIELD_IDS.order_number] || '',
            school_recording: [],
            event_type: eventFields[EVENTS_FIELD_IDS.event_type] || '',
            parent_id: parentFields[PARENTS_FIELD_IDS.parent_id] || '',
            booking_date: eventFields[EVENTS_FIELD_IDS.event_date] || '',
            child_id: regFields[REGISTRATIONS_FIELD_IDS.child_id] || '',
            registered_complete: regFields[REGISTRATIONS_FIELD_IDS.registered_complete] || false,
            total_children: classFields[CLASSES_FIELD_IDS.total_children] || 0,
            assigned_staff: eventFields[EVENTS_FIELD_IDS.assigned_staff] || [],
          });
        }

        // Calculate next offset (last record ID if page is full)
        const newOffset = registrations.length === 100 ? registrations[registrations.length - 1].id : undefined;

        return {
          records: journeys,
          offset: newOffset,
        };
      } catch (error) {
        console.error('Error fetching all records from normalized tables:', error);
        throw new Error(`Failed to fetch records: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
  }

  // Update email campaign preference for multiple parents
  async updateEmailCampaignPreferences(parentIds: string[], preference: string): Promise<void> {
    if (this.useNormalizedTables()) {
      // NEW: In normalized tables, these IDs could be registration IDs
      // We need to find the unique parent records and update them
      try {
        // First, try to interpret these as parent record IDs
        // (In the new structure, callers should pass parent Airtable record IDs)
        const updates = parentIds.map((parentRecordId) => ({
          id: parentRecordId,
          fields: {
            [PARENTS_FIELD_IDS.email_campaigns]: preference,
          },
        }));

        // Airtable allows updating up to 10 records at once
        for (let i = 0; i < updates.length; i += 10) {
          const batch = updates.slice(i, i + 10);
          await this.parentsTable!.update(batch as any);
        }
      } catch (error) {
        console.error('Error updating email preferences in normalized tables:', error);
        throw new Error(`Failed to update email preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Update parent_journey_table records
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
  }

  /**
   * Unsubscribe a parent by email: look up parent record and set email_campaigns to 'no'.
   * Returns true if successful, false if parent not found.
   */
  async unsubscribeParentByEmail(email: string): Promise<boolean> {
    try {
      const parent = await this.queryParentByEmail(email);
      if (!parent) return false;
      await this.updateEmailCampaignPreferences([parent.id], 'no');
      return true;
    } catch (error) {
      console.error('[AirtableService] Error unsubscribing parent:', error);
      return false;
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
    if (this.useNormalizedTables()) {
      // NEW: Query Classes table directly
      try {
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            returnFieldsByFieldId: true,
          })
          .all();

        const results = [];

        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
          const eventRecordId = (classRecord.fields[CLASSES_FIELD_IDS.event_id] as string[])?.[0];

          // Get event details
          const event = eventRecordId ? await this.queryEventById(eventRecordId) : null;

          // Count registrations for this class
          const registrations = await this.base(REGISTRATIONS_TABLE_ID)
            .select({
              filterByFormula: `SEARCH('${classRecord.id}', {${REGISTRATIONS_FIELD_IDS.class_id}})`,
              returnFieldsByFieldId: true,
            })
            .all();

          results.push({
            booking_id: event?.event_id || '',
            class_id: classId,
            school_name: event?.school_name || '',
            booking_date: event?.event_date,
            event_type: event?.event_type || '',
            main_teacher: classRecord.fields[CLASSES_FIELD_IDS.main_teacher] as string,
            other_teachers: classRecord.fields[CLASSES_FIELD_IDS.other_teachers] as string,
            class: classRecord.fields[CLASSES_FIELD_IDS.class_name] as string,
            parent_count: registrations.length,
            booking_ids: event?.event_id ? [event.event_id] : [],
          });
        }

        // Sort by date descending
        return results.sort((a, b) => {
          if (!a.booking_date) return 1;
          if (!b.booking_date) return -1;
          return new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime();
        });
      } catch (error) {
        console.error('Error fetching unique events:', error);
        throw new Error(`Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
              parent_count: isRealParent ? 1 : 0,
              booking_ids: [record.booking_id],
            });
          } else {
            const existing = eventsMap.get(key)!;
            if (isRealParent) {
              existing.parent_count += 1;
            }
            existing.booking_ids.push(record.booking_id);
          }
        });

        return Array.from(eventsMap.values()).sort((a, b) => {
          if (!a.booking_date) return 1;
          if (!b.booking_date) return -1;
          return new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime();
        });
      } catch (error) {
        console.error('Error fetching unique events:', error);
        throw new Error(`Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get school-level event summaries for admin cards view.
   * Groups by booking_id (school + date) and aggregates stats.
   *
   * WARNING: This method fetches ALL events and is O(n) with database size.
   * Do NOT use in user-facing API endpoints. Use getSchoolEvents(schoolName) instead.
   * Only appropriate for admin dashboards with pagination.
   */
  async getSchoolEventSummaries(): Promise<SchoolEventSummary[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events table directly
      try {
        const eventRecords = await this.base(EVENTS_TABLE_ID)
          .select({
            returnFieldsByFieldId: true,
            sort: [{ field: EVENTS_FIELD_IDS.event_date, direction: 'desc' }],
          })
          .all();

        const summaries: SchoolEventSummary[] = [];

        for (const eventRecord of eventRecords) {
          const eventId = eventRecord.fields[EVENTS_FIELD_IDS.event_id] as string;
          const schoolName = eventRecord.fields[EVENTS_FIELD_IDS.school_name] as string;
          const eventDate = eventRecord.fields[EVENTS_FIELD_IDS.event_date] as string;
          const eventType = eventRecord.fields[EVENTS_FIELD_IDS.event_type] as string;
          const assignedStaffIds = eventRecord.fields[EVENTS_FIELD_IDS.assigned_staff] as string[];
          const assignedEngineerIds = eventRecord.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[];
          const simplybookBookingIds = eventRecord.fields[EVENTS_FIELD_IDS.simplybook_booking] as string[];

          // Get contact person from linked SchoolBooking as fallback
          let contactPerson: string | undefined;
          if (simplybookBookingIds?.[0]) {
            try {
              const booking = await this.getSchoolBookingById(simplybookBookingIds[0]);
              if (booking?.schoolContactName) {
                contactPerson = booking.schoolContactName;
              }
            } catch (error) {
              console.error('Error fetching booking contact:', error);
            }
          }

          // Get classes for this event
          const classRecords = await this.base(CLASSES_TABLE_ID)
            .select({
              filterByFormula: `SEARCH('${eventRecord.id}', {${CLASSES_FIELD_IDS.event_id}})`,
              returnFieldsByFieldId: true,
            })
            .all();

          // Get total children and main teacher from first class
          let totalChildren = 0;
          let mainTeacher = '';
          const classIds = new Set<string>();

          for (const classRecord of classRecords) {
            classIds.add(classRecord.id);
            totalChildren += (classRecord.fields[CLASSES_FIELD_IDS.total_children] as number) || 0;
            if (!mainTeacher) {
              mainTeacher = (classRecord.fields[CLASSES_FIELD_IDS.main_teacher] as string) || '';
            }
          }

          // Count registrations for this event
          const registrations = await this.base(REGISTRATIONS_TABLE_ID)
            .select({
              filterByFormula: `SEARCH('${eventRecord.id}', {${REGISTRATIONS_FIELD_IDS.event_id}})`,
              returnFieldsByFieldId: true,
            })
            .all();

          // Get staff name if assigned
          let assignedStaffName: string | undefined;
          const assignedStaffId = assignedStaffIds?.[0];

          if (assignedStaffId) {
            try {
              const staffRecord = await this.base(PERSONEN_TABLE_ID).find(assignedStaffId);
              assignedStaffName = staffRecord.fields['staff_name'] as string;
            } catch (error) {
              console.error('Error fetching staff name:', error);
            }
          }

          summaries.push({
            eventId,
            schoolName,
            eventDate,
            eventType,
            mainTeacher,
            contactPerson,
            classCount: classRecords.length,
            totalChildren,
            totalParents: registrations.length,
            assignedStaffId,
            assignedStaffName,
            assignedEngineerIds: assignedEngineerIds || [],
            assignedEngineerId: assignedEngineerIds?.[0],  // Backwards compat
          });
        }

        return summaries;
      } catch (error) {
        console.error('Error fetching school event summaries:', error);
        throw new Error(`Failed to fetch school events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
          seenClassIds: Set<string>;
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
              assignedStaffId: record.assigned_staff?.[0],
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
              const name = record.fields['staff_name'] as string;
              if (name) {
                staffNames.set(record.id, name);
              }
            });
          } catch (error) {
            console.error('Error fetching staff names:', error);
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
            if (!a.eventDate) return 1;
            if (!b.eventDate) return -1;
            return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
          });
      } catch (error) {
        console.error('Error fetching school event summaries:', error);
        throw new Error(`Failed to fetch school events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Get full event detail including all classes for detail page
  async getSchoolEventDetail(eventId: string): Promise<SchoolEventDetail | null> {
    if (this.useNormalizedTables()) {
      // NEW: Query normalized tables
      try {
        // Find the event by event_id OR legacy_booking_id
        let eventRecords = await this.base(EVENTS_TABLE_ID)
          .select({
            filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = '${eventId}', {${EVENTS_FIELD_IDS.legacy_booking_id}} = '${eventId}')`,
            returnFieldsByFieldId: true,
            maxRecords: 1,
          })
          .firstPage();

        let resolvedVia: 'event_id' | 'legacy_booking_id' | 'simplybook_id' = 'event_id';

        // If not found, try SimplyBook ID resolution
        if (eventRecords.length === 0) {
          console.log(`[getSchoolEventDetail] Primary lookup failed for: ${eventId}, trying SimplyBook ID`);

          const booking = await this.getSchoolBookingBySimplybookId(eventId);
          if (booking) {
            const linkedEvent = await this.getEventBySchoolBookingId(booking.id);
            if (linkedEvent) {
              // Fetch the full event record with field IDs
              const eventRecord = await this.base(EVENTS_TABLE_ID)
                .select({
                  filterByFormula: `RECORD_ID() = '${linkedEvent.id}'`,
                  returnFieldsByFieldId: true,
                  maxRecords: 1,
                })
                .firstPage();

              if (eventRecord.length > 0) {
                eventRecords = eventRecord;
                resolvedVia = 'simplybook_id';
                console.log(`[getSchoolEventDetail] Resolved via SimplyBook ID: ${eventId} -> Event record: ${linkedEvent.id}`);
              }
            }
          }
        }

        if (eventRecords.length === 0) {
          console.log(`[getSchoolEventDetail] No event found for: ${eventId}`);
          return null;
        }

        console.log(`[getSchoolEventDetail] Found event via: ${resolvedVia}`);

        const eventRecord = eventRecords[0];
        const schoolName = eventRecord.fields[EVENTS_FIELD_IDS.school_name] as string;
        const eventDate = eventRecord.fields[EVENTS_FIELD_IDS.event_date] as string;
        const eventType = eventRecord.fields[EVENTS_FIELD_IDS.event_type] as string;
        const assignedStaffIds = eventRecord.fields[EVENTS_FIELD_IDS.assigned_staff] as string[];
        const assignedStaffId = assignedStaffIds?.[0];
        const simplybookBookingIds = eventRecord.fields[EVENTS_FIELD_IDS.simplybook_booking] as string[];
        const isSchulsong = eventRecord.fields[EVENTS_FIELD_IDS.is_schulsong] as boolean || false;

        // Get contact person from linked SchoolBooking as fallback
        let contactPerson: string | undefined;
        if (simplybookBookingIds?.[0]) {
          try {
            const booking = await this.getSchoolBookingById(simplybookBookingIds[0]);
            if (booking?.schoolContactName) {
              contactPerson = booking.schoolContactName;
            }
          } catch (error) {
            console.error('Error fetching booking contact for detail:', error);
          }
        }

        // Get linked class IDs from the event record
        const linkedClassIds = eventRecord.fields[EVENTS_FIELD_IDS.classes] as string[] || [];
        console.log(`[getSchoolEventDetail] Event has ${linkedClassIds.length} linked classes`);

        // Fetch each class record directly using the linked IDs
        const classRecords: Airtable.Record<Airtable.FieldSet>[] = [];
        for (const classId of linkedClassIds) {
          try {
            const classRecord = await this.base(CLASSES_TABLE_ID).find(classId);
            // Convert to format expected by rest of code (with field IDs)
            const recordWithFieldIds = await this.base(CLASSES_TABLE_ID)
              .select({
                filterByFormula: `RECORD_ID() = '${classId}'`,
                returnFieldsByFieldId: true,
                maxRecords: 1,
              })
              .firstPage();
            if (recordWithFieldIds.length > 0) {
              classRecords.push(recordWithFieldIds[0]);
            }
          } catch (error) {
            console.error(`[getSchoolEventDetail] Error fetching class ${classId}:`, error);
          }
        }

        // Build class details with registration counts
        const classes: EventClassDetail[] = [];
        let mainTeacher = '';

        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
          const className = classRecord.fields[CLASSES_FIELD_IDS.class_name] as string;
          const classMainTeacher = classRecord.fields[CLASSES_FIELD_IDS.main_teacher] as string;
          const totalChildren = (classRecord.fields[CLASSES_FIELD_IDS.total_children] as number) || 0;

          // Capture first main teacher
          if (!mainTeacher && classMainTeacher) {
            mainTeacher = classMainTeacher;
          }

          // Count registrations for this class using linked field
          const linkedRegistrationIds = classRecord.fields[CLASSES_FIELD_IDS.registrations] as string[] || [];
          const registeredParents = linkedRegistrationIds.length;

          const classType = (classRecord.fields[CLASSES_FIELD_IDS.class_type] as string) || 'regular';

          classes.push({
            classId,
            className,
            classType,
            mainTeacher: classMainTeacher,
            totalChildren,
            registeredParents,
            registrationRate: totalChildren > 0
              ? Math.round((registeredParents / totalChildren) * 100)
              : 0,
          });
        }

        // Sort classes by name
        classes.sort((a, b) => a.className.localeCompare(b.className));

        // Compute totals
        const totalChildren = classes.reduce((sum, c) => sum + c.totalChildren, 0);
        const totalParents = classes.reduce((sum, c) => sum + c.registeredParents, 0);

        // Fetch assigned staff name if present
        let assignedStaffName: string | undefined;
        if (assignedStaffId) {
          try {
            const staffRecord = await this.base(PERSONEN_TABLE_ID).find(assignedStaffId);
            assignedStaffName = staffRecord.fields['staff_name'] as string;
          } catch (error) {
            console.error('Error fetching assigned staff name:', error);
          }
        }

        const resolvedEventId = eventRecord.fields[EVENTS_FIELD_IDS.event_id] as string || eventId;
        return {
          eventId: resolvedEventId,
          schoolName,
          eventDate,
          eventType,
          mainTeacher,
          contactPerson,
          classCount: classes.length,
          totalChildren,
          totalParents,
          assignedStaffId,
          assignedStaffName,
          isSchulsong,
          classes,
          overallRegistrationRate: totalChildren > 0
            ? Math.round((totalParents / totalChildren) * 100)
            : 0,
        };
      } catch (error) {
        console.error('Error fetching school event detail:', error);
        throw new Error(`Failed to fetch event detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
          if (!schoolName) {
            schoolName = record.school_name;
            eventDate = record.booking_date || '';
            eventType = record.event_type;
            mainTeacher = record.main_teacher || '';
            assignedStaffId = record.assigned_staff?.[0];
          }
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

        const classes: EventClassDetail[] = Array.from(classesMap.values()).map(cls => ({
          ...cls,
          classType: 'regular' as const,
          registrationRate: cls.totalChildren > 0
            ? Math.round((cls.registeredParents / cls.totalChildren) * 100)
            : 0,
        })).sort((a, b) => a.className.localeCompare(b.className));

        const totalChildren = classes.reduce((sum, c) => sum + c.totalChildren, 0);
        const totalParents = classes.reduce((sum, c) => sum + c.registeredParents, 0);

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
  }

  // ==================== Registration Methods ====================

  /**
   * Check if a parent email is already registered for a specific event
   */
  async isParentRegisteredForEvent(
    email: string,
    bookingId: string
  ): Promise<boolean> {
    if (this.useNormalizedTables()) {
      // NEW: Query Parents → Registrations → Events
      try {
        // Find parent by email
        const parents = await this.parentsTable!.select({
          filterByFormula: `LOWER({${PARENTS_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        }).firstPage();

        if (parents.length === 0) return false;

        const parentRecordId = parents[0].id;

        // Find event by event_id (bookingId)
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
          maxRecords: 1,
        }).firstPage();

        if (events.length === 0) return false;

        const eventRecordId = events[0].id;

        // Check if there's a registration linking this parent to this event
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `AND(
            {${REGISTRATIONS_FIELD_IDS.parent_id}} = '${parentRecordId}',
            {${REGISTRATIONS_FIELD_IDS.event_id}} = '${eventRecordId}'
          )`,
          maxRecords: 1,
        }).firstPage();

        return registrations.length > 0;
      } catch (error) {
        console.error('Error checking parent registration:', error);
        throw new Error(`Failed to check registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
  }

  /**
   * Get event and class details for registration validation
   */
  async getEventAndClassDetails(
    bookingId: string,
    classId: string
  ): Promise<import('@/lib/types/airtable').EventClassDetails | null> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events and Classes tables
      this.ensureNormalizedTablesInitialized();
      try {
        // Query event by event_id (booking_id)
        // Note: Field IDs work in Airtable formulas but field names are more readable
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{event_id} = '${bookingId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) {
          console.warn(`[getEventAndClassDetails] Event not found for bookingId: ${bookingId}`);
          return null;
        }

        const eventRecord = eventRecords[0];
        const eventFields = eventRecord.fields as Record<string, any>;

        // Query class by class_id only, then verify it belongs to this event
        // via the linked record relationship (event_id field contains event record IDs)
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) {
          // Class doesn't exist at all
          console.warn(`[getEventAndClassDetails] Class not found for classId: ${classId}`);
          return null;
        }

        const classRecord = classRecords[0];
        const classFields = classRecord.fields as Record<string, any>;

        // Verify the class belongs to this event via linked record relationship
        // The event_id field is a linked record field containing event record IDs
        const linkedEventIds = classFields['event_id'] as string[] | undefined;
        if (!linkedEventIds || !linkedEventIds.includes(eventRecord.id)) {
          // Class exists but doesn't belong to this event
          console.warn(`[getEventAndClassDetails] Class ${classId} exists but is not linked to event ${bookingId} (event record: ${eventRecord.id})`);
          console.warn(`[getEventAndClassDetails] Class linked events: ${JSON.stringify(linkedEventIds)}`);
          return null;
        }

        // Reject non-registrable class types (choir, teacher_song)
        const classType = classFields['class_type'] || classFields[CLASSES_FIELD_IDS.class_type];
        const isDefault = Boolean(classFields['is_default'] || classFields[CLASSES_FIELD_IDS.is_default]);
        if (!isRegistrableClassType(classType, isDefault)) {
          console.warn(`[getEventAndClassDetails] Class ${classId} is type "${classType}" - not registrable`);
          return null;
        }

        // Transform to EventClassDetails format
        // Note: Airtable returns field names, not field IDs
        return {
          schoolName: eventFields['school_name'] || '',
          eventType: eventFields['event_type'] || '',
          bookingDate: eventFields['event_date'] || '',
          className: classFields['class_name'] || '',
          teacherName: classFields['main_teacher'] || '',
          otherTeachers: classFields['other_teachers'] || '',
          bookingId: bookingId,
        };
      } catch (error) {
        console.error('Error fetching event and class details:', error);
        throw new Error(`Failed to fetch event and class details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table
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
    this.ensureNormalizedTablesInitialized();

    if (this.useNormalizedTables()) {
      // NEW: Query Events table directly
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        const cutoff = cutoffDate.toISOString().split('T')[0];

        // Get all events with recent/future dates and matching school name
        // Use returnFieldsByFieldId: true so we can read results using field IDs
        const events = await this.eventsTable!.select({
          filterByFormula: `AND(
            IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${cutoff}'),
            SEARCH(LOWER('${searchQuery.toLowerCase()}'), LOWER({${EVENTS_FIELD_IDS.school_name}}))
          )`,
          returnFieldsByFieldId: true,
        }).all();

        // Group by school and count events
        const schoolMap = new Map<string, number>();
        events.forEach(event => {
          const eventFields = event.fields as Record<string, any>;
          const schoolName = eventFields[EVENTS_FIELD_IDS.school_name];

          if (schoolName) {
            schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
          }
        });

        // Convert to array and sort by event count
        return Array.from(schoolMap.entries())
          .map(([schoolName, eventCount]) => ({
            schoolName,
            eventCount,
          }))
          .sort((a, b) => b.eventCount - a.eventCount);
      } catch (error) {
        console.error('Error searching active schools:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        const cutoff = cutoffDate.toISOString().split('T')[0];

        // Get all records with recent/future booking dates
        const allRecords = await this.query({
          filterByFormula: `IS_AFTER({booking_date}, '${cutoff}')`,
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
  }

  // Get events for a specific school
  async getSchoolEvents(schoolName: string): Promise<Array<{
    bookingId: string;
    eventType: string;
    eventDate: string;
    classCount: number;
    classes: Array<{
      classId: string;
      className: string;
      teacherName: string;
      registeredCount: number;
      isDefault: boolean;
    }>;
  }>> {
    this.ensureNormalizedTablesInitialized();

    if (this.useNormalizedTables()) {
      // NEW: Query Events table and fetch class details
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        const cutoff = cutoffDate.toISOString().split('T')[0];

        // Get all events for this school with recent/future dates
        // Use returnFieldsByFieldId: true so we can read results using field IDs
        const events = await this.eventsTable!.select({
          filterByFormula: `AND(
            {${EVENTS_FIELD_IDS.school_name}} = '${schoolName.replace(/'/g, "\\'")}',
            IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${cutoff}')
          )`,
          returnFieldsByFieldId: true,
        }).all();

        // For each event, fetch class details with registration counts
        const eventDetails = await Promise.all(
          events.map(async (event) => {
            const eventFields = event.fields as Record<string, any>;
            const eventBookingId = eventFields[EVENTS_FIELD_IDS.event_id] || '';

            // Get linked class record IDs from the Event's 'classes' field
            // This is more reliable than querying by legacy_booking_id
            const linkedClassIds = eventFields[EVENTS_FIELD_IDS.classes] as string[] | undefined;

            // Fetch classes using the linked record IDs
            let classRecords: Airtable.Record<FieldSet>[] = [];
            if (linkedClassIds && linkedClassIds.length > 0) {
              // Fetch each linked class record
              classRecords = await Promise.all(
                linkedClassIds.map(async (classRecordId) => {
                  try {
                    return await this.classesTable!.find(classRecordId);
                  } catch (err) {
                    console.warn(`[getSchoolEvents] Failed to fetch class ${classRecordId}:`, err);
                    return null;
                  }
                })
              ).then(records => records.filter((r): r is Airtable.Record<FieldSet> => r !== null));
            }

            // For each class, count registered children
            const classesWithCounts = await Promise.all(
              classRecords.map(async (classRecord) => {
                const classFields = classRecord.fields as Record<string, any>;
                const classId = classFields['class_id'] || classFields[CLASSES_FIELD_IDS.class_id];

                // Debug: warn if classId is empty
                if (!classId) {
                  console.warn(`[getSchoolEvents] Empty classId for class record ${classRecord.id}. Fields:`, Object.keys(classFields));
                }

                // Count registrations for this class (excluding placeholders)
                const registrations = await this.registrationsTable!.select({
                  filterByFormula: `{${REGISTRATIONS_FIELD_IDS.class_id}} = '${classRecord.id}'`,
                }).all();

                // Filter out placeholder records (no parent_id link)
                const realRegistrations = registrations.filter(reg => {
                  const regFields = reg.fields as Record<string, any>;
                  return regFields[REGISTRATIONS_FIELD_IDS.parent_id] &&
                         regFields[REGISTRATIONS_FIELD_IDS.parent_id].length > 0;
                });

                return {
                  classId: classId || '',
                  className: classFields['class_name'] || classFields[CLASSES_FIELD_IDS.class_name] || 'Unknown Class',
                  teacherName: classFields['main_teacher'] || classFields[CLASSES_FIELD_IDS.main_teacher] || '',
                  registeredCount: realRegistrations.length,
                  isDefault: Boolean(classFields['is_default'] || classFields[CLASSES_FIELD_IDS.is_default]),
                };
              })
            );

            // Sort classes: alphabetically, but default classes at the end
            const sortedClasses = classesWithCounts.sort((a, b) => {
              if (a.isDefault && !b.isDefault) return 1;
              if (!a.isDefault && b.isDefault) return -1;
              return a.className.localeCompare(b.className);
            });

            return {
              bookingId: eventBookingId,
              eventType: eventFields[EVENTS_FIELD_IDS.event_type] || 'Event',
              eventDate: eventFields[EVENTS_FIELD_IDS.event_date] || '',
              classCount: classRecords.length,
              classes: sortedClasses,
            };
          })
        );

        // Sort by date
        return eventDetails.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
      } catch (error) {
        console.error('Error getting school events:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 3);
        const cutoff = cutoffDate.toISOString().split('T')[0];

        // Get all records for this school with recent/future dates
        const records = await this.query({
          filterByFormula: `AND(
            {school_name} = '${schoolName.replace(/'/g, "\\'")}',
            IS_AFTER({booking_date}, '${cutoff}')
          )`,
        });

        // Group by booking_id and class_id to build events with class details
        const eventMap = new Map<string, {
          eventType: string;
          eventDate: string;
          classMap: Map<string, {
            className: string;
            teacherName: string;
            registeredCount: number;
            isDefault: boolean;
          }>;
        }>();

        records.forEach(r => {
          if (r.booking_id) {
            if (!eventMap.has(r.booking_id)) {
              eventMap.set(r.booking_id, {
                eventType: r.event_type || 'Event',
                eventDate: r.booking_date || '',
                classMap: new Map(),
              });
            }
            if (r.class_id) {
              const event = eventMap.get(r.booking_id)!;
              if (!event.classMap.has(r.class_id)) {
                const isDefaultClass = r.class === 'Alle Kinder';
                event.classMap.set(r.class_id, {
                  className: r.class || 'Unknown Class',
                  teacherName: r.main_teacher || '',
                  registeredCount: 0,
                  isDefault: isDefaultClass,
                });
              }
              // Count non-placeholder registrations
              if (r.parent_id && r.parent_id !== 'PLACEHOLDER') {
                event.classMap.get(r.class_id)!.registeredCount++;
              }
            }
          }
        });

        // Convert to array with classes sorted (alphabetically, default at end)
        return Array.from(eventMap.entries())
          .map(([bookingId, data]) => {
            const classes = Array.from(data.classMap.entries())
              .map(([classId, classData]) => ({
                classId,
                className: classData.className,
                teacherName: classData.teacherName,
                registeredCount: classData.registeredCount,
                isDefault: classData.isDefault,
              }))
              .sort((a, b) => {
                if (a.isDefault && !b.isDefault) return 1;
                if (!a.isDefault && b.isDefault) return -1;
                return a.className.localeCompare(b.className);
              });

            return {
              bookingId,
              eventType: data.eventType,
              eventDate: data.eventDate,
              classCount: data.classMap.size,
              classes,
            };
          })
          .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
      } catch (error) {
        console.error('Error getting school events:', error);
        return [];
      }
    }
  }

  // Get classes for a specific event
  async getEventClasses(bookingId: string): Promise<Array<{
    classId: string;
    className: string;
    teacherName: string;
    registeredCount: number;
    isDefault?: boolean;
  }>> {
    if (this.useNormalizedTables()) {
      // Ensure tables are initialized
      this.ensureNormalizedTablesInitialized();

      // NEW: Query Classes table and Registrations
      try {
        // Get all classes for this event using legacy_booking_id
        // Classes may have been created with either event_id (e.g., "gs-frankenberg-2025-03-15")
        // or simplybookId (e.g., "8594251"), so we need to search for both
        let filterFormula = `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${bookingId.replace(/'/g, "\\'")}'`;

        // Try to get the Event record to find alternative identifiers
        const event = await this.getEventByEventId(bookingId);
        if (event?.simplybook_booking?.[0]) {
          const schoolBooking = await this.getSchoolBookingById(event.simplybook_booking[0]);
          if (schoolBooking?.simplybookId && schoolBooking.simplybookId !== bookingId) {
            filterFormula = `OR(
              {${CLASSES_FIELD_IDS.legacy_booking_id}} = '${bookingId.replace(/'/g, "\\'")}',
              {${CLASSES_FIELD_IDS.legacy_booking_id}} = '${schoolBooking.simplybookId.replace(/'/g, "\\'")}'
            )`;
          }
        }

        const classRecords = await this.classesTable!.select({
          filterByFormula: filterFormula,
        }).all();

        // Filter out non-registrable class types (choir, teacher_song)
        const registrableRecords = classRecords.filter(classRecord => {
          const f = classRecord.fields as Record<string, any>;
          const classType = f['class_type'] || f[CLASSES_FIELD_IDS.class_type];
          const isDefault = Boolean(f['is_default'] || f[CLASSES_FIELD_IDS.is_default]);
          return isRegistrableClassType(classType, isDefault);
        });

        // For each class, count registered children
        const classesWithCounts = await Promise.all(
          registrableRecords.map(async (classRecord) => {
            const classFields = classRecord.fields as Record<string, any>;
            // Note: Airtable returns human-readable field names, not field IDs
            const classId = classFields['class_id'] || classFields[CLASSES_FIELD_IDS.class_id];

            // Count registrations for this class (excluding placeholders if any)
            const registrations = await this.registrationsTable!.select({
              filterByFormula: `{${REGISTRATIONS_FIELD_IDS.class_id}} = '${classRecord.id}'`,
            }).all();

            // Filter out any placeholder records (no parent_id link)
            const realRegistrations = registrations.filter(reg => {
              const regFields = reg.fields as Record<string, any>;
              return regFields[REGISTRATIONS_FIELD_IDS.parent_id] &&
                     regFields[REGISTRATIONS_FIELD_IDS.parent_id].length > 0;
            });

            return {
              classId: classId || '',
              className: classFields['class_name'] || classFields[CLASSES_FIELD_IDS.class_name] || 'Unknown Class',
              teacherName: classFields['main_teacher'] || classFields[CLASSES_FIELD_IDS.main_teacher] || '',
              registeredCount: realRegistrations.length,
              isDefault: Boolean(classFields['is_default'] || classFields[CLASSES_FIELD_IDS.is_default]),
            };
          })
        );

        // Sort by class name
        return classesWithCounts.sort((a, b) => a.className.localeCompare(b.className));
      } catch (error) {
        console.error('Error getting event classes:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
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
          isDefault: boolean;
        }>();

        records.forEach(r => {
          if (r.class_id) {
            if (!classMap.has(r.class_id)) {
              // Check if this is the default "Alle Kinder" class by name
              // Legacy table doesn't have is_default field, so we detect by naming convention
              const isDefaultClass = r.class === 'Alle Kinder';
              classMap.set(r.class_id, {
                className: r.class || 'Unknown Class',
                teacherName: r.main_teacher || '',
                registeredCount: 0,
                isDefault: isDefaultClass,
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
            isDefault: data.isDefault,
          }))
          .sort((a, b) => a.className.localeCompare(b.className));
      } catch (error) {
        console.error('Error getting event classes:', error);
        return [];
      }
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
    if (this.useNormalizedTables()) {
      // NEW: Query from normalized tables
      try {
        // Count unique parents from Parents table
        const parents = await this.parentsTable!.select().all();
        const totalParents = parents.length;

        // Count parents who opted into email campaigns
        const emailsSent = parents.filter(p => {
          const fields = p.fields as Record<string, any>;
          return fields[PARENTS_FIELD_IDS.email_campaigns] === 'yes';
        }).length;

        // Count unique events from Events table
        const events = await this.eventsTable!.select().all();
        const activeEvents = events.length;

        // Count registrations with order numbers (completed orders)
        const registrations = await this.registrationsTable!.select().all();
        const orders = registrations.filter(r => {
          const fields = r.fields as Record<string, any>;
          return fields[REGISTRATIONS_FIELD_IDS.order_number];
        });
        const totalOrders = orders.length;

        // Calculate total revenue from orders (placeholder)
        const totalRevenue = 0; // Actual revenue would come from order system

        // Calculate email open rate (mock for now)
        const emailOpenRate = emailsSent > 0 ? 0.65 : 0;

        // Calculate conversion rate
        const conversionRate = totalParents > 0
          ? (totalOrders / totalParents) * 100
          : 0;

        return {
          totalRevenue,
          totalOrders,
          totalParents,
          emailsSent,
          emailOpenRate,
          conversionRate: Math.round(conversionRate * 100) / 100,
          activeEvents,
        };
      } catch (error) {
        console.error('Error fetching dashboard stats from normalized tables:', error);
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
    } else {
      // LEGACY: Query from parent_journey_table
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
  }

  // Get analytics for a specific event
  async getEventAnalytics(eventId: string): Promise<{
    eventId: string;
    eventName: string;
    totalRegistrations: number;
    totalRevenue: number;
    conversionRate: number;
  }> {
    if (this.useNormalizedTables()) {
      // NEW: Query from normalized tables
      try {
        // Find event by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) {
          return {
            eventId,
            eventName: 'Unknown Event',
            totalRegistrations: 0,
            totalRevenue: 0,
            conversionRate: 0,
          };
        }

        const eventRecord = eventRecords[0];
        const eventFields = eventRecord.fields as Record<string, any>;
        const eventName = eventFields[EVENTS_FIELD_IDS.school_name] || 'Unknown Event';

        // Get all registrations for this event
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${eventRecord.id}'`,
        }).all();

        const totalRegistrations = registrations.length;

        // Count registrations with order numbers
        const orders = registrations.filter(r => {
          const fields = r.fields as Record<string, any>;
          return fields[REGISTRATIONS_FIELD_IDS.order_number];
        });

        const totalRevenue = 0; // Placeholder - actual revenue would come from order system

        const conversionRate = totalRegistrations > 0
          ? (orders.length / totalRegistrations) * 100
          : 0;

        return {
          eventId,
          eventName,
          totalRegistrations,
          totalRevenue,
          conversionRate: Math.round(conversionRate * 100) / 100,
        };
      } catch (error) {
        console.error('Error fetching event analytics from normalized tables:', error);
        return {
          eventId,
          eventName: 'Unknown',
          totalRegistrations: 0,
          totalRevenue: 0,
          conversionRate: 0,
        };
      }
    } else {
      // LEGACY: Query from parent_journey_table
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
    if (this.useNormalizedTables()) {
      // NEW: Update Events table assigned_staff field
      this.ensureNormalizedTablesInitialized();
      try {
        // Find the event by event_id (bookingId)
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
          maxRecords: 1,
        }).firstPage();

        if (events.length === 0) {
          // No event found - try SchoolBookings table instead
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
        }

        // Update the Events record
        await this.eventsTable!.update(events[0].id, {
          [EVENTS_FIELD_IDS.assigned_staff]: staffId ? [staffId] : [],
        });

        return 1;
      } catch (error) {
        console.error('Error assigning staff to event:', error);
        throw new Error(`Failed to assign staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Update parent_journey_table records
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
    if (this.useNormalizedTables()) {
      // NEW: Update Events table assigned_engineer field
      try {
        // Find the event by event_id (bookingId)
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
          maxRecords: 1,
        }).firstPage();

        if (events.length === 0) {
          return 0;
        }

        // Update the Events record
        await this.eventsTable!.update(events[0].id, {
          [EVENTS_FIELD_IDS.assigned_engineer]: engineerId ? [engineerId] : [],
        });

        return 1;
      } catch (error) {
        console.error('Error assigning engineer to event:', error);
        throw new Error(`Failed to assign engineer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Update parent_journey_table records
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
  }

  /**
   * Auto-assign engineer to event based on schulsong status
   * - If hasSchulsongTracks is true, assign Micha (ENGINEER_IDS.MICHA)
   * - Otherwise, assign Jakob (ENGINEER_IDS.JAKOB)
   * - Does NOT override existing assignment
   * @param eventId - The event_id to assign
   * @param hasSchulsongTracks - Whether the upload contains schulsong tracks
   * @returns true if assignment was made, false if already assigned or no engineer configured
   */
  async autoAssignEngineerForUpload(eventId: string, hasSchulsongTracks: boolean): Promise<boolean> {
    if (!this.useNormalizedTables()) {
      console.log('[autoAssignEngineer] Skipping - normalized tables not enabled');
      return false;
    }

    try {
      // Find the event
      const events = await this.eventsTable!.select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (events.length === 0) {
        console.log(`[autoAssignEngineer] Event not found: ${eventId}`);
        return false;
      }

      const eventRecord = events[0];
      const existingEngineer = eventRecord.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[] | undefined;

      // Don't override existing assignment
      if (existingEngineer && existingEngineer.length > 0) {
        console.log(`[autoAssignEngineer] Event ${eventId} already has engineer assigned: ${existingEngineer[0]}`);
        return false;
      }

      // Get appropriate engineer based on schulsong flag
      const engineerId = getEngineerIdForTrack(hasSchulsongTracks);

      if (!engineerId) {
        console.log(`[autoAssignEngineer] No engineer ID configured for schulsong=${hasSchulsongTracks}`);
        return false;
      }

      // Assign the engineer
      await this.eventsTable!.update(eventRecord.id, {
        [EVENTS_FIELD_IDS.assigned_engineer]: [engineerId],
      });

      console.log(`[autoAssignEngineer] Assigned engineer ${engineerId} to event ${eventId} (schulsong=${hasSchulsongTracks})`);
      return true;
    } catch (error) {
      console.error('[autoAssignEngineer] Error:', error);
      return false;
    }
  }

  /**
   * Update event's approval status fields
   * Called after admin approves/rejects tracks
   * @param eventId - The event_id
   * @param allTracksApproved - Whether all final tracks are approved
   */
  async updateEventApprovalStatus(eventId: string, allTracksApproved: boolean): Promise<void> {
    if (!this.useNormalizedTables()) {
      console.log('[updateEventApprovalStatus] Skipping - normalized tables not enabled');
      return;
    }

    try {
      // Find the event
      const events = await this.eventsTable!.select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (events.length === 0) {
        console.log(`[updateEventApprovalStatus] Event not found: ${eventId}`);
        return;
      }

      const eventRecord = events[0];
      const adminApprovalStatus = allTracksApproved ? 'approved' : 'ready_for_approval';

      // Update the event record
      await this.eventsTable!.update(eventRecord.id, {
        [EVENTS_FIELD_IDS.all_tracks_approved]: allTracksApproved,
        [EVENTS_FIELD_IDS.admin_approval_status]: adminApprovalStatus,
      });

      console.log(`[updateEventApprovalStatus] Updated event ${eventId}: all_tracks_approved=${allTracksApproved}, status=${adminApprovalStatus}`);
    } catch (error) {
      console.error('[updateEventApprovalStatus] Error:', error);
      throw new Error(`Failed to update event approval status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set or clear schulsong_released_at on an event
   * Called when admin approves (sets date) or rejects (clears) schulsong
   */
  async setSchulsongReleasedAt(eventId: string, releasedAt: string | null): Promise<void> {
    try {
      const events = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (events.length === 0) {
        console.log(`[setSchulsongReleasedAt] Event not found: ${eventId}`);
        return;
      }

      // Airtable SDK doesn't accept null — use undefined to clear a field
      const fieldValue = releasedAt ?? undefined;
      const updates: Record<string, string | undefined> = {
        [EVENTS_FIELD_IDS.schulsong_released_at]: fieldValue,
      };
      if (releasedAt) {
        updates[EVENTS_FIELD_IDS.admin_approval_status] = 'approved';
      }
      await this.base(EVENTS_TABLE_ID).update(events[0].id, updates);

      console.log(`[setSchulsongReleasedAt] Updated event ${eventId}: schulsong_released_at=${releasedAt}`);
    } catch (error) {
      console.error('[setSchulsongReleasedAt] Error:', error);
      throw new Error(`Failed to set schulsong released at: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the audio pipeline stage for an event
   * Called at each pipeline transition point (staff upload, engineer final, admin approve)
   */
  async updateEventAudioPipelineStage(
    eventId: string,
    stage: 'not_started' | 'staff_uploaded' | 'finals_submitted'
  ): Promise<void> {
    if (!this.useNormalizedTables()) {
      return;
    }

    try {
      const events = await this.eventsTable!.select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (events.length === 0) {
        console.log(`[updateEventAudioPipelineStage] Event not found: ${eventId}`);
        return;
      }

      await this.eventsTable!.update(events[0].id, {
        [EVENTS_FIELD_IDS.audio_pipeline_stage]: stage,
      });

      console.log(`[updateEventAudioPipelineStage] Updated event ${eventId}: stage=${stage}`);
    } catch (error) {
      console.error('[updateEventAudioPipelineStage] Error:', error);
      // Don't throw - pipeline stage updates are non-critical
    }
  }

  /**
   * Get school event summaries filtered by assigned engineer
   * Used for Engineer Portal to show only assigned events
   */
  async getSchoolEventSummariesByEngineer(engineerId: string): Promise<SchoolEventSummary[]> {
    if (this.useNormalizedTables()) {
      // NEW: Use getSchoolEventSummaries and filter
      try {
        const allEvents = await this.getSchoolEventSummaries();

        // Filter to only events assigned to this engineer (check array membership)
        return allEvents.filter(event => event.assignedEngineerIds?.includes(engineerId));
      } catch (error) {
        console.error('Error fetching engineer event summaries:', error);
        throw new Error(`Failed to fetch engineer events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // LEGACY: Query parent_journey_table and aggregate
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
  }

  /**
   * Optimized: Get engineer event summaries with minimal Airtable calls.
   * Fetches all events and filters by engineer assignment in JS.
   * Airtable formulas resolve linked records to display names (not record IDs),
   * so formula-based filtering doesn't work for linked record ID matching.
   * With ~77 events total, fetching all and filtering in JS is 1 API call.
   * ~3-5 API calls total (down from ~100).
   */
  async getEngineerEventSummaries(engineerId: string): Promise<{
    eventId: string;
    schoolName: string;
    eventDate: string;
    eventType: string;
    classCount: number;
    assignedEngineerIds: string[];
  }[]> {
    this.ensureNormalizedTablesInitialized();

    try {
      // Fetch all events, filter by engineer in JS (linked record IDs can't be matched in formulas)
      const eventRecords = await this.base(EVENTS_TABLE_ID)
        .select({
          returnFieldsByFieldId: true,
          sort: [{ field: EVENTS_FIELD_IDS.event_date, direction: 'desc' }],
        })
        .all();

      return eventRecords
        .filter((record) => {
          const assignedEngineers = (record.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[]) || [];
          return assignedEngineers.includes(engineerId);
        })
        .map((record) => {
          const linkedClassIds = (record.fields[EVENTS_FIELD_IDS.classes] as string[]) || [];
          return {
            eventId: record.fields[EVENTS_FIELD_IDS.event_id] as string,
            schoolName: record.fields[EVENTS_FIELD_IDS.school_name] as string,
            eventDate: record.fields[EVENTS_FIELD_IDS.event_date] as string,
            eventType: record.fields[EVENTS_FIELD_IDS.event_type] as string,
            classCount: linkedClassIds.length,
            assignedEngineerIds: (record.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[]) || [],
          };
        });
    } catch (error) {
      console.error('Error fetching optimized engineer event summaries:', error);
      throw new Error(`Failed to fetch engineer events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an engineer is assigned to a specific event
   */
  async isEngineerAssignedToEvent(engineerId: string, bookingId: string): Promise<boolean> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events table
      this.ensureNormalizedTablesInitialized();
      try {
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${bookingId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        }).firstPage();

        if (events.length === 0) return false;

        const eventFields = events[0].fields as Record<string, any>;
        const assignedEngineers = eventFields[EVENTS_FIELD_IDS.assigned_engineer] as string[] | undefined;

        return assignedEngineers?.includes(engineerId) || false;
      } catch (error) {
        console.error('Error checking engineer assignment:', error);
        return false;
      }
    } else {
      // LEGACY: Query parent_journey_table
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
  }

  /**
   * Optimized: Get engineer event detail with minimal Airtable calls.
   * Single event fetch, batch class fetch, returns all data needed for the detail page.
   * Also returns assignment check and is_schulsong to avoid separate queries.
   * ~3-4 API calls total (down from ~21+).
   */
  async getEngineerEventDetailOptimized(eventId: string, engineerId: string): Promise<{
    isAssigned: boolean;
    event: {
      eventId: string;
      schoolName: string;
      eventDate: string;
      eventType: string;
      isSchulsong: boolean;
      audioPipelineStage?: string;
      classes: Array<{
        classId: string;
        className: string;
        classType: string;
      }>;
    };
  } | null> {
    this.ensureNormalizedTablesInitialized();

    try {
      // Single event fetch — extracts assignment, is_schulsong, pipeline stage, and class IDs
      const eventRecords = await this.base(EVENTS_TABLE_ID)
        .select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
          returnFieldsByFieldId: true,
          maxRecords: 1,
        })
        .firstPage();

      if (eventRecords.length === 0) return null;

      const record = eventRecords[0];
      const assignedEngineers = (record.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[]) || [];
      const isAssigned = assignedEngineers.includes(engineerId);

      const linkedClassIds = (record.fields[EVENTS_FIELD_IDS.classes] as string[]) || [];

      // Batch class fetch: single OR query for all class IDs
      let classes: Array<{ classId: string; className: string; classType: string }> = [];
      if (linkedClassIds.length > 0) {
        const orClauses = linkedClassIds.map((id) => `RECORD_ID() = '${id}'`);
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: linkedClassIds.length === 1 ? orClauses[0] : `OR(${orClauses.join(',')})`,
            returnFieldsByFieldId: true,
          })
          .all();

        classes = classRecords.map((cr) => ({
          classId: cr.fields[CLASSES_FIELD_IDS.class_id] as string,
          className: cr.fields[CLASSES_FIELD_IDS.class_name] as string,
          classType: (cr.fields[CLASSES_FIELD_IDS.class_type] as string) || 'regular',
        }));

        classes.sort((a, b) => a.className.localeCompare(b.className));
      }

      return {
        isAssigned,
        event: {
          eventId: record.fields[EVENTS_FIELD_IDS.event_id] as string,
          schoolName: record.fields[EVENTS_FIELD_IDS.school_name] as string,
          eventDate: record.fields[EVENTS_FIELD_IDS.event_date] as string,
          eventType: record.fields[EVENTS_FIELD_IDS.event_type] as string,
          isSchulsong: (record.fields[EVENTS_FIELD_IDS.is_schulsong] as boolean) || false,
          audioPipelineStage: record.fields[EVENTS_FIELD_IDS.audio_pipeline_stage] as string | undefined,
          classes,
        },
      };
    } catch (error) {
      console.error('Error fetching optimized engineer event detail:', error);
      throw new Error(`Failed to fetch event detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get parent emails for a specific event
   * Used for notifications when audio is uploaded
   */
  async getParentEmailsByEventId(eventId: string): Promise<string[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Events → Registrations → Parents
      try {
        // Find the event
        const events = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId}'`,
          maxRecords: 1,
        }).firstPage();

        if (events.length === 0) return [];

        const eventRecordId = events[0].id;

        // Get all registrations for this event
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `{${REGISTRATIONS_FIELD_IDS.event_id}} = '${eventRecordId}'`,
        }).all();

        // Get unique parent emails
        const emails = new Set<string>();

        for (const reg of registrations) {
          const regFields = reg.fields as Record<string, any>;
          const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];

          if (parentRecordId) {
            const parent = await this.parentsTable!.find(parentRecordId).catch(() => null);
            if (parent) {
              const parentFields = parent.fields as Record<string, any>;
              const email = parentFields[PARENTS_FIELD_IDS.parent_email];

              if (email && email.includes('@')) {
                emails.add(email.toLowerCase());
              }
            }
          }
        }

        return Array.from(emails);
      } catch (error) {
        console.error('Error fetching parent emails:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
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
  }

  /**
   * Get parent emails for a specific class within an event
   */
  async getParentEmailsByClassId(classId: string): Promise<string[]> {
    if (this.useNormalizedTables()) {
      // NEW: Query Classes → Registrations → Parents
      try {
        // Find the class by class_id
        const classes = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
          maxRecords: 1,
        }).firstPage();

        if (classes.length === 0) return [];

        const classRecordId = classes[0].id;

        // Get all registrations for this class
        const registrations = await this.registrationsTable!.select({
          filterByFormula: `{${REGISTRATIONS_FIELD_IDS.class_id}} = '${classRecordId}'`,
        }).all();

        // Get unique parent emails
        const emails = new Set<string>();

        for (const reg of registrations) {
          const regFields = reg.fields as Record<string, any>;
          const parentRecordId = regFields[REGISTRATIONS_FIELD_IDS.parent_id]?.[0];

          if (parentRecordId) {
            const parent = await this.parentsTable!.find(parentRecordId).catch(() => null);
            if (parent) {
              const parentFields = parent.fields as Record<string, any>;
              const email = parentFields[PARENTS_FIELD_IDS.parent_email];

              if (email && email.includes('@')) {
                emails.add(email.toLowerCase());
              }
            }
          }
        }

        return Array.from(emails);
      } catch (error) {
        console.error('Error fetching parent emails by class:', error);
        return [];
      }
    } else {
      // LEGACY: Query parent_journey_table
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
      schoolName: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_name] || '',
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
      secondaryContacts: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.secondary_contacts],
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
      // Use select with RECORD_ID() filter to get field IDs in response
      // .find() doesn't support returnFieldsByFieldId, which causes field mapping issues
      const records = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `RECORD_ID() = '${bookingId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        return null;
      }

      return this.transformSchoolBookingRecord(records[0]);
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
        const status = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] as string | undefined;
        if (status === 'deleted') return false;

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
   * Get all bookings (past and future)
   * Only filters out deleted records, returns all bookings with valid start_date
   * Sorted by start_date descending (newest first)
   */
  async getAllBookings(): Promise<SchoolBooking[]> {
    try {
      // Use returnFieldsByFieldId to get field IDs in response (matching our SCHOOL_BOOKINGS_FIELD_IDS)
      const allRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          pageSize: 100,
          returnFieldsByFieldId: true,
        })
        .all();

      // Filter out deleted records; allow pending bookings without a date
      const validRecords = allRecords.filter(record => {
        const status = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] as string | undefined;
        if (status === 'deleted') return false;

        const startDateStr = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string | undefined;
        return status === 'pending' || Boolean(startDateStr);
      });

      // Sort by start_date descending (newest first)
      validRecords.sort((a, b) => {
        const dateA = new Date(a.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        const dateB = new Date(b.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string);
        return dateB.getTime() - dateA.getTime();
      });

      return validRecords.map((record) => this.transformSchoolBookingRecord(record));
    } catch (error) {
      console.error('Error fetching all bookings:', error);
      throw new Error(`Failed to fetch all bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // ==================== Leads CRM ====================

  /**
   * Transform an Airtable record to a Lead object
   * Note: call_notes is stored as a JSON string in Airtable, parsed to CallNote[]
   * Linked record fields (region, einrichtung, assigned_staff, converted_booking_id) are arrays in Airtable
   */
  private transformLeadRecord(record: any): Lead {
    const fields = record.fields;

    // Parse call_notes JSON string
    let callNotes: CallNote[] = [];
    const callNotesRaw = fields[LEADS_FIELD_IDS.call_notes] as string | undefined;
    if (callNotesRaw) {
      try {
        callNotes = JSON.parse(callNotesRaw);
      } catch {
        callNotes = [];
      }
    }

    // Linked record fields come as arrays, take first element
    const regionArr = fields[LEADS_FIELD_IDS.region] as string[] | undefined;
    const einrichtungArr = fields[LEADS_FIELD_IDS.einrichtung] as string[] | undefined;
    const assignedStaffArr = fields[LEADS_FIELD_IDS.assigned_staff] as string[] | undefined;
    const convertedBookingArr = fields[LEADS_FIELD_IDS.converted_booking_id] as string[] | undefined;

    return {
      id: record.id,
      schoolName: (fields[LEADS_FIELD_IDS.school_name] as string) || '',
      contactPerson: (fields[LEADS_FIELD_IDS.contact_person] as string) || '',
      contactEmail: fields[LEADS_FIELD_IDS.contact_email] as string | undefined,
      contactPhone: fields[LEADS_FIELD_IDS.contact_phone] as string | undefined,
      address: fields[LEADS_FIELD_IDS.address] as string | undefined,
      postalCode: fields[LEADS_FIELD_IDS.postal_code] as string | undefined,
      city: fields[LEADS_FIELD_IDS.city] as string | undefined,
      regionId: regionArr?.[0],
      estimatedChildren: fields[LEADS_FIELD_IDS.estimated_children] as number | undefined,
      eventTypeInterest: fields[LEADS_FIELD_IDS.event_type_interest] as EventTypeInterest[] | undefined,
      leadSource: fields[LEADS_FIELD_IDS.lead_source] as LeadSource | undefined,
      stage: (fields[LEADS_FIELD_IDS.stage] as LeadStage) || 'New',
      lostReason: fields[LEADS_FIELD_IDS.lost_reason] as string | undefined,
      schulsongUpsell: fields[LEADS_FIELD_IDS.schulsong_upsell] as boolean | undefined,
      scsFunded: fields[LEADS_FIELD_IDS.scs_funded] as boolean | undefined,
      einrichtungId: einrichtungArr?.[0],
      assignedStaffId: assignedStaffArr?.[0],
      callNotes,
      nextFollowUp: fields[LEADS_FIELD_IDS.next_follow_up] as string | undefined,
      estimatedDate: fields[LEADS_FIELD_IDS.estimated_date] as string | undefined,
      estimatedMonth: fields[LEADS_FIELD_IDS.estimated_month] as string | undefined,
      convertedBookingId: convertedBookingArr?.[0],
      createdAt: record.createdTime || '',
      updatedAt: '',
    };
  }

  /**
   * Get all leads from the Leads table
   */
  async getAllLeads(): Promise<Lead[]> {
    try {
      const allRecords = await this.base(LEADS_TABLE_ID)
        .select({
          pageSize: 100,
          returnFieldsByFieldId: true,
        })
        .all();

      return allRecords.map((record) => this.transformLeadRecord(record));
    } catch (error) {
      console.error('Error fetching all leads:', error);
      throw new Error(`Failed to fetch all leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new lead record
   * Auto-links to Einrichtung via findOrCreateEinrichtung
   */
  async createLead(data: {
    schoolName: string;
    contactPerson: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    regionId?: string;
    estimatedChildren?: number;
    eventTypeInterest?: EventTypeInterest[];
    leadSource?: LeadSource;
    schulsongUpsell?: boolean;
    scsFunded?: boolean;
    assignedStaffId?: string;
    initialNotes?: string;
    estimatedDate?: string;
    estimatedMonth?: string;
  }): Promise<Lead> {
    try {
      // Create initial call note
      const initialCallNote: CallNote = {
        callNumber: 1,
        date: new Date().toISOString().split('T')[0],
        notes: data.initialNotes || '',
      };

      // Auto-link institution
      const einrichtung = await this.findOrCreateEinrichtung(
        data.schoolName,
        data.contactEmail || ''
      );

      // Build fields object
      const fields: Record<string, any> = {
        [LEADS_FIELD_IDS.school_name]: data.schoolName,
        [LEADS_FIELD_IDS.contact_person]: data.contactPerson,
        [LEADS_FIELD_IDS.stage]: 'New' as LeadStage,
        [LEADS_FIELD_IDS.call_notes]: JSON.stringify([initialCallNote]),
        [LEADS_FIELD_IDS.einrichtung]: [einrichtung.id],
      };

      if (data.contactEmail !== undefined) {
        fields[LEADS_FIELD_IDS.contact_email] = data.contactEmail;
      }
      if (data.contactPhone !== undefined) {
        fields[LEADS_FIELD_IDS.contact_phone] = data.contactPhone;
      }
      if (data.address !== undefined) {
        fields[LEADS_FIELD_IDS.address] = data.address;
      }
      if (data.postalCode !== undefined) {
        fields[LEADS_FIELD_IDS.postal_code] = data.postalCode;
      }
      if (data.city !== undefined) {
        fields[LEADS_FIELD_IDS.city] = data.city;
      }
      if (data.regionId !== undefined) {
        fields[LEADS_FIELD_IDS.region] = [data.regionId];
      }
      if (data.estimatedChildren !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_children] = data.estimatedChildren;
      }
      if (data.eventTypeInterest !== undefined) {
        fields[LEADS_FIELD_IDS.event_type_interest] = data.eventTypeInterest;
      }
      if (data.leadSource !== undefined) {
        fields[LEADS_FIELD_IDS.lead_source] = data.leadSource;
      }
      if (data.schulsongUpsell !== undefined) {
        fields[LEADS_FIELD_IDS.schulsong_upsell] = data.schulsongUpsell;
      }
      if (data.scsFunded !== undefined) {
        fields[LEADS_FIELD_IDS.scs_funded] = data.scsFunded;
      }
      if (data.assignedStaffId !== undefined) {
        fields[LEADS_FIELD_IDS.assigned_staff] = [data.assignedStaffId];
      }
      if (data.estimatedDate !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_date] = data.estimatedDate;
      }
      if (data.estimatedMonth !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_month] = data.estimatedMonth;
      }

      const record = await this.base(LEADS_TABLE_ID).create(fields);

      // Re-fetch with returnFieldsByFieldId to get consistent transform
      const refetchedRecords = await this.base(LEADS_TABLE_ID)
        .select({
          filterByFormula: `RECORD_ID() = '${record.id}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (refetchedRecords.length > 0) {
        return this.transformLeadRecord(refetchedRecords[0]);
      }

      // Fallback: return a minimal Lead object from what we know
      return this.transformLeadRecord(record);
    } catch (error) {
      console.error('Error creating lead:', error);
      throw new Error(`Failed to create lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single lead by ID
   */
  async getLeadById(leadId: string): Promise<Lead> {
    try {
      const records = await this.base(LEADS_TABLE_ID)
        .select({
          filterByFormula: `RECORD_ID() = '${leadId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        throw new Error('Lead not found');
      }

      return this.transformLeadRecord(records[0]);
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw new Error(`Failed to fetch lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing lead record
   * Only updates fields that are explicitly provided (uses !== undefined checks)
   */
  async updateLead(leadId: string, data: {
    schoolName?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    regionId?: string | null;
    estimatedChildren?: number;
    eventTypeInterest?: EventTypeInterest[];
    leadSource?: LeadSource;
    stage?: LeadStage;
    lostReason?: string;
    schulsongUpsell?: boolean;
    scsFunded?: boolean;
    einrichtungId?: string | null;
    assignedStaffId?: string | null;
    callNotes?: CallNote[];
    nextFollowUp?: string | null;
    estimatedDate?: string | null;
    estimatedMonth?: string | null;
    convertedBookingId?: string | null;
  }): Promise<Lead> {
    try {
      const fields: Record<string, any> = {};

      if (data.schoolName !== undefined) {
        fields[LEADS_FIELD_IDS.school_name] = data.schoolName;
      }
      if (data.contactPerson !== undefined) {
        fields[LEADS_FIELD_IDS.contact_person] = data.contactPerson;
      }
      if (data.contactEmail !== undefined) {
        fields[LEADS_FIELD_IDS.contact_email] = data.contactEmail;
      }
      if (data.contactPhone !== undefined) {
        fields[LEADS_FIELD_IDS.contact_phone] = data.contactPhone;
      }
      if (data.address !== undefined) {
        fields[LEADS_FIELD_IDS.address] = data.address;
      }
      if (data.postalCode !== undefined) {
        fields[LEADS_FIELD_IDS.postal_code] = data.postalCode;
      }
      if (data.city !== undefined) {
        fields[LEADS_FIELD_IDS.city] = data.city;
      }
      if (data.regionId !== undefined) {
        fields[LEADS_FIELD_IDS.region] = data.regionId ? [data.regionId] : [];
      }
      if (data.estimatedChildren !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_children] = data.estimatedChildren;
      }
      if (data.eventTypeInterest !== undefined) {
        fields[LEADS_FIELD_IDS.event_type_interest] = data.eventTypeInterest;
      }
      if (data.leadSource !== undefined) {
        fields[LEADS_FIELD_IDS.lead_source] = data.leadSource;
      }
      if (data.stage !== undefined) {
        fields[LEADS_FIELD_IDS.stage] = data.stage;
      }
      if (data.lostReason !== undefined) {
        fields[LEADS_FIELD_IDS.lost_reason] = data.lostReason;
      }
      if (data.schulsongUpsell !== undefined) {
        fields[LEADS_FIELD_IDS.schulsong_upsell] = data.schulsongUpsell;
      }
      if (data.scsFunded !== undefined) {
        fields[LEADS_FIELD_IDS.scs_funded] = data.scsFunded;
      }
      if (data.einrichtungId !== undefined) {
        fields[LEADS_FIELD_IDS.einrichtung] = data.einrichtungId ? [data.einrichtungId] : [];
      }
      if (data.assignedStaffId !== undefined) {
        fields[LEADS_FIELD_IDS.assigned_staff] = data.assignedStaffId ? [data.assignedStaffId] : [];
      }
      if (data.callNotes !== undefined) {
        fields[LEADS_FIELD_IDS.call_notes] = JSON.stringify(data.callNotes);
      }
      if (data.nextFollowUp !== undefined) {
        fields[LEADS_FIELD_IDS.next_follow_up] = data.nextFollowUp;
      }
      if (data.estimatedDate !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_date] = data.estimatedDate;
      }
      if (data.estimatedMonth !== undefined) {
        fields[LEADS_FIELD_IDS.estimated_month] = data.estimatedMonth;
      }
      if (data.convertedBookingId !== undefined) {
        fields[LEADS_FIELD_IDS.converted_booking_id] = data.convertedBookingId ? [data.convertedBookingId] : [];
      }

      await this.base(LEADS_TABLE_ID).update(leadId, fields);

      // Re-fetch with returnFieldsByFieldId for consistent transform
      const refetchedRecords = await this.base(LEADS_TABLE_ID)
        .select({
          filterByFormula: `RECORD_ID() = '${leadId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (refetchedRecords.length === 0) {
        throw new Error(`Lead ${leadId} not found after update`);
      }

      return this.transformLeadRecord(refetchedRecords[0]);
    } catch (error) {
      console.error('Error updating lead:', error);
      throw new Error(`Failed to update lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a lead record
   */
  async deleteLead(leadId: string): Promise<void> {
    try {
      await this.base(LEADS_TABLE_ID).destroy(leadId);
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw new Error(`Failed to delete lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================
  // Event Creation from Booking
  // ========================================

  /**
   * Create an Event record from a SchoolBooking
   * Called by SimplyBook webhook after creating SchoolBookings record
   *
   * @param eventId - Generated event_id (e.g., evt_school_minimusiker_20260115_abc123)
   * @param schoolBookingRecordId - Airtable record ID of the SchoolBookings record
   * @param schoolName - School name from booking
   * @param eventDate - Event date (ISO string)
   * @param staffId - Optional staff ID to assign
   * @returns Created Event record
   */
  async createEventFromBooking(
    eventId: string,
    schoolBookingRecordId: string,
    schoolName: string,
    eventDate: string,
    staffId?: string,
    eventType?: string,
    schoolAddress?: string,
    schoolPhone?: string,
    eventStatus?: string,
    estimatedChildren?: number
  ): Promise<Event> {
    this.ensureNormalizedTablesInitialized();

    try {
      // Check if event already exists by exact event_id (idempotency)
      const existingRecords = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = "${eventId}"`,
        maxRecords: 1,
      }).firstPage();

      if (existingRecords.length > 0) {
        console.log(`Event ${eventId} already exists, returning existing record`);
        return this.transformEventRecord(existingRecords[0]);
      }

      // Broader duplicate check: same school_name + same event_date (±1 day)
      // Prevents duplicates caused by re-processing webhooks or timezone edge cases
      if (schoolName && eventDate) {
        const normalizedName = schoolName.trim().replace(/\s+/g, ' ').toLowerCase();
        const targetDate = new Date(eventDate);
        const dayBefore = new Date(targetDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(targetDate);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        const nearDuplicates = await this.base(EVENTS_TABLE_ID).select({
          filterByFormula: `AND(
            LOWER({${EVENTS_FIELD_IDS.school_name}}) = '${normalizedName.replace(/'/g, "\\'")}',
            IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${formatDate(dayBefore)}'),
            IS_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${formatDate(dayAfter)}')
          )`,
          maxRecords: 1,
        }).firstPage();

        if (nearDuplicates.length > 0) {
          const existingEvent = this.transformEventRecord(nearDuplicates[0]);
          console.warn(
            `[createEventFromBooking] Potential duplicate: found existing event ${existingEvent.event_id} ` +
            `for "${schoolName}" on ${eventDate}. Returning existing instead of creating new.`
          );
          return existingEvent;
        }
      }

      // Create the Event record
      const eventFields: Record<string, any> = {
        [EVENTS_FIELD_IDS.event_id]: eventId,
        [EVENTS_FIELD_IDS.school_name]: schoolName,
        [EVENTS_FIELD_IDS.event_date]: eventDate,
        [EVENTS_FIELD_IDS.simplybook_booking]: [schoolBookingRecordId],
      };

      // Only set event_type if provided (allows graceful degradation)
      if (eventType) {
        eventFields[EVENTS_FIELD_IDS.event_type] = eventType;
      }

      // Add staff assignment if provided
      if (staffId) {
        eventFields[EVENTS_FIELD_IDS.assigned_staff] = [staffId];
      }

      // Add event status if provided (e.g., 'Pending' for manual bookings)
      if (eventStatus) {
        eventFields[EVENTS_FIELD_IDS.status] = eventStatus;
      }

      // Add school contact info if provided
      if (schoolAddress) {
        eventFields[EVENTS_FIELD_IDS.school_address] = schoolAddress;
      }
      if (schoolPhone) {
        eventFields[EVENTS_FIELD_IDS.school_phone] = schoolPhone;
      }

      // Add estimated children and auto-calculate is_under_100
      if (estimatedChildren !== undefined) {
        eventFields[EVENTS_FIELD_IDS.estimated_children] = estimatedChildren;
        eventFields[EVENTS_FIELD_IDS.is_under_100] = estimatedChildren < 100;
      }

      const record = await this.base(EVENTS_TABLE_ID).create(eventFields);
      console.log(`Created Event record: ${record.id} with event_id: ${eventId}`);

      return this.transformEventRecord(record);
    } catch (error) {
      console.error('Error creating Event from booking:', error);
      throw new Error(`Failed to create Event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get an Event by its event_id
   */
  async getEventByEventId(eventId: string): Promise<Event | null> {
    try {
      // Note: Airtable formulas use field names, not field IDs
      const records = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `{event_id} = "${eventId}"`,
        maxRecords: 1,
      }).firstPage();

      if (records.length === 0) {
        return null;
      }

      return this.transformEventRecord(records[0]);
    } catch (error) {
      console.error('Error fetching Event by event_id:', error);
      return null;
    }
  }

  /**
   * Check if an event has the schulsong feature enabled
   * @param eventId - The event_id (not Airtable record ID)
   * @returns true if the event's is_schulsong field is true
   */
  async getEventIsSchulsong(eventId: string): Promise<boolean> {
    try {
      const event = await this.getEventByEventId(eventId);
      return event?.is_schulsong === true;
    } catch (error) {
      console.error('Error checking is_schulsong for event:', error);
      return false;
    }
  }

  /**
   * Get an Event by its access_code (short URL code)
   * Used for short URL routing: minimusiker.app/1562 → Event
   */
  async getEventByAccessCode(accessCode: number): Promise<Event | null> {
    try {
      // Note: Airtable formulas use field names, not field IDs
      const records = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `{access_code} = ${accessCode}`,
        maxRecords: 1,
      }).firstPage();

      if (records.length === 0) {
        return null;
      }

      return this.transformEventRecord(records[0]);
    } catch (error) {
      console.error('Error fetching Event by access_code:', error);
      return null;
    }
  }

  /**
   * Get an Event by its linked SchoolBookings record ID
   * Used to find the Event associated with a specific booking
   */
  async getEventByBookingRecordId(bookingRecordId: string): Promise<Event | null> {
    try {
      // Find Events where simplybook_booking contains this booking record ID
      const records = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `FIND("${bookingRecordId}", ARRAYJOIN({simplybook_booking}))`,
        maxRecords: 1,
      }).firstPage();

      if (records.length === 0) {
        return null;
      }

      return this.transformEventRecord(records[0]);
    } catch (error) {
      console.error('Error fetching Event by booking record ID:', error);
      return null;
    }
  }

  /**
   * Update an Event record
   * Used to sync school contact info from teacher portal updates
   */
  async updateEvent(
    eventRecordId: string,
    updates: {
      school_address?: string;
      school_phone?: string;
    }
  ): Promise<void> {
    try {
      const updateFields: Record<string, any> = {};

      if (updates.school_address !== undefined) {
        updateFields[EVENTS_FIELD_IDS.school_address] = updates.school_address;
      }
      if (updates.school_phone !== undefined) {
        updateFields[EVENTS_FIELD_IDS.school_phone] = updates.school_phone;
      }

      if (Object.keys(updateFields).length > 0) {
        await this.base(EVENTS_TABLE_ID).update(eventRecordId, updateFields);
        console.log(`Updated Event ${eventRecordId} with:`, Object.keys(updateFields));
      }
    } catch (error) {
      console.error('Error updating Event:', error);
      throw new Error(`Failed to update Event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an Event's date with proper sync to linked SchoolBooking
   * @param eventRecordId - The Airtable record ID of the event
   * @param newDate - The new date in YYYY-MM-DD format
   * @returns Object with updated event and whether booking was also updated
   */
  async updateEventDate(
    eventRecordId: string,
    newDate: string
  ): Promise<{ success: boolean; bookingUpdated: boolean; simplybookId?: string; message: string }> {
    try {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(newDate)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }

      // Parse and validate the date is valid
      const parsedDate = new Date(newDate);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date value');
      }

      // First, get the current event to find linked SchoolBooking
      const eventRecords = await this.base(EVENTS_TABLE_ID).select({
        filterByFormula: `RECORD_ID() = '${eventRecordId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (eventRecords.length === 0) {
        throw new Error('Event not found');
      }

      const linkedBookingIds = eventRecords[0].fields[EVENTS_FIELD_IDS.simplybook_booking] as string[] | undefined;

      // Update the Events table
      await this.base(EVENTS_TABLE_ID).update(eventRecordId, {
        [EVENTS_FIELD_IDS.event_date]: newDate,
      });
      console.log(`Updated Event ${eventRecordId} date to: ${newDate}`);

      // If there's a linked SchoolBooking, update it too
      let bookingUpdated = false;
      let simplybookId: string | undefined;
      if (linkedBookingIds && linkedBookingIds.length > 0) {
        const bookingRecordId = linkedBookingIds[0];
        try {
          // Fetch the SchoolBooking to get simplybook_id before updating
          const bookingRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID).select({
            filterByFormula: `RECORD_ID() = '${bookingRecordId}'`,
            maxRecords: 1,
            returnFieldsByFieldId: true,
          }).firstPage();

          if (bookingRecords.length > 0) {
            simplybookId = bookingRecords[0].fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id] as string | undefined;
          }

          await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(bookingRecordId, {
            [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: newDate,
            [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: newDate,
          });
          console.log(`Updated SchoolBooking ${bookingRecordId} start_date and end_date to: ${newDate}`);
          bookingUpdated = true;
        } catch (bookingError) {
          console.error('Warning: Could not update linked SchoolBooking:', bookingError);
          // Don't throw - the main event update succeeded
        }
      }

      return {
        success: true,
        bookingUpdated,
        simplybookId,
        message: bookingUpdated
          ? 'Event date updated and synced to booking'
          : 'Event date updated (no linked booking to sync)',
      };
    } catch (error) {
      console.error('Error updating Event date:', error);
      throw new Error(
        `Failed to update Event date: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update Event status and event type toggle fields
   * @param eventRecordId - The Airtable record ID of the event
   * @param updates - Object containing fields to update
   */
  async updateEventFields(
    eventRecordId: string,
    updates: {
      status?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Pending' | null;
      is_plus?: boolean;
      is_kita?: boolean;
      is_schulsong?: boolean;
      is_minimusikertag?: boolean;
      is_under_100?: boolean;
      estimated_children?: number;
      deal_builder_enabled?: boolean;
      deal_type?: string | null;
      deal_config?: string;
    }
  ): Promise<Event> {
    try {
      const updateFields: Record<string, any> = {};

      if (updates.status !== undefined) {
        updateFields[EVENTS_FIELD_IDS.status] = updates.status;
      }
      if (updates.is_plus !== undefined) {
        updateFields[EVENTS_FIELD_IDS.is_plus] = updates.is_plus;
      }
      if (updates.is_kita !== undefined) {
        updateFields[EVENTS_FIELD_IDS.is_kita] = updates.is_kita;
      }
      if (updates.is_schulsong !== undefined) {
        updateFields[EVENTS_FIELD_IDS.is_schulsong] = updates.is_schulsong;
      }
      if (updates.is_minimusikertag !== undefined) {
        updateFields[EVENTS_FIELD_IDS.is_minimusikertag] = updates.is_minimusikertag;
      }
      if (updates.is_under_100 !== undefined) {
        updateFields[EVENTS_FIELD_IDS.is_under_100] = updates.is_under_100;
      }
      if (updates.estimated_children !== undefined) {
        updateFields[EVENTS_FIELD_IDS.estimated_children] = updates.estimated_children;
      }
      if (updates.deal_builder_enabled !== undefined) {
        updateFields[EVENTS_FIELD_IDS.deal_builder_enabled] = updates.deal_builder_enabled;
      }
      if (updates.deal_type !== undefined) {
        updateFields[EVENTS_FIELD_IDS.deal_type] = updates.deal_type;
      }
      if (updates.deal_config !== undefined) {
        updateFields[EVENTS_FIELD_IDS.deal_config] = updates.deal_config;
      }

      if (Object.keys(updateFields).length === 0) {
        // No updates provided, just return the current event
        const event = await this.getEventById(eventRecordId);
        if (!event) {
          throw new Error('Event not found');
        }
        return event;
      }

      const updatedRecord = await this.base(EVENTS_TABLE_ID).update(eventRecordId, updateFields);
      console.log(`Updated Event ${eventRecordId} fields:`, Object.keys(updates));

      return this.transformEventRecord(updatedRecord);
    } catch (error) {
      console.error('Error updating Event fields:', error);
      throw new Error(
        `Failed to update Event fields: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Soft-delete an event by setting Event status to "Deleted" and SchoolBooking status to "deleted"
   */
  async softDeleteEvent(eventRecordId: string): Promise<{
    eventId: string;
    schoolName: string;
    bookingRecordId?: string;
  }> {
    // 1. Fetch Event record to get linked booking
    const eventRecord = await this.getEventById(eventRecordId);
    if (!eventRecord) {
      throw new Error('Event not found');
    }
    const eventId = eventRecord.event_id || '';
    const schoolName = eventRecord.school_name || '';
    const linkedBookingIds = eventRecord.simplybook_booking;

    // 2. Update Event status to "Deleted"
    await this.base(EVENTS_TABLE_ID).update(eventRecordId, {
      [EVENTS_FIELD_IDS.status]: 'Deleted',
    });

    // 3. Update linked SchoolBooking status to "deleted"
    let bookingRecordId: string | undefined;
    if (linkedBookingIds?.length) {
      bookingRecordId = linkedBookingIds[0];
      try {
        await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(bookingRecordId, {
          [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: 'deleted',
        });
      } catch (err) {
        console.error('Warning: Could not soft-delete linked SchoolBooking:', err);
      }
    }

    return { eventId, schoolName, bookingRecordId };
  }

  /**
   * Get logo URL for an Einrichtung (school)
   * Returns the logo_url field if it exists
   */
  async getEinrichtungLogoUrl(einrichtungId: string): Promise<string | null> {
    try {
      const record = await this.base(EINRICHTUNGEN_TABLE_ID).find(einrichtungId);
      const logoUrl = record.get(EINRICHTUNGEN_FIELD_IDS.logo_url) as string | undefined;
      return logoUrl || null;
    } catch (error) {
      console.error('Error fetching Einrichtung logo URL:', error);
      return null;
    }
  }

  /**
   * Get direct access to the Airtable base
   * Used by taskService for direct table operations
   */
  getBase(): Airtable.Base {
    return this.base;
  }

  /**
   * Get an Event by its Airtable record ID
   */
  async getEventById(recordId: string): Promise<Event | null> {
    try {
      const record = await this.base(EVENTS_TABLE_ID).find(recordId);
      return this.transformEventRecord(record);
    } catch (error) {
      console.error('Error fetching Event by record ID:', error);
      return null;
    }
  }

  /**
   * Get multiple Events by their Airtable record IDs
   * Used to fetch events linked to a teacher via linked_events field
   */
  async getEventsByRecordIds(recordIds: string[]): Promise<Event[]> {
    if (!recordIds || recordIds.length === 0) {
      return [];
    }

    const events: Event[] = [];
    for (const recordId of recordIds) {
      const event = await this.getEventById(recordId);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  // ======================================================================
  // ENGINEER AUTO-ASSIGNMENT METHODS
  // ======================================================================

  /**
   * Add an engineer to an event (tracks auto vs manual assignment)
   *
   * @param eventRecordId - Airtable record ID of the Event
   * @param engineerId - Personen record ID of the engineer
   * @param isAutoAssigned - Whether this is an automatic assignment (vs manual)
   */
  async addEngineerToEvent(
    eventRecordId: string,
    engineerId: string,
    isAutoAssigned: boolean = false
  ): Promise<void> {
    try {
      const record = await this.base(EVENTS_TABLE_ID).find(eventRecordId);
      const currentEngineers = record.get('assigned_engineer') as string[] || [];
      const autoAssigned = record.get('auto_assigned_engineers') as string[] || [];

      // Only add if not already assigned
      if (!currentEngineers.includes(engineerId)) {
        const updates: Record<string, string[]> = {
          [EVENTS_FIELD_IDS.assigned_engineer]: [...currentEngineers, engineerId],
        };

        // Track auto-assignment if applicable
        if (isAutoAssigned && !autoAssigned.includes(engineerId)) {
          updates[EVENTS_FIELD_IDS.auto_assigned_engineers] = [...autoAssigned, engineerId];
        }

        await this.base(EVENTS_TABLE_ID).update(eventRecordId, updates);
        console.log(`Added engineer ${engineerId} to event ${eventRecordId} (auto: ${isAutoAssigned})`);
      }
    } catch (error) {
      console.error('Error adding engineer to event:', error);
      throw new Error(`Failed to add engineer to event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove an engineer from an event (only if auto-assigned)
   *
   * This preserves manual assignments - only removes engineers that
   * were auto-assigned (tracked in auto_assigned_engineers field).
   *
   * @param eventRecordId - Airtable record ID of the Event
   * @param engineerId - Personen record ID of the engineer to remove
   */
  async removeAutoAssignedEngineer(eventRecordId: string, engineerId: string): Promise<void> {
    try {
      const record = await this.base(EVENTS_TABLE_ID).find(eventRecordId);
      const currentEngineers = record.get('assigned_engineer') as string[] || [];
      const autoAssigned = record.get('auto_assigned_engineers') as string[] || [];

      // Only remove if this engineer was auto-assigned
      if (autoAssigned.includes(engineerId)) {
        const newEngineers = currentEngineers.filter(id => id !== engineerId);
        const newAutoAssigned = autoAssigned.filter(id => id !== engineerId);

        await this.base(EVENTS_TABLE_ID).update(eventRecordId, {
          [EVENTS_FIELD_IDS.assigned_engineer]: newEngineers,
          [EVENTS_FIELD_IDS.auto_assigned_engineers]: newAutoAssigned,
        });

        console.log(`Removed auto-assigned engineer ${engineerId} from event ${eventRecordId}`);
      } else {
        console.log(`Engineer ${engineerId} not auto-assigned, preserving manual assignment`);
      }
    } catch (error) {
      console.error('Error removing auto-assigned engineer:', error);
      throw new Error(`Failed to remove engineer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure default engineers are assigned to an event
   *
   * Auto-assignment rules:
   * - Jakob (ENGINEER_JAKOB_ID): Always assigned to ALL events (handles regular/Minimusikertag tracks)
   * - Micha (ENGINEER_MICHA_ID): Only assigned when is_schulsong = true (handles schulsong tracks)
   *
   * When is_schulsong is toggled OFF, Micha is removed (only if auto-assigned, not manual).
   *
   * @param eventRecordId - Airtable record ID of the Event
   * @param isSchulsong - Whether the event has schulsong enabled
   */
  async ensureDefaultEngineers(eventRecordId: string, isSchulsong: boolean): Promise<void> {
    const JAKOB_ID = process.env.ENGINEER_JAKOB_ID;
    const MICHA_ID = process.env.ENGINEER_MICHA_ID;

    // Jakob always assigned (for regular tracks)
    if (JAKOB_ID) {
      await this.addEngineerToEvent(eventRecordId, JAKOB_ID, true);
    } else {
      console.warn('ENGINEER_JAKOB_ID not configured, skipping Jakob auto-assignment');
    }

    // Micha assigned only if schulsong
    if (MICHA_ID) {
      if (isSchulsong) {
        await this.addEngineerToEvent(eventRecordId, MICHA_ID, true);
      } else {
        await this.removeAutoAssignedEngineer(eventRecordId, MICHA_ID);
      }
    } else {
      console.warn('ENGINEER_MICHA_ID not configured, skipping Micha auto-assignment');
    }
  }

  /**
   * Get an Event by its linked SchoolBooking record ID
   * Used to get access_code for a booking
   *
   * Note: Airtable formulas can't filter by linked record IDs directly,
   * so we fetch Events with booking links and filter in JavaScript.
   */
  async getEventBySchoolBookingId(schoolBookingRecordId: string): Promise<Event | null> {
    try {
      // Fetch Events that have simplybook_booking linked
      // Note: ARRAYJOIN on linked records returns display names, not IDs,
      // so we can't use a formula filter. We must filter in JavaScript.
      const allRecords: Airtable.Record<FieldSet>[] = [];

      await this.base(EVENTS_TABLE_ID).select({
        fields: [
          EVENTS_FIELD_IDS.event_id,
          EVENTS_FIELD_IDS.school_name,
          EVENTS_FIELD_IDS.event_date,
          EVENTS_FIELD_IDS.event_type,
          EVENTS_FIELD_IDS.assigned_staff,
          EVENTS_FIELD_IDS.assigned_engineer,
          EVENTS_FIELD_IDS.created_at,
          EVENTS_FIELD_IDS.legacy_booking_id,
          EVENTS_FIELD_IDS.simplybook_booking,
          EVENTS_FIELD_IDS.access_code,
          EVENTS_FIELD_IDS.status,
          EVENTS_FIELD_IDS.is_plus,
          EVENTS_FIELD_IDS.is_kita,
          EVENTS_FIELD_IDS.is_schulsong,
          EVENTS_FIELD_IDS.is_minimusikertag,
          EVENTS_FIELD_IDS.is_under_100,
          EVENTS_FIELD_IDS.estimated_children,
          EVENTS_FIELD_IDS.audio_pipeline_stage,
          EVENTS_FIELD_IDS.admin_notes,
        ],
      }).eachPage((records, fetchNextPage) => {
        allRecords.push(...records);
        fetchNextPage();
      });

      // Find the Event that has this booking ID in its simplybook_booking array
      // Note: record.get() uses field NAMES, not field IDs
      const matchingRecord = allRecords.find(record => {
        const bookings = record.get('simplybook_booking') as string[] | undefined;
        return bookings && bookings.includes(schoolBookingRecordId);
      });

      if (!matchingRecord) {
        return null;
      }

      return this.transformEventRecord(matchingRecord);
    } catch (error) {
      console.error('Error fetching Event by SchoolBooking ID:', error);
      return null;
    }
  }

  /**
   * Download the entire Events table once and return a Map<bookingRecordId, Event>.
   * Replaces N individual getEventBySchoolBookingId calls with a single table scan.
   */
  async getAllEventsIndexedByBookingId(): Promise<Map<string, Event>> {
    const map = new Map<string, Event>();

    try {
      const allRecords: Airtable.Record<FieldSet>[] = [];

      await this.base(EVENTS_TABLE_ID).select({
        fields: [
          EVENTS_FIELD_IDS.event_id,
          EVENTS_FIELD_IDS.school_name,
          EVENTS_FIELD_IDS.event_date,
          EVENTS_FIELD_IDS.event_type,
          EVENTS_FIELD_IDS.assigned_staff,
          EVENTS_FIELD_IDS.assigned_engineer,
          EVENTS_FIELD_IDS.created_at,
          EVENTS_FIELD_IDS.legacy_booking_id,
          EVENTS_FIELD_IDS.simplybook_booking,
          EVENTS_FIELD_IDS.access_code,
          EVENTS_FIELD_IDS.status,
          EVENTS_FIELD_IDS.is_plus,
          EVENTS_FIELD_IDS.is_kita,
          EVENTS_FIELD_IDS.is_schulsong,
          EVENTS_FIELD_IDS.is_minimusikertag,
          EVENTS_FIELD_IDS.is_under_100,
          EVENTS_FIELD_IDS.estimated_children,
          EVENTS_FIELD_IDS.audio_pipeline_stage,
          EVENTS_FIELD_IDS.admin_notes,
        ],
      }).eachPage((records, fetchNextPage) => {
        allRecords.push(...records);
        fetchNextPage();
      });

      for (const record of allRecords) {
        const event = this.transformEventRecord(record);
        const bookingIds = record.get('simplybook_booking') as string[] | undefined;
        if (bookingIds) {
          for (const bookingId of bookingIds) {
            map.set(bookingId, event);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching all Events indexed by booking ID:', error);
    }

    return map;
  }

  /**
   * Get registration counts for multiple events in a single query
   * @param eventRecordIds Array of Event record IDs (not event_id strings)
   * @returns Map of event record ID to registration count
   */
  async getRegistrationCountsByEventIds(eventRecordIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    if (eventRecordIds.length === 0) return counts;

    // Initialize all event IDs with 0
    eventRecordIds.forEach(id => counts.set(id, 0));

    try {
      // Query all registrations and filter in JS (Airtable formula limitations with linked records)
      const records = await this.base(REGISTRATIONS_TABLE_ID)
        .select({
          fields: [REGISTRATIONS_FIELD_IDS.event_id],
          returnFieldsByFieldId: true,
        })
        .all();

      // Count registrations per event
      for (const record of records) {
        const eventIdArray = record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[] || [];
        for (const eventId of eventIdArray) {
          if (counts.has(eventId)) {
            counts.set(eventId, (counts.get(eventId) || 0) + 1);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching registration counts:', error);
    }

    return counts;
  }

  /**
   * Get class counts for multiple events in a single query
   * @param eventRecordIds Array of Event record IDs
   * @returns Map of event record ID to class count
   */
  async getClassCountsByEventIds(eventRecordIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    if (eventRecordIds.length === 0) return counts;

    // Initialize all event IDs with 0
    eventRecordIds.forEach(id => counts.set(id, 0));

    try {
      const records = await this.base(CLASSES_TABLE_ID)
        .select({
          fields: [CLASSES_FIELD_IDS.event_id],
          returnFieldsByFieldId: true,
        })
        .all();

      for (const record of records) {
        const eventIdArray = record.fields[CLASSES_FIELD_IDS.event_id] as string[] || [];
        for (const eventId of eventIdArray) {
          if (counts.has(eventId)) {
            counts.set(eventId, (counts.get(eventId) || 0) + 1);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching class counts:', error);
    }

    return counts;
  }

  /**
   * Get song counts for multiple events in a single query
   * @param eventRecordIds Array of Event record IDs
   * @returns Map of event record ID to song count
   */
  async getSongCountsByEventIds(eventRecordIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    if (eventRecordIds.length === 0) return counts;

    // Initialize all event IDs with 0
    eventRecordIds.forEach(id => counts.set(id, 0));

    try {
      const records = await this.base(SONGS_TABLE_ID)
        .select({
          fields: [SONGS_LINKED_FIELD_IDS.event_link],
          returnFieldsByFieldId: true,
        })
        .all();

      for (const record of records) {
        const eventIdArray = record.fields[SONGS_LINKED_FIELD_IDS.event_link] as string[] || [];
        for (const eventId of eventIdArray) {
          if (counts.has(eventId)) {
            counts.set(eventId, (counts.get(eventId) || 0) + 1);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching song counts:', error);
    }

    return counts;
  }

  /**
   * Transform an Airtable Event record to our Event type
   * Note: record.get() uses field NAMES, not field IDs
   */
  private transformEventRecord(record: Airtable.Record<FieldSet>): Event {
    return {
      id: record.id,
      event_id: record.get('event_id') as string || '',
      school_name: record.get('school_name') as string || '',
      event_date: record.get('event_date') as string || '',
      event_type: (record.get('event_type') as Event['event_type']) || 'concert',
      assigned_staff: record.get('assigned_staff') as string[] | undefined,
      assigned_engineer: record.get('assigned_engineer') as string[] | undefined,
      auto_assigned_engineers: record.get('auto_assigned_engineers') as string[] | undefined,
      created_at: record.get('created_at') as string || '',
      legacy_booking_id: record.get('legacy_booking_id') as string | undefined,
      simplybook_booking: record.get('simplybook_booking') as string[] | undefined,
      access_code: record.get('access_code') as number | undefined,
      // Status & Event Type fields for admin booking view
      status: record.get('status') as Event['status'] | undefined,
      is_plus: record.get('is_plus') as boolean | undefined,
      is_kita: record.get('is_kita') as boolean | undefined,
      is_schulsong: record.get('is_schulsong') as boolean | undefined,
      is_minimusikertag: record.get('is_minimusikertag') as boolean | undefined,
      // Audio approval fields
      all_tracks_approved: record.get('all_tracks_approved') as boolean | undefined,
      admin_approval_status: record.get('admin_approval_status') as Event['admin_approval_status'] | undefined,
      // Audio pipeline
      audio_pipeline_stage: record.get('audio_pipeline_stage') as Event['audio_pipeline_stage'] | undefined,
      // Admin notes
      admin_notes: record.get('admin_notes') as string | undefined,
      // Schulsong release date
      schulsong_released_at: record.get('schulsong_released_at') as string | undefined,
      // Per-event timeline threshold overrides
      timeline_overrides: record.get('timeline_overrides') as string | undefined,
      // Under-100-kids flag and estimated children
      is_under_100: record.get('is_under_100') as boolean | undefined,
      estimated_children: record.get('estimated_children') as number | undefined,
      // Deal Builder fields
      deal_builder_enabled: record.get('deal_builder_enabled') as boolean | undefined,
      deal_type: record.get('deal_type') as Event['deal_type'] | undefined,
      deal_config: (() => {
        const raw = record.get('deal_config') as string | undefined;
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch { return undefined; }
      })(),
    };
  }

  // ======================================================================
  // EVENT MANUAL COSTS METHODS
  // ======================================================================

  /**
   * Get all manual costs for an event
   */
  async getManualCostsForEvent(eventId: string): Promise<ManualCost[]> {
    try {
      const records = await this.base(EVENT_MANUAL_COSTS_TABLE_ID)
        .select({
          filterByFormula: `SEARCH('${eventId}', ARRAYJOIN({${EVENT_MANUAL_COSTS_FIELD_IDS.event_id}}))`,
        })
        .all();

      return records.map((record) => this.transformManualCostRecord(record));
    } catch (error) {
      console.error('Error fetching manual costs:', error);
      return [];
    }
  }

  /**
   * Look up Events table record ID from booking_id
   * Checks both event_id and legacy_booking_id fields
   */
  async getEventsRecordIdByBookingId(bookingId: string): Promise<string | null> {
    try {
      const records = await this.base(EVENTS_TABLE_ID)
        .select({
          filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = '${bookingId}', {${EVENTS_FIELD_IDS.legacy_booking_id}} = '${bookingId}')`,
          maxRecords: 1,
        })
        .firstPage();
      return records[0]?.id || null;
    } catch (error) {
      console.error('Error looking up Events record:', error);
      return null;
    }
  }

  /**
   * Get the audio publish status for an event
   * Returns true if audio_published is checked, false otherwise
   */
  async getEventPublishStatus(eventId: string): Promise<boolean> {
    try {
      const records = await this.base(EVENTS_TABLE_ID)
        .select({
          filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = '${eventId}', {${EVENTS_FIELD_IDS.legacy_booking_id}} = '${eventId}')`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length === 0) {
        return false;
      }

      const eventFields = records[0].fields as Record<string, any>;
      return eventFields[EVENTS_FIELD_IDS.audio_published] === true;
    } catch (error) {
      console.error('Error getting event publish status:', error);
      return false;
    }
  }

  /**
   * Set the audio publish status for an event
   * When published is true, audio preview becomes visible to parents
   */
  async setEventPublishStatus(eventId: string, published: boolean): Promise<void> {
    try {
      const recordId = await this.getEventsRecordIdByBookingId(eventId);
      if (!recordId) {
        throw new Error(`Event not found: ${eventId}`);
      }

      await this.base(EVENTS_TABLE_ID).update(recordId, {
        [EVENTS_FIELD_IDS.audio_published]: published,
      } as Partial<FieldSet>);
    } catch (error) {
      console.error('Error setting event publish status:', error);
      throw new Error(`Failed to update publish status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new manual cost entry
   */
  async createManualCost(
    eventId: string,
    costName: string,
    amount: number
  ): Promise<ManualCost> {
    // Resolve booking_id to Events record ID for linked record field
    const eventsRecordId = await this.getEventsRecordIdByBookingId(eventId);
    if (!eventsRecordId) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const record = await this.base(EVENT_MANUAL_COSTS_TABLE_ID).create({
      [EVENT_MANUAL_COSTS_FIELD_IDS.event_id]: [eventsRecordId],
      [EVENT_MANUAL_COSTS_FIELD_IDS.cost_name]: costName,
      [EVENT_MANUAL_COSTS_FIELD_IDS.amount]: amount,
    } as Partial<FieldSet>);

    return this.transformManualCostRecord(record);
  }

  /**
   * Update an existing manual cost entry
   */
  async updateManualCost(
    costId: string,
    costName: string,
    amount: number
  ): Promise<ManualCost> {
    const record = await this.base(EVENT_MANUAL_COSTS_TABLE_ID).update(costId, {
      [EVENT_MANUAL_COSTS_FIELD_IDS.cost_name]: costName,
      [EVENT_MANUAL_COSTS_FIELD_IDS.amount]: amount,
    } as Partial<FieldSet>);

    return this.transformManualCostRecord(record);
  }

  /**
   * Delete a manual cost entry
   */
  async deleteManualCost(costId: string): Promise<void> {
    await this.base(EVENT_MANUAL_COSTS_TABLE_ID).destroy(costId);
  }

  /**
   * Transform an Airtable Manual Cost record to our ManualCost type
   */
  private transformManualCostRecord(record: Airtable.Record<FieldSet>): ManualCost {
    const eventIds = record.get(EVENT_MANUAL_COSTS_FIELD_IDS.event_id) as string[] | undefined;
    return {
      id: record.id,
      eventId: eventIds?.[0] || '',
      costName: (record.get(EVENT_MANUAL_COSTS_FIELD_IDS.cost_name) as string) || '',
      amount: (record.get(EVENT_MANUAL_COSTS_FIELD_IDS.amount) as number) || 0,
      createdAt: (record.get(EVENT_MANUAL_COSTS_FIELD_IDS.created_at) as string) || '',
      updatedAt: (record.get(EVENT_MANUAL_COSTS_FIELD_IDS.updated_at) as string) || '',
    };
  }

  // ==========================================================================
  // TEACHER RESOURCES METHODS
  // ==========================================================================

  /**
   * Fetch all teacher resources from Airtable
   * Returns resources with Dropbox URLs for PDF downloads
   */
  async getTeacherResources(): Promise<TeacherResource[]> {
    try {
      const records = await this.base(TEACHER_RESOURCES_TABLE_ID)
        .select({
          fields: [
            TEACHER_RESOURCES_FIELD_NAMES.resource_key,
            TEACHER_RESOURCES_FIELD_NAMES.pdf_url,
            TEACHER_RESOURCES_FIELD_NAMES.display_title,
          ],
        })
        .all();

      return records.map((record) => ({
        id: record.id,
        resourceKey: (record.get(TEACHER_RESOURCES_FIELD_NAMES.resource_key) as string) || '',
        pdfUrl: (record.get(TEACHER_RESOURCES_FIELD_NAMES.pdf_url) as string) || '',
        displayTitle: (record.get(TEACHER_RESOURCES_FIELD_NAMES.display_title) as string) || '',
      }));
    } catch (error) {
      console.error('Error fetching teacher resources:', error);
      return [];
    }
  }

  /**
   * Fetch a single teacher resource by key
   */
  async getTeacherResourceByKey(resourceKey: string): Promise<TeacherResource | null> {
    try {
      const records = await this.base(TEACHER_RESOURCES_TABLE_ID)
        .select({
          filterByFormula: `{${TEACHER_RESOURCES_FIELD_NAMES.resource_key}} = '${resourceKey}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        resourceKey: (record.get(TEACHER_RESOURCES_FIELD_NAMES.resource_key) as string) || '',
        pdfUrl: (record.get(TEACHER_RESOURCES_FIELD_NAMES.pdf_url) as string) || '',
        displayTitle: (record.get(TEACHER_RESOURCES_FIELD_NAMES.display_title) as string) || '',
      };
    } catch (error) {
      console.error('Error fetching teacher resource by key:', error);
      return null;
    }
  }

  // ==========================================================================
  // EMAIL AUTOMATION HELPER METHODS
  // ==========================================================================

  /**
   * Get all events from the normalized Events table
   */
  async getAllEvents(): Promise<Event[]> {
    this.ensureNormalizedTablesInitialized();

    if (!this.eventsTable) {
      console.warn('Events table not available - USE_NORMALIZED_TABLES may not be enabled');
      return [];
    }

    try {
      const records = await this.eventsTable.select({
        returnFieldsByFieldId: true,
      }).all();

      return records.map((record) => ({
        id: record.id,
        event_id: (record.fields[EVENTS_FIELD_IDS.event_id] as string) || '',
        school_name: (record.fields[EVENTS_FIELD_IDS.school_name] as string) || '',
        event_date: (record.fields[EVENTS_FIELD_IDS.event_date] as string) || '',
        event_type: record.fields[EVENTS_FIELD_IDS.event_type] as string | undefined,
        assigned_staff: record.fields[EVENTS_FIELD_IDS.assigned_staff] as string[] | undefined,
        assigned_engineer: record.fields[EVENTS_FIELD_IDS.assigned_engineer] as string[] | undefined,
        created_at: (record.fields[EVENTS_FIELD_IDS.created_at] as string) || '',
        legacy_booking_id: record.fields[EVENTS_FIELD_IDS.legacy_booking_id] as string | undefined,
        simplybook_booking: record.fields[EVENTS_FIELD_IDS.simplybook_booking] as string[] | undefined,
        access_code: record.fields[EVENTS_FIELD_IDS.access_code] as number | undefined,
        is_kita: record.fields[EVENTS_FIELD_IDS.is_kita] as boolean | undefined,
        is_plus: record.fields[EVENTS_FIELD_IDS.is_plus] as boolean | undefined,
        is_schulsong: record.fields[EVENTS_FIELD_IDS.is_schulsong] as boolean | undefined,
        is_minimusikertag: record.fields[EVENTS_FIELD_IDS.is_minimusikertag] as boolean | undefined,
        status: record.fields[EVENTS_FIELD_IDS.status] as Event['status'] | undefined,
      }));
    } catch (error) {
      console.error('Error fetching all events:', error);
      return [];
    }
  }

  /**
   * Get event by Airtable record ID (public wrapper for queryEventById)
   */
  async getEventByRecordId(recordId: string): Promise<Event | null> {
    return this.queryEventById(recordId);
  }

  /**
   * Get classes linked to an event by event record ID
   */
  async getClassesByEventId(eventRecordId: string): Promise<Class[]> {
    this.ensureNormalizedTablesInitialized();

    if (!this.classesTable) return [];

    try {
      // Fetch all classes and filter by event_id (linked record)
      const records = await this.classesTable.select({
        returnFieldsByFieldId: true,
      }).all();

      const filteredRecords = records.filter((record) => {
        const eventIds = record.fields[CLASSES_FIELD_IDS.event_id] as string[] | undefined;
        return eventIds && eventIds.includes(eventRecordId);
      });

      return filteredRecords.map((record) => ({
        id: record.id,
        class_id: (record.fields[CLASSES_FIELD_IDS.class_id] as string) || '',
        event_id: record.fields[CLASSES_FIELD_IDS.event_id] as string[],
        class_name: (record.fields[CLASSES_FIELD_IDS.class_name] as string) || '',
        main_teacher: record.fields[CLASSES_FIELD_IDS.main_teacher] as string | undefined,
        other_teachers: record.fields[CLASSES_FIELD_IDS.other_teachers] as string | undefined,
        total_children: (record.fields[CLASSES_FIELD_IDS.total_children] as number) || 0,
        created_at: (record.fields[CLASSES_FIELD_IDS.created_at] as string) || '',
        legacy_booking_id: record.fields[CLASSES_FIELD_IDS.legacy_booking_id] as string | undefined,
      }));
    } catch (error) {
      console.error('Error fetching classes by event ID:', error);
      return [];
    }
  }

  /**
   * Get class by Airtable record ID (public wrapper for queryClassById)
   */
  async getClassByRecordId(recordId: string): Promise<Class | null> {
    return this.queryClassById(recordId);
  }

  /**
   * Update a class's main_teacher field
   * Used when syncing teacher data from booking contact person
   */
  async updateClassTeacher(classRecordId: string, teacherName: string): Promise<void> {
    try {
      await this.base(CLASSES_TABLE_ID).update(classRecordId, {
        [CLASSES_FIELD_IDS.main_teacher]: teacherName,
      });
    } catch (error) {
      console.error('Error updating class teacher:', error);
      throw new Error(`Failed to update class teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get registrations linked to an event by event record ID
   */
  async getRegistrationsByEventId(eventRecordId: string): Promise<Registration[]> {
    this.ensureNormalizedTablesInitialized();

    if (!this.registrationsTable) return [];

    try {
      const records = await this.registrationsTable.select({
        returnFieldsByFieldId: true,
      }).all();

      const filteredRecords = records.filter((record) => {
        const eventIds = record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[] | undefined;
        return eventIds && eventIds.includes(eventRecordId);
      });

      return filteredRecords.map((record) => ({
        id: record.id,
        Id: (record.fields[REGISTRATIONS_FIELD_IDS.Id] as number) || 0,
        event_id: record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[],
        parent_id: record.fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[],
        class_id: record.fields[REGISTRATIONS_FIELD_IDS.class_id] as string[],
        registered_child: (record.fields[REGISTRATIONS_FIELD_IDS.registered_child] as string) || '',
        child_id: (record.fields[REGISTRATIONS_FIELD_IDS.child_id] as string) || '',
        registered_complete: (record.fields[REGISTRATIONS_FIELD_IDS.registered_complete] as boolean) || false,
        order_number: record.fields[REGISTRATIONS_FIELD_IDS.order_number] as string | undefined,
        legacy_record: record.fields[REGISTRATIONS_FIELD_IDS.legacy_record] as string | undefined,
        registration_date: record.fields[REGISTRATIONS_FIELD_IDS.registration_date] as string | undefined,
        registration_status: record.fields[REGISTRATIONS_FIELD_IDS.registration_status] as string | undefined,
      }));
    } catch (error) {
      console.error('Error fetching registrations by event ID:', error);
      return [];
    }
  }

  /**
   * Get parent by Airtable record ID
   */
  async getParentByRecordId(recordId: string): Promise<Parent | null> {
    this.ensureNormalizedTablesInitialized();

    if (!this.parentsTable) return null;

    try {
      const records = await this.parentsTable.select({
        filterByFormula: `RECORD_ID() = '${recordId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        parents_id: (record.fields[PARENTS_FIELD_IDS.parents_id] as string) || '',
        parent_id: (record.fields[PARENTS_FIELD_IDS.parent_id] as string) || '',
        parent_email: (record.fields[PARENTS_FIELD_IDS.parent_email] as string) || '',
        parent_first_name: (record.fields[PARENTS_FIELD_IDS.parent_first_name] as string) || '',
        parent_telephone: (record.fields[PARENTS_FIELD_IDS.parent_telephone] as string) || '',
        email_campaigns: record.fields[PARENTS_FIELD_IDS.email_campaigns] as 'yes' | 'no' | undefined,
        created_at: (record.fields[PARENTS_FIELD_IDS.created_at] as string) || '',
      };
    } catch (error) {
      console.error('Error fetching parent by record ID:', error);
      return null;
    }
  }

  /**
   * Get person (staff) by Airtable record ID from Personen table
   */
  async getPersonById(personId: string): Promise<{ id: string; staff_name: string; email?: string } | null> {
    try {
      const records = await this.base(PERSONEN_TABLE_ID)
        .select({
          filterByFormula: `RECORD_ID() = '${personId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        staff_name: (record.fields[PERSONEN_FIELD_IDS.staff_name] as string) || '',
        email: record.fields[PERSONEN_FIELD_IDS.email] as string | undefined,
      };
    } catch (error) {
      console.error('Error fetching person by ID:', error);
      return null;
    }
  }

  /**
   * Get all staff members from Personen table for dropdown lists
   * Returns id and name for each staff member
   */
  async getAllStaffMembers(): Promise<Array<{ id: string; name: string }>> {
    try {
      const records = await this.base(PERSONEN_TABLE_ID)
        .select({
          fields: [PERSONEN_FIELD_IDS.staff_name],
          returnFieldsByFieldId: true,
        })
        .all();

      return records
        .map(record => ({
          id: record.id,
          name: (record.fields[PERSONEN_FIELD_IDS.staff_name] as string) || '',
        }))
        .filter(staff => staff.name) // Filter out records without names
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    } catch (error) {
      console.error('Error fetching all staff members:', error);
      return [];
    }
  }

  /**
   * Get all regions from Teams/Regionen table for dropdown lists
   * Returns id and name for each region
   */
  async getAllRegions(): Promise<Array<{ id: string; name: string }>> {
    try {
      const records = await this.base(TEAMS_REGIONEN_TABLE_ID)
        .select({
          fields: [TEAMS_REGIONEN_FIELD_IDS.name],
          returnFieldsByFieldId: true,
        })
        .all();

      return records
        .map(record => ({
          id: record.id,
          name: (record.fields[TEAMS_REGIONEN_FIELD_IDS.name] as string) || '',
        }))
        .filter(region => region.name) // Filter out records without names
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    } catch (error) {
      console.error('Error fetching all regions:', error);
      return [];
    }
  }

  // ==========================================================================
  // EMAIL AUTOMATION METHODS
  // ==========================================================================

  /**
   * Transform an Airtable email template record to our EmailTemplate type
   */
  private transformEmailTemplateRecord(record: Airtable.Record<FieldSet>): EmailTemplate {
    // Multi-select returns string[]. Handle legacy single-select values.
    const rawAudience = record.get(EMAIL_TEMPLATES_FIELD_IDS.audience);
    let audience: Audience;
    if (Array.isArray(rawAudience)) {
      audience = rawAudience.filter(v => ['teacher', 'parent', 'non-buyers'].includes(v)) as Audience;
      if (audience.length === 0) audience = ['teacher', 'parent'];
    } else if (rawAudience === 'both') {
      audience = ['teacher', 'parent'];
    } else if (rawAudience === 'teacher' || rawAudience === 'parent') {
      audience = [rawAudience];
    } else {
      audience = ['teacher', 'parent'];
    }

    return {
      id: record.id,
      name: (record.get(EMAIL_TEMPLATES_FIELD_IDS.name) as string) || '',
      audience,
      triggerDays: (record.get(EMAIL_TEMPLATES_FIELD_IDS.trigger_days) as number) || 0,
      triggerHour: (record.get(EMAIL_TEMPLATES_FIELD_IDS.trigger_hour) as number) ?? 7,
      subject: (record.get(EMAIL_TEMPLATES_FIELD_IDS.email_subject) as string) || '',
      bodyHtml: (record.get(EMAIL_TEMPLATES_FIELD_IDS.email_body_html) as string) || '',
      active: (record.get(EMAIL_TEMPLATES_FIELD_IDS.active) as boolean) || false,
      is_minimusikertag: (record.get(EMAIL_TEMPLATES_FIELD_IDS.is_minimusikertag) as boolean) || false,
      is_kita: (record.get(EMAIL_TEMPLATES_FIELD_IDS.is_kita) as boolean) || false,
      is_plus: (record.get(EMAIL_TEMPLATES_FIELD_IDS.is_plus) as boolean) || false,
      is_schulsong: (record.get(EMAIL_TEMPLATES_FIELD_IDS.is_schulsong) as boolean) || false,
      only_under_100: (record.get(EMAIL_TEMPLATES_FIELD_IDS.only_under_100) as boolean) || false,
      templateType: (record.get(EMAIL_TEMPLATES_FIELD_IDS.template_type) as 'timeline' | 'trigger') || undefined,
      triggerSlug: (record.get(EMAIL_TEMPLATES_FIELD_IDS.trigger_slug) as string) || undefined,
      triggerDescription: (record.get(EMAIL_TEMPLATES_FIELD_IDS.trigger_description) as string) || undefined,
    };
  }

  /**
   * Transform an Airtable email log record to our EmailLog type
   */
  private transformEmailLogRecord(record: Airtable.Record<FieldSet>): EmailLog {
    // event_id is a linked record, extract the first record ID or use as string
    const eventIdField = record.get(EMAIL_LOGS_FIELD_IDS.event_id);
    const eventId = Array.isArray(eventIdField) ? eventIdField[0] : (eventIdField as string) || '';

    return {
      id: record.id,
      templateName: (record.get(EMAIL_LOGS_FIELD_IDS.template_name) as string) || '',
      eventId,
      recipientEmail: (record.get(EMAIL_LOGS_FIELD_IDS.recipient_email) as string) || '',
      recipientType: (record.get(EMAIL_LOGS_FIELD_IDS.recipient_type) as 'teacher' | 'parent') || 'parent',
      sentAt: (record.get(EMAIL_LOGS_FIELD_IDS.sent_at) as string) || '',
      status: (record.get(EMAIL_LOGS_FIELD_IDS.status) as 'sent' | 'failed' | 'skipped') || 'failed',
      errorMessage: (record.get(EMAIL_LOGS_FIELD_IDS.error_message) as string) || undefined,
      resendMessageId: (record.get(EMAIL_LOGS_FIELD_IDS.resend_message_id) as string) || undefined,
    };
  }

  /**
   * Get all active email templates
   */
  async getActiveEmailTemplates(): Promise<EmailTemplate[]> {
    if (!this.ensureEmailTablesInitialized()) return [];

    try {
      const records = await this.emailTemplatesTable!.select({
        filterByFormula: `{${EMAIL_TEMPLATES_FIELD_IDS.active}} = TRUE()`,
        returnFieldsByFieldId: true,
      }).all();

      return records.map((record) => this.transformEmailTemplateRecord(record));
    } catch (error) {
      console.error('Error fetching active email templates:', error);
      return [];
    }
  }

  /**
   * Get all email templates (including inactive)
   */
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    if (!this.ensureEmailTablesInitialized()) return [];

    try {
      const records = await this.emailTemplatesTable!.select({
        returnFieldsByFieldId: true,
      }).all();
      return records.map((record) => this.transformEmailTemplateRecord(record));
    } catch (error) {
      console.error('Error fetching all email templates:', error);
      return [];
    }
  }

  /**
   * Get a single email template by Airtable record ID
   */
  async getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
    if (!this.ensureEmailTablesInitialized()) return null;

    try {
      const records = await this.emailTemplatesTable!.select({
        filterByFormula: `RECORD_ID() = '${id}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (records.length === 0) return null;
      return this.transformEmailTemplateRecord(records[0]);
    } catch (error) {
      console.error('Error fetching email template by ID:', error);
      return null;
    }
  }

  /**
   * Create a new email template
   */
  async createEmailTemplate(data: CreateEmailTemplateInput): Promise<EmailTemplate | null> {
    if (!this.ensureEmailTablesInitialized()) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {
        [EMAIL_TEMPLATES_FIELD_IDS.name]: data.name,
        [EMAIL_TEMPLATES_FIELD_IDS.audience]: data.audience,
        [EMAIL_TEMPLATES_FIELD_IDS.trigger_days]: data.triggerDays,
        [EMAIL_TEMPLATES_FIELD_IDS.trigger_hour]: data.triggerHour ?? 7,
        [EMAIL_TEMPLATES_FIELD_IDS.email_subject]: data.subject,
        [EMAIL_TEMPLATES_FIELD_IDS.email_body_html]: data.bodyHtml,
        [EMAIL_TEMPLATES_FIELD_IDS.active]: data.active ?? true,
        [EMAIL_TEMPLATES_FIELD_IDS.is_minimusikertag]: data.is_minimusikertag ?? false,
        [EMAIL_TEMPLATES_FIELD_IDS.is_kita]: data.is_kita ?? false,
        [EMAIL_TEMPLATES_FIELD_IDS.is_plus]: data.is_plus ?? false,
        [EMAIL_TEMPLATES_FIELD_IDS.is_schulsong]: data.is_schulsong ?? false,
        [EMAIL_TEMPLATES_FIELD_IDS.only_under_100]: data.only_under_100 ?? false,
      };
      if (data.templateType) fields[EMAIL_TEMPLATES_FIELD_IDS.template_type] = data.templateType;
      if (data.triggerSlug) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_slug] = data.triggerSlug;
      if (data.triggerDescription) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_description] = data.triggerDescription;

      const record = await this.emailTemplatesTable!.create(fields);

      return this.transformEmailTemplateRecord(record);
    } catch (error) {
      console.error('Error creating email template:', error);
      return null;
    }
  }

  /**
   * Update an existing email template
   */
  async updateEmailTemplate(id: string, data: UpdateEmailTemplateInput): Promise<EmailTemplate | null> {
    if (!this.ensureEmailTablesInitialized()) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: any = {};

      if (data.name !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.name] = data.name;
      if (data.audience !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.audience] = data.audience;
      if (data.triggerDays !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_days] = data.triggerDays;
      if (data.triggerHour !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_hour] = data.triggerHour;
      if (data.subject !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.email_subject] = data.subject;
      if (data.bodyHtml !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.email_body_html] = data.bodyHtml;
      if (data.active !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.active] = data.active;
      if (data.is_minimusikertag !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.is_minimusikertag] = data.is_minimusikertag;
      if (data.is_kita !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.is_kita] = data.is_kita;
      if (data.is_plus !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.is_plus] = data.is_plus;
      if (data.is_schulsong !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.is_schulsong] = data.is_schulsong;
      if (data.only_under_100 !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.only_under_100] = data.only_under_100;
      if (data.templateType !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.template_type] = data.templateType;
      if (data.triggerSlug !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_slug] = data.triggerSlug;
      if (data.triggerDescription !== undefined) fields[EMAIL_TEMPLATES_FIELD_IDS.trigger_description] = data.triggerDescription;

      const record = await this.emailTemplatesTable!.update(id, fields);
      return this.transformEmailTemplateRecord(record);
    } catch (error) {
      console.error('Error updating email template:', error);
      return null;
    }
  }

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(id: string): Promise<boolean> {
    if (!this.ensureEmailTablesInitialized()) return false;

    try {
      await this.emailTemplatesTable!.destroy(id);
      return true;
    } catch (error) {
      console.error('Error deleting email template:', error);
      return false;
    }
  }

  /**
   * Create an email log entry
   */
  async createEmailLog(data: CreateEmailLogInput): Promise<EmailLog | null> {
    if (!this.ensureEmailTablesInitialized()) return null;

    try {
      const record = await this.emailLogsTable!.create({
        [EMAIL_LOGS_FIELD_IDS.template_name]: data.templateName,
        [EMAIL_LOGS_FIELD_IDS.event_id]: data.eventId,
        [EMAIL_LOGS_FIELD_IDS.recipient_email]: data.recipientEmail,
        [EMAIL_LOGS_FIELD_IDS.recipient_type]: data.recipientType,
        [EMAIL_LOGS_FIELD_IDS.sent_at]: new Date().toISOString(),
        [EMAIL_LOGS_FIELD_IDS.status]: data.status,
        [EMAIL_LOGS_FIELD_IDS.error_message]: data.errorMessage || '',
        [EMAIL_LOGS_FIELD_IDS.resend_message_id]: data.resendMessageId || '',
      });

      return this.transformEmailLogRecord(record);
    } catch (error) {
      console.error('Error creating email log:', error);
      return null;
    }
  }

  /**
   * Get recent email logs with optional pagination
   */
  async getRecentEmailLogs(limit: number = 100): Promise<EmailLog[]> {
    if (!this.ensureEmailTablesInitialized()) return [];

    try {
      const records = await this.emailLogsTable!.select({
        maxRecords: limit,
        sort: [{ field: EMAIL_LOGS_FIELD_IDS.sent_at, direction: 'desc' }],
        returnFieldsByFieldId: true,
      }).all();

      return records.map((record) => this.transformEmailLogRecord(record));
    } catch (error) {
      console.error('Error fetching recent email logs:', error);
      return [];
    }
  }

  /**
   * Check if an email has already been sent for a specific template/event/recipient combination
   * Used to prevent duplicate emails
   */
  async hasEmailBeenSent(templateName: string, eventId: string, recipientEmail: string): Promise<boolean> {
    if (!this.ensureEmailTablesInitialized()) return false;

    try {
      const formula = `AND(
        {${EMAIL_LOGS_FIELD_IDS.template_name}} = '${templateName.replace(/'/g, "\\'")}',
        {${EMAIL_LOGS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}',
        {${EMAIL_LOGS_FIELD_IDS.recipient_email}} = '${recipientEmail.replace(/'/g, "\\'")}',
        {${EMAIL_LOGS_FIELD_IDS.status}} = 'sent'
      )`;

      const records = await this.emailLogsTable!.select({
        filterByFormula: formula,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      return records.length > 0;
    } catch (error) {
      console.error('Error checking if email has been sent:', error);
      return true; // Fail closed: skip email rather than risk duplicate sends during Airtable outages
    }
  }

  /**
   * Get email logs for a specific event
   */
  async getEmailLogsForEvent(eventId: string): Promise<EmailLog[]> {
    if (!this.ensureEmailTablesInitialized()) return [];

    try {
      const records = await this.emailLogsTable!.select({
        filterByFormula: `{${EMAIL_LOGS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
        sort: [{ field: EMAIL_LOGS_FIELD_IDS.sent_at, direction: 'desc' }],
        returnFieldsByFieldId: true,
      }).all();

      return records.map((record) => this.transformEmailLogRecord(record));
    } catch (error) {
      console.error('Error fetching email logs for event:', error);
      return [];
    }
  }

  // ==================== Parent Registration Management ====================

  /**
   * Get parent with all their children across all events
   * Returns parent data and existing children for pre-filling registration forms
   */
  async getParentWithChildren(email: string): Promise<{
    parent: Parent | null;
    children: Array<{
      registrationId: string;
      childName: string;
      eventId: string;
      eventName?: string;
      classId: string;
      className?: string;
      eventDate?: string;
    }>;
  }> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Query parent_journey_table
      const records = await this.getParentRecordsByEmail(email);
      if (!records || records.length === 0) {
        return { parent: null, children: [] };
      }

      const firstRecord = records[0];
      return {
        parent: {
          id: firstRecord.id,
          parents_id: '',
          parent_id: firstRecord.parent_id,
          parent_email: firstRecord.parent_email,
          parent_first_name: firstRecord.parent_first_name,
          parent_telephone: firstRecord.parent_telephone || '',
          email_campaigns: firstRecord.email_campaigns as 'yes' | 'no',
          created_at: '',
        },
        children: records.map(r => ({
          registrationId: r.id,
          childName: r.registered_child,
          eventId: r.booking_id,
          eventName: r.school_name,
          classId: r.class_id || '',
          className: r.class,
          eventDate: r.booking_date,
        })),
      };
    }

    // NEW: Query normalized tables
    const parent = await this.queryParentByEmail(email);
    if (!parent) {
      return { parent: null, children: [] };
    }

    const registrations = await this.queryRegistrationsByParent(parent.id);

    // Fetch event and class details for each registration
    const childrenWithDetails = await Promise.all(
      registrations.map(async (reg) => {
        let eventName: string | undefined;
        let className: string | undefined;
        let eventDate: string | undefined;

        // Fetch event details
        if (reg.event_id?.[0]) {
          const event = await this.queryEventById(reg.event_id[0]);
          if (event) {
            eventName = event.school_name;
            eventDate = event.event_date;
          }
        }

        // Fetch class details
        if (reg.class_id?.[0]) {
          const classRecord = await this.queryClassById(reg.class_id[0]);
          if (classRecord) {
            className = classRecord.class_name;
          }
        }

        return {
          registrationId: reg.id,
          childName: reg.registered_child,
          eventId: reg.event_id?.[0] || '',
          eventName,
          classId: reg.class_id?.[0] || '',
          className,
          eventDate,
        };
      })
    );

    return { parent, children: childrenWithDetails };
  }

  /**
   * Get children registered for a specific event by parent email
   */
  async getChildrenByParentEmailForEvent(
    email: string,
    eventId: string
  ): Promise<Array<{
    registrationId: string;
    childName: string;
    classId: string;
    className?: string;
  }>> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Query parent_journey_table
      const records = await this.query({
        filterByFormula: `AND(
          LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email.replace(/'/g, "\\'")}'),
          {${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId}'
        )`,
      });

      return records.map(r => ({
        registrationId: r.id,
        childName: r.registered_child,
        classId: r.class_id || '',
        className: r.class,
      }));
    }

    // NEW: Query normalized tables
    const parent = await this.queryParentByEmail(email);
    if (!parent) return [];

    // Find event record ID
    const eventRecords = await this.eventsTable!.select({
      filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId}'`,
      maxRecords: 1,
      returnFieldsByFieldId: true,
    }).firstPage();

    if (eventRecords.length === 0) return [];
    const eventRecordId = eventRecords[0].id;

    // Get all registrations for this parent
    const allRegistrations = await this.queryRegistrationsByParent(parent.id);

    // Filter by event
    const eventRegistrations = allRegistrations.filter(
      reg => reg.event_id?.includes(eventRecordId)
    );

    // Fetch class details
    return Promise.all(
      eventRegistrations.map(async (reg) => {
        let className: string | undefined;
        if (reg.class_id?.[0]) {
          const classRecord = await this.queryClassById(reg.class_id[0]);
          className = classRecord?.class_name;
        }

        return {
          registrationId: reg.id,
          childName: reg.registered_child,
          classId: reg.class_id?.[0] || '',
          className,
        };
      })
    );
  }

  /**
   * Add a new child registration for an existing parent
   */
  async addChildRegistration(
    parentEmail: string,
    eventId: string,
    classId: string,
    childName: string
  ): Promise<{ success: boolean; registrationId?: string; error?: string }> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Create row in parent_journey_table
      try {
        // Get parent data from existing record
        const existingRecords = await this.getParentRecordsByEmail(parentEmail);
        if (!existingRecords || existingRecords.length === 0) {
          return { success: false, error: 'Parent not found' };
        }

        const parentData = existingRecords[0];

        // Get event/class details
        const eventDetails = await this.getEventAndClassDetails(eventId, classId);
        if (!eventDetails) {
          return { success: false, error: 'Event or class not found' };
        }

        // Generate child ID
        const crypto = await import('crypto');
        const childId = `CHD-${crypto.createHash('md5').update(`${parentEmail}-${childName}-${Date.now()}`).digest('hex').substring(0, 8)}`;

        // Create new record
        const newRecord = await this.create({
          booking_id: eventId,
          class_id: classId,
          parent_email: parentEmail,
          parent_first_name: parentData.parent_first_name,
          parent_telephone: parentData.parent_telephone,
          parent_id: parentData.parent_id,
          registered_child: childName,
          child_id: childId,
          school_name: eventDetails.schoolName,
          class: eventDetails.className,
          main_teacher: eventDetails.teacherName,
          event_type: eventDetails.eventType,
          booking_date: eventDetails.bookingDate,
          registered_complete: true,
          email_campaigns: parentData.email_campaigns,
        });

        return { success: true, registrationId: newRecord.id };
      } catch (error) {
        console.error('Error adding child registration:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // NEW: Create in normalized tables
    try {
      // Find parent
      const parent = await this.queryParentByEmail(parentEmail);
      if (!parent) {
        return { success: false, error: 'Parent not found' };
      }

      // Find event record
      const eventRecords = await this.eventsTable!.select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (eventRecords.length === 0) {
        return { success: false, error: 'Event not found' };
      }
      const eventRecordId = eventRecords[0].id;

      // Find class record
      const classRecords = await this.classesTable!.select({
        filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (classRecords.length === 0) {
        return { success: false, error: 'Class not found' };
      }
      const classRecordId = classRecords[0].id;

      // Generate child ID
      const crypto = await import('crypto');
      const childId = `CHD-${crypto.createHash('md5').update(`${parentEmail}-${childName}-${Date.now()}`).digest('hex').substring(0, 8)}`;

      // Create registration
      const registrationFields: any = {
        [REGISTRATIONS_FIELD_IDS.parent_id]: [parent.id],
        [REGISTRATIONS_FIELD_IDS.event_id]: [eventRecordId],
        [REGISTRATIONS_FIELD_IDS.class_id]: [classRecordId],
        [REGISTRATIONS_FIELD_IDS.registered_child]: childName,
        [REGISTRATIONS_FIELD_IDS.child_id]: childId,
        [REGISTRATIONS_FIELD_IDS.registered_complete]: true,
        [REGISTRATIONS_FIELD_IDS.registration_date]: new Date().toISOString(),
      };

      const newRecords = await this.registrationsTable!.create([{ fields: registrationFields }]);
      return { success: true, registrationId: newRecords[0].id };
    } catch (error) {
      console.error('Error adding child registration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update an existing child registration
   */
  async updateChildRegistration(
    registrationId: string,
    updates: { childName?: string; classId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Update parent_journey_table
      try {
        const updateFields: any = {};
        if (updates.childName) updateFields.registered_child = updates.childName;
        if (updates.classId) updateFields.class_id = updates.classId;

        await this.base(TABLE_NAME).update(registrationId, updateFields);
        return { success: true };
      } catch (error) {
        console.error('Error updating child registration:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // NEW: Update registrations table
    try {
      const updateFields: any = {};

      if (updates.childName) {
        updateFields[REGISTRATIONS_FIELD_IDS.registered_child] = updates.childName;
      }

      if (updates.classId) {
        // Find class record ID
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${updates.classId}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        }).firstPage();

        if (classRecords.length === 0) {
          return { success: false, error: 'Class not found' };
        }
        updateFields[REGISTRATIONS_FIELD_IDS.class_id] = [classRecords[0].id];
      }

      await this.registrationsTable!.update(registrationId, updateFields);
      return { success: true };
    } catch (error) {
      console.error('Error updating child registration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a child registration
   */
  async deleteChildRegistration(
    registrationId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Delete from parent_journey_table
      try {
        await this.base(TABLE_NAME).destroy(registrationId);
        return { success: true };
      } catch (error) {
        console.error('Error deleting child registration:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // NEW: Delete from registrations table
    try {
      await this.registrationsTable!.destroy(registrationId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting child registration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update parent profile (name, phone)
   */
  async updateParentProfile(
    email: string,
    updates: { firstName?: string; phone?: string }
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Update all records in parent_journey_table for this parent
      try {
        const records = await this.getParentRecordsByEmail(email);
        if (!records || records.length === 0) {
          return { success: false, error: 'Parent not found' };
        }

        const updateFields: any = {};
        if (updates.firstName) updateFields.parent_first_name = updates.firstName;
        if (updates.phone) updateFields.parent_telephone = updates.phone;

        // Update all records for this parent
        const updatePromises = records.map(r =>
          this.base(TABLE_NAME).update(r.id, updateFields)
        );
        await Promise.all(updatePromises);

        return { success: true };
      } catch (error) {
        console.error('Error updating parent profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // NEW: Update parents table
    try {
      const parent = await this.queryParentByEmail(email);
      if (!parent) {
        return { success: false, error: 'Parent not found' };
      }

      const updateFields: any = {};
      if (updates.firstName) {
        updateFields[PARENTS_FIELD_IDS.parent_first_name] = updates.firstName;
      }
      if (updates.phone) {
        updateFields[PARENTS_FIELD_IDS.parent_telephone] = updates.phone;
      }

      await this.parentsTable!.update(parent.id, updateFields);
      return { success: true };
    } catch (error) {
      console.error('Error updating parent profile:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get a single registration by ID with details
   */
  async getRegistrationById(registrationId: string): Promise<{
    id: string;
    childName: string;
    parentEmail: string;
    eventId: string;
    classId: string;
  } | null> {
    this.ensureNormalizedTablesInitialized();

    if (!this.useNormalizedTables()) {
      // LEGACY: Query parent_journey_table
      try {
        const record = await this.base(TABLE_NAME).find(registrationId);
        return {
          id: record.id,
          childName: record.fields.registered_child as string,
          parentEmail: record.fields.parent_email as string,
          eventId: record.fields.booking_id as string,
          classId: record.fields.class_id as string,
        };
      } catch (error) {
        console.error('Error fetching registration:', error);
        return null;
      }
    }

    // NEW: Query registrations table
    try {
      const record = await this.registrationsTable!.find(registrationId);
      const fields = record.fields as Record<string, any>;

      // Get parent email
      let parentEmail = '';
      const parentIds = fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[] | undefined;
      if (parentIds?.[0]) {
        const parentRecord = await this.parentsTable!.find(parentIds[0]);
        parentEmail = parentRecord.fields[PARENTS_FIELD_IDS.parent_email] as string;
      }

      // Get event ID
      let eventId = '';
      const eventIds = fields[REGISTRATIONS_FIELD_IDS.event_id] as string[] | undefined;
      if (eventIds?.[0]) {
        const eventRecord = await this.eventsTable!.find(eventIds[0]);
        eventId = eventRecord.fields[EVENTS_FIELD_IDS.event_id] as string;
      }

      // Get class ID
      let classId = '';
      const classIds = fields[REGISTRATIONS_FIELD_IDS.class_id] as string[] | undefined;
      if (classIds?.[0]) {
        const classRecord = await this.classesTable!.find(classIds[0]);
        classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
      }

      return {
        id: record.id,
        childName: fields[REGISTRATIONS_FIELD_IDS.registered_child] as string,
        parentEmail,
        eventId,
        classId,
      };
    } catch (error) {
      console.error('Error fetching registration:', error);
      return null;
    }
  }

  // ==================== Master Calendar ====================

  /**
   * Get calendar bookings for a given month.
   * Fetches bookings from SchoolBookings, enriches with staff names, region names,
   * and event type data from the Events table.
   * @param month - Month in "YYYY-MM" format
   * @returns CalendarEntry[] for the requested month
   */
  async getCalendarBookings(month: string): Promise<CalendarEntry[]> {
    try {
      // Parse month to get date range
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      // Last day of month: create date for first day of NEXT month, subtract 1 day
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Query SchoolBookings for this month, excluding deleted
      const bookingRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `AND(
            {${SCHOOL_BOOKINGS_FIELD_IDS.start_date}} >= '${startDate}',
            {${SCHOOL_BOOKINGS_FIELD_IDS.start_date}} <= '${endDate}',
            {${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status}} != 'deleted'
          )`,
          fields: [
            SCHOOL_BOOKINGS_FIELD_IDS.start_date,
            SCHOOL_BOOKINGS_FIELD_IDS.school_name,
            SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name,
            SCHOOL_BOOKINGS_FIELD_IDS.school_phone,
            SCHOOL_BOOKINGS_FIELD_IDS.region,
            SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff,
            SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status,
          ],
          returnFieldsByFieldId: true,
        })
        .all();

      if (bookingRecords.length === 0) {
        return [];
      }

      // Collect unique staff IDs and region IDs from bookings
      const allStaffIds = new Set<string>();
      const allRegionIds = new Set<string>();

      for (const record of bookingRecords) {
        const staffIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff] as string[] | undefined;
        if (staffIds) {
          staffIds.forEach(id => allStaffIds.add(id));
        }
        const regionIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region] as string[] | undefined;
        if (regionIds) {
          regionIds.forEach(id => allRegionIds.add(id));
        }
      }

      // Batch fetch staff names from Personen table
      const staffNameMap = new Map<string, string>();
      if (allStaffIds.size > 0) {
        try {
          const staffRecords = await this.base(PERSONEN_TABLE_ID)
            .select({
              filterByFormula: `OR(${Array.from(allStaffIds).map(id => `RECORD_ID() = '${id}'`).join(',')})`,
              fields: [PERSONEN_FIELD_IDS.staff_name],
              returnFieldsByFieldId: true,
            })
            .all();

          staffRecords.forEach(record => {
            const name = record.fields[PERSONEN_FIELD_IDS.staff_name] as string;
            if (name) {
              staffNameMap.set(record.id, name);
            }
          });
        } catch (error) {
          console.error('Error fetching staff names for calendar:', error);
        }
      }

      // Batch fetch region names from Teams/Regionen table
      const regionNameMap = new Map<string, string>();
      if (allRegionIds.size > 0) {
        try {
          const regionRecords = await this.base(TEAMS_REGIONEN_TABLE_ID)
            .select({
              filterByFormula: `OR(${Array.from(allRegionIds).map(id => `RECORD_ID() = '${id}'`).join(',')})`,
              fields: [TEAMS_REGIONEN_FIELD_IDS.name],
              returnFieldsByFieldId: true,
            })
            .all();

          regionRecords.forEach(record => {
            const name = record.fields[TEAMS_REGIONEN_FIELD_IDS.name] as string;
            if (name) {
              regionNameMap.set(record.id, name);
            }
          });
        } catch (error) {
          console.error('Error fetching region names for calendar:', error);
        }
      }

      // Fetch ALL Events to build eventByBookingId map
      // Events use record.get() with field NAMES, not IDs
      const allEventRecords: Airtable.Record<FieldSet>[] = [];
      await this.base(EVENTS_TABLE_ID)
        .select({
          fields: [
            EVENTS_FIELD_IDS.simplybook_booking,
            EVENTS_FIELD_IDS.status,
            EVENTS_FIELD_IDS.is_plus,
            EVENTS_FIELD_IDS.is_kita,
            EVENTS_FIELD_IDS.is_schulsong,
            EVENTS_FIELD_IDS.is_minimusikertag,
            EVENTS_FIELD_IDS.assigned_staff,
          ],
        })
        .eachPage((records, fetchNextPage) => {
          allEventRecords.push(...records);
          fetchNextPage();
        });

      // Build eventByBookingId map: booking record ID -> event record
      const bookingIds = new Set(bookingRecords.map(r => r.id));
      const eventByBookingId = new Map<string, Airtable.Record<FieldSet>>();

      for (const eventRecord of allEventRecords) {
        const linkedBookings = eventRecord.get('simplybook_booking') as string[] | undefined;
        if (linkedBookings) {
          for (const bookingId of linkedBookings) {
            if (bookingIds.has(bookingId)) {
              eventByBookingId.set(bookingId, eventRecord);
            }
          }
        }
      }

      // Also collect staff IDs from events (assigned_staff on events may differ from bookings)
      const eventStaffIds = new Set<string>();
      for (const eventRecord of eventByBookingId.values()) {
        const staffIds = eventRecord.get('assigned_staff') as string[] | undefined;
        if (staffIds) {
          staffIds.forEach(id => {
            if (!staffNameMap.has(id)) {
              eventStaffIds.add(id);
            }
          });
        }
      }

      // Fetch any additional staff names from events not already in staffNameMap
      if (eventStaffIds.size > 0) {
        try {
          const extraStaffRecords = await this.base(PERSONEN_TABLE_ID)
            .select({
              filterByFormula: `OR(${Array.from(eventStaffIds).map(id => `RECORD_ID() = '${id}'`).join(',')})`,
              fields: [PERSONEN_FIELD_IDS.staff_name],
              returnFieldsByFieldId: true,
            })
            .all();

          extraStaffRecords.forEach(record => {
            const name = record.fields[PERSONEN_FIELD_IDS.staff_name] as string;
            if (name) {
              staffNameMap.set(record.id, name);
            }
          });
        } catch (error) {
          console.error('Error fetching event staff names for calendar:', error);
        }
      }

      // Transform each booking record into a CalendarEntry
      const entries: CalendarEntry[] = bookingRecords.map(record => {
        const bookingId = record.id;
        const dateStr = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string || '';
        // Normalize date to YYYY-MM-DD (strip any time component)
        const date = dateStr.substring(0, 10);
        const schoolName = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_name] as string || '';
        const contactName = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] as string || '';
        const contactPhone = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone] as string | undefined;
        const regionIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region] as string[] | undefined;
        const regionId = regionIds?.[0];
        const regionName = regionId ? regionNameMap.get(regionId) : undefined;

        // Determine staff names: prefer event assigned_staff, fall back to booking assigned_staff
        const eventRecord = eventByBookingId.get(bookingId);
        let staffIds = eventRecord?.get('assigned_staff') as string[] | undefined;
        if (!staffIds || staffIds.length === 0) {
          staffIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff] as string[] | undefined;
        }
        const staffNames = (staffIds || [])
          .map(id => staffNameMap.get(id))
          .filter((name): name is string => Boolean(name));

        // Determine event type from Event record flags
        let eventType: CalendarEntry['eventType'] = 'Minimusikertag';
        if (eventRecord) {
          const isPlus = eventRecord.get('is_plus') as boolean | undefined;
          const isKita = eventRecord.get('is_kita') as boolean | undefined;
          const isSchulsong = eventRecord.get('is_schulsong') as boolean | undefined;
          const isMinimusikertag = eventRecord.get('is_minimusikertag') as boolean | undefined;

          if (isKita) {
            eventType = 'Kita';
          } else if (isPlus) {
            eventType = 'Plus';
          } else if (isSchulsong && !isMinimusikertag) {
            eventType = 'Schulsong';
          }
          // Default: Minimusikertag
        }

        // Determine status: prefer Event status, fall back to booking simplybook_status
        let status: CalendarEntry['status'] = 'Pending';
        const eventStatus = eventRecord?.get('status') as string | undefined;
        if (eventStatus === 'Confirmed') {
          status = 'Confirmed';
        } else if (eventStatus === 'On Hold') {
          status = 'On Hold';
        } else if (eventStatus === 'Pending') {
          status = 'Pending';
        } else {
          // Fall back to booking status
          const rawStatus = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] as string || '';
          if (rawStatus === 'confirmed') status = 'Confirmed';
          else if (rawStatus === 'hold') status = 'On Hold';
        }

        return {
          bookingId,
          date,
          schoolName,
          contactName,
          contactPhone,
          regionId,
          regionName,
          staffNames,
          eventType,
          status,
        };
      });

      // Sort by date ascending
      entries.sort((a, b) => a.date.localeCompare(b.date));

      return entries;
    } catch (error) {
      console.error('Error fetching calendar bookings:', error);
      throw new Error(`Failed to fetch calendar bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Lazy getter to prevent build-time instantiation
export function getAirtableService(): AirtableService {
  return AirtableService.getInstance();
}