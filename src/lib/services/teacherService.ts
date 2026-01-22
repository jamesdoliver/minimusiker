import Airtable from 'airtable';
import crypto from 'crypto';
import { generateClassId } from '@/lib/utils/eventIdentifiers';
import {
  Teacher,
  Song,
  AudioFile,
  SongWithAudio,
  TeacherEventView,
  TeacherClassView,
  ClassGroup,
  CreateClassGroupInput,
  UpdateClassGroupInput,
  UpsertSongRequest,
  UpsertClassRequest,
  AudioFileType,
  AudioFileStatus,
  TEACHERS_TABLE_ID,
  SONGS_TABLE_ID,
  AUDIO_FILES_TABLE_ID,
  TEACHERS_FIELD_IDS,
  SONGS_FIELD_IDS,
  AUDIO_FILES_FIELD_IDS,
  MAGIC_LINK_EXPIRY_MS,
} from '@/lib/types/teacher';
import {
  AIRTABLE_FIELD_IDS,
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
  CLASSES_FIELD_IDS,
  EVENTS_FIELD_IDS,
  SONGS_LINKED_FIELD_IDS,
  AUDIO_FILES_LINKED_FIELD_IDS,
  EVENTS_TABLE_ID,
  CLASSES_TABLE_ID,
  GROUPS_TABLE_ID,
  GROUPS_FIELD_IDS,
} from '@/lib/types/airtable';
import { getAirtableService } from './airtableService';

// Table names in Airtable - use table IDs for API calls
const TEACHERS_TABLE = TEACHERS_TABLE_ID; // tblLO2vXcgvNjrJ0T
const SONGS_TABLE = SONGS_TABLE_ID; // tblPjGWQlHuG8jp5X
const AUDIO_FILES_TABLE = AUDIO_FILES_TABLE_ID; // tbloCM4tmH7mYoyXR
const PARENT_JOURNEY_TABLE = 'parent_journey_table';

/**
 * Service for Teacher Portal operations
 * Handles teachers, songs, and audio files
 */
class TeacherService {
  private base: Airtable.Base;
  private static instance: TeacherService;
  private eventsTable: Airtable.Table<any> | null = null;
  private classesTable: Airtable.Table<any> | null = null;
  private groupsTable: Airtable.Table<any> | null = null;

  private constructor() {
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY!,
    });
    this.base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

    // Initialize normalized tables if feature flag is enabled
    if (this.useNormalizedTables()) {
      this.eventsTable = this.base(EVENTS_TABLE_ID);
      this.classesTable = this.base(CLASSES_TABLE_ID);
    }

    // Groups table is always available (not behind feature flag)
    this.groupsTable = this.base(GROUPS_TABLE_ID);
  }

  public static getInstance(): TeacherService {
    if (!TeacherService.instance) {
      TeacherService.instance = new TeacherService();
    }
    return TeacherService.instance;
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
    }
  }

  // =============================================================================
  // TEACHER CRUD OPERATIONS
  // =============================================================================

  /**
   * Transform Airtable record to Teacher interface
   */
  private transformTeacherRecord(record: any): Teacher {
    return {
      id: record.id,
      email: record.fields.email || record.fields[TEACHERS_FIELD_IDS.email] || '',
      name: record.fields.name || record.fields[TEACHERS_FIELD_IDS.name] || '',
      phone: record.fields.phone || record.fields[TEACHERS_FIELD_IDS.phone],
      schoolName: record.fields.school_name || record.fields[TEACHERS_FIELD_IDS.school_name] || '',
      simplybookBookingId:
        record.fields.simplybook_booking_id || record.fields[TEACHERS_FIELD_IDS.simplybook_booking_id],
      magicLinkToken: record.fields.magic_link_token || record.fields[TEACHERS_FIELD_IDS.magic_link_token],
      tokenExpiresAt: record.fields.token_expires_at || record.fields[TEACHERS_FIELD_IDS.token_expires_at],
      linkedEvents: record.fields.linked_events || record.fields[TEACHERS_FIELD_IDS.linked_events],
      createdAt: record.fields.created_at || record.fields[TEACHERS_FIELD_IDS.created_at] || record.createdTime,
      // New fields for portal revamp
      region: record.fields.region || record.fields[TEACHERS_FIELD_IDS.region],
      schoolAddress: record.fields.school_address || record.fields[TEACHERS_FIELD_IDS.school_address],
      schoolPhone: record.fields.school_phone || record.fields[TEACHERS_FIELD_IDS.school_phone],
    };
  }

  /**
   * Get teacher by email address
   */
  async getTeacherByEmail(email: string): Promise<Teacher | null> {
    try {
      const records = await this.base(TEACHERS_TABLE)
        .select({
          filterByFormula: `LOWER({email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        })
        .all();

      if (records.length === 0) {
        return null;
      }

      return this.transformTeacherRecord(records[0]);
    } catch (error) {
      console.error('Error getting teacher by email:', error);
      throw new Error(`Failed to get teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get teacher by ID
   */
  async getTeacherById(teacherId: string): Promise<Teacher | null> {
    try {
      const record = await this.base(TEACHERS_TABLE).find(teacherId);
      return this.transformTeacherRecord(record);
    } catch (error) {
      console.error('Error getting teacher by ID:', error);
      return null;
    }
  }

  /**
   * Get teacher by magic link token
   */
  async getTeacherByToken(token: string): Promise<Teacher | null> {
    try {
      const records = await this.base(TEACHERS_TABLE)
        .select({
          filterByFormula: `{magic_link_token} = '${token.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        .all();

      if (records.length === 0) {
        return null;
      }

      return this.transformTeacherRecord(records[0]);
    } catch (error) {
      console.error('Error getting teacher by token:', error);
      return null;
    }
  }

  /**
   * Create a new teacher (typically from SimplyBook webhook)
   */
  async createTeacher(data: {
    email: string;
    name: string;
    phone?: string;
    schoolName: string;
    simplybookBookingId?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    regionRecordId?: string;
    linkedEventId?: string;
  }): Promise<Teacher> {
    try {
      const record = await this.base(TEACHERS_TABLE).create({
        [TEACHERS_FIELD_IDS.email]: data.email,
        [TEACHERS_FIELD_IDS.name]: data.name,
        [TEACHERS_FIELD_IDS.phone]: data.phone,
        [TEACHERS_FIELD_IDS.school_name]: data.schoolName,
        [TEACHERS_FIELD_IDS.simplybook_booking_id]: data.simplybookBookingId,
        [TEACHERS_FIELD_IDS.created_at]: new Date().toISOString(),
        [TEACHERS_FIELD_IDS.school_address]: data.schoolAddress,
        [TEACHERS_FIELD_IDS.school_phone]: data.schoolPhone,
        [TEACHERS_FIELD_IDS.region]: data.regionRecordId ? [data.regionRecordId] : [],
        [TEACHERS_FIELD_IDS.linked_events]: data.linkedEventId ? [data.linkedEventId] : [],
      });

      return this.transformTeacherRecord(record);
    } catch (error) {
      console.error('Error creating teacher:', error);
      throw new Error(`Failed to create teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate and store magic link token for teacher
   * Returns the generated token
   */
  async generateMagicLinkToken(teacherId: string): Promise<string> {
    try {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS).toISOString();

      await this.base(TEACHERS_TABLE).update(teacherId, {
        magic_link_token: token,
        token_expires_at: expiresAt,
      });

      return token;
    } catch (error) {
      console.error('Error generating magic link token:', error);
      throw new Error(`Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear magic link token after use
   */
  async clearMagicLinkToken(teacherId: string): Promise<void> {
    try {
      await this.base(TEACHERS_TABLE).update(teacherId, {
        magic_link_token: '',
        token_expires_at: '',
      });
    } catch (error) {
      console.error('Error clearing magic link token:', error);
    }
  }

  /**
   * Verify magic link token is valid and not expired
   */
  async verifyMagicLinkToken(token: string): Promise<Teacher | null> {
    const teacher = await this.getTeacherByToken(token);

    if (!teacher) {
      return null;
    }

    // Check expiration
    if (teacher.tokenExpiresAt) {
      const expiresAt = new Date(teacher.tokenExpiresAt);
      if (expiresAt < new Date()) {
        // Token expired
        await this.clearMagicLinkToken(teacher.id);
        return null;
      }
    }

    return teacher;
  }

  /**
   * Find or create teacher by email
   * Used when processing SimplyBook webhooks
   */
  async findOrCreateTeacher(data: {
    email: string;
    name: string;
    phone?: string;
    schoolName: string;
    simplybookBookingId?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    regionRecordId?: string;
    eventRecordId?: string;
  }): Promise<Teacher> {
    let teacher = await this.getTeacherByEmail(data.email);

    if (!teacher) {
      // Create new teacher with all data including linked event
      teacher = await this.createTeacher({
        email: data.email,
        name: data.name,
        phone: data.phone,
        schoolName: data.schoolName,
        simplybookBookingId: data.simplybookBookingId,
        schoolAddress: data.schoolAddress,
        schoolPhone: data.schoolPhone,
        regionRecordId: data.regionRecordId,
        linkedEventId: data.eventRecordId,
      });
    } else if (data.eventRecordId) {
      // Teacher exists - link this event to them
      await this.linkEventToTeacher(teacher.id, data.eventRecordId);
    }

    return teacher;
  }

  /**
   * Link an event to an existing teacher
   * Appends the event ID to the teacher's linked_events field
   */
  async linkEventToTeacher(teacherId: string, eventRecordId: string): Promise<void> {
    try {
      // Get current linked events
      const records = await this.base(TEACHERS_TABLE).find(teacherId);
      const currentLinkedEvents = (records.get('linked_events') as string[]) || [];

      // Only add if not already linked
      if (!currentLinkedEvents.includes(eventRecordId)) {
        await this.base(TEACHERS_TABLE).update(teacherId, {
          linked_events: [...currentLinkedEvents, eventRecordId],
        });
      }
    } catch (error) {
      console.error('Error linking event to teacher:', error);
      // Non-blocking - don't throw
    }
  }

  /**
   * Update teacher's school contact information
   * Allows teachers to edit school_address and school_phone fields
   */
  async updateTeacherSchoolInfo(
    teacherEmail: string,
    data: {
      address?: string;
      phone?: string;
    }
  ): Promise<void> {
    try {
      // Find teacher by email
      const teacher = await this.getTeacherByEmail(teacherEmail);

      if (!teacher) {
        throw new Error(`Teacher not found: ${teacherEmail}`);
      }

      // Build update object using field IDs
      const updateFields: Record<string, string> = {};

      if (data.address !== undefined) {
        updateFields[TEACHERS_FIELD_IDS.school_address] = data.address;
      }

      if (data.phone !== undefined) {
        updateFields[TEACHERS_FIELD_IDS.school_phone] = data.phone;
      }

      // Update teacher record
      await this.base(TEACHERS_TABLE).update(teacher.id, updateFields);
    } catch (error) {
      console.error('Error updating teacher school info:', error);
      throw new Error(`Failed to update school info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update school booking information to sync with teacher updates
   * Ensures admin view reflects teacher portal changes
   *
   * This function finds all bookings associated with a teacher's email
   * and updates the school contact information (address/phone) to match
   * what the teacher entered in the portal.
   *
   * Note: Updates ALL bookings (past and future) for data consistency.
   * Silently fails if no bookings found or update fails, to avoid blocking teacher updates.
   */
  async updateSchoolBookingInfo(
    teacherEmail: string,
    data: {
      address?: string;
      phone?: string;
    }
  ): Promise<void> {
    try {
      // Find all school bookings for this teacher's school
      // Use lowercase comparison to handle email case variations
      const bookings = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `LOWER({school_contact_email}) = LOWER('${teacherEmail.replace(/'/g, "\\'")}')`,
        })
        .all();

      if (bookings.length === 0) {
        console.warn(`[updateSchoolBookingInfo] No bookings found for teacher: ${teacherEmail}`);
        return;
      }

      // Build update object using field IDs
      const updateFields: Record<string, string> = {};

      if (data.address !== undefined) {
        updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_address] = data.address;
      }

      if (data.phone !== undefined) {
        updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone] = data.phone;
      }

      // Update all bookings for this school
      console.log(`[updateSchoolBookingInfo] Updating ${bookings.length} booking(s) for ${teacherEmail}`);

      for (const booking of bookings) {
        await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(booking.id, updateFields);
      }

      console.log(`[updateSchoolBookingInfo] Successfully updated ${bookings.length} booking(s)`);
    } catch (error) {
      console.error('[updateSchoolBookingInfo] Error updating school booking info:', error);
      // Don't throw - allow teacher update to succeed even if booking update fails
      // This ensures teachers can always update their portal info
    }
  }

  /**
   * Update a specific school booking's contact information by ID
   * Used when teacher edits address/phone for a specific event
   * Also cascades updates to the linked Events record
   */
  async updateSchoolBookingById(
    bookingId: string,
    data: {
      address?: string;
      phone?: string;
    }
  ): Promise<void>;
  /**
   * Update a specific school booking using raw field IDs
   * Used by admin refresh API to update arbitrary fields
   */
  async updateSchoolBookingById(
    bookingId: string,
    data: Record<string, string | number>
  ): Promise<void>;
  async updateSchoolBookingById(
    bookingId: string,
    data: { address?: string; phone?: string } | Record<string, string | number>
  ): Promise<void> {
    try {
      // Check if this is the semantic interface (has address/phone keys) or raw field IDs
      const isSemanticInterface = 'address' in data || 'phone' in data;

      let updateFields: Record<string, string | number>;
      let cascadeData: { address?: string; phone?: string } | undefined;

      if (isSemanticInterface) {
        // Build update object using field IDs from semantic keys
        updateFields = {};
        const semanticData = data as { address?: string; phone?: string };

        if (semanticData.address !== undefined) {
          updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_address] = semanticData.address;
        }

        if (semanticData.phone !== undefined) {
          updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone] = semanticData.phone;
        }

        cascadeData = semanticData;
      } else {
        // Raw field IDs passed directly
        updateFields = data as Record<string, string | number>;
      }

      if (Object.keys(updateFields).length === 0) {
        console.warn('[updateSchoolBookingById] No fields to update');
        return;
      }

      await this.base(SCHOOL_BOOKINGS_TABLE_ID).update(bookingId, updateFields);
      console.log(`[updateSchoolBookingById] Successfully updated booking: ${bookingId}`);

      // Cascade update to linked Event record (only for semantic interface with address/phone)
      if (cascadeData) {
        try {
          const airtableService = getAirtableService();
          const linkedEvent = await airtableService.getEventByBookingRecordId(bookingId);
          if (linkedEvent) {
            await airtableService.updateEvent(linkedEvent.id, {
              school_address: cascadeData.address,
              school_phone: cascadeData.phone,
            });
            console.log(`[updateSchoolBookingById] Cascaded update to Event: ${linkedEvent.id}`);
          }
        } catch (eventError) {
          // Log but don't fail - booking update succeeded
          console.error('[updateSchoolBookingById] Failed to cascade to Event:', eventError);
        }
      }
    } catch (error) {
      console.error('[updateSchoolBookingById] Error updating booking:', error);
      throw new Error(`Failed to update booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // SONG CRUD OPERATIONS
  // =============================================================================

  /**
   * Transform Airtable record to Song interface
   */
  private transformSongRecord(record: any): Song {
    return {
      id: record.id,
      classId: record.fields.class_id || record.fields[SONGS_FIELD_IDS.class_id] || '',
      eventId: record.fields.event_id || record.fields[SONGS_FIELD_IDS.event_id] || '',
      title: record.fields.title || record.fields[SONGS_FIELD_IDS.title] || '',
      artist: record.fields.artist || record.fields[SONGS_FIELD_IDS.artist],
      notes: record.fields.notes || record.fields[SONGS_FIELD_IDS.notes],
      order: record.fields.order || record.fields[SONGS_FIELD_IDS.order] || 1,
      createdBy: record.fields.created_by || record.fields[SONGS_FIELD_IDS.created_by],
      createdAt: record.fields.created_at || record.fields[SONGS_FIELD_IDS.created_at] || record.createdTime,
    };
  }

  /**
   * Get songs for a class
   */
  async getSongsByClassId(classId: string): Promise<Song[]> {
    // For groups (classId starts with 'group_'), query by class_id text field directly
    // because groups don't use the class_link linked record field
    const isGroup = classId.startsWith('group_');

    if (isGroup) {
      try {
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
            sort: [{ field: 'order', direction: 'asc' }],
          })
          .all();
        return records.map((record) => this.transformSongRecord(record));
      } catch (error) {
        console.error('Error getting songs for group:', error);
        return [];
      }
    }

    if (this.useNormalizedTables()) {
      // Use text field (class_id) for querying - linked record queries don't work
      // reliably in Airtable formulas. The text class_id is always set and indexed.
      try {
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
            sort: [{ field: 'order', direction: 'asc' }],
          })
          .all();

        return records.map((record) => this.transformSongRecord(record));
      } catch (error) {
        console.error('Error getting songs by class ID (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (class_id)
      try {
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
            sort: [{ field: 'order', direction: 'asc' }],
          })
          .all();

        return records.map((record) => this.transformSongRecord(record));
      } catch (error) {
        console.error('Error getting songs by class ID:', error);
        return [];
      }
    }
  }

  /**
   * Get songs for an event (all classes)
   */
  async getSongsByEventId(eventId: string): Promise<Song[]> {
    if (this.useNormalizedTables()) {
      // Use text field (event_id) for querying - linked record queries don't work
      // reliably in Airtable formulas. The text event_id is always set and indexed.
      try {
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
            sort: [
              { field: 'class_id', direction: 'asc' },
              { field: 'order', direction: 'asc' },
            ],
          })
          .all();

        return records.map((record) => this.transformSongRecord(record));
      } catch (error) {
        console.error('Error getting songs by event ID (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (event_id)
      try {
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
            sort: [
              { field: 'class_id', direction: 'asc' },
              { field: 'order', direction: 'asc' },
            ],
          })
          .all();

        return records.map((record) => this.transformSongRecord(record));
      } catch (error) {
        console.error('Error getting songs by event ID:', error);
        return [];
      }
    }
  }

  /**
   * Get a single song by ID
   */
  async getSongById(songId: string): Promise<Song | null> {
    try {
      const record = await this.base(SONGS_TABLE).find(songId);
      return this.transformSongRecord(record);
    } catch (error) {
      console.error('Error getting song by ID:', error);
      return null;
    }
  }

  /**
   * Create a new song for a class
   */
  async createSong(data: {
    classId: string;
    eventId: string;
    title: string;
    artist?: string;
    notes?: string;
    order?: number;
    createdBy?: string;
  }): Promise<Song> {
    try {
      // If no order provided, get the next order number
      let order = data.order;
      if (!order) {
        const existingSongs = await this.getSongsByClassId(data.classId);
        order = existingSongs.length + 1;
      }

      const fields: any = {
        class_id: data.classId,
        event_id: data.eventId,
        title: data.title,
        artist: data.artist,
        notes: data.notes,
        order: order,
        created_by: data.createdBy,
        created_at: new Date().toISOString(),
      };

      // If using normalized tables, also populate linked record fields
      if (this.useNormalizedTables()) {
        // Ensure tables are initialized
        this.ensureNormalizedTablesInitialized();

        // Find Classes record by class_id
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[SONGS_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length > 0) {
          fields[SONGS_LINKED_FIELD_IDS.event_link] = [eventRecords[0].id];
        }
      }

      const record = await this.base(SONGS_TABLE).create(fields);

      return this.transformSongRecord(record);
    } catch (error) {
      console.error('Error creating song:', error);
      throw new Error(`Failed to create song: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a song
   */
  async updateSong(
    songId: string,
    data: {
      title?: string;
      artist?: string;
      notes?: string;
      order?: number;
    }
  ): Promise<Song> {
    try {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.artist !== undefined) updateData.artist = data.artist;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.order !== undefined) updateData.order = data.order;

      const record = await this.base(SONGS_TABLE).update(songId, updateData);
      return this.transformSongRecord(record);
    } catch (error) {
      console.error('Error updating song:', error);
      throw new Error(`Failed to update song: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a song
   */
  async deleteSong(songId: string): Promise<void> {
    try {
      await this.base(SONGS_TABLE).destroy(songId);
    } catch (error) {
      console.error('Error deleting song:', error);
      throw new Error(`Failed to delete song: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // AUDIO FILE CRUD OPERATIONS
  // =============================================================================

  /**
   * Transform Airtable record to AudioFile interface
   */
  private transformAudioFileRecord(record: any): AudioFile {
    return {
      id: record.id,
      classId: record.fields.class_id || record.fields[AUDIO_FILES_FIELD_IDS.class_id] || '',
      eventId: record.fields.event_id || record.fields[AUDIO_FILES_FIELD_IDS.event_id] || '',
      songId: record.fields.song_id || record.fields[AUDIO_FILES_FIELD_IDS.song_id],
      type: (record.fields.type || record.fields[AUDIO_FILES_FIELD_IDS.type] || 'raw') as AudioFileType,
      r2Key: record.fields.r2_key || record.fields[AUDIO_FILES_FIELD_IDS.r2_key] || '',
      filename: record.fields.filename || record.fields[AUDIO_FILES_FIELD_IDS.filename] || '',
      uploadedBy: record.fields.uploaded_by || record.fields[AUDIO_FILES_FIELD_IDS.uploaded_by] || '',
      uploadedAt:
        record.fields.uploaded_at || record.fields[AUDIO_FILES_FIELD_IDS.uploaded_at] || record.createdTime,
      durationSeconds: record.fields.duration_seconds || record.fields[AUDIO_FILES_FIELD_IDS.duration_seconds],
      fileSizeBytes: record.fields.file_size_bytes || record.fields[AUDIO_FILES_FIELD_IDS.file_size_bytes],
      status: (record.fields.status || record.fields[AUDIO_FILES_FIELD_IDS.status] || 'pending') as AudioFileStatus,
    };
  }

  /**
   * Get audio files for a class
   */
  async getAudioFilesByClassId(classId: string): Promise<AudioFile[]> {
    if (this.useNormalizedTables()) {
      // NEW: Use linked record field (class_link)
      try {
        // First, find the Classes record by class_id field
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) return [];

        const classRecordId = classRecords[0].id;

        // Query AudioFiles table by linked record (class_link)
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `{${AUDIO_FILES_LINKED_FIELD_IDS.class_link}} = '${classRecordId}'`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by class ID (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (class_id)
      try {
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by class ID:', error);
        return [];
      }
    }
  }

  /**
   * Get audio files for an event
   */
  async getAudioFilesByEventId(eventId: string): Promise<AudioFile[]> {
    if (this.useNormalizedTables()) {
      // NEW: Use linked record field (event_link)
      try {
        // First, find the Events record by event_id field
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) return [];

        const eventRecordId = eventRecords[0].id;

        // Query AudioFiles table by linked record (event_link)
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `{${AUDIO_FILES_LINKED_FIELD_IDS.event_link}} = '${eventRecordId}'`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by event ID (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (event_id)
      try {
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by event ID:', error);
        return [];
      }
    }
  }

  /**
   * Get audio files by type for a class
   */
  async getAudioFilesByType(classId: string, type: AudioFileType): Promise<AudioFile[]> {
    if (this.useNormalizedTables()) {
      // NEW: Use linked record field (class_link) + type filter
      try {
        // First, find the Classes record by class_id field
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) return [];

        const classRecordId = classRecords[0].id;

        // Query AudioFiles table by linked record (class_link) and type
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `AND({${AUDIO_FILES_LINKED_FIELD_IDS.class_link}} = '${classRecordId}', {type} = '${type}')`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by type (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (class_id) + type filter
      try {
        const records = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `AND({class_id} = '${classId.replace(/'/g, "\\'")}', {type} = '${type}')`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        return records.map((record) => this.transformAudioFileRecord(record));
      } catch (error) {
        console.error('Error getting audio files by type:', error);
        return [];
      }
    }
  }

  /**
   * Create audio file record
   */
  async createAudioFile(data: {
    classId: string;
    eventId: string;
    songId?: string;
    type: AudioFileType;
    r2Key: string;
    filename: string;
    uploadedBy: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
    status?: AudioFileStatus;
  }): Promise<AudioFile> {
    try {
      const fields: any = {
        class_id: data.classId,
        event_id: data.eventId,
        song_id: data.songId,
        type: data.type,
        r2_key: data.r2Key,
        filename: data.filename,
        uploaded_by: data.uploadedBy,
        uploaded_at: new Date().toISOString(),
        duration_seconds: data.durationSeconds,
        file_size_bytes: data.fileSizeBytes,
        status: data.status || 'pending',
      };

      // If using normalized tables, also populate linked record fields
      if (this.useNormalizedTables()) {
        // Find Classes record by class_id
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.event_link] = [eventRecords[0].id];
        }

        // If songId provided, find Song record and link
        if (data.songId) {
          // songId is the Airtable record ID, so we can link directly
          fields[AUDIO_FILES_LINKED_FIELD_IDS.song_link] = [data.songId];
        }
      }

      const record = await this.base(AUDIO_FILES_TABLE).create(fields);

      return this.transformAudioFileRecord(record);
    } catch (error) {
      console.error('Error creating audio file record:', error);
      throw new Error(`Failed to create audio file record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update audio file status
   */
  async updateAudioFileStatus(audioFileId: string, status: AudioFileStatus): Promise<AudioFile> {
    try {
      const record = await this.base(AUDIO_FILES_TABLE).update(audioFileId, {
        status: status,
      });
      return this.transformAudioFileRecord(record);
    } catch (error) {
      console.error('Error updating audio file status:', error);
      throw new Error(`Failed to update audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update audio file record with multiple fields
   */
  async updateAudioFile(
    audioFileId: string,
    data: {
      r2Key?: string;
      filename?: string;
      uploadedBy?: string;
      durationSeconds?: number;
      fileSizeBytes?: number;
      status?: AudioFileStatus;
    }
  ): Promise<AudioFile> {
    try {
      const updateData: Record<string, string | number | boolean | undefined> = {};
      if (data.r2Key !== undefined) updateData.r2_key = data.r2Key;
      if (data.filename !== undefined) updateData.filename = data.filename;
      if (data.uploadedBy !== undefined) updateData.uploaded_by = data.uploadedBy;
      if (data.durationSeconds !== undefined) updateData.duration_seconds = data.durationSeconds;
      if (data.fileSizeBytes !== undefined) updateData.file_size_bytes = data.fileSizeBytes;
      if (data.status !== undefined) updateData.status = data.status;
      // Update uploaded_at timestamp
      updateData.uploaded_at = new Date().toISOString();

      const record = await this.base(AUDIO_FILES_TABLE).update(audioFileId, updateData);
      return this.transformAudioFileRecord(record);
    } catch (error) {
      console.error('Error updating audio file:', error);
      throw new Error(`Failed to update audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete audio file record
   */
  async deleteAudioFile(audioFileId: string): Promise<void> {
    try {
      await this.base(AUDIO_FILES_TABLE).destroy(audioFileId);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      throw new Error(`Failed to delete audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // SONG-LEVEL AUDIO OPERATIONS
  // =============================================================================

  /**
   * Get audio files for a specific song
   * Optionally filter by type (raw or final)
   */
  async getAudioFilesBySongId(songId: string, type?: 'raw' | 'final'): Promise<AudioFile[]> {
    try {
      let filterFormula = `{song_id} = '${songId.replace(/'/g, "\\'")}'`;

      if (type) {
        filterFormula = `AND({song_id} = '${songId.replace(/'/g, "\\'")}', {type} = '${type}')`;
      }

      const records = await this.base(AUDIO_FILES_TABLE)
        .select({
          filterByFormula: filterFormula,
          sort: [{ field: 'uploaded_at', direction: 'desc' }],
        })
        .all();

      return records.map((record) => this.transformAudioFileRecord(record));
    } catch (error) {
      console.error('Error getting audio files by song ID:', error);
      return [];
    }
  }

  /**
   * Get all songs for an event with their associated audio files
   * Used by staff and engineer portals to show upload/download status
   */
  async getSongsWithAudioStatus(eventId: string): Promise<SongWithAudio[]> {
    if (this.useNormalizedTables()) {
      // NEW: Use linked record field (event_link) for audio files
      try {
        // Get all songs for this event (already uses dual-read)
        const songs = await this.getSongsByEventId(eventId);

        // Find the Events record by event_id field
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) {
          // No event found, return songs with empty audio
          return songs.map((song) => ({
            ...song,
            rawAudioFiles: [],
            finalAudioFiles: [],
          }));
        }

        const eventRecordId = eventRecords[0].id;

        // Get all audio files for this event that have a songId using event_link
        const audioFiles = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `AND({${AUDIO_FILES_LINKED_FIELD_IDS.event_link}} = '${eventRecordId}', {song_id} != '')`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        const audioFileRecords = audioFiles.map((record) => this.transformAudioFileRecord(record));

        // Map songs to SongWithAudio by adding their audio files
        const songsWithAudio: SongWithAudio[] = songs.map((song) => {
          const songAudioFiles = audioFileRecords.filter((af) => af.songId === song.id);

          return {
            ...song,
            rawAudioFiles: songAudioFiles.filter((af) => af.type === 'raw'),
            finalAudioFiles: songAudioFiles.filter((af) => af.type === 'final'),
          };
        });

        return songsWithAudio;
      } catch (error) {
        console.error('Error getting songs with audio status (normalized):', error);
        return [];
      }
    } else {
      // LEGACY: Use text field (event_id)
      try {
        // Get all songs for this event
        const songs = await this.getSongsByEventId(eventId);

        // Get all audio files for this event that have a songId
        const audioFiles = await this.base(AUDIO_FILES_TABLE)
          .select({
            filterByFormula: `AND({event_id} = '${eventId.replace(/'/g, "\\'")}', {song_id} != '')`,
            sort: [{ field: 'uploaded_at', direction: 'desc' }],
          })
          .all();

        const audioFileRecords = audioFiles.map((record) => this.transformAudioFileRecord(record));

        // Map songs to SongWithAudio by adding their audio files
        const songsWithAudio: SongWithAudio[] = songs.map((song) => {
          const songAudioFiles = audioFileRecords.filter((af) => af.songId === song.id);

          return {
            ...song,
            rawAudioFiles: songAudioFiles.filter((af) => af.type === 'raw'),
            finalAudioFiles: songAudioFiles.filter((af) => af.type === 'final'),
          };
        });

        return songsWithAudio;
      } catch (error) {
        console.error('Error getting songs with audio status:', error);
        return [];
      }
    }
  }

  /**
   * Create audio file record for a song
   * This is called after a file is uploaded to R2 to track it in Airtable
   */
  async createSongAudioFile(data: {
    songId: string;
    classId: string;
    eventId: string;
    type: 'raw' | 'final';
    r2Key: string;
    filename: string;
    uploadedBy: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
    status?: AudioFileStatus;
  }): Promise<AudioFile> {
    try {
      const fields: any = {
        song_id: data.songId,
        class_id: data.classId,
        event_id: data.eventId,
        type: data.type,
        r2_key: data.r2Key,
        filename: data.filename,
        uploaded_by: data.uploadedBy,
        uploaded_at: new Date().toISOString(),
        duration_seconds: data.durationSeconds,
        file_size_bytes: data.fileSizeBytes,
        status: data.status || 'ready',
      };

      // If using normalized tables, also populate linked record fields
      if (this.useNormalizedTables()) {
        // Find Classes record by class_id
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.event_link] = [eventRecords[0].id];
        }

        // Link to song (songId is the Airtable record ID, so we can link directly)
        if (data.songId) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.song_link] = [data.songId];
        }
      }

      const record = await this.base(AUDIO_FILES_TABLE).create(fields);

      return this.transformAudioFileRecord(record);
    } catch (error) {
      console.error('Error creating song audio file record:', error);
      throw new Error(`Failed to create song audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // CLASS CRUD OPERATIONS
  // =============================================================================

  /**
   * Create a new class for an event
   * Creates a record in the normalized Classes table only
   */
  async createClass(data: {
    eventId: string;
    className: string;
    teacherEmail: string;
    teacherName?: string;
    numChildren?: number;
  }): Promise<TeacherClassView> {
    try {
      // First, look up the Event record - it's the source of truth for event info
      let eventRecord = await getAirtableService().getEventByEventId(data.eventId);

      // Fallback: if eventId looks like a simplybookId (numeric), resolve via SchoolBookings
      // This handles the case where getTeacherEvents() fell back to simplybookId because
      // the Event wasn't linked to the SchoolBooking via simplybook_booking field
      if (!eventRecord && /^\d+$/.test(data.eventId)) {
        console.log(`createClass: eventId "${data.eventId}" looks like a simplybookId, trying fallback resolution`);
        const booking = await getAirtableService().getSchoolBookingBySimplybookId(data.eventId);
        if (booking) {
          eventRecord = await getAirtableService().getEventBySchoolBookingId(booking.id);
          if (eventRecord) {
            console.log(`createClass: Resolved Event via SchoolBooking: ${eventRecord.id} (${eventRecord.event_id})`);
          }
        }
      }

      // Get school info from Event record (preferred) or fallback to SchoolBooking lookup
      let schoolName = eventRecord?.school_name || '';
      let bookingDate = eventRecord?.event_date || '';
      const eventRecordId = eventRecord?.id || null;

      // If Event doesn't have school info, try looking up the linked SchoolBooking
      if ((!schoolName || !bookingDate) && eventRecord?.simplybook_booking?.[0]) {
        const schoolBooking = await getAirtableService().getSchoolBookingById(eventRecord.simplybook_booking[0]);
        schoolName = schoolName || schoolBooking?.schoolName || schoolBooking?.schoolContactName || '';
        bookingDate = bookingDate || schoolBooking?.startDate || '';
      }

      // Generate a consistent class_id using generateClassId() when we have the required data
      // Falls back to timestamp-based ID for backward compatibility
      let classId: string;
      if (schoolName && bookingDate) {
        classId = generateClassId(schoolName, bookingDate, data.className);
      } else {
        // Fallback for cases where school info isn't available
        classId = `${data.eventId}_class_${Date.now()}`;
        console.warn('createClass: Missing schoolName or bookingDate, using fallback class_id format');
      }

      // Create Class record in normalized Classes table
      const classFields: Airtable.FieldSet = {
        [CLASSES_FIELD_IDS.class_id]: classId,
        [CLASSES_FIELD_IDS.class_name]: data.className,
        [CLASSES_FIELD_IDS.main_teacher]: data.teacherName || '',
        [CLASSES_FIELD_IDS.legacy_booking_id]: data.eventId,
      };

      // Only add total_children if it's a positive number
      if (data.numChildren && data.numChildren > 0) {
        classFields[CLASSES_FIELD_IDS.total_children] = data.numChildren;
      }

      // Link to Event if found
      if (eventRecordId) {
        classFields[CLASSES_FIELD_IDS.event_id] = [eventRecordId];
      }

      await this.base(CLASSES_TABLE_ID).create([{ fields: classFields }]);
      console.log(`Created Class record: ${classId}`);

      // Return the new class view
      return {
        classId,
        className: data.className,
        numChildren: data.numChildren,
        songs: [],
        audioStatus: {
          hasRawAudio: false,
          hasPreview: false,
          hasFinal: false,
        },
      };
    } catch (error) {
      console.error('Error creating class:', error);
      throw new Error(`Failed to create class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a default "Alle Kinder" catch-all class for an event
   * Called automatically when SimplyBook webhook creates an event
   * This ensures parents can always register even if teacher hasn't set up classes
   */
  async createDefaultClass(data: {
    eventId: string;
    eventRecordId: string;  // Airtable record ID for Events table linking
    schoolName: string;
    bookingDate: string;
    estimatedChildren?: number;
  }): Promise<TeacherClassView | null> {
    const DEFAULT_CLASS_NAME = 'Alle Kinder';

    try {
      // Generate class_id for the catch-all class
      const classId = generateClassId(data.schoolName, data.bookingDate, DEFAULT_CLASS_NAME);

      // Check if default class already exists (idempotency)
      const existingRecords = await this.base(CLASSES_TABLE_ID)
        .select({
          filterByFormula: `AND({${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}', {${CLASSES_FIELD_IDS.is_default}} = TRUE())`,
          maxRecords: 1,
        })
        .firstPage();

      if (existingRecords.length > 0) {
        console.log(`Default class already exists for event ${data.eventId}, skipping creation`);
        return null;
      }

      // Create record in Classes table with is_default flag
      const classFields: Airtable.FieldSet = {
        [CLASSES_FIELD_IDS.class_id]: classId,
        [CLASSES_FIELD_IDS.class_name]: DEFAULT_CLASS_NAME,
        [CLASSES_FIELD_IDS.main_teacher]: '',
        [CLASSES_FIELD_IDS.legacy_booking_id]: data.eventId,
        [CLASSES_FIELD_IDS.event_id]: [data.eventRecordId],
        [CLASSES_FIELD_IDS.is_default]: true,
      };

      if (data.estimatedChildren && data.estimatedChildren > 0) {
        classFields[CLASSES_FIELD_IDS.total_children] = data.estimatedChildren;
      }

      await this.base(CLASSES_TABLE_ID).create([{ fields: classFields }]);
      console.log(`Created default "Alle Kinder" class: ${classId} for event ${data.eventId}`);

      return {
        classId,
        className: DEFAULT_CLASS_NAME,
        numChildren: data.estimatedChildren,
        songs: [],
        audioStatus: {
          hasRawAudio: false,
          hasPreview: false,
          hasFinal: false,
        },
        isDefault: true,
      };
    } catch (error) {
      console.error('Error creating default class:', error);
      return null;
    }
  }

  /**
   * Update a class
   */
  async updateClass(
    classId: string,
    data: {
      className?: string;
      numChildren?: number;
    }
  ): Promise<void> {
    try {
      // Find the class record in Classes table
      const classRecords = await this.base(CLASSES_TABLE_ID)
        .select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (classRecords.length === 0) {
        throw new Error('Class not found');
      }

      // Build updates for Classes table
      const updates: Airtable.FieldSet = {};
      if (data.className !== undefined) updates[CLASSES_FIELD_IDS.class_name] = data.className;
      if (data.numChildren !== undefined) updates[CLASSES_FIELD_IDS.total_children] = data.numChildren;

      // Update the Classes table record
      await this.base(CLASSES_TABLE_ID).update(classRecords[0].id, updates);
    } catch (error) {
      console.error('Error updating class:', error);
      throw new Error(`Failed to update class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify that a teacher owns a class (via event ownership)
   */
  async verifyTeacherOwnsClass(classId: string, teacherEmail: string): Promise<boolean> {
    try {
      // Find the class record in Classes table to get its booking_id
      const classRecords = await this.base(CLASSES_TABLE_ID)
        .select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (classRecords.length === 0) {
        return false;
      }

      const classRecord = classRecords[0];
      const bookingId = classRecord.fields[CLASSES_FIELD_IDS.legacy_booking_id] as string;

      if (!bookingId) {
        return false;
      }

      // Check if teacher has access to this event
      const event = await this.getTeacherEventDetail(bookingId, teacherEmail);
      return event !== null;
    } catch (error) {
      console.error('Error verifying class ownership:', error);
      return false;
    }
  }

  /**
   * Delete a class (only if no children registered and no songs)
   */
  async deleteClass(classId: string): Promise<void> {
    try {
      // Find the class record in Classes table
      const classRecords = await this.base(CLASSES_TABLE_ID)
        .select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (classRecords.length === 0) {
        throw new Error('Class not found');
      }

      const classRecord = classRecords[0];
      const classFields = classRecord.fields as Record<string, unknown>;

      // Check if this is a default class (cannot be deleted)
      const isDefault = Boolean(classFields[CLASSES_FIELD_IDS.is_default]);
      const className = classFields[CLASSES_FIELD_IDS.class_name] as string;
      if (isDefault || className === 'Alle Kinder') {
        throw new Error('Die Standardklasse kann nicht gelöscht werden. Eltern können sich hier registrieren, bevor Sie Klassen einrichten.');
      }

      // Check if any children are registered for this class (from parent_journey_table)
      const registrationRecords = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `AND({${AIRTABLE_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}', {${AIRTABLE_FIELD_IDS.registered_child}} != '')`,
          maxRecords: 1,
        })
        .firstPage();

      if (registrationRecords.length > 0) {
        throw new Error('Cannot delete class with registered children');
      }

      // Check if class has any songs
      const songs = await this.getSongsByClassId(classId);
      if (songs.length > 0) {
        throw new Error('Cannot delete class with songs. Remove songs first.');
      }

      // Delete the class from Classes table
      await this.base(CLASSES_TABLE_ID).destroy(classRecord.id);
    } catch (error) {
      console.error('Error deleting class:', error);
      throw new Error(`Failed to delete class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // CLASS GROUP OPERATIONS ("Classes Singing Together")
  // =============================================================================

  /**
   * Transform Airtable record to ClassGroup interface
   */
  private transformGroupRecord(record: any): ClassGroup {
    const memberClasses = record.fields[GROUPS_FIELD_IDS.member_classes] || [];
    return {
      groupId: record.fields[GROUPS_FIELD_IDS.group_id] || record.id,
      groupName: record.fields[GROUPS_FIELD_IDS.group_name] || '',
      eventId: '', // Will be populated from linked record lookup
      memberClassIds: Array.isArray(memberClasses) ? memberClasses : [],
      songs: [], // Will be populated separately
      audioStatus: {
        hasRawAudio: false,
        hasPreview: false,
        hasFinal: false,
      },
      createdAt: record.fields[GROUPS_FIELD_IDS.created_at] || record.createdTime || '',
      createdBy: record.fields[GROUPS_FIELD_IDS.created_by] || '',
    };
  }

  /**
   * Get all groups for an event
   */
  async getGroupsByEventId(eventId: string): Promise<ClassGroup[]> {
    try {
      if (!this.groupsTable) {
        console.warn('Groups table not initialized');
        return [];
      }

      // First, find the Events record by event_id
      let eventRecords = await this.base(EVENTS_TABLE_ID)
        .select({
          filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}', {${EVENTS_FIELD_IDS.legacy_booking_id}} = '${eventId.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        })
        .firstPage();

      // Fallback: if eventId looks like a simplybookId (numeric), resolve via SchoolBookings
      if (eventRecords.length === 0 && /^\d+$/.test(eventId)) {
        const booking = await getAirtableService().getSchoolBookingBySimplybookId(eventId);
        if (booking) {
          const eventRecord = await getAirtableService().getEventBySchoolBookingId(booking.id);
          if (eventRecord) {
            eventRecords = await this.base(EVENTS_TABLE_ID)
              .select({
                filterByFormula: `RECORD_ID() = '${eventRecord.id}'`,
                maxRecords: 1,
              })
              .firstPage();
          }
        }
      }

      if (eventRecords.length === 0) {
        return [];
      }

      const eventRecordId = eventRecords[0].id;

      // Query Groups table and filter by event_id linked record
      // Note: We fetch all groups and filter in JS because ARRAYJOIN on linked record fields
      // returns display text (primary field values), not record IDs
      const allRecords = await this.groupsTable.select({ returnFieldsByFieldId: true }).all();

      // Filter to groups where the event_id linked record contains our target event record ID
      const records = allRecords.filter((record) => {
        const linkedEventIds = record.fields[GROUPS_FIELD_IDS.event_id];
        return Array.isArray(linkedEventIds) && linkedEventIds.includes(eventRecordId);
      });

      const groups: ClassGroup[] = [];

      for (const record of records) {
        const group = this.transformGroupRecord(record);
        group.eventId = eventId;

        // Get songs for this group (stored with group_id as the class_id)
        const songs = await this.getSongsByClassId(group.groupId);
        group.songs = songs;

        // Get audio files for this group
        const audioFiles = await this.getAudioFilesByClassId(group.groupId);
        group.audioStatus = {
          hasRawAudio: audioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
          hasPreview: audioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
          hasFinal: audioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
        };

        // Populate member classes details
        if (group.memberClassIds.length > 0) {
          const memberClasses: TeacherClassView[] = [];
          for (const classRecordId of group.memberClassIds) {
            try {
              // Use .select() instead of .find() to support returnFieldsByFieldId
              const classRecords = await this.base(CLASSES_TABLE_ID)
                .select({
                  filterByFormula: `RECORD_ID() = '${classRecordId}'`,
                  maxRecords: 1,
                  returnFieldsByFieldId: true,
                })
                .firstPage();
              if (classRecords.length === 0) continue;
              const classRecord = classRecords[0];
              const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
              const className = classRecord.fields[CLASSES_FIELD_IDS.class_name] as string;
              const numChildren = classRecord.fields[CLASSES_FIELD_IDS.total_children] as number | undefined;
              memberClasses.push({
                classId,
                className,
                numChildren,
                songs: [],
                audioStatus: { hasRawAudio: false, hasPreview: false, hasFinal: false },
              });
            } catch (err) {
              console.warn(`Could not fetch class record ${classRecordId}:`, err);
            }
          }
          group.memberClasses = memberClasses;
        }

        groups.push(group);
      }

      return groups;
    } catch (error) {
      console.error('Error getting groups by event ID:', error);
      return [];
    }
  }

  /**
   * Get a single group by ID
   */
  async getGroupById(groupId: string): Promise<ClassGroup | null> {
    try {
      if (!this.groupsTable) {
        return null;
      }

      // Query by group_id field
      const records = await this.groupsTable
        .select({
          filterByFormula: `{${GROUPS_FIELD_IDS.group_id}} = '${groupId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        return null;
      }

      const group = this.transformGroupRecord(records[0]);

      // Get the event_id from the linked record
      const eventLink = records[0].fields[GROUPS_FIELD_IDS.event_id];
      if (Array.isArray(eventLink) && eventLink.length > 0) {
        try {
          const eventRecord = await this.base(EVENTS_TABLE_ID).find(eventLink[0]);
          group.eventId = (eventRecord.fields[EVENTS_FIELD_IDS.event_id] || eventRecord.fields[EVENTS_FIELD_IDS.legacy_booking_id] || '') as string;
        } catch (err) {
          console.warn('Could not fetch event record:', err);
        }
      }

      // Get songs and audio for this group
      group.songs = await this.getSongsByClassId(groupId);
      const audioFiles = await this.getAudioFilesByClassId(groupId);
      group.audioStatus = {
        hasRawAudio: audioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
        hasPreview: audioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
        hasFinal: audioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
      };

      return group;
    } catch (error) {
      console.error('Error getting group by ID:', error);
      return null;
    }
  }

  /**
   * Create a new class group
   */
  async createGroup(data: {
    eventId: string;
    groupName: string;
    memberClassIds: string[];  // These are class_id values (not Airtable record IDs)
    createdBy: string;
  }): Promise<ClassGroup> {
    try {
      if (!this.groupsTable) {
        throw new Error('Groups table not initialized');
      }

      if (data.memberClassIds.length < 2) {
        throw new Error('A group must contain at least 2 classes');
      }

      // Generate a unique group_id
      const groupId = `group_${data.eventId}_${Date.now()}`;

      // Find the Events record
      let eventRecords = await this.base(EVENTS_TABLE_ID)
        .select({
          filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}', {${EVENTS_FIELD_IDS.legacy_booking_id}} = '${data.eventId.replace(/'/g, "\\'")}')`,
          maxRecords: 1,
        })
        .firstPage();

      // Fallback: if eventId looks like a simplybookId (numeric), resolve via SchoolBookings
      if (eventRecords.length === 0 && /^\d+$/.test(data.eventId)) {
        console.log(`createGroup: eventId "${data.eventId}" looks like a simplybookId, trying fallback resolution`);
        const booking = await getAirtableService().getSchoolBookingBySimplybookId(data.eventId);
        if (booking) {
          const eventRecord = await getAirtableService().getEventBySchoolBookingId(booking.id);
          if (eventRecord) {
            console.log(`createGroup: Resolved Event via SchoolBooking: ${eventRecord.id} (${eventRecord.event_id})`);
            // Get the event record from Airtable directly
            eventRecords = await this.base(EVENTS_TABLE_ID)
              .select({
                filterByFormula: `RECORD_ID() = '${eventRecord.id}'`,
                maxRecords: 1,
              })
              .firstPage();
          }
        }
      }

      if (eventRecords.length === 0) {
        throw new Error('Event not found');
      }

      const eventRecordId = eventRecords[0].id;

      // Convert class_id values to Airtable record IDs
      const classRecordIds: string[] = [];
      for (const classId of data.memberClassIds) {
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
            maxRecords: 1,
          })
          .firstPage();

        if (classRecords.length > 0) {
          classRecordIds.push(classRecords[0].id);
        } else {
          console.warn(`Class not found: ${classId}`);
        }
      }

      if (classRecordIds.length < 2) {
        throw new Error('Could not find enough valid classes to create group');
      }

      // Create the group record
      const record = await this.groupsTable.create({
        [GROUPS_FIELD_IDS.group_id]: groupId,
        [GROUPS_FIELD_IDS.group_name]: data.groupName,
        [GROUPS_FIELD_IDS.event_id]: [eventRecordId],
        [GROUPS_FIELD_IDS.member_classes]: classRecordIds,
        [GROUPS_FIELD_IDS.created_at]: new Date().toISOString(),
        [GROUPS_FIELD_IDS.created_by]: data.createdBy,
      });

      const group = this.transformGroupRecord(record);
      group.eventId = data.eventId;
      group.memberClassIds = classRecordIds;

      return group;
    } catch (error) {
      console.error('Error creating group:', error);
      throw new Error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a class group
   */
  async updateGroup(
    groupId: string,
    data: UpdateClassGroupInput
  ): Promise<ClassGroup> {
    try {
      if (!this.groupsTable) {
        throw new Error('Groups table not initialized');
      }

      // Find the group record
      const records = await this.groupsTable
        .select({
          filterByFormula: `{${GROUPS_FIELD_IDS.group_id}} = '${groupId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        throw new Error('Group not found');
      }

      const recordId = records[0].id;
      const updateFields: Record<string, any> = {};

      if (data.groupName !== undefined) {
        updateFields[GROUPS_FIELD_IDS.group_name] = data.groupName;
      }

      if (data.memberClassIds !== undefined) {
        if (data.memberClassIds.length < 2) {
          throw new Error('A group must contain at least 2 classes');
        }

        // Convert class_id values to Airtable record IDs
        const classRecordIds: string[] = [];
        for (const classId of data.memberClassIds) {
          const classRecords = await this.base(CLASSES_TABLE_ID)
            .select({
              filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
              maxRecords: 1,
            })
            .firstPage();

          if (classRecords.length > 0) {
            classRecordIds.push(classRecords[0].id);
          }
        }

        if (classRecordIds.length < 2) {
          throw new Error('Could not find enough valid classes');
        }

        updateFields[GROUPS_FIELD_IDS.member_classes] = classRecordIds;
      }

      const updatedRecord = await this.groupsTable.update(recordId, updateFields);
      const group = this.transformGroupRecord(updatedRecord);

      // Fetch full group details
      const fullGroup = await this.getGroupById(groupId);
      return fullGroup || group;
    } catch (error) {
      console.error('Error updating group:', error);
      throw new Error(`Failed to update group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a class group
   */
  async deleteGroup(groupId: string): Promise<void> {
    try {
      if (!this.groupsTable) {
        throw new Error('Groups table not initialized');
      }

      // Find the group record
      const records = await this.groupsTable
        .select({
          filterByFormula: `{${GROUPS_FIELD_IDS.group_id}} = '${groupId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
          returnFieldsByFieldId: true,
        })
        .firstPage();

      if (records.length === 0) {
        throw new Error('Group not found');
      }

      // Check if group has songs (cannot delete if has songs)
      const songs = await this.getSongsByClassId(groupId);
      if (songs.length > 0) {
        throw new Error('Cannot delete group with songs. Remove songs first.');
      }

      // Check if group has audio files
      const audioFiles = await this.getAudioFilesByClassId(groupId);
      if (audioFiles.length > 0) {
        throw new Error('Cannot delete group with audio files. Remove audio files first.');
      }

      await this.groupsTable.destroy(records[0].id);
    } catch (error) {
      console.error('Error deleting group:', error);
      throw new Error(`Failed to delete group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all groups that a specific class belongs to
   */
  async getGroupsForClass(classId: string): Promise<ClassGroup[]> {
    try {
      if (!this.groupsTable) {
        return [];
      }

      // First, find the class record ID
      const classRecords = await this.base(CLASSES_TABLE_ID)
        .select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (classRecords.length === 0) {
        return [];
      }

      const classRecordId = classRecords[0].id;

      // Query Groups where member_classes contains this class record ID
      // Note: We fetch all groups and filter in JS because ARRAYJOIN on linked record fields
      // returns display text (primary field values), not record IDs
      const allRecords = await this.groupsTable.select({ returnFieldsByFieldId: true }).all();

      const records = allRecords.filter((record) => {
        const memberClassIds = record.fields[GROUPS_FIELD_IDS.member_classes];
        return Array.isArray(memberClassIds) && memberClassIds.includes(classRecordId);
      });

      const groups: ClassGroup[] = [];
      for (const record of records) {
        const group = this.transformGroupRecord(record);

        // Get the event_id from the linked record
        const eventLink = record.fields[GROUPS_FIELD_IDS.event_id];
        if (Array.isArray(eventLink) && eventLink.length > 0) {
          try {
            const eventRecord = await this.base(EVENTS_TABLE_ID).find(eventLink[0]);
            group.eventId = (eventRecord.fields[EVENTS_FIELD_IDS.event_id] || eventRecord.fields[EVENTS_FIELD_IDS.legacy_booking_id] || '') as string;
          } catch (err) {
            console.warn('Could not fetch event record:', err);
          }
        }

        groups.push(group);
      }

      return groups;
    } catch (error) {
      console.error('Error getting groups for class:', error);
      return [];
    }
  }

  /**
   * Verify that a teacher owns a group (via event ownership)
   */
  async verifyTeacherOwnsGroup(groupId: string, teacherEmail: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group || !group.eventId) {
        return false;
      }

      // Check if teacher has access to this event
      const event = await this.getTeacherEventDetail(group.eventId, teacherEmail);
      return event !== null;
    } catch (error) {
      console.error('Error verifying group ownership:', error);
      return false;
    }
  }

  // =============================================================================
  // TEACHER EVENT VIEW OPERATIONS
  // =============================================================================

  /**
   * Get events for a teacher (by email)
   * Returns events where the teacher's email matches the school contact
   */
  async getTeacherEvents(teacherEmail: string): Promise<TeacherEventView[]> {
    try {
      // Get teacher's bookings from SchoolBookings table (source of truth)
      const schoolBookings = await getAirtableService().getBookingsForTeacher(teacherEmail);

      // Also check parent_journey_table for legacy/test events not in SchoolBookings
      const legacyRecords = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${teacherEmail.replace(/'/g, "\\'")}')`,
        })
        .all();

      // Collect unique event IDs from legacy records
      const legacyEventIds = new Set<string>();
      const legacyEventData = new Map<string, { schoolName: string; eventDate: string; eventType: string }>();
      for (const record of legacyRecords) {
        const eventId = (record.fields.booking_id || record.fields[AIRTABLE_FIELD_IDS.booking_id]) as string;
        if (eventId && !legacyEventIds.has(eventId)) {
          legacyEventIds.add(eventId);
          legacyEventData.set(eventId, {
            schoolName: (record.fields.school_name || record.fields[AIRTABLE_FIELD_IDS.school_name] || '') as string,
            eventDate: (record.fields.booking_date || record.fields[AIRTABLE_FIELD_IDS.booking_date] || '') as string,
            eventType: (record.fields.event_type || record.fields[AIRTABLE_FIELD_IDS.event_type] || '') as string,
          });
        }
      }

      // Build a set of booking IDs we already have from SchoolBookings
      const schoolBookingIds = new Set(schoolBookings.map(b => b.simplybookId).filter(Boolean));

      // Get teacher record to check linked_events field
      const teacher = await this.getTeacherByEmail(teacherEmail);
      const linkedEventRecordIds = teacher?.linkedEvents || [];

      // Fetch events directly linked to teacher via Teachers.linked_events
      const linkedEvents = await getAirtableService().getEventsByRecordIds(linkedEventRecordIds);

      // Track all processed event IDs to avoid duplicates
      const processedEventIds = new Set<string>();

      // Build TeacherEventView array
      const events: TeacherEventView[] = [];

      // Process SchoolBookings first
      for (const booking of schoolBookings) {
        // Look up the Event record to get the canonical event_id
        // This ensures we use a consistent identifier for class queries
        const eventRecord = await getAirtableService().getEventBySchoolBookingId(booking.id);

        // Use Event's event_id if available, fallback to simplybookId for legacy support
        const eventId = eventRecord?.event_id || booking.simplybookId;
        if (!eventId) continue;

        const actualEventDate = booking.startDate || '';
        const actualSchoolName = booking.schoolName || '';

        // Query Classes table to get classes for this event
        // Search for both event_id format AND simplybookId to catch classes created with either identifier
        const simplybookId = booking.simplybookId;
        const classFilterFormula = simplybookId && simplybookId !== eventId
          ? `OR({${CLASSES_FIELD_IDS.legacy_booking_id}} = '${eventId.replace(/'/g, "\\'")}', {${CLASSES_FIELD_IDS.legacy_booking_id}} = '${simplybookId.replace(/'/g, "\\'")}')`
          : `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${eventId.replace(/'/g, "\\'")}'`;

        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: classFilterFormula,
            returnFieldsByFieldId: true,
          })
          .all();

        // Get songs and audio files for this event
        const songs = await this.getSongsByEventId(eventId);
        const audioFiles = await this.getAudioFilesByEventId(eventId);

        // Build class views from Classes table
        const classViews: TeacherClassView[] = [];
        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
          const className = classRecord.fields[CLASSES_FIELD_IDS.class_name] as string;
          const numChildren = classRecord.fields[CLASSES_FIELD_IDS.total_children] as number | undefined;
          const isDefault = Boolean(classRecord.fields[CLASSES_FIELD_IDS.is_default]);

          const classSongs = songs.filter((s) => s.classId === classId);
          const classAudioFiles = audioFiles.filter((a) => a.classId === classId);

          classViews.push({
            classId,
            className,
            numChildren,
            songs: classSongs,
            audioStatus: {
              hasRawAudio: classAudioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
              hasPreview: classAudioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
              hasFinal: classAudioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
            },
            isDefault,
          });
        }

        // Determine event status - Use date-only comparison to avoid timezone issues
        const eventDate = new Date(actualEventDate);
        const now = new Date();

        // Normalize both dates to start of day in local timezone
        const eventDateOnly = new Date(
          eventDate.getFullYear(),
          eventDate.getMonth(),
          eventDate.getDate()
        );
        const nowDateOnly = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        // Events with no classes are considered "needs-setup"
        const needsSetup = classViews.length === 0;

        let status: 'upcoming' | 'in-progress' | 'completed' | 'needs-setup';
        if (needsSetup) {
          status = 'needs-setup';
        } else if (eventDateOnly > nowDateOnly) {
          status = 'upcoming';
        } else if (eventDateOnly.getTime() === nowDateOnly.getTime()) {
          status = 'in-progress';
        } else {
          status = 'completed';
        }

        // Calculate progress metrics
        const classesCount = classViews.length;
        const songsCount = songs.length;

        // Count registrations for this event from parent_journey_table
        // (registrations with actual children, not class placeholders)
        let registrationsCount = 0;
        try {
          const registrationRecords = await this.base(PARENT_JOURNEY_TABLE)
            .select({
              filterByFormula: `AND({${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId.replace(/'/g, "\\'")}', {${AIRTABLE_FIELD_IDS.registered_child}} != '')`,
            })
            .all();
          registrationsCount = registrationRecords.length;
        } catch (err) {
          console.warn('Could not get registration count:', err);
        }

        // Calculate total expected children (sum of total_children from all classes)
        const totalChildrenExpected = classViews.reduce(
          (sum, cls) => sum + (cls.numChildren || 0),
          0
        );

        // Calculate days and weeks until event
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / msPerDay);
        const weeksUntilEvent = Math.round(daysUntilEvent / 7);

        // Expected songs: default to 1 song per class
        const SONGS_PER_CLASS = 1;
        const expectedSongs = classesCount * SONGS_PER_CLASS;

        events.push({
          eventId,
          schoolName: actualSchoolName,
          eventDate: actualEventDate,
          eventType: 'MiniMusiker Day',
          classes: classViews,
          status,
          simplybookHash: booking.simplybookHash,
          bookingRecordId: booking.id,
          schoolAddress: booking.schoolAddress,
          schoolPhone: booking.schoolPhone,
          progress: {
            classesCount,
            expectedClasses: undefined,
            songsCount,
            expectedSongs,
            registrationsCount,
            totalChildrenExpected: totalChildrenExpected > 0 ? totalChildrenExpected : undefined,
            daysUntilEvent,
            weeksUntilEvent,
          },
        });

        // Track this event to avoid duplicates from linked_events
        processedEventIds.add(eventId);
      }

      // Process legacy events not in SchoolBookings
      for (const eventId of legacyEventIds) {
        if (schoolBookingIds.has(eventId)) continue; // Skip if already processed

        const legacyData = legacyEventData.get(eventId)!;
        const actualEventDate = legacyData.eventDate;
        const actualSchoolName = legacyData.schoolName;

        // Query Classes table to get classes for this event
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${eventId.replace(/'/g, "\\'")}'`,
            returnFieldsByFieldId: true,
          })
          .all();

        // Get songs and audio files for this event
        const songs = await this.getSongsByEventId(eventId);
        const audioFiles = await this.getAudioFilesByEventId(eventId);

        // Build class views from Classes table
        const classViews: TeacherClassView[] = [];
        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
          const className = classRecord.fields[CLASSES_FIELD_IDS.class_name] as string;
          const numChildren = classRecord.fields[CLASSES_FIELD_IDS.total_children] as number | undefined;
          const isDefault = Boolean(classRecord.fields[CLASSES_FIELD_IDS.is_default]);

          const classSongs = songs.filter((s) => s.classId === classId);
          const classAudioFiles = audioFiles.filter((a) => a.classId === classId);

          classViews.push({
            classId,
            className,
            numChildren,
            songs: classSongs,
            audioStatus: {
              hasRawAudio: classAudioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
              hasPreview: classAudioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
              hasFinal: classAudioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
            },
            isDefault,
          });
        }

        // Determine event status
        const eventDate = new Date(actualEventDate);
        const now = new Date();
        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const needsSetup = classViews.length === 0;
        let status: 'upcoming' | 'in-progress' | 'completed' | 'needs-setup';
        if (needsSetup) {
          status = 'needs-setup';
        } else if (eventDateOnly > nowDateOnly) {
          status = 'upcoming';
        } else if (eventDateOnly.getTime() === nowDateOnly.getTime()) {
          status = 'in-progress';
        } else {
          status = 'completed';
        }

        // Calculate progress metrics
        const classesCount = classViews.length;
        const songsCount = songs.length;

        let registrationsCount = 0;
        try {
          const registrationRecords = await this.base(PARENT_JOURNEY_TABLE)
            .select({
              filterByFormula: `AND({${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId.replace(/'/g, "\\'")}', {${AIRTABLE_FIELD_IDS.registered_child}} != '')`,
            })
            .all();
          registrationsCount = registrationRecords.length;
        } catch (err) {
          console.warn('Could not get registration count:', err);
        }

        const totalChildrenExpected = classViews.reduce((sum, cls) => sum + (cls.numChildren || 0), 0);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / msPerDay);
        const weeksUntilEvent = Math.round(daysUntilEvent / 7);
        const SONGS_PER_CLASS = 1;
        const expectedSongs = classesCount * SONGS_PER_CLASS;

        events.push({
          eventId,
          schoolName: actualSchoolName,
          eventDate: actualEventDate,
          eventType: legacyData.eventType || 'MiniMusiker Day',
          classes: classViews,
          status,
          progress: {
            classesCount,
            expectedClasses: undefined,
            songsCount,
            expectedSongs,
            registrationsCount,
            totalChildrenExpected: totalChildrenExpected > 0 ? totalChildrenExpected : undefined,
            daysUntilEvent,
            weeksUntilEvent,
          },
        });

        // Track this event to avoid duplicates from linked_events
        processedEventIds.add(eventId);
      }

      // Process events from Teachers.linked_events that aren't already included
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const linkedEvent of linkedEvents) {
        const eventId = linkedEvent.event_id;

        // Skip if already processed via SchoolBookings or legacy
        if (processedEventIds.has(eventId)) continue;
        if (schoolBookingIds.has(eventId)) continue;
        if (legacyEventIds.has(eventId)) continue;

        // Apply date filter - only future/current events
        const eventDate = new Date(linkedEvent.event_date);
        eventDate.setHours(0, 0, 0, 0);
        if (eventDate < today) continue;

        const actualEventDate = linkedEvent.event_date;
        const actualSchoolName = linkedEvent.school_name;

        // Query Classes table to get classes for this event
        const classRecords = await this.base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${eventId.replace(/'/g, "\\'")}'`,
            returnFieldsByFieldId: true,
          })
          .all();

        // Get songs and audio files for this event
        const songs = await this.getSongsByEventId(eventId);
        const audioFiles = await this.getAudioFilesByEventId(eventId);

        // Build class views from Classes table
        const classViews: TeacherClassView[] = [];
        for (const classRecord of classRecords) {
          const classId = classRecord.fields[CLASSES_FIELD_IDS.class_id] as string;
          const className = classRecord.fields[CLASSES_FIELD_IDS.class_name] as string;
          const numChildren = classRecord.fields[CLASSES_FIELD_IDS.total_children] as number | undefined;
          const isDefault = Boolean(classRecord.fields[CLASSES_FIELD_IDS.is_default]);

          const classSongs = songs.filter((s) => s.classId === classId);
          const classAudioFiles = audioFiles.filter((a) => a.classId === classId);

          classViews.push({
            classId,
            className,
            numChildren,
            songs: classSongs,
            audioStatus: {
              hasRawAudio: classAudioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
              hasPreview: classAudioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
              hasFinal: classAudioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
            },
            isDefault,
          });
        }

        // Determine event status
        const eventDateParsed = new Date(actualEventDate);
        const now = new Date();
        const eventDateOnly = new Date(eventDateParsed.getFullYear(), eventDateParsed.getMonth(), eventDateParsed.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const needsSetup = classViews.length === 0;
        let status: 'upcoming' | 'in-progress' | 'completed' | 'needs-setup';
        if (needsSetup) {
          status = 'needs-setup';
        } else if (eventDateOnly > nowDateOnly) {
          status = 'upcoming';
        } else if (eventDateOnly.getTime() === nowDateOnly.getTime()) {
          status = 'in-progress';
        } else {
          status = 'completed';
        }

        // Calculate progress metrics
        const classesCount = classViews.length;
        const songsCount = songs.length;

        let registrationsCount = 0;
        try {
          const registrationRecords = await this.base(PARENT_JOURNEY_TABLE)
            .select({
              filterByFormula: `AND({${AIRTABLE_FIELD_IDS.booking_id}} = '${eventId.replace(/'/g, "\\'")}', {${AIRTABLE_FIELD_IDS.registered_child}} != '')`,
            })
            .all();
          registrationsCount = registrationRecords.length;
        } catch (err) {
          console.warn('Could not get registration count:', err);
        }

        const totalChildrenExpected = classViews.reduce((sum, cls) => sum + (cls.numChildren || 0), 0);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilEvent = Math.floor((eventDateParsed.getTime() - now.getTime()) / msPerDay);
        const weeksUntilEvent = Math.round(daysUntilEvent / 7);
        const SONGS_PER_CLASS = 1;
        const expectedSongs = classesCount * SONGS_PER_CLASS;

        events.push({
          eventId,
          schoolName: actualSchoolName,
          eventDate: actualEventDate,
          eventType: linkedEvent.event_type || 'MiniMusiker Day',
          classes: classViews,
          status,
          simplybookHash: undefined,  // No booking for directly linked events
          bookingRecordId: undefined, // No booking for directly linked events
          progress: {
            classesCount,
            expectedClasses: undefined,
            songsCount,
            expectedSongs,
            registrationsCount,
            totalChildrenExpected: totalChildrenExpected > 0 ? totalChildrenExpected : undefined,
            daysUntilEvent,
            weeksUntilEvent,
          },
        });

        processedEventIds.add(eventId);
      }

      // Sort by date (upcoming first)
      events.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

      return events;
    } catch (error) {
      console.error('Error getting teacher events:', error);
      return [];
    }
  }

  /**
   * Get a single event detail for teacher
   */
  async getTeacherEventDetail(eventId: string, teacherEmail: string): Promise<TeacherEventView | null> {
    const events = await this.getTeacherEvents(teacherEmail);
    return events.find((e) => e.eventId === eventId) || null;
  }
}

// Export singleton instance getter
export function getTeacherService(): TeacherService {
  return TeacherService.getInstance();
}

// Export standalone function for updating teacher school info
export async function updateTeacherSchoolInfo(
  teacherEmail: string,
  data: { address?: string; phone?: string }
): Promise<void> {
  const service = TeacherService.getInstance();
  return service.updateTeacherSchoolInfo(teacherEmail, data);
}

// Export standalone function for updating school booking info
// This ensures admin view stays in sync with teacher portal updates
export async function updateSchoolBookingInfo(
  teacherEmail: string,
  data: { address?: string; phone?: string }
): Promise<void> {
  const service = TeacherService.getInstance();
  return service.updateSchoolBookingInfo(teacherEmail, data);
}

// Export standalone function for updating a specific booking by ID
// Used when teacher edits address/phone for a specific event (not all bookings)
// Also supports raw field ID updates for admin refresh API
export function updateSchoolBookingById(
  bookingId: string,
  data: { address?: string; phone?: string }
): Promise<void>;
export function updateSchoolBookingById(
  bookingId: string,
  data: Record<string, string | number>
): Promise<void>;
export function updateSchoolBookingById(
  bookingId: string,
  data: { address?: string; phone?: string } | Record<string, string | number>
): Promise<void> {
  const service = TeacherService.getInstance();
  return service.updateSchoolBookingById(bookingId, data);
}

export default TeacherService;
