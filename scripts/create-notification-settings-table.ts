/**
 * Script to create the NotificationSettings table in Airtable
 * Run with: npx tsx scripts/create-notification-settings-table.ts
 *
 * This table stores admin notification preferences for booking events.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

async function createNotificationSettingsTable() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  const tableDefinition = {
    name: 'NotificationSettings',
    description: 'Admin notification preferences for booking events (new bookings, date changes, cancellations)',
    fields: [
      {
        name: 'Name',
        type: 'singleLineText',
        description: 'Display name for the notification setting (auto-populated)',
      },
      {
        name: 'type',
        type: 'singleSelect',
        description: 'Type of notification',
        options: {
          choices: [
            { name: 'new_booking', color: 'greenBright' },
            { name: 'date_change', color: 'yellowBright' },
            { name: 'cancellation', color: 'redBright' },
          ],
        },
      },
      {
        name: 'recipientEmails',
        type: 'multilineText',
        description: 'Comma-separated list of email addresses to receive notifications',
      },
      {
        name: 'enabled',
        type: 'checkbox',
        description: 'Whether this notification type is enabled',
        options: {
          icon: 'check',
          color: 'greenBright',
        },
      },
    ],
  };

  console.log('Creating NotificationSettings table...');
  console.log('Table definition:', JSON.stringify(tableDefinition, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tableDefinition),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error creating table:', data);
      process.exit(1);
    }

    console.log('\n✅ Table created successfully!');
    console.log('\nTable ID:', data.id);
    console.log('\nField IDs:');

    const fieldIds: Record<string, string> = {};
    for (const field of data.fields) {
      console.log(`  ${field.name}: '${field.id}'`);
      fieldIds[field.name] = field.id;
    }

    console.log('\n📋 Update these values in src/app/api/admin/settings/notifications/route.ts:\n');
    console.log(`const NOTIFICATION_SETTINGS_TABLE_ID = '${data.id}';`);
    console.log('');
    console.log('const FIELD_IDS = {');
    console.log(`  type: '${fieldIds['type']}',`);
    console.log(`  recipientEmails: '${fieldIds['recipientEmails']}',`);
    console.log(`  enabled: '${fieldIds['enabled']}',`);
    console.log('};');

    console.log('\n📋 Also update src/lib/services/notificationService.ts:\n');
    console.log(`const NOTIFICATION_SETTINGS_TABLE_ID = '${data.id}';`);

    console.log('\n📋 And update src/lib/types/notification-settings.ts:\n');
    console.log(`export const NOTIFICATION_SETTINGS_TABLE_ID = '${data.id}';`);
    console.log('');
    console.log('export const NOTIFICATION_SETTINGS_FIELD_IDS = {');
    console.log(`  type: '${fieldIds['type']}',`);
    console.log(`  recipientEmails: '${fieldIds['recipientEmails']}',`);
    console.log(`  enabled: '${fieldIds['enabled']}',`);
    console.log('} as const;');

  } catch (error) {
    console.error('Failed to create table:', error);
    process.exit(1);
  }
}

createNotificationSettingsTable();
