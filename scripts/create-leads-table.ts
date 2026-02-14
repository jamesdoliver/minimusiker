/**
 * Script to create the Leads table in Airtable
 * Run with: npx tsx scripts/create-leads-table.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

// Existing table IDs for linked record fields
const EINRICHTUNGEN_TABLE_ID = 'tblLPUjLnHZ0Y4mdB';
const PERSONEN_TABLE_ID = 'tblu8iWectQaQGTto';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const TEAMS_REGIONEN_TABLE_ID = 'tblQm2nyPKU7k2N2N';

async function createLeadsTable() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  const tableDefinition = {
    name: 'Leads',
    description: 'Sales pipeline for tracking prospective bookings before confirmation',
    fields: [
      {
        name: 'school_name',
        type: 'singleLineText',
        description: 'Name of the school or institution',
      },
      {
        name: 'contact_person',
        type: 'singleLineText',
        description: 'Primary contact person name',
      },
      {
        name: 'contact_email',
        type: 'email',
        description: 'Contact email address',
      },
      {
        name: 'contact_phone',
        type: 'phoneNumber',
        description: 'Contact phone number',
      },
      {
        name: 'address',
        type: 'singleLineText',
        description: 'Street address',
      },
      {
        name: 'postal_code',
        type: 'singleLineText',
        description: 'Postal code / PLZ',
      },
      {
        name: 'city',
        type: 'singleLineText',
        description: 'City / Ort',
      },
      {
        name: 'region',
        type: 'multipleRecordLinks',
        description: 'Link to Teams/Regionen table',
        options: {
          linkedTableId: TEAMS_REGIONEN_TABLE_ID,
        },
      },
      {
        name: 'estimated_children',
        type: 'number',
        description: 'Estimated number of children',
        options: {
          precision: 0,
        },
      },
      {
        name: 'event_type_interest',
        type: 'multipleSelects',
        description: 'Which event types the lead is interested in',
        options: {
          choices: [
            { name: 'Minimusikertag', color: 'blueBright' },
            { name: 'Plus', color: 'purpleBright' },
            { name: 'Kita', color: 'greenBright' },
            { name: 'Schulsong', color: 'orangeBright' },
          ],
        },
      },
      {
        name: 'lead_source',
        type: 'singleSelect',
        description: 'How the lead heard about MiniMusiker',
        options: {
          choices: [
            { name: 'Inbound Call', color: 'blueBright' },
            { name: 'Outbound Call', color: 'cyanBright' },
            { name: 'Website', color: 'purpleBright' },
            { name: 'Referral', color: 'greenBright' },
            { name: 'Repeat Customer', color: 'tealBright' },
            { name: 'Event/Fair', color: 'orangeBright' },
            { name: 'Other', color: 'grayBright' },
          ],
        },
      },
      {
        name: 'stage',
        type: 'singleSelect',
        description: 'Current pipeline stage',
        options: {
          choices: [
            { name: 'New', color: 'blueBright' },
            { name: 'Contacted', color: 'yellowBright' },
            { name: 'In Discussion', color: 'orangeBright' },
            { name: 'Won', color: 'greenBright' },
            { name: 'Lost', color: 'redBright' },
          ],
        },
      },
      {
        name: 'lost_reason',
        type: 'singleLineText',
        description: 'Reason the lead was lost (only when stage = Lost)',
      },
      {
        name: 'schulsong_upsell',
        type: 'checkbox',
        description: 'Whether Schulsong upsell is applicable',
        options: {
          icon: 'check',
          color: 'orangeBright',
        },
      },
      {
        name: 'scs_funded',
        type: 'checkbox',
        description: 'Whether the lead is SCS funded',
        options: {
          icon: 'check',
          color: 'greenBright',
        },
      },
      {
        name: 'einrichtung',
        type: 'multipleRecordLinks',
        description: 'Link to Einrichtungen table - auto-linked or auto-created',
        options: {
          linkedTableId: EINRICHTUNGEN_TABLE_ID,
        },
      },
      {
        name: 'assigned_staff',
        type: 'multipleRecordLinks',
        description: 'Link to Personen table - sales owner',
        options: {
          linkedTableId: PERSONEN_TABLE_ID,
        },
      },
      {
        name: 'call_notes',
        type: 'multilineText',
        description: 'JSON array of call notes: [{callNumber, date, notes}]',
      },
      {
        name: 'next_follow_up',
        type: 'date',
        description: 'Next follow-up reminder date',
        options: {
          dateFormat: {
            name: 'iso',
          },
        },
      },
      {
        name: 'estimated_date',
        type: 'date',
        description: 'Specific estimated event date (when known)',
        options: {
          dateFormat: {
            name: 'iso',
          },
        },
      },
      {
        name: 'estimated_month',
        type: 'singleLineText',
        description: 'Month-only estimate, format "2026-06" (when specific date not known)',
      },
      {
        name: 'converted_booking_id',
        type: 'multipleRecordLinks',
        description: 'Link to SchoolBookings - set when lead is converted to booking',
        options: {
          linkedTableId: SCHOOL_BOOKINGS_TABLE_ID,
        },
      },
    ],
  };

  console.log('Creating Leads table...');
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

    console.log('\n✅ Leads table created successfully!');
    console.log('\nTable ID:', data.id);
    console.log('\nField IDs:');

    const fieldIds: Record<string, string> = {};
    for (const field of data.fields) {
      console.log(`  ${field.name}: '${field.id}'`);
      fieldIds[field.name] = field.id;
    }

    console.log('\n📋 Copy this to src/lib/types/airtable.ts:\n');
    console.log('// Leads Table');
    console.log(`export const LEADS_TABLE_ID = '${data.id}';`);
    console.log('');
    console.log('export const LEADS_FIELD_IDS = {');
    console.log(`  school_name: '${fieldIds['school_name']}',`);
    console.log(`  contact_person: '${fieldIds['contact_person']}',`);
    console.log(`  contact_email: '${fieldIds['contact_email']}',`);
    console.log(`  contact_phone: '${fieldIds['contact_phone']}',`);
    console.log(`  address: '${fieldIds['address']}',`);
    console.log(`  postal_code: '${fieldIds['postal_code']}',`);
    console.log(`  city: '${fieldIds['city']}',`);
    console.log(`  region: '${fieldIds['region']}',`);
    console.log(`  estimated_children: '${fieldIds['estimated_children']}',`);
    console.log(`  event_type_interest: '${fieldIds['event_type_interest']}',`);
    console.log(`  lead_source: '${fieldIds['lead_source']}',`);
    console.log(`  stage: '${fieldIds['stage']}',`);
    console.log(`  lost_reason: '${fieldIds['lost_reason']}',`);
    console.log(`  schulsong_upsell: '${fieldIds['schulsong_upsell']}',`);
    console.log(`  scs_funded: '${fieldIds['scs_funded']}',`);
    console.log(`  einrichtung: '${fieldIds['einrichtung']}',`);
    console.log(`  assigned_staff: '${fieldIds['assigned_staff']}',`);
    console.log(`  call_notes: '${fieldIds['call_notes']}',`);
    console.log(`  next_follow_up: '${fieldIds['next_follow_up']}',`);
    console.log(`  estimated_date: '${fieldIds['estimated_date']}',`);
    console.log(`  estimated_month: '${fieldIds['estimated_month']}',`);
    console.log(`  converted_booking_id: '${fieldIds['converted_booking_id']}',`);
    console.log('} as const;');

    console.log('\n📋 And add this TypeScript interface:\n');
    console.log(`export type LeadStage = 'New' | 'Contacted' | 'In Discussion' | 'Won' | 'Lost';`);
    console.log(`export type LeadSource = 'Inbound Call' | 'Outbound Call' | 'Website' | 'Referral' | 'Repeat Customer' | 'Event/Fair' | 'Other';`);
    console.log(`export type EventTypeInterest = 'Minimusikertag' | 'Plus' | 'Kita' | 'Schulsong';`);
    console.log('');
    console.log('export interface CallNote {');
    console.log('  callNumber: number;');
    console.log('  date: string;');
    console.log('  notes: string;');
    console.log('}');
    console.log('');
    console.log('export interface Lead {');
    console.log('  id: string;');
    console.log('  schoolName: string;');
    console.log('  contactPerson: string;');
    console.log('  contactEmail?: string;');
    console.log('  contactPhone?: string;');
    console.log('  address?: string;');
    console.log('  postalCode?: string;');
    console.log('  city?: string;');
    console.log('  regionId?: string;');
    console.log('  estimatedChildren?: number;');
    console.log('  eventTypeInterest?: EventTypeInterest[];');
    console.log('  leadSource?: LeadSource;');
    console.log('  stage: LeadStage;');
    console.log('  lostReason?: string;');
    console.log('  schulsongUpsell?: boolean;');
    console.log('  scsFunded?: boolean;');
    console.log('  einrichtungId?: string;');
    console.log('  assignedStaffId?: string;');
    console.log('  assignedStaffName?: string;');
    console.log('  callNotes: CallNote[];');
    console.log('  nextFollowUp?: string;');
    console.log('  estimatedDate?: string;');
    console.log('  estimatedMonth?: string;');
    console.log('  convertedBookingId?: string;');
    console.log('  createdAt: string;');
    console.log('  updatedAt: string;');
    console.log('}');

  } catch (error) {
    console.error('Failed to create table:', error);
    process.exit(1);
  }
}

createLeadsTable();
