/**
 * Create notification setting for schulsong_teacher_approved in Airtable
 * Run once: node scripts/create-schulsong-notification-setting.js
 *
 * This creates a record in the NotificationSettings table so that
 * admin emails are sent when a teacher approves a schulsong.
 */

const Airtable = require('airtable');

const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';

async function createSetting() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables');
    process.exit(1);
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  // First check if the setting already exists
  const existing = await base(NOTIFICATION_SETTINGS_TABLE_ID)
    .select({
      filterByFormula: '{type} = "schulsong_teacher_approved"',
      maxRecords: 1,
    })
    .firstPage();

  if (existing.length > 0) {
    console.log('Setting already exists:', existing[0].id);
    console.log('Type:', existing[0].fields.type);
    console.log('Recipients:', existing[0].fields.recipientEmails);
    console.log('Enabled:', existing[0].fields.enabled);
    return;
  }

  // Get recipients from the new_booking notification as a default
  const bookingSettings = await base(NOTIFICATION_SETTINGS_TABLE_ID)
    .select({
      filterByFormula: '{type} = "new_booking"',
      maxRecords: 1,
    })
    .firstPage();

  const defaultRecipients = bookingSettings[0]?.fields?.recipientEmails || '';

  const record = await base(NOTIFICATION_SETTINGS_TABLE_ID).create({
    type: 'schulsong_teacher_approved',
    recipientEmails: defaultRecipients,
    enabled: true,
  });

  console.log('Notification setting created successfully!');
  console.log('Record ID:', record.id);
  console.log('Type: schulsong_teacher_approved');
  console.log('Recipients:', defaultRecipients);
  console.log('Enabled: true');
}

createSetting().catch(console.error);
