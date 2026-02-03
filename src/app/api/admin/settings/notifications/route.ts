import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  NotificationSetting,
  NotificationSettingsResponse,
  NotificationSettingsErrorResponse,
  UpdateNotificationSettingRequest,
  UpdateNotificationSettingResponse,
  NotificationType,
} from '@/lib/types/notification-settings';

export const dynamic = 'force-dynamic';

// Airtable table ID
const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';

// Field IDs
const FIELD_IDS = {
  type: 'fldQGEm9CfxtoX9Ix',
  recipientEmails: 'fldc05iI9SDV6F8Wx',
  enabled: 'fldM2w0mGklqKsCbQ',
};

// Default settings to create if none exist
const DEFAULT_SETTINGS: { type: NotificationType; recipientEmails: string; enabled: boolean }[] = [
  { type: 'new_booking', recipientEmails: '', enabled: false },
  { type: 'date_change', recipientEmails: '', enabled: false },
  { type: 'cancellation', recipientEmails: '', enabled: false },
];

/**
 * GET /api/admin/settings/notifications
 * Fetch all notification settings
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<NotificationSettingsResponse | NotificationSettingsErrorResponse>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    // Fetch all notification settings
    const records = await base(NOTIFICATION_SETTINGS_TABLE_ID)
      .select({
        fields: ['type', 'recipientEmails', 'enabled'],
      })
      .all();

    // Transform to NotificationSetting interface
    const settings: NotificationSetting[] = records.map((record) => ({
      id: record.id,
      type: (record.fields['type'] as NotificationType) || 'new_booking',
      recipientEmails: (record.fields['recipientEmails'] as string) || '',
      enabled: (record.fields['enabled'] as boolean) || false,
    }));

    // If no settings exist, create default ones
    if (settings.length === 0) {
      const createdSettings: NotificationSetting[] = [];

      for (const defaultSetting of DEFAULT_SETTINGS) {
        const created = await base(NOTIFICATION_SETTINGS_TABLE_ID).create({
          [FIELD_IDS.type]: defaultSetting.type,
          [FIELD_IDS.recipientEmails]: defaultSetting.recipientEmails,
          [FIELD_IDS.enabled]: defaultSetting.enabled,
        });

        createdSettings.push({
          id: created.id,
          type: defaultSetting.type,
          recipientEmails: defaultSetting.recipientEmails,
          enabled: defaultSetting.enabled,
        });
      }

      return NextResponse.json({
        success: true,
        settings: createdSettings,
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('[NotificationSettings API] Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notification settings',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/notifications
 * Update a notification setting
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<UpdateNotificationSettingResponse | NotificationSettingsErrorResponse>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateNotificationSettingRequest = await request.json();

    // Validate request
    if (!body.type || !['new_booking', 'date_change', 'cancellation'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (body.recipientEmails) {
      const emails = body.recipientEmails.split(',').map((e) => e.trim()).filter(Boolean);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { success: false, error: `Invalid email format: ${email}` },
            { status: 400 }
          );
        }
      }
    }

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    // Find existing setting by type
    const existingRecords = await base(NOTIFICATION_SETTINGS_TABLE_ID)
      .select({
        filterByFormula: `{type} = "${body.type}"`,
        maxRecords: 1,
      })
      .firstPage();

    let setting: NotificationSetting;

    if (existingRecords.length > 0) {
      // Update existing record
      const updated = await base(NOTIFICATION_SETTINGS_TABLE_ID).update(existingRecords[0].id, {
        [FIELD_IDS.recipientEmails]: body.recipientEmails,
        [FIELD_IDS.enabled]: body.enabled,
      });

      setting = {
        id: updated.id,
        type: body.type,
        recipientEmails: body.recipientEmails,
        enabled: body.enabled,
      };
    } else {
      // Create new record
      const created = await base(NOTIFICATION_SETTINGS_TABLE_ID).create({
        [FIELD_IDS.type]: body.type,
        [FIELD_IDS.recipientEmails]: body.recipientEmails,
        [FIELD_IDS.enabled]: body.enabled,
      });

      setting = {
        id: created.id,
        type: body.type,
        recipientEmails: body.recipientEmails,
        enabled: body.enabled,
      };
    }

    console.log(`[NotificationSettings API] Updated setting for ${body.type}`);

    return NextResponse.json({
      success: true,
      setting,
    });
  } catch (error) {
    console.error('[NotificationSettings API] Error updating setting:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notification setting',
      },
      { status: 500 }
    );
  }
}
