import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, ParentSession } from '@/lib/types';
import { generateEventId, generateSchoolId } from '@/lib/utils/eventIdentifiers';

/**
 * Parent Login Route
 *
 * IMPORTANT: This route handles authentication for EXISTING parent records.
 * It assumes parent records already exist in parent_journey_table (created during
 * parent registration when they sign up for an event).
 *
 * CHILD CREATION: Children are NOT created separately - they exist as rows in
 * parent_journey_table with the registered_child field populated during registration.
 *
 * When parent registration is implemented, it should:
 * 1. Collect parent email, name, phone, child name, and selected class
 * 2. Create a new row in parent_journey_table (which creates the child record)
 * 3. Set booking_id, class_id from the selected event/class
 * 4. Generate or reuse parent_id based on email
 */

const PARENT_JWT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';
const PARENT_SESSION_DURATION = parseInt(process.env.PARENT_SESSION_DURATION || '604800'); // 7 days in seconds

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email input
    if (!email || typeof email !== 'string') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Please provide a valid email address'
        },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Please provide a valid email address'
        },
        { status: 400 }
      );
    }

    // Look up ALL parent records and get the most recent one
    const allParentRecords = await airtableService.getParentRecordsByEmail(email.toLowerCase().trim());

    if (!allParentRecords || allParentRecords.length === 0) {
      // Email not found - suggest registration
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'We couldn\'t find an account with that email address.',
          data: {
            shouldRegister: true, // Flag for client to redirect to registration
            email: email.toLowerCase().trim(),
          }
        },
        { status: 404 }
      );
    }

    // Get the most recent/relevant event for this parent
    const mostRecentRecord = await airtableService.getMostRecentParentRecord(email.toLowerCase().trim());
    const parentJourney = mostRecentRecord!; // We know it exists from the check above

    // Check if parent has multiple events
    const hasMultipleEvents = allParentRecords.length > 1;

    // Generate unique event ID based on school, event type, and date
    const eventId = generateEventId(
      parentJourney.school_name,
      parentJourney.event_type,
      parentJourney.booking_date
    );

    // Generate school ID for potential future use
    const schoolId = generateSchoolId(parentJourney.school_name);

    // Create children array from ALL parent records
    const children = allParentRecords.map(record => ({
      childName: record.registered_child,
      bookingId: record.booking_id,
      class: record.class,
      eventId: generateEventId(record.school_name, record.event_type, record.booking_date),
      schoolName: record.school_name,
      eventType: record.event_type,
      bookingDate: record.booking_date,
    }));

    // Create parent session data with multi-child support
    const sessionData: ParentSession = {
      parentId: parentJourney.parent_id,
      email: parentJourney.parent_email,
      firstName: parentJourney.parent_first_name,
      // Legacy single-child fields (use most recent for backward compatibility)
      bookingId: parentJourney.booking_id,
      schoolName: parentJourney.school_name,
      eventType: parentJourney.event_type,
      childName: parentJourney.registered_child,
      bookingDate: parentJourney.booking_date,
      eventId, // Add generated event ID
      schoolId, // Add generated school ID
      // Multi-child support
      children,
      loginTimestamp: Date.now(),
    };

    // Create JWT token
    const token = jwt.sign(
      sessionData,
      PARENT_JWT_SECRET,
      { expiresIn: PARENT_SESSION_DURATION }
    );

    // Prepare information about other events if parent has multiple
    let otherEvents = undefined;
    if (hasMultipleEvents) {
      otherEvents = allParentRecords
        .filter(record => record.id !== parentJourney.id) // Exclude current event
        .slice(0, 5) // Limit to 5 other events
        .map(record => ({
          eventId: generateEventId(record.school_name, record.event_type, record.booking_date),
          bookingId: record.booking_id,
          schoolName: record.school_name,
          eventType: record.event_type,
          bookingDate: record.booking_date,
          childName: record.registered_child,
        }));
    }

    // Create response with parent data preview
    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: {
        parent: {
          firstName: parentJourney.parent_first_name,
          email: parentJourney.parent_email,
          phone: parentJourney.parent_telephone,
        },
        school: {
          id: schoolId,
          name: parentJourney.school_name,
          teacher: parentJourney.main_teacher,
          class: parentJourney.class,
        },
        event: {
          id: eventId,
          type: parentJourney.event_type,
          bookingDate: parentJourney.booking_date,
        },
        child: {
          name: parentJourney.registered_child,
        },
        booking: {
          id: parentJourney.booking_id,
          hasOrder: !!parentJourney.order_number,
          orderNumber: parentJourney.order_number,
        },
        // Multi-child support
        children: children.map(child => ({
          name: child.childName,
          class: child.class,
          schoolName: child.schoolName,
          eventId: child.eventId,
          bookingId: child.bookingId,
        })),
        hasMultipleChildren: children.length > 1,
        hasMultipleEvents,
        otherEvents, // Include if parent has multiple events
        redirectUrl: '/parent-portal',
      },
      message: `Welcome back, ${parentJourney.parent_first_name}!`,
    });

    // Set HTTP-only cookie with session token
    response.cookies.set('parent_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PARENT_SESSION_DURATION,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during parent login:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'An error occurred during login. Please try again.'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user is logged in
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('parent_session')?.value;

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    try {
      const decoded = jwt.verify(token, PARENT_JWT_SECRET) as ParentSession;

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          isAuthenticated: true,
          parent: {
            firstName: decoded.firstName,
            email: decoded.email,
            bookingId: decoded.bookingId,
            schoolName: decoded.schoolName,
            childName: decoded.childName,
          },
        },
      });
    } catch (jwtError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error checking parent session:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to check session' },
      { status: 500 }
    );
  }
}