/**
 * Email Template Dry Run API
 *
 * @route GET /api/admin/email-templates/[id]/dry-run
 *
 * Returns real recipient data showing how many people would receive this email today
 * based on actual events in Airtable matching the template's trigger threshold.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  getEventsHittingThreshold,
  getRecipientsForEvent,
  eventMatchesTemplate,
} from '@/lib/services/emailAutomationService';
import { EmailRecipient, Audience } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

interface DryRunEventMatch {
  eventId: string;
  schoolName: string;
  eventDate: string;
  daysUntilEvent: number;
}

interface DryRunTeacherRecipient {
  email: string;
  name: string | undefined;
  eventId: string;
}

interface DryRunParentRecipient {
  email: string;
  name: string | undefined;
  eventId: string;
  childName: string | undefined;
}

interface DryRunNonBuyerRecipient {
  email: string;
  name: string | undefined;
  eventId: string;
  childName: string | undefined;
}

interface DryRunResponse {
  success: boolean;
  data?: {
    template: {
      id: string;
      name: string;
      triggerDays: number;
      audience: Audience;
    };
    matchingEvents: DryRunEventMatch[];
    recipients: {
      teachers: DryRunTeacherRecipient[];
      parents: DryRunParentRecipient[];
      nonBuyers: DryRunNonBuyerRecipient[];
    };
    summary: {
      totalEvents: number;
      totalRecipients: number;
      teacherCount: number;
      parentCount: number;
      nonBuyerCount: number;
    };
  };
  error?: string;
}

/**
 * GET /api/admin/email-templates/[id]/dry-run
 * Get real recipient data for a template based on events matching today's threshold
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DryRunResponse>> {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const airtable = getAirtableService();

    // Get the template
    const template = await airtable.getEmailTemplateById(id);
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Email template not found' },
        { status: 404 }
      );
    }

    // Get events matching this template's trigger threshold
    const allEvents = await getEventsHittingThreshold(template.triggerDays);
    const events = allEvents.filter(e => eventMatchesTemplate(e, template));

    // Transform events to response format
    const matchingEvents: DryRunEventMatch[] = events.map((event) => ({
      eventId: event.eventId,
      schoolName: event.schoolName,
      eventDate: event.eventDate,
      daysUntilEvent: event.daysUntilEvent,
    }));

    // Collect all recipients across all matching events
    const allTeachers: DryRunTeacherRecipient[] = [];
    const allParents: DryRunParentRecipient[] = [];
    const allNonBuyers: DryRunNonBuyerRecipient[] = [];
    const seenEmails = new Set<string>();

    for (const event of events) {
      const recipients: EmailRecipient[] = await getRecipientsForEvent(
        event.eventId,
        event.eventRecordId,
        event,
        template.audience
      );

      for (const recipient of recipients) {
        const key = `${recipient.email.toLowerCase()}:${recipient.eventId}`;
        if (seenEmails.has(key)) continue;
        seenEmails.add(key);

        if (recipient.type === 'teacher') {
          allTeachers.push({
            email: recipient.email,
            name: recipient.name,
            eventId: recipient.eventId,
          });
        } else if (recipient.type === 'non-buyer') {
          allNonBuyers.push({
            email: recipient.email,
            name: recipient.name,
            eventId: recipient.eventId,
            childName: recipient.templateData?.child_name,
          });
        } else {
          allParents.push({
            email: recipient.email,
            name: recipient.name,
            eventId: recipient.eventId,
            childName: recipient.templateData?.child_name,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.name,
          triggerDays: template.triggerDays,
          audience: template.audience,
        },
        matchingEvents,
        recipients: {
          teachers: allTeachers,
          parents: allParents,
          nonBuyers: allNonBuyers,
        },
        summary: {
          totalEvents: matchingEvents.length,
          totalRecipients: allTeachers.length + allParents.length + allNonBuyers.length,
          teacherCount: allTeachers.length,
          parentCount: allParents.length,
          nonBuyerCount: allNonBuyers.length,
        },
      },
    });
  } catch (error) {
    console.error('Error running dry-run for email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run dry-run analysis' },
      { status: 500 }
    );
  }
}
