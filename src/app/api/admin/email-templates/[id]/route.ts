/**
 * Single Email Template Admin API
 *
 * @route GET /api/admin/email-templates/[id] - Get a single template
 * @route PUT /api/admin/email-templates/[id] - Update a template
 * @route DELETE /api/admin/email-templates/[id] - Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { UpdateEmailTemplateInput } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email-templates/[id]
 * Get a single email template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const airtable = getAirtableService();
    const template = await airtable.getEmailTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Email template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email-templates/[id]
 * Update an email template
 *
 * Body (all optional):
 * - name: string
 * - audience: 'teacher' | 'parent' | 'both'
 * - triggerDays: number
 * - subject: string
 * - bodyHtml: string
 * - active: boolean
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate audience if provided
    if (body.audience !== undefined) {
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
    }

    // Validate triggerDays if provided
    if (body.triggerDays !== undefined && typeof body.triggerDays !== 'number') {
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

    const updateInput: UpdateEmailTemplateInput = {};
    if (body.name !== undefined) updateInput.name = body.name;
    if (body.audience !== undefined) updateInput.audience = body.audience;
    if (body.triggerDays !== undefined) updateInput.triggerDays = body.triggerDays;
    if (body.triggerHour !== undefined) updateInput.triggerHour = body.triggerHour;
    if (body.subject !== undefined) updateInput.subject = body.subject;
    if (body.bodyHtml !== undefined) updateInput.bodyHtml = body.bodyHtml;
    if (body.active !== undefined) updateInput.active = body.active;
    if (body.is_minimusikertag !== undefined) updateInput.is_minimusikertag = body.is_minimusikertag;
    if (body.is_plus !== undefined) updateInput.is_plus = body.is_plus;
    if (body.is_schulsong !== undefined) updateInput.is_schulsong = body.is_schulsong;

    // Normalize: exactly one event-type boolean true when tier fields are present
    if (updateInput.is_plus !== undefined || updateInput.is_minimusikertag !== undefined || updateInput.is_schulsong !== undefined) {
      if (updateInput.is_plus) {
        updateInput.is_minimusikertag = false;
        updateInput.is_schulsong = false;
      } else if (updateInput.is_schulsong) {
        updateInput.is_minimusikertag = false;
        updateInput.is_plus = false;
      } else {
        updateInput.is_minimusikertag = true;
        updateInput.is_plus = false;
        updateInput.is_schulsong = false;
      }
    }

    const airtable = getAirtableService();
    const template = await airtable.updateEmailTemplate(id, updateInput);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Email template not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Email template updated successfully',
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates/[id]
 * Delete an email template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const airtable = getAirtableService();

    // First check if template exists
    const template = await airtable.getEmailTemplateById(id);
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Email template not found' },
        { status: 404 }
      );
    }

    const success = await airtable.deleteEmailTemplate(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete email template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
