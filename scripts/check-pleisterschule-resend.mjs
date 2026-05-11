#!/usr/bin/env node
import 'dotenv/config';
import Airtable from 'airtable';
import { Resend } from 'resend';

const EVENT_ID = 'evt_pleisterschule_minimusiker_20260603_5874e6';
const RECIPIENT = 'pardonr@pleister.ms.de';

// Get the resend_message_id from email_logs so we can look up the exact send.
const EMAIL_LOGS_TABLE_ID = 'tblxLemlKY8p8cIwS';
const EMAIL_LOGS_F = {
  template_name: 'fldcNHa3GTYmp1mzp',
  event_id: 'fldejWMhTGwxz4Dr8',
  recipient_email: 'fldsg3jsbFjCtCj4O',
  recipient_type: 'fldP4i5NjOFb8n711',
  sent_at: 'fldHi7daVcCWpjrFj',
  status: 'fld0HyrvPQtWQDGTj',
  error_message: 'fldObgfIAwwOjVWJC',
  resend_message_id: 'fldlxL1Dav8yx3NoI',
};

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const resend = new Resend(process.env.RESEND_API_KEY);

console.log(`\n=== Resend audit for ${RECIPIENT} ===\n`);

// 1) Pull email_logs row to get the resend_message_id
const logs = await base(EMAIL_LOGS_TABLE_ID).select({
  filterByFormula: `{${EMAIL_LOGS_F.event_id}} = '${EVENT_ID.replace(/'/g, "\\'")}'`,
  returnFieldsByFieldId: true,
}).all();

if (logs.length === 0) {
  console.log('No email_logs rows for this event.');
  process.exit(0);
}

for (const log of logs) {
  const lf = log.fields;
  const messageId = lf[EMAIL_LOGS_F.resend_message_id];
  console.log(`Log: "${lf[EMAIL_LOGS_F.template_name]}" → ${lf[EMAIL_LOGS_F.recipient_email]}`);
  console.log(`  sent_at:           ${lf[EMAIL_LOGS_F.sent_at]}`);
  console.log(`  log status:        ${lf[EMAIL_LOGS_F.status]}`);
  console.log(`  resend_message_id: ${messageId || '(not stored)'}`);

  if (!messageId) {
    console.log('  ⚠ No Resend message ID stored — cannot look up delivery details\n');
    continue;
  }

  // 2) Ask Resend for the actual delivery state
  try {
    const { data, error } = await resend.emails.get(messageId);
    if (error) {
      console.log(`  ✗ Resend error: ${JSON.stringify(error)}\n`);
      continue;
    }
    console.log('  ── Resend says ──');
    console.log(`  id:           ${data.id}`);
    console.log(`  to:           ${JSON.stringify(data.to)}`);
    console.log(`  from:         ${data.from}`);
    console.log(`  subject:      ${data.subject}`);
    console.log(`  created_at:   ${data.created_at}`);
    console.log(`  last_event:   ${data.last_event}`);
    if (data.bounced_at) console.log(`  bounced_at:   ${data.bounced_at}`);
    if (data.delivered_at) console.log(`  delivered_at: ${data.delivered_at}`);
    if (data.complained_at) console.log(`  complained_at: ${data.complained_at}`);
    if (data.opened_at) console.log(`  opened_at:    ${data.opened_at}`);
    if (data.clicked_at) console.log(`  clicked_at:   ${data.clicked_at}`);
    console.log('');
  } catch (err) {
    console.log(`  ✗ Resend lookup threw: ${err.message}\n`);
  }
}

process.exit(0);
