import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getAirtableService } from '@/lib/services/airtableService';
import { getEmailService } from '@/lib/services/emailService';
import { ParentSession } from '@/lib/types/airtable';
import {
  RegistrationRequest,
  RegistrationResponse,
  RegistrationErrorResponse,
} from '@/lib/types/registration';
import {
  validateRegistrationData,
  sanitizeRegistrationData,
} from '@/lib/validators/registrationValidators';
import { generateSchoolId } from '@/lib/utils/eventIdentifiers';

const PARENT_JWT_SECRET =
  process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';
const PARENT_SESSION_DURATION = parseInt(
  process.env.PARENT_SESSION_DURATION || '604800'
); // 7 days

/**
 * Generate a unique parent_id based on email
 */
function generateParentId(email: string): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex').substring(0, 8);
  return `PAR-${hash}`;
}

/**
 * Parent Registration API Route
 *
 * Handles new parent registrations from the registration form.
 * Creates child records as rows in parent_journey_table and automatically logs in the parent.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: RegistrationRequest = await request.json();

    // Validate registration data
    const validation = validateRegistrationData(body);
    if (!validation.valid) {
      return NextResponse.json<RegistrationErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent XSS
    const sanitizedData = sanitizeRegistrationData(body);

    // Step 1: Validate that event and class exist
    const eventDetails = await getAirtableService().getEventAndClassDetails(
      sanitizedData.eventId,
      sanitizedData.classId
    );

    if (!eventDetails) {
      return NextResponse.json<RegistrationErrorResponse>(
        {
          success: false,
          error:
            'Invalid event or class ID. Please contact your school for the correct registration link.',
        },
        { status: 400 }
      );
    }

    // Step 2: Check if parent is already registered for this event
    const isAlreadyRegistered = await getAirtableService().isParentRegisteredForEvent(
      sanitizedData.parentEmail,
      sanitizedData.eventId
    );

    if (isAlreadyRegistered) {
      // Don't error - just log them in instead!
      // Fetch their existing records to create session
      const existingRecords = await getAirtableService().getParentRecordsByEmail(
        sanitizedData.parentEmail
      );

      const mostRecentRecord = existingRecords[0];

      // Use the actual booking_id from the database as the event identifier
      // Do NOT regenerate - hash variations cause event_id linking failures
      const eventId = mostRecentRecord.booking_id;
      const schoolId = generateSchoolId(mostRecentRecord.school_name);

      // Create children array from existing records
      const children = existingRecords.map((record) => ({
        childName: record.registered_child,
        bookingId: record.booking_id,
        classId: record.class_id,
        class: record.class,
        eventId: record.booking_id, // Use actual booking_id, not generated ID
        schoolName: record.school_name,
        eventType: record.event_type,
        bookingDate: record.booking_date,
      }));

      // Create session
      const sessionData: ParentSession = {
        parentId: mostRecentRecord.parent_id,
        email: mostRecentRecord.parent_email,
        firstName: mostRecentRecord.parent_first_name,
        bookingId: mostRecentRecord.booking_id,
        schoolName: mostRecentRecord.school_name,
        eventType: mostRecentRecord.event_type,
        childName: mostRecentRecord.registered_child,
        bookingDate: mostRecentRecord.booking_date,
        eventId,
        schoolId,
        children,
        loginTimestamp: Date.now(),
      };

      // Create JWT token
      const token = jwt.sign(sessionData, PARENT_JWT_SECRET, {
        expiresIn: PARENT_SESSION_DURATION,
      });

      const response = NextResponse.json<RegistrationResponse>({
        success: true,
        data: {
          session: sessionData,
          redirectUrl: '/familie',
        },
        message: "You're already registered! Logging you in...",
      });

      // Set HTTP-only cookie
      response.cookies.set('parent_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: PARENT_SESSION_DURATION,
        path: '/',
      });

      return response;
    }

    // Step 3: Generate or reuse parent_id
    const existingParent = await getAirtableService().getParentByEmail(
      sanitizedData.parentEmail
    );
    const parentId = existingParent?.parent_id || generateParentId(sanitizedData.parentEmail);

    // Step 4: Create parent_journey records (one per child)
    const recordsToCreate = sanitizedData.children.map((child) => ({
      parent_id: parentId,
      parent_email: sanitizedData.parentEmail,
      parent_first_name: sanitizedData.parentFirstName,
      parent_telephone: sanitizedData.parentPhone || '',
      booking_id: sanitizedData.eventId,
      class_id: sanitizedData.classId,
      school_name: eventDetails.schoolName,
      event_type: eventDetails.eventType,
      booking_date: eventDetails.bookingDate,
      class: eventDetails.className,
      main_teacher: eventDetails.teacherName,
      other_teachers: eventDetails.otherTeachers || '',
      registered_child: child.childName,
      // Store grade level in notes field or add a new field in Airtable if needed
      // For now, we'll just use the child name
    }));

    const createdRecords = await getAirtableService().createBulkParentJourneys(
      recordsToCreate
    );

    // Step 5: Generate session data
    // Use the canonical booking_id from the validated event
    // Do NOT regenerate - hash variations cause event_id linking failures
    const eventId = sanitizedData.eventId;
    const schoolId = generateSchoolId(eventDetails.schoolName);

    // Create children array for session
    const sessionChildren = sanitizedData.children.map((child) => ({
      childName: child.childName,
      bookingId: sanitizedData.eventId,
      classId: sanitizedData.classId,
      class: eventDetails.className,
      eventId: sanitizedData.eventId, // Use canonical booking_id
      schoolName: eventDetails.schoolName,
      eventType: eventDetails.eventType,
      bookingDate: eventDetails.bookingDate,
    }));

    const sessionData: ParentSession = {
      parentId,
      email: sanitizedData.parentEmail,
      firstName: sanitizedData.parentFirstName,
      bookingId: sanitizedData.eventId,
      schoolName: eventDetails.schoolName,
      eventType: eventDetails.eventType,
      childName: sanitizedData.children[0].childName, // Use first child for legacy field
      bookingDate: eventDetails.bookingDate,
      eventId,
      schoolId,
      children: sessionChildren,
      loginTimestamp: Date.now(),
    };

    // Step 6: Create JWT token
    const token = jwt.sign(sessionData, PARENT_JWT_SECRET, {
      expiresIn: PARENT_SESSION_DURATION,
    });

    // Step 7: Send welcome email (fire and forget - don't block registration)
    try {
      await getEmailService().sendParentWelcome(sanitizedData.parentEmail, {
        parentName: sanitizedData.parentFirstName,
        childName: sanitizedData.children.map(c => c.childName).join(', '),
        schoolName: eventDetails.schoolName,
      });
      console.log('[parent-register] Welcome email sent to:', sanitizedData.parentEmail);
    } catch (emailError) {
      // Log but don't fail registration if email fails
      console.error('[parent-register] Failed to send welcome email:', emailError);
    }

    // Step 8: Return success with session
    const response = NextResponse.json<RegistrationResponse>(
      {
        success: true,
        data: {
          session: sessionData,
          redirectUrl: '/familie',
        },
        message: 'Registration successful! Welcome to MiniMusiker.',
      },
      { status: 201 }
    );

    // Set HTTP-only cookie
    response.cookies.set('parent_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PARENT_SESSION_DURATION,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during parent registration:', error);

    return NextResponse.json<RegistrationErrorResponse>(
      {
        success: false,
        error: 'An error occurred during registration. Please try again.',
      },
      { status: 500 }
    );
  }
}
