/**
 * Event Readiness Service
 * Checks events within 42 days for:
 * 1. No staff assigned (daily → admin email)
 * 2. No classes set up (weekly → teacher + admin)
 * 3. Classes without songs (weekly → teacher + admin)
 */

import { getAirtableService } from './airtableService';
import { getTeacherService } from './teacherService';
import { getTeacherRecipientsForEvent } from './emailAutomationService';
import {
  sendEventReadinessNoStaffEmail,
  sendEventReadinessTeacherNudgeEmail,
  sendEventReadinessAdminDigestEmail,
  sendEventReadinessNoEventEmail,
  sendPostWave2OrdersDigestEmail,
} from './resendService';
import Airtable from 'airtable';
import { ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '@/lib/types/airtable';
import { buildClassToEventMap, resolveOrderEventId } from '@/lib/utils/orderEventResolver';

const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';
const READINESS_WINDOW_DAYS = 42;

interface ReadinessResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Get admin recipients for event_readiness notification type
 */
async function getAdminRecipients(): Promise<string[]> {
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    const records = await base(NOTIFICATION_SETTINGS_TABLE_ID)
      .select({
        filterByFormula: `{type} = "event_readiness"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return [];

    const enabled = records[0].fields['enabled'] as boolean;
    if (!enabled) return [];

    const emails = (records[0].fields['recipientEmails'] as string) || '';
    return emails
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  } catch (error) {
    console.error('[EventReadiness] Error fetching admin recipients:', error);
    return [];
  }
}

function formatDateGerman(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

async function getUpcomingEvents() {
  const airtable = getAirtableService();
  const allEvents = await airtable.getAllEvents();

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() + READINESS_WINDOW_DAYS);

  return allEvents.filter((event) => {
    if (!event.event_date) return false;
    if (event.status !== 'Confirmed') return false;

    const eventDate = new Date(event.event_date);
    return eventDate >= now && eventDate <= cutoff;
  });
}

export async function checkNoStaffAssigned(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const events = await getUpcomingEvents();
    const unstaffed = events.filter(
      (e) => !e.assigned_staff || e.assigned_staff.length === 0
    );

    if (unstaffed.length === 0) {
      console.log('[EventReadiness] No unstaffed events found');
      result.skipped = 1;
      return result;
    }

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) {
      console.log('[EventReadiness] No admin recipients configured for event_readiness');
      result.skipped = 1;
      return result;
    }

    const rows = unstaffed
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .map(
        (e) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #2F4858;">${e.school_name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(e.event_date)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${e.event_type || '—'}</td>
          </tr>`
      )
      .join('\n');

    const eventListHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
      <tr style="background-color: #f7fafc;">
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Schule</th>
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Datum</th>
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Typ</th>
      </tr>
      ${rows}
    </table>`;

    if (dryRun) {
      console.log(`[EventReadiness] DRY RUN: Would send no-staff digest (${unstaffed.length} events) to ${recipients.length} recipients`);
      result.skipped = 1;
      return result;
    }

    const emailResult = await sendEventReadinessNoStaffEmail(recipients, {
      count: unstaffed.length,
      eventListHtml,
    });

    if (emailResult.success) {
      result.sent = 1;
    } else {
      result.failed = 1;
      result.errors.push(emailResult.error || 'Unknown email error');
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[EventReadiness] Error in checkNoStaffAssigned:', error);
  }

  return result;
}

export async function checkBookingsWithoutEvent(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();

    // Two queries, in-memory join (efficient for 200+ bookings)
    const [bookings, allEvents] = await Promise.all([
      airtable.getConfirmedBookingsInWindow(READINESS_WINDOW_DAYS),
      airtable.getAllEvents(),
    ]);

    // Build set of booking record IDs that have a linked event
    const bookingIdsWithEvent = new Set<string>();
    for (const event of allEvents) {
      if (event.simplybook_booking) {
        for (const bookingId of event.simplybook_booking) {
          bookingIdsWithEvent.add(bookingId);
        }
      }
    }

    // Find bookings with no linked event
    const orphaned = bookings.filter((b) => !bookingIdsWithEvent.has(b.id));

    if (orphaned.length === 0) {
      console.log('[EventReadiness] All confirmed bookings have linked events');
      result.skipped = 1;
      return result;
    }

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) {
      console.log('[EventReadiness] No admin recipients configured for event_readiness');
      result.skipped = 1;
      return result;
    }

    const rows = orphaned
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
      .map(
        (b) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #2F4858;">${b.schoolName || b.schoolContactName || '(unbekannt)'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(b.startDate!)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${b.simplybookId || '—'}</td>
          </tr>`
      )
      .join('\n');

    const eventListHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
      <tr style="background-color: #f7fafc;">
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Schule</th>
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Datum</th>
        <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Buchungs-ID</th>
      </tr>
      ${rows}
    </table>`;

    if (dryRun) {
      console.log(`[EventReadiness] DRY RUN: Would send no-event digest (${orphaned.length} bookings) to ${recipients.length} recipients`);
      result.skipped = 1;
      return result;
    }

    const emailResult = await sendEventReadinessNoEventEmail(recipients, {
      count: orphaned.length,
      eventListHtml,
    });

    if (emailResult.success) {
      result.sent = 1;
    } else {
      result.failed = 1;
      result.errors.push(emailResult.error || 'Unknown email error');
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[EventReadiness] Error in checkBookingsWithoutEvent:', error);
  }

  return result;
}

export async function checkClassesAndSongs(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const events = await getUpcomingEvents();
    const airtable = getAirtableService();
    const teacherService = getTeacherService();

    interface FlaggedEvent {
      eventId: string;
      schoolName: string;
      eventDate: string;
      teacherEmail: string;
      teacherName: string;
      missingClasses: boolean;
      classesWithoutSongs: string[];
    }

    const flagged: FlaggedEvent[] = [];

    for (const event of events) {
      const classes = await airtable.getClassesByEventId(event.id);
      const realClasses = classes.filter((c) => !c.is_default);

      const missingClasses = realClasses.length === 0;

      const classesWithoutSongs: string[] = [];
      if (!missingClasses) {
        for (const cls of realClasses) {
          const songs = await teacherService.getSongsByClassId(cls.class_id);
          if (songs.length === 0) {
            classesWithoutSongs.push(cls.class_name || cls.class_id);
          }
        }
      }

      if (!missingClasses && classesWithoutSongs.length === 0) continue;

      // Calculate days until event for EventThresholdMatch
      const now = new Date();
      const eventDate = new Date(event.event_date);
      const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Resolve teacher email using 3-tier fallback
      const teacherRecipients = await getTeacherRecipientsForEvent(
        event.event_id,
        event.id,
        {
          eventId: event.event_id,
          eventRecordId: event.id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type || 'MiniMusiker',
          daysUntilEvent,
          accessCode: event.access_code,
          isKita: event.is_kita,
          isMinimusikertag: event.is_minimusikertag,
          isPlus: event.is_plus,
          isSchulsong: event.is_schulsong,
        }
      );

      const teacher = teacherRecipients[0];

      flagged.push({
        eventId: event.event_id,
        schoolName: event.school_name,
        eventDate: event.event_date,
        teacherEmail: teacher?.email || '',
        teacherName: teacher?.name || 'Lehrkraft',
        missingClasses,
        classesWithoutSongs,
      });
    }

    if (flagged.length === 0) {
      console.log('[EventReadiness] All events have classes and songs');
      result.skipped = 1;
      return result;
    }

    console.log(`[EventReadiness] Found ${flagged.length} events with readiness issues`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';

    for (const item of flagged) {
      if (!item.teacherEmail) {
        console.warn(`[EventReadiness] No teacher email for event ${item.eventId}, skipping teacher nudge`);
        continue;
      }

      const checklistItems: string[] = [];
      if (item.missingClasses) {
        checklistItems.push('Klassen anlegen — Bitte teile uns mit, welche Klassen am Event teilnehmen');
      }
      for (const className of item.classesWithoutSongs) {
        checklistItems.push(`Lieder für <strong>${className}</strong> auswählen`);
      }

      const checklistHtml = `<ul style="margin: 0 0 16px 0; padding-left: 20px; color: #4a5568; font-size: 16px; line-height: 1.8;">
        ${checklistItems.map((ci) => `<li style="margin-bottom: 4px;">${ci}</li>`).join('\n')}
      </ul>`;

      if (dryRun) {
        console.log(`[EventReadiness] DRY RUN: Would send teacher nudge to ${item.teacherEmail} for ${item.eventId}`);
        result.skipped++;
        continue;
      }

      try {
        const emailResult = await sendEventReadinessTeacherNudgeEmail(item.teacherEmail, {
          teacherName: item.teacherName,
          schoolName: item.schoolName,
          eventDate: formatDateGerman(item.eventDate),
          checklistHtml,
          portalUrl: `${baseUrl}/paedagogen`,
        });

        if (emailResult.success) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`Teacher email failed for ${item.eventId}: ${emailResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Teacher email error for ${item.eventId}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Send admin digest
    const adminRecipients = await getAdminRecipients();
    if (adminRecipients.length > 0 && !dryRun) {
      const rows = flagged
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
        .map((item) => {
          const issues: string[] = [];
          if (item.missingClasses) issues.push('Keine Klassen');
          if (item.classesWithoutSongs.length > 0) {
            issues.push(`Lieder fehlen: ${item.classesWithoutSongs.join(', ')}`);
          }

          return `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #2F4858;">${item.schoolName}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(item.eventDate)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${item.teacherEmail || '—'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #c53030;">${issues.join('; ')}</td>
          </tr>`;
        })
        .join('\n');

      const digestHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr style="background-color: #f7fafc;">
          <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Schule</th>
          <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Datum</th>
          <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Lehrkraft</th>
          <th style="padding: 8px 12px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Fehlend</th>
        </tr>
        ${rows}
      </table>`;

      try {
        const digestResult = await sendEventReadinessAdminDigestEmail(adminRecipients, {
          count: flagged.length,
          digestHtml,
        });

        if (digestResult.success) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`Admin digest failed: ${digestResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Admin digest error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    } else if (dryRun) {
      console.log(`[EventReadiness] DRY RUN: Would send admin digest (${flagged.length} events) to ${adminRecipients.length} recipients`);
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[EventReadiness] Error in checkClassesAndSongs:', error);
  }

  return result;
}

const WAVE_2_OFFSET_DAYS = 14;

export async function checkPostWave2Orders(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();
    const base = airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);

    // Fetch pending/partial orders (server-side filtered) + class→event map + all events
    const filterFormula = `AND(
      OR(
        {${ORDERS_FIELD_IDS.fulfillment_status}} = 'pending',
        {${ORDERS_FIELD_IDS.fulfillment_status}} = 'partial'
      ),
      {${ORDERS_FIELD_IDS.payment_status}} != 'refunded',
      {${ORDERS_FIELD_IDS.payment_status}} != 'voided'
    )`;

    const [pendingOrders, classToEvent, allEvents] = await Promise.all([
      ordersTable
        .select({ filterByFormula: filterFormula, returnFieldsByFieldId: true })
        .all(),
      buildClassToEventMap(base),
      airtable.getAllEvents(),
    ]);

    // Build event lookup by record ID
    const eventMap = new Map(allEvents.map((e) => [e.id, e]));

    const now = new Date();

    interface PostWave2Order {
      orderNumber: string;
      totalAmount: number;
      orderDate: string;
      fulfillmentStatus: string;
      itemsSummary: string;
    }

    interface PostWave2Event {
      schoolName: string;
      eventDate: string;
      daysSinceEvent: number;
      orders: PostWave2Order[];
    }

    const eventOrders = new Map<string, PostWave2Event>();

    for (const order of pendingOrders) {
      // Skip cancelled orders
      const cancelReason = order.get(ORDERS_FIELD_IDS.cancel_reason) as string | undefined;
      if (cancelReason) continue;

      // Resolve order → event
      const eventRecordId = resolveOrderEventId(order, classToEvent);
      if (!eventRecordId) continue;

      const event = eventMap.get(eventRecordId);
      if (!event || !event.event_date) continue;

      // Check if Wave 2 deadline has passed
      const eventDate = new Date(event.event_date);
      const wave2Deadline = new Date(eventDate);
      wave2Deadline.setDate(wave2Deadline.getDate() + WAVE_2_OFFSET_DAYS);

      if (now <= wave2Deadline) continue;

      const daysSinceEvent = Math.floor(
        (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Parse line items for a compact summary
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      let itemsSummary = '—';
      if (lineItemsJson) {
        try {
          const items = JSON.parse(lineItemsJson) as Array<{
            product_title: string;
            variant_title?: string;
            quantity: number;
          }>;
          itemsSummary = items
            .map((i) => `${i.quantity}x ${i.variant_title || i.product_title}`)
            .join(', ');
        } catch {
          // ignore parse errors
        }
      }

      if (!eventOrders.has(eventRecordId)) {
        eventOrders.set(eventRecordId, {
          schoolName: event.school_name,
          eventDate: event.event_date,
          daysSinceEvent,
          orders: [],
        });
      }

      eventOrders.get(eventRecordId)!.orders.push({
        orderNumber: (order.get(ORDERS_FIELD_IDS.order_number) as string) || '—',
        totalAmount: (order.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
        orderDate: (order.get(ORDERS_FIELD_IDS.order_date) as string) || '',
        fulfillmentStatus:
          (order.get(ORDERS_FIELD_IDS.fulfillment_status) as string) || 'pending',
        itemsSummary,
      });
    }

    if (eventOrders.size === 0) {
      console.log('[EventReadiness] No post-Wave 2 pending orders found');
      result.skipped = 1;
      return result;
    }

    // Sort events oldest-first so the most overdue are at the top
    const sortedEvents = [...eventOrders.values()].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

    let totalOrders = 0;
    let totalValue = 0;

    const eventSections = sortedEvents
      .map((evt) => {
        totalOrders += evt.orders.length;

        const orderRows = evt.orders
          .sort(
            (a, b) =>
              new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
          )
          .map((o) => {
            totalValue += o.totalAmount;
            const statusLabel =
              o.fulfillmentStatus === 'partial' ? 'Teilversand' : 'Ausstehend';
            const statusColor =
              o.fulfillmentStatus === 'partial' ? '#c53030' : '#718096';
            return `<tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.orderNumber}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568; font-size: 13px;">${o.itemsSummary}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.totalAmount.toFixed(2)} €</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(o.orderDate)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: ${statusColor};">${statusLabel}</td>
          </tr>`;
          })
          .join('\n');

        return `<tr>
        <td colspan="5" style="padding: 14px 10px 8px 10px; background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
          <strong style="color: #2F4858; font-size: 15px;">${evt.schoolName}</strong>
          <span style="color: #718096; font-size: 13px; margin-left: 8px;">
            ${formatDateGerman(evt.eventDate)} — vor ${evt.daysSinceEvent} Tagen — ${evt.orders.length} Bestellung${evt.orders.length !== 1 ? 'en' : ''}
          </span>
        </td>
      </tr>
      ${orderRows}`;
      })
      .join('\n');

    const ordersTableHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; font-size: 14px;">
      <tr style="background-color: #edf2f7;">
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Bestell-Nr.</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Artikel</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Betrag</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Bestellt am</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Status</th>
      </tr>
      ${eventSections}
    </table>`;

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) {
      console.log(
        '[EventReadiness] No admin recipients configured for event_readiness'
      );
      result.skipped = 1;
      return result;
    }

    if (dryRun) {
      console.log(
        `[EventReadiness] DRY RUN: Would send post-Wave 2 digest (${totalOrders} orders, ${eventOrders.size} events) to ${recipients.length} recipients`
      );
      result.skipped = 1;
      return result;
    }

    const emailResult = await sendPostWave2OrdersDigestEmail(recipients, {
      orderCount: totalOrders,
      eventCount: eventOrders.size,
      totalValue: `${totalValue.toFixed(2)} €`,
      ordersTableHtml,
    });

    if (emailResult.success) {
      result.sent = 1;
    } else {
      result.failed = 1;
      result.errors.push(emailResult.error || 'Unknown email error');
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[EventReadiness] Error in checkPostWave2Orders:', error);
  }

  return result;
}
