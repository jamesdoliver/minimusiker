/**
 * Email Templates Admin API
 *
 * @route GET /api/admin/email-templates - List all email templates
 * @route POST /api/admin/email-templates - Create a new email template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { CreateEmailTemplateInput, AudienceValue } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email-templates
 * Get all email templates with optional filtering
 *
 * Query params:
 * - activeOnly: 'true' to only get active templates (default: false)
 * - audience: 'teacher' | 'parent' | 'both' to filter by audience
 */
export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const audienceFilter = searchParams.get('audience') as AudienceValue | null;

    const airtable = getAirtableService();

    let templates = activeOnly
      ? await airtable.getActiveEmailTemplates()
      : await airtable.getAllEmailTemplates();

    // Filter by audience if specified
    if (audienceFilter) {
      templates = templates.filter((t) => t.audience.includes(audienceFilter));
    }

    // Sort by triggerDays (most negative first, i.e., earliest before event)
    templates.sort((a, b) => a.triggerDays - b.triggerDays);

    // Group by audience for UI convenience
    const grouped = {
      teacher: templates.filter((t) => t.audience.includes('teacher')),
      parent: templates.filter((t) => t.audience.includes('parent')),
      'non-buyers': templates.filter((t) => t.audience.includes('non-buyers')),
    };

    return NextResponse.json({
      success: true,
      data: {
        templates,
        grouped,
        total: templates.length,
      },
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-templates
 * Create a new email template
 *
 * Body:
 * - name: string (required)
 * - audience: 'teacher' | 'parent' | 'both' (required)
 * - triggerDays: number (required, negative = before event)
 * - subject: string (required)
 * - bodyHtml: string (required)
 * - active: boolean (optional, defaults to true)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'audience', 'triggerDays', 'subject', 'bodyHtml'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate audience
    const validAudiences = ['teacher', 'parent', 'non-buyers'];
    if (!Array.isArray(body.audience) || body.audience.length === 0) {
      return NextResponse.json(
        { success: false, error: 'audience must be a non-empty array' },
        { status: 400 }
      );
    }
    if (!body.audience.every((a: string) => validAudiences.includes(a))) {
      return NextResponse.json(
        { success: false, error: 'audience values must be "teacher", "parent", and/or "non-buyers"' },
        { status: 400 }
      );
    }

    // Validate triggerDays is a number
    if (typeof body.triggerDays !== 'number') {
      return NextResponse.json(
        { success: false, error: 'triggerDays must be a number' },
        { status: 400 }
      );
    }

    // Validate triggerHour if provided (must be 0-23)
    if (body.triggerHour !== undefined && (typeof body.triggerHour !== 'number' || body.triggerHour < 0 || body.triggerHour > 23)) {
      return NextResponse.json(
        { success: false, error: 'triggerHour must be a number between 0 and 23' },
        { status: 400 }
      );
    }

    const templateInput: CreateEmailTemplateInput = {
      name: body.name,
      audience: body.audience,
      triggerDays: body.triggerDays,
      triggerHour: body.triggerHour,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      active: body.active ?? true,
      is_minimusikertag: body.is_minimusikertag,
      is_kita: false,
      is_plus: body.is_plus,
      is_schulsong: body.is_schulsong,
    };

    const airtable = getAirtableService();
    const template = await airtable.createEmailTemplate(templateInput);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Failed to create email template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Email template created successfully',
    });
  } catch (error) {
    console.error('Error creating email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}
