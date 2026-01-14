import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { generateClassId } from '@/lib/utils/eventIdentifiers';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { validateEventCreation, sanitizeString } from '@/lib/utils/validators';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
} from '@/lib/types/airtable';

interface ClassInput {
  className: string;
  totalChildren?: number;
}

interface CreateEventRequest {
  schoolName: string;
  eventDate: string;
  eventType: string;
  mainTeacher: string;
  otherTeachers?: string[];
  classes: ClassInput[];
}

interface CreatedClass {
  classId: string;
  className: string;
  totalChildren?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateEventRequest = await request.json();

    // Validate request data
    const validation = validateEventCreation({
      schoolName: body.schoolName,
      eventDate: body.eventDate,
      eventType: body.eventType,
      mainTeacher: body.mainTeacher,
      otherTeachers: body.otherTeachers,
      classes: body.classes,
    });

    if (!validation.valid) {
      console.error('Event creation validation failed:', {
        errors: validation.errors,
        requestData: {
          schoolName: body.schoolName,
          eventDate: body.eventDate,
          eventType: body.eventType,
          mainTeacher: body.mainTeacher,
          classCount: body.classes?.length,
        }
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent XSS
    const sanitizedSchoolName = sanitizeString(body.schoolName);
    const sanitizedMainTeacher = sanitizeString(body.mainTeacher);
    const sanitizedOtherTeachers = body.otherTeachers?.map((t) => sanitizeString(t));
    const sanitizedClasses = body.classes.map((c) => ({
      className: sanitizeString(c.className),
      totalChildren: c.totalChildren,
    }));

    // Generate booking_id (event-level identifier) using sanitized data
    const bookingId = generateEventId(
      sanitizedSchoolName,
      body.eventType || 'concert',
      body.eventDate
    );

    // Generate class_ids for each class and store the mapping
    // NOTE: Children are NOT created at this stage. Child records are created
    // when parents register (as rows in parent_journey_table with the registered_child field)
    const createdClasses: CreatedClass[] = [];

    for (const classInput of sanitizedClasses) {
      const classId = generateClassId(
        sanitizedSchoolName,
        body.eventDate,
        classInput.className
      );

      createdClasses.push({
        classId,
        className: classInput.className,
        totalChildren: classInput.totalChildren,
      });

      // Update existing records or prepare for future parent records
      // This assigns the class_id to any existing parent records matching this criteria
      try {
        const updatedCount = await getAirtableService().assignClassIdToRecords(
          sanitizedSchoolName,
          body.eventDate,
          classInput.className,
          classId
        );

        console.log(`Assigned class_id ${classId} to ${updatedCount} existing records`);
      } catch (error) {
        console.error(`Error assigning class_id for ${classInput.className}:`, error);
        // Continue even if this fails - the class_id will be assigned when parent records are created
      }
    }

    // Format other teachers as comma-separated string for Airtable
    const otherTeachersStr = sanitizedOtherTeachers && sanitizedOtherTeachers.length > 0
      ? sanitizedOtherTeachers.join(', ')
      : undefined;

    // Create placeholder records in parent_journey_table for each class
    // These allow the event to appear in the admin list before parents register
    const placeholderRecords = createdClasses.map((cls) => ({
      parent_id: 'PLACEHOLDER', // Special ID to identify event placeholders
      parent_email: '', // Empty - this is not a real parent registration
      parent_first_name: '', // Empty
      parent_telephone: '', // Empty
      registered_child: '', // Empty - no child registered yet
      booking_id: bookingId,
      class_id: cls.classId,
      school_name: sanitizedSchoolName,
      event_type: body.eventType,
      booking_date: body.eventDate,
      class: cls.className,
      main_teacher: sanitizedMainTeacher,
      other_teachers: otherTeachersStr || '',
      total_children: cls.totalChildren,
    }));

    try {
      await getAirtableService().createBulkParentJourneys(placeholderRecords);
      console.log(`Created ${placeholderRecords.length} placeholder records for event`);

      // Optional verification - don't fail if records aren't immediately queryable
      // Airtable sometimes has a slight delay before new records are searchable
      try {
        const verifyClasses = await getAirtableService().getClassesByBookingId(bookingId);
        if (verifyClasses.length > 0) {
          console.log(`Verified ${verifyClasses.length} classes created for booking ${bookingId}`);
        } else {
          console.log(`Warning: Verification query returned 0 classes, but records were created successfully. This may be due to Airtable indexing delay.`);
        }
      } catch (verifyError) {
        console.log(`Warning: Could not verify records immediately after creation (this is usually OK):`, verifyError);
      }
    } catch (error) {
      console.error('Error creating placeholder records:', error);
      // Return error response instead of silently failing
      return NextResponse.json(
        {
          error: 'Event IDs generated but failed to save to database',
          details: error instanceof Error ? error.message : 'Unknown error',
          partialSuccess: {
            bookingId,
            classes: createdClasses,
            message: 'Event identifiers were created but not saved to Airtable. Please check Airtable configuration.',
          },
        },
        { status: 500 }
      );
    }

    // Also create records in normalized tables (Events + Classes)
    // This ensures orders can link to Event and Class records
    let eventRecordId: string | null = null;

    try {
      const Airtable = require('airtable');
      const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
        .base(process.env.AIRTABLE_BASE_ID!);

      // Create Event record in normalized Events table
      const eventRecord = await base(EVENTS_TABLE_ID).create([{
        fields: {
          [EVENTS_FIELD_IDS.event_id]: bookingId, // Using bookingId as event_id
          [EVENTS_FIELD_IDS.school_name]: sanitizedSchoolName,
          [EVENTS_FIELD_IDS.event_date]: body.eventDate,
          [EVENTS_FIELD_IDS.legacy_booking_id]: bookingId,
        },
      }]);

      eventRecordId = eventRecord[0].id;
      console.log(`Created Event record in normalized table: ${eventRecordId}`);

      // Create Class records in normalized Classes table (linked to Event)
      for (const cls of createdClasses) {
        const classFields: Record<string, unknown> = {
          [CLASSES_FIELD_IDS.class_id]: cls.classId,
          [CLASSES_FIELD_IDS.event_id]: [eventRecordId], // Linked record
          [CLASSES_FIELD_IDS.class_name]: cls.className,
          [CLASSES_FIELD_IDS.main_teacher]: sanitizedMainTeacher,
          [CLASSES_FIELD_IDS.other_teachers]: otherTeachersStr || '',
          [CLASSES_FIELD_IDS.legacy_booking_id]: bookingId,
        };
        // Only add total_children if it's a positive number
        if (cls.totalChildren && cls.totalChildren > 0) {
          classFields[CLASSES_FIELD_IDS.total_children] = cls.totalChildren;
        }
        await base(CLASSES_TABLE_ID).create([{ fields: classFields }]);
        console.log(`Created Class record in normalized table: ${cls.classId}`);
      }
    } catch (normalizedError) {
      // Log but don't fail - parent_journey_table records were created successfully
      console.error('Warning: Failed to create normalized table records:', normalizedError);
      console.log('Legacy parent_journey_table records were created successfully, but normalized tables may need manual backfill.');
    }

    // Return success response with generated IDs
    return NextResponse.json(
      {
        success: true,
        bookingId,
        classes: createdClasses,
        message: `Event created successfully with ${createdClasses.length} class(es)`,
        details: {
          schoolName: sanitizedSchoolName,
          eventDate: body.eventDate,
          eventType: body.eventType,
          mainTeacher: sanitizedMainTeacher,
          otherTeachers: sanitizedOtherTeachers,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating event:', error);

    return NextResponse.json(
      {
        error: 'Failed to create event',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve event details (optional)
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'booking_id parameter is required' },
        { status: 400 }
      );
    }

    // Fetch classes for this booking_id
    const classes = await getAirtableService().getClassesByBookingId(bookingId);

    if (classes.length === 0) {
      return NextResponse.json(
        { error: 'Event not found or has no classes' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bookingId,
      classes,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch event details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
