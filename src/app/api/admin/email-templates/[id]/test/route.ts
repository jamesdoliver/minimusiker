/**
 * Test Email API
 *
 * @route POST /api/admin/email-templates/[id]/test - Send a test email
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendTestEmail, getPreviewTemplateData, substituteTemplateVariables } from '@/lib/services/emailAutomationService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/email-templates/[id]/test
 * Send a test email using this template
 *
 * Body:
 * - email: string (required) - Email address to send test to
 * - customData: object (optional) - Custom template data to override defaults
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate email
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Send test email
    const result = await sendTestEmail(id, body.email);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send test email',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        previewData: result.previewData,
      },
      message: `Test email sent successfully to ${body.email}`,
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/email-templates/[id]/test
 * Preview a template with sample data (without sending)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const airtable = getAirtableService();
    const template = await airtable.getEmailTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Email template not found' },
        { status: 404 }
      );
    }

    // Generate preview with sample data
    const previewData = getPreviewTemplateData();
    const previewSubject = substituteTemplateVariables(template.subject, previewData);
    const previewBody = substituteTemplateVariables(template.bodyHtml, previewData);

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.name,
          audience: template.audience,
          triggerDays: template.triggerDays,
          active: template.active,
        },
        preview: {
          subject: previewSubject,
          body: previewBody,
        },
        sampleData: previewData,
        availableVariables: Object.keys(previewData),
      },
    });
  } catch (error) {
    console.error('Error previewing email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to preview email template' },
      { status: 500 }
    );
  }
}
