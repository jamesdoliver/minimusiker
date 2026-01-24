/**
 * Single Email Template Admin API
 *
 * @route GET /api/admin/email-templates/[id] - Get a single template
 * @route PUT /api/admin/email-templates/[id] - Update a template
 * @route DELETE /api/admin/email-templates/[id] - Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
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
    const { id } = await params;
    const body = await request.json();

    // Validate audience if provided
    if (body.audience !== undefined && !['teacher', 'parent', 'both'].includes(body.audience)) {
      return NextResponse.json(
        { success: false, error: 'Invalid audience. Must be "teacher", "parent", or "both"' },
        { status: 400 }
      );
    }

    // Validate triggerDays if provided
    if (body.triggerDays !== undefined && typeof body.triggerDays !== 'number') {
      return NextResponse.json(
        { success: false, error: 'triggerDays must be a number' },
        { status: 400 }
      );
    }

    const updateInput: UpdateEmailTemplateInput = {};
    if (body.name !== undefined) updateInput.name = body.name;
    if (body.audience !== undefined) updateInput.audience = body.audience;
    if (body.triggerDays !== undefined) updateInput.triggerDays = body.triggerDays;
    if (body.subject !== undefined) updateInput.subject = body.subject;
    if (body.bodyHtml !== undefined) updateInput.bodyHtml = body.bodyHtml;
    if (body.active !== undefined) updateInput.active = body.active;

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
