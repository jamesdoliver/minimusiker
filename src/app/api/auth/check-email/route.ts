import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Email Check API
 *
 * Checks if a parent email exists in the system and returns registration status.
 * Used in the email-first registration flow to determine:
 * 1. If parent is new (show full registration form)
 * 2. If parent exists and is registered for this event (redirect to portal)
 * 3. If parent exists but not for this event (pre-fill data)
 *
 * GET /api/auth/check-email?email=X&eventId=Y
 */

export interface EmailCheckResponse {
  exists: boolean;                    // Parent exists in system
  registeredForEvent: boolean;        // Has registrations for this event
  parentData?: {                      // If parent exists
    firstName: string;
    phone: string;
  };
  existingChildren?: Array<{          // Children from all events (for pre-fill)
    name: string;
    eventName?: string;
    className?: string;
  }>;
  childrenForEvent?: Array<{          // Children already registered for this event
    name: string;
    className?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const eventId = searchParams.get('eventId');

    // Validate required parameters
    if (!email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const airtableService = getAirtableService();

    // Get parent with all children
    const { parent, children } = await airtableService.getParentWithChildren(normalizedEmail);

    // Parent doesn't exist - brand new registration
    if (!parent) {
      const response: EmailCheckResponse = {
        exists: false,
        registeredForEvent: false,
      };

      return NextResponse.json<ApiResponse>({
        success: true,
        data: response,
      });
    }

    // Parent exists - check if registered for this specific event
    let registeredForEvent = false;
    let childrenForEvent: Array<{ name: string; className?: string }> = [];

    if (eventId) {
      // Check if parent has children registered for this event
      const eventChildren = await airtableService.getChildrenByParentEmailForEvent(
        normalizedEmail,
        eventId
      );

      registeredForEvent = eventChildren.length > 0;
      childrenForEvent = eventChildren.map(c => ({
        name: c.childName,
        className: c.className,
      }));
    }

    // Build response
    const response: EmailCheckResponse = {
      exists: true,
      registeredForEvent,
      parentData: {
        firstName: parent.parent_first_name || '',
        phone: parent.parent_telephone || '',
      },
      existingChildren: children.map(c => ({
        name: c.childName,
        eventName: c.eventName,
        className: c.className,
      })),
    };

    // Include children for this event if any
    if (childrenForEvent.length > 0) {
      response.childrenForEvent = childrenForEvent;
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error checking email:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to check email. Please try again.',
      },
      { status: 500 }
    );
  }
}
