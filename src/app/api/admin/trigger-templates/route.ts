/**
 * Trigger Templates Admin API
 *
 * @route GET /api/admin/trigger-templates - List all trigger templates (auto-seeds missing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  getAllTriggerTemplates,
  seedMissingTriggerTemplates,
} from '@/lib/services/triggerTemplateService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/trigger-templates
 * Returns all trigger templates merged with registry data.
 * Auto-seeds any missing templates into Airtable.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Auto-seed missing trigger templates
    const seedResult = await seedMissingTriggerTemplates();
    if (seedResult.seeded.length > 0) {
      console.log(`[TriggerTemplates] Seeded ${seedResult.seeded.length} templates:`, seedResult.seeded);
    }

    const templates = await getAllTriggerTemplates();

    return NextResponse.json({
      success: true,
      data: {
        templates,
        total: templates.length,
        seeded: seedResult.seeded,
      },
    });
  } catch (error) {
    console.error('Error fetching trigger templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trigger templates' },
      { status: 500 }
    );
  }
}
