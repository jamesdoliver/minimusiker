/**
 * Campaign Service
 * Handles one-off email campaign logic
 */

import Airtable, { FieldSet } from 'airtable';
import {
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  REGISTRATIONS_TABLE_ID,
  REGISTRATIONS_FIELD_IDS,
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
} from '@/lib/types/airtable';

export interface CampaignRecipient {
  email: string;
  firstName: string;
  schoolName: string;
  loginLink: string;
}

interface EventInfo {
  recordId: string;
  eventId: string;
  schoolName: string;
  accessCode: number | null;
}

// Lazy-initialize Airtable to avoid build-time errors
let airtableBase: Airtable.Base | null = null;

function getAirtableBase(): Airtable.Base {
  if (!airtableBase) {
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY!,
    });
    airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID!);
  }
  return airtableBase;
}

/**
 * Get events by their access_code values (short URL codes like minimusiker.app/1718)
 */
async function getEventsByAccessCodes(accessCodes: number[]): Promise<EventInfo[]> {
  const base = getAirtableBase();
  const eventsTable = base(EVENTS_TABLE_ID);

  // Build OR formula to match any of the access_codes
  // Note: access_code is a number field, not a text field
  const conditions = accessCodes.map(code => `{access_code} = ${code}`);
  const formula = `OR(${conditions.join(', ')})`;

  // Don't use returnFieldsByFieldId for access_code since it's queried by name
  const records = await eventsTable.select({
    filterByFormula: formula,
  }).all();

  return records.map(record => ({
    recordId: record.id,
    eventId: record.get('event_id') as string,
    schoolName: record.get('school_name') as string,
    accessCode: record.get('access_code') as number | null,
  }));
}

/**
 * Get registrations for given event record IDs that don't have an order
 */
async function getRegistrationsWithoutOrders(eventRecordIds: string[]): Promise<Array<{
  parentRecordId: string;
  eventRecordId: string;
}>> {
  const base = getAirtableBase();
  const registrationsTable = base(REGISTRATIONS_TABLE_ID);

  // Fetch all registrations - Airtable formula filtering on linked records is unreliable
  const records = await registrationsTable.select({
    returnFieldsByFieldId: true,
  }).all();

  // Filter in JavaScript:
  // 1. Event is one of our target events
  // 2. No order_number
  return records
    .filter(record => {
      const eventIds = record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[] | undefined;
      const orderNumber = record.fields[REGISTRATIONS_FIELD_IDS.order_number] as string | undefined;

      // Check if this registration is for one of our target events
      const isTargetEvent = eventIds?.some(id => eventRecordIds.includes(id));

      // Check if no order exists
      const hasNoOrder = !orderNumber || orderNumber.trim() === '';

      return isTargetEvent && hasNoOrder;
    })
    .map(record => ({
      parentRecordId: (record.fields[REGISTRATIONS_FIELD_IDS.parent_id] as string[])?.[0] || '',
      eventRecordId: (record.fields[REGISTRATIONS_FIELD_IDS.event_id] as string[])?.[0] || '',
    }))
    .filter(r => r.parentRecordId && r.eventRecordId);
}

/**
 * Get parent details by record IDs
 */
async function getParentsByRecordIds(parentRecordIds: string[]): Promise<Map<string, { email: string; firstName: string }>> {
  const base = getAirtableBase();
  const parentsTable = base(PARENTS_TABLE_ID);

  // Fetch all parents - then filter in JS (Airtable formula filtering on multiple record IDs is complex)
  const records = await parentsTable.select({
    returnFieldsByFieldId: true,
  }).all();

  const parentMap = new Map<string, { email: string; firstName: string }>();

  for (const record of records) {
    if (parentRecordIds.includes(record.id)) {
      const email = record.fields[PARENTS_FIELD_IDS.parent_email] as string;
      const firstName = record.fields[PARENTS_FIELD_IDS.parent_first_name] as string;
      const emailCampaigns = record.fields[PARENTS_FIELD_IDS.email_campaigns] as string | undefined;

      if (email && emailCampaigns !== 'no') {
        parentMap.set(record.id, {
          email: email.toLowerCase().trim(),
          firstName: firstName || '',
        });
      }
    }
  }

  return parentMap;
}

/**
 * Get early bird campaign targets
 * - Fetches registrations for given access codes (short URL codes)
 * - Filters out registrations with orders
 * - Deduplicates by email (case-insensitive)
 * - Returns array of recipients with email, firstName, schoolName, loginLink
 */
export async function getEarlyBirdTargets(accessCodes: number[]): Promise<CampaignRecipient[]> {
  // Step 1: Get event info by access codes
  const events = await getEventsByAccessCodes(accessCodes);
  console.log(`Found ${events.length} events for access codes: ${accessCodes.join(', ')}`);

  if (events.length === 0) {
    return [];
  }

  // Create maps for quick lookup
  const eventRecordIds = events.map(e => e.recordId);
  const eventMap = new Map(events.map(e => [e.recordId, e]));

  // Step 2: Get registrations without orders for these events
  const registrations = await getRegistrationsWithoutOrders(eventRecordIds);
  console.log(`Found ${registrations.length} registrations without orders`);

  if (registrations.length === 0) {
    return [];
  }

  // Step 3: Get parent details
  const uniqueParentIds = [...new Set(registrations.map(r => r.parentRecordId))];
  const parentMap = await getParentsByRecordIds(uniqueParentIds);
  console.log(`Found ${parentMap.size} unique parents`);

  // Step 4: Build recipient list, deduplicated by email
  const seenEmails = new Set<string>();
  const recipients: CampaignRecipient[] = [];

  for (const reg of registrations) {
    const parent = parentMap.get(reg.parentRecordId);
    const event = eventMap.get(reg.eventRecordId);

    if (!parent || !event) continue;

    const emailLower = parent.email.toLowerCase();

    // Skip if we've already added this email
    if (seenEmails.has(emailLower)) continue;
    seenEmails.add(emailLower);

    // Build login link using access_code
    const loginLink = event.accessCode
      ? `https://minimusiker.app/e/${event.accessCode}`
      : `https://minimusiker.app`; // Fallback if no access code

    recipients.push({
      email: parent.email,
      firstName: parent.firstName,
      schoolName: event.schoolName,
      loginLink,
    });
  }

  console.log(`Built ${recipients.length} unique recipients`);
  return recipients;
}
