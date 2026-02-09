/**
 * Single Trigger Template Admin API
 *
 * @route GET    /api/admin/trigger-templates/[slug] - Get single trigger template
 * @route PATCH  /api/admin/trigger-templates/[slug] - Update subject, body, active status
 * @route POST   /api/admin/trigger-templates/[slug] - Preview with sample variables
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  getTriggerTemplateBySlug,
  updateTriggerTemplate,
  resetTriggerTemplate,
  getSampleVariables,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/trigger-templates/[slug]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const template = await getTriggerTemplateBySlug(slug);

    if (!template) {
      return NextResponse.json(
        { success: false, error: `Trigger template not found: ${slug}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching trigger template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trigger template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/trigger-templates/[slug]
 * Update subject, bodyHtml, active status, or reset to default.
 *
 * Body:
 * - subject?: string
 * - bodyHtml?: string
 * - active?: boolean
 * - resetToDefault?: boolean (if true, resets subject and body to default)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();

    let updated;
    if (body.resetToDefault) {
      updated = await resetTriggerTemplate(slug);
    } else {
      const updates: { subject?: string; bodyHtml?: string; active?: boolean } = {};
      if (body.subject !== undefined) updates.subject = body.subject;
      if (body.bodyHtml !== undefined) updates.bodyHtml = body.bodyHtml;
      if (body.active !== undefined) updates.active = body.active;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, error: 'No updates provided' },
          { status: 400 }
        );
      }

      updated = await updateTriggerTemplate(slug, updates);
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Trigger template not found: ${slug}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: body.resetToDefault ? 'Template reset to default' : 'Template updated',
    });
  } catch (error) {
    console.error('Error updating trigger template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trigger template' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/trigger-templates/[slug]
 * Preview: render template with sample variables, return rendered HTML.
 *
 * Body (optional):
 * - subject?: string (override for preview)
 * - bodyHtml?: string (override for preview)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json().catch(() => ({}));

    const template = await getTriggerTemplateBySlug(slug);
    if (!template) {
      return NextResponse.json(
        { success: false, error: `Trigger template not found: ${slug}` },
        { status: 404 }
      );
    }

    const sampleVars = getSampleVariables(slug);
    const subjectToRender = body.subject || template.subject;
    const bodyToRender = body.bodyHtml || template.bodyHtml;

    const renderedSubject = renderTriggerTemplate(subjectToRender, sampleVars);
    const renderedHtml = renderFullTriggerEmail(bodyToRender, sampleVars);

    return NextResponse.json({
      success: true,
      data: {
        subject: renderedSubject,
        html: renderedHtml,
        sampleVariables: sampleVars,
      },
    });
  } catch (error) {
    console.error('Error previewing trigger template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to preview trigger template' },
      { status: 500 }
    );
  }
}
