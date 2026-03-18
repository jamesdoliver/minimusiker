import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { createTeacherSessionToken } from '@/lib/auth/verifyTeacherSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { TeacherSession, TEACHER_SESSION_COOKIE } from '@/lib/types/teacher';
import { Event, ParentSession, ParentSessionChild } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

const PARENT_JWT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';
const PREVIEW_SESSION_DURATION = 1800; // 30 minutes

/**
 * Derive event type string from event flags.
 */
function deriveEventType(event: { is_minimusikertag?: boolean; is_plus?: boolean; is_kita?: boolean; is_schulsong?: boolean }): string {
  if (event.is_plus) return 'minimusikertag_plus';
  if (event.is_kita) return 'minimusikertag_kita';
  if (event.is_minimusikertag) return 'minimusikertag';
  if (event.is_schulsong) return 'schulsong';
  return 'minimusikertag';
}

/**
 * POST /api/admin/preview-session
 * Mints a short-lived JWT session for teacher or parent portals,
 * setting the cookie server-side so the admin can preview portals.
 */
export async function POST(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const { type, eventId, parentId } = body as {
      type: 'teacher' | 'parent';
      eventId: string;
      parentId?: string;
    };

    if (!type || !eventId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, eventId' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Look up the event
    const event = await airtableService.getEventByEventId(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    if (type === 'teacher') {
      return await handleTeacherPreview(airtableService, event, eventId);
    } else if (type === 'parent') {
      return await handleParentPreview(airtableService, event, eventId, parentId);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "teacher" or "parent".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating preview session:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create preview session',
      },
      { status: 500 }
    );
  }
}

/**
 * Create a teacher preview session.
 */
async function handleTeacherPreview(
  airtableService: ReturnType<typeof getAirtableService>,
  event: Event,
  eventId: string
) {
  // Get contact person email from the linked booking
  let contactEmail = '';
  let contactName = '';

  if (event.simplybook_booking?.[0]) {
    const booking = await airtableService.getSchoolBookingById(event.simplybook_booking[0]);
    if (booking) {
      contactEmail = booking.schoolContactEmail || '';
      contactName = booking.schoolContactName || '';
    }
  }

  const session: TeacherSession = {
    teacherId: event.id,
    email: contactEmail,
    name: contactName,
    schoolName: event.school_name || '',
    loginTimestamp: Date.now(),
  };

  const token = createTeacherSessionToken(session, PREVIEW_SESSION_DURATION);

  const response = NextResponse.json({
    success: true,
    portalUrl: '/paedagogen',
  });

  response.cookies.set(TEACHER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PREVIEW_SESSION_DURATION,
    path: '/',
  });

  return response;
}

/**
 * Create a parent preview session.
 */
async function handleParentPreview(
  airtableService: ReturnType<typeof getAirtableService>,
  event: Event,
  eventId: string,
  parentId?: string
) {
  if (!parentId) {
    return NextResponse.json(
      { success: false, error: 'parentId is required for parent preview' },
      { status: 400 }
    );
  }

  // Fetch parent record
  const parents = await airtableService.getParentsByIds([parentId]);
  if (parents.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Parent not found' },
      { status: 404 }
    );
  }
  const parent = parents[0];

  // Fetch registrations and classes for the event
  const [registrations, classes] = await Promise.all([
    airtableService.getRegistrationsByEventId(event.id),
    airtableService.getClassesByEventId(event.id),
  ]);

  // Filter registrations to this parent
  const parentRegistrations = registrations.filter(
    (reg) => reg.parent_id?.[0] === parentId
  );

  // Build a class map for quick lookup
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));

  const eventType = deriveEventType(event);

  // Build children array from parent's registrations
  const children: ParentSessionChild[] = parentRegistrations.map((reg) => {
    const cls = reg.class_id?.[0] ? classMap.get(reg.class_id[0]) : undefined;
    return {
      childName: reg.registered_child,
      bookingId: eventId,
      classId: cls?.class_id || '',
      class: cls?.class_name || '',
      eventId: eventId,
      schoolName: event.school_name || '',
      eventType,
      bookingDate: event.event_date,
    };
  });

  const sessionData: ParentSession = {
    parentId: parent.id,
    email: parent.parent_email,
    firstName: parent.parent_first_name || 'Preview',
    bookingId: eventId,
    schoolName: event.school_name || '',
    eventType: children[0]?.eventType || 'minimusikertag',
    childName: children[0]?.childName || 'Unknown',
    bookingDate: event.event_date,
    eventId: eventId,
    children,
    loginTimestamp: Date.now(),
  };

  const token = jwt.sign(sessionData, PARENT_JWT_SECRET, {
    expiresIn: PREVIEW_SESSION_DURATION,
  });

  const response = NextResponse.json({
    success: true,
    portalUrl: '/familie',
  });

  response.cookies.set('parent_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PREVIEW_SESSION_DURATION,
    path: '/',
  });

  return response;
}
