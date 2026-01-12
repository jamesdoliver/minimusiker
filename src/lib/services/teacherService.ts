import Airtable from 'airtable';
import crypto from 'crypto';
import {
  Teacher,
  Song,
  AudioFile,
  SongWithAudio,
  TeacherEventView,
  TeacherClassView,
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
      eventIds: record.fields.events || record.fields[TEACHERS_FIELD_IDS.events],
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
  }): Promise<Teacher> {
    try {
      const record = await this.base(TEACHERS_TABLE).create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        school_name: data.schoolName,
        simplybook_booking_id: data.simplybookBookingId,
        created_at: new Date().toISOString(),
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
  }): Promise<Teacher> {
    let teacher = await this.getTeacherByEmail(data.email);

    if (!teacher) {
      teacher = await this.createTeacher(data);
    }

    return teacher;
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
    if (this.useNormalizedTables()) {
      // NEW: Use linked record field (class_link)
      try {
        // First, find the Classes record by class_id field
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'}`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length === 0) return [];

        const classRecordId = classRecords[0].id;

        // Query Songs table by linked record (class_link)
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{${SONGS_LINKED_FIELD_IDS.class_link}} = '${classRecordId}'`,
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
      // NEW: Use linked record field (event_link)
      try {
        // First, find the Events record by event_id field
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'}`,
          maxRecords: 1,
        }).firstPage();

        if (eventRecords.length === 0) return [];

        const eventRecordId = eventRecords[0].id;

        // Query Songs table by linked record (event_link)
        const records = await this.base(SONGS_TABLE)
          .select({
            filterByFormula: `{${SONGS_LINKED_FIELD_IDS.event_link}} = '${eventRecordId}'`,
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
        // Find Classes record by class_id
        const classRecords = await this.classesTable!.select({
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'}`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[SONGS_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'}`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${eventId.replace(/'/g, "\\'")}'}`,
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
          filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${data.classId.replace(/'/g, "\\'")}'}`,
          maxRecords: 1,
        }).firstPage();

        if (classRecords.length > 0) {
          fields[AUDIO_FILES_LINKED_FIELD_IDS.class_link] = [classRecords[0].id];
        }

        // Find Events record by event_id
        const eventRecords = await this.eventsTable!.select({
          filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = '${data.eventId.replace(/'/g, "\\'")}'}`,
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
   * Creates a placeholder record in parent_journey_table with the class info
   */
  async createClass(data: {
    eventId: string;
    className: string;
    teacherEmail: string;
    teacherName?: string;
    numChildren?: number;
  }): Promise<TeacherClassView> {
    try {
      // First, get an existing record for this event to copy school info
      const existingRecords = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `{booking_id} = '${data.eventId.replace(/'/g, "\\'")}'`,
          maxRecords: 1,
        })
        .all();

      let schoolName = '';
      let eventType = '';
      let bookingDate = '';

      if (existingRecords.length > 0) {
        const existing = existingRecords[0];
        schoolName = (existing.fields.school_name || existing.fields[AIRTABLE_FIELD_IDS.school_name] || '') as string;
        eventType = (existing.fields.event_type || existing.fields[AIRTABLE_FIELD_IDS.event_type] || '') as string;
        bookingDate = (existing.fields.booking_date || existing.fields[AIRTABLE_FIELD_IDS.booking_date] || '') as string;
      }

      // Generate a unique class_id
      const classId = `${data.eventId}_class_${Date.now()}`;

      // Create a placeholder record for this class
      // This record serves as the class definition (no child registered yet)
      const record = await this.base(PARENT_JOURNEY_TABLE).create({
        [AIRTABLE_FIELD_IDS.booking_id]: data.eventId,
        [AIRTABLE_FIELD_IDS.class_id]: classId,
        [AIRTABLE_FIELD_IDS.class]: data.className,
        [AIRTABLE_FIELD_IDS.school_name]: schoolName,
        [AIRTABLE_FIELD_IDS.event_type]: eventType,
        [AIRTABLE_FIELD_IDS.booking_date]: bookingDate,
        [AIRTABLE_FIELD_IDS.parent_email]: data.teacherEmail,
        [AIRTABLE_FIELD_IDS.main_teacher]: data.teacherName || '',
        [AIRTABLE_FIELD_IDS.total_children]: data.numChildren || 0,
        // Placeholder values for required fields
        [AIRTABLE_FIELD_IDS.registered_child]: '',
        [AIRTABLE_FIELD_IDS.parent_first_name]: '',
        [AIRTABLE_FIELD_IDS.parent_telephone]: '',
        [AIRTABLE_FIELD_IDS.parent_id]: '',
      });

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
      // Find all records with this class_id and update them
      const records = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
        })
        .all();

      if (records.length === 0) {
        throw new Error('Class not found');
      }

      // Update each record with the new class info
      const updates: any = {};
      if (data.className !== undefined) updates[AIRTABLE_FIELD_IDS.class] = data.className;
      if (data.numChildren !== undefined) updates[AIRTABLE_FIELD_IDS.total_children] = data.numChildren;

      for (const record of records) {
        await this.base(PARENT_JOURNEY_TABLE).update(record.id, updates);
      }
    } catch (error) {
      console.error('Error updating class:', error);
      throw new Error(`Failed to update class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a class (only if no children registered and no songs)
   */
  async deleteClass(classId: string): Promise<void> {
    try {
      // Find all records with this class_id
      const records = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
        })
        .all();

      if (records.length === 0) {
        throw new Error('Class not found');
      }

      // Check if any record has registered children
      const hasRegisteredChildren = records.some((r) => {
        const childName = r.fields.registered_child || r.fields[AIRTABLE_FIELD_IDS.registered_child];
        return childName && (childName as string).trim() !== '';
      });

      if (hasRegisteredChildren) {
        throw new Error('Cannot delete class with registered children');
      }

      // Check if class has any songs
      const songs = await this.getSongsByClassId(classId);
      if (songs.length > 0) {
        throw new Error('Cannot delete class with songs. Remove songs first.');
      }

      // Delete all records for this class
      for (const record of records) {
        await this.base(PARENT_JOURNEY_TABLE).destroy(record.id);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      throw new Error(`Failed to delete class: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Query parent_journey_table for events where this teacher is the contact
      // We'll group by booking_id to get unique events
      const records = await this.base(PARENT_JOURNEY_TABLE)
        .select({
          filterByFormula: `LOWER({parent_email}) = LOWER('${teacherEmail.replace(/'/g, "\\'")}')`,
        })
        .all();

      // Group by booking_id
      const eventMap = new Map<
        string,
        {
          eventId: string;
          schoolName: string;
          eventDate: string;
          eventType: string;
          classes: Map<string, { classId: string; className: string; numChildren?: number }>;
        }
      >();

      for (const record of records) {
        const eventId = record.fields.booking_id || record.fields[AIRTABLE_FIELD_IDS.booking_id];
        const classId = record.fields.class_id || record.fields[AIRTABLE_FIELD_IDS.class_id];

        if (!eventId) continue;

        if (!eventMap.has(eventId as string)) {
          eventMap.set(eventId as string, {
            eventId: eventId as string,
            schoolName: (record.fields.school_name || record.fields[AIRTABLE_FIELD_IDS.school_name] || '') as string,
            eventDate: (record.fields.booking_date || record.fields[AIRTABLE_FIELD_IDS.booking_date] || '') as string,
            eventType: (record.fields.event_type || record.fields[AIRTABLE_FIELD_IDS.event_type] || '') as string,
            classes: new Map(),
          });
        }

        const event = eventMap.get(eventId as string)!;
        if (classId && !event.classes.has(classId as string)) {
          event.classes.set(classId as string, {
            classId: classId as string,
            className: (record.fields.class || record.fields[AIRTABLE_FIELD_IDS.class] || '') as string,
            numChildren: (record.fields.total_children ||
              record.fields[AIRTABLE_FIELD_IDS.total_children]) as number | undefined,
          });
        }
      }

      // Build TeacherEventView array
      const events: TeacherEventView[] = [];

      for (const [eventId, eventData] of eventMap) {
        // Lookup SchoolBooking to get the current date (source of truth)
        // This ensures date changes by admin are reflected immediately
        const schoolBooking = await getAirtableService().getSchoolBookingBySimplybookId(eventId);
        const actualEventDate = schoolBooking?.startDate || eventData.eventDate;

        // Get songs and audio files for this event
        const songs = await this.getSongsByEventId(eventId);
        const audioFiles = await this.getAudioFilesByEventId(eventId);

        // Build class views
        const classViews: TeacherClassView[] = [];
        for (const [classId, classData] of eventData.classes) {
          const classSongs = songs.filter((s) => s.classId === classId);
          const classAudioFiles = audioFiles.filter((a) => a.classId === classId);

          classViews.push({
            classId: classData.classId,
            className: classData.className,
            numChildren: classData.numChildren,
            songs: classSongs,
            audioStatus: {
              hasRawAudio: classAudioFiles.some((a) => a.type === 'raw' && a.status === 'ready'),
              hasPreview: classAudioFiles.some((a) => a.type === 'preview' && a.status === 'ready'),
              hasFinal: classAudioFiles.some((a) => a.type === 'final' && a.status === 'ready'),
            },
          });
        }

        // Determine event status - Use date-only comparison to avoid timezone issues
        const eventDate = new Date(actualEventDate);
        const now = new Date();

        // Normalize both dates to start of day in local timezone
        // This strips time component and avoids UTC conversion issues
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

        let status: 'upcoming' | 'in-progress' | 'completed';
        if (eventDateOnly > nowDateOnly) {
          status = 'upcoming';
        } else if (eventDateOnly.getTime() === nowDateOnly.getTime()) {
          status = 'in-progress';
        } else {
          status = 'completed';
        }

        // Calculate progress metrics
        const classesCount = eventData.classes.size;
        const songsCount = songs.length;

        // Check if school logo is uploaded
        let hasLogo = false;
        try {
          const einrichtung = await getAirtableService().getEinrichtungForTeacher(teacherEmail, eventData.schoolName);
          hasLogo = !!(einrichtung?.logoUrl);
        } catch (error) {
          console.error('Error checking logo status:', error);
        }

        // Count registrations for this event
        const eventRecords = records.filter(
          (r) => (r.fields.booking_id || r.fields[AIRTABLE_FIELD_IDS.booking_id]) === eventId
        );
        const registrationsCount = eventRecords.length;

        // Calculate total expected children (sum of total_children from all classes)
        const totalChildrenExpected = Array.from(eventData.classes.values()).reduce(
          (sum, classData) => sum + (classData.numChildren || 0),
          0
        );

        // Calculate days and weeks until event
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / msPerDay);
        const weeksUntilEvent = Math.round(daysUntilEvent / 7);

        // Expected songs: default to 1 song per class (can be configured later)
        const SONGS_PER_CLASS = 1;
        const expectedSongs = classesCount * SONGS_PER_CLASS;

        events.push({
          eventId: eventData.eventId,
          schoolName: eventData.schoolName,
          eventDate: actualEventDate,
          eventType: eventData.eventType,
          classes: classViews,
          status,
          simplybookHash: schoolBooking?.simplybookHash,
          progress: {
            classesCount,
            expectedClasses: undefined, // TODO: Get from booking config when available
            songsCount,
            expectedSongs,
            hasLogo,
            registrationsCount,
            totalChildrenExpected: totalChildrenExpected > 0 ? totalChildrenExpected : undefined,
            daysUntilEvent,
            weeksUntilEvent,
          },
        });
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

export default TeacherService;
