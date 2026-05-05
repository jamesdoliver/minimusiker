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
  sendPostWave2BreakdownEmail,
  sendStaffEventReminderEmail,
  sendRegistrationShortfallEmail,
} from './resendService';
import { getActivityService } from './activityService';
import { REGISTRATION_SHORTFALL_TRIGGERS, shouldFire, type RegistrationShortfallTriggerKey } from './registrationShortfall';
import { getTriggerTemplate } from './triggerTemplateService';
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

    // Fetch pending/partial orders (server-side filtered) + class→event map + all events.
    // refund_amount is the load-bearing refund check — payment_status can lag behind
    // when Shopify's orders/updated webhook misses a beat, but refund_amount is always
    // recomputed from total_price - current_total_price.
    // is_test excludes Bogus-Gateway test orders (treated as unchecked when blank).
    const filterFormula = `AND(
      OR(
        {${ORDERS_FIELD_IDS.fulfillment_status}} = 'pending',
        {${ORDERS_FIELD_IDS.fulfillment_status}} = 'partial'
      ),
      {${ORDERS_FIELD_IDS.payment_status}} != 'refunded',
      {${ORDERS_FIELD_IDS.payment_status}} != 'partially_refunded',
      {${ORDERS_FIELD_IDS.payment_status}} != 'voided',
      OR(
        {${ORDERS_FIELD_IDS.refund_amount}} = BLANK(),
        {${ORDERS_FIELD_IDS.refund_amount}} = 0
      ),
      OR(
        {${ORDERS_FIELD_IDS.is_test}} = BLANK(),
        {${ORDERS_FIELD_IDS.is_test}} = FALSE()
      )
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

const RECENT_CHANGES_WINDOW_DAYS = 7;

// Narrower distribution than the post-Wave 2 digest — only the two recipients
// who own the financial follow-up. Edit this list to change the routing; the
// digest itself still goes to all event_readiness recipients.
const BREAKDOWN_RECIPIENTS = [
  'gian.koehler@guesstimate.de',
  'jordan.baker@guesstimate.de',
];

/**
 * Build a categorized breakdown of orders created or updated in the last 7 days
 * and email it to admin recipients. Runs weekly (Mondays) alongside the digest.
 *
 * Categorization mirrors scripts/report-orders-status.ts:
 *   - refunds:    refund_amount > 0 OR payment_status in (refunded, partially_refunded, voided)
 *   - test:       is_test === true and not in refunds
 *   - new:        order_date within the window and not in refunds/test
 *   - fulfillment: everything else updated in the window (older orders touched)
 */
export async function checkRecentOrderChanges(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();
    const base = airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);

    const since = new Date();
    since.setDate(since.getDate() - RECENT_CHANGES_WINDOW_DAYS);
    const sinceIso = since.toISOString();

    // Server-side filter: anything updated in the last 7 days. Each loop iteration
    // re-classifies based on current state, so we don't need to track diffs.
    const filterFormula = `IS_AFTER({${ORDERS_FIELD_IDS.updated_at}}, '${sinceIso}')`;

    const records = await ordersTable
      .select({ filterByFormula: filterFormula, returnFieldsByFieldId: true })
      .all();

    interface OrderRow {
      orderNumber: string;
      schoolName: string;
      orderDate: string;
      paymentStatus: string;
      fulfillmentStatus: string;
      totalAmount: number;
      refundAmount: number;
      cancelReason: string;
      isTest: boolean;
    }

    const all: OrderRow[] = records.map((r) => ({
      orderNumber: (r.get(ORDERS_FIELD_IDS.order_number) as string) || '—',
      schoolName: (r.get(ORDERS_FIELD_IDS.school_name) as string) || '—',
      orderDate: (r.get(ORDERS_FIELD_IDS.order_date) as string) || '',
      paymentStatus: (r.get(ORDERS_FIELD_IDS.payment_status) as string) || '',
      fulfillmentStatus: (r.get(ORDERS_FIELD_IDS.fulfillment_status) as string) || '',
      totalAmount: (r.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
      refundAmount: (r.get(ORDERS_FIELD_IDS.refund_amount) as number) || 0,
      cancelReason: (r.get(ORDERS_FIELD_IDS.cancel_reason) as string) || '',
      isTest: r.get(ORDERS_FIELD_IDS.is_test) === true,
    }));

    const refunds: OrderRow[] = [];
    const tests: OrderRow[] = [];
    const fulfillment: OrderRow[] = [];
    const newOrders: OrderRow[] = [];

    for (const o of all) {
      const isRefund =
        o.refundAmount > 0.01 ||
        o.paymentStatus === 'refunded' ||
        o.paymentStatus === 'partially_refunded' ||
        o.paymentStatus === 'voided';
      if (isRefund) {
        refunds.push(o);
        continue;
      }
      if (o.isTest) {
        tests.push(o);
        continue;
      }
      if (o.orderDate && new Date(o.orderDate) >= since) {
        newOrders.push(o);
        continue;
      }
      fulfillment.push(o);
    }

    if (all.length === 0) {
      console.log('[EventReadiness] No order changes in the last 7 days');
      result.skipped = 1;
      return result;
    }

    const recipients = BREAKDOWN_RECIPIENTS;

    const refundValue = refunds.reduce((acc, o) => acc + o.refundAmount, 0);
    const newOrderValue = newOrders.reduce((acc, o) => acc + o.totalAmount, 0);

    const sortBy = <T extends OrderRow>(rows: T[]): T[] =>
      [...rows].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

    const refundRow = (o: OrderRow): string => {
      const status = o.paymentStatus === 'partially_refunded' ? 'Teilerstattung' : 'Erstattung';
      return `<tr>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.orderNumber}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.schoolName}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(o.orderDate)}</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.totalAmount.toFixed(2)} €</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #c53030;">${o.refundAmount.toFixed(2)} €</td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${status}${o.cancelReason ? ` (${o.cancelReason})` : ''}</td>
      </tr>`;
    };

    const simpleRow = (o: OrderRow, statusLabel: string): string => `<tr>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.orderNumber}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.schoolName}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(o.orderDate)}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.totalAmount.toFixed(2)} €</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${statusLabel}</td>
    </tr>`;

    const wrap = (title: string, headers: string[], bodyRows: string): string => `
      <h3 style="margin: 24px 0 8px 0; color: #2F4858; font-size: 16px; font-weight: 600;">${title}</h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8px; font-size: 14px; border-collapse: collapse;">
        <tr style="background-color: #edf2f7;">
          ${headers.map((h) => `<th style="padding: 6px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">${h}</th>`).join('')}
        </tr>
        ${bodyRows}
      </table>`;

    const refundsHtml = refunds.length
      ? wrap(
          `Erstattungen (${refunds.length}, ${refundValue.toFixed(2)} € erstattet)`,
          ['Bestell-Nr.', 'Schule', 'Bestellt am', 'Gesamt', 'Erstattet', 'Status'],
          sortBy(refunds).map(refundRow).join('\n')
        )
      : '';
    const newOrdersHtml = newOrders.length
      ? wrap(
          `Neue Bestellungen (${newOrders.length}, ${newOrderValue.toFixed(2)} €)`,
          ['Bestell-Nr.', 'Schule', 'Bestellt am', 'Gesamt', 'Versand'],
          sortBy(newOrders)
            .map((o) =>
              simpleRow(
                o,
                o.fulfillmentStatus === 'fulfilled' ? 'Versendet' : 'Ausstehend'
              )
            )
            .join('\n')
        )
      : '';
    const fulfillmentHtml = fulfillment.length
      ? wrap(
          `Versand-Updates an älteren Bestellungen (${fulfillment.length})`,
          ['Bestell-Nr.', 'Schule', 'Bestellt am', 'Gesamt', 'Versand'],
          sortBy(fulfillment)
            .map((o) =>
              simpleRow(
                o,
                o.fulfillmentStatus === 'fulfilled'
                  ? 'Versendet'
                  : o.fulfillmentStatus === 'partial'
                    ? 'Teilversand'
                    : 'Ausstehend'
              )
            )
            .join('\n')
        )
      : '';
    const testOrdersHtml = tests.length
      ? wrap(
          `Test-Bestellungen markiert (${tests.length})`,
          ['Bestell-Nr.', 'Schule', 'Bestellt am', 'Gesamt', 'Versand'],
          sortBy(tests)
            .map((o) => simpleRow(o, o.fulfillmentStatus || '—'))
            .join('\n')
        )
      : '';

    if (dryRun) {
      console.log(
        `[EventReadiness] DRY RUN: Would send breakdown — refunds=${refunds.length} (${refundValue.toFixed(2)} €), new=${newOrders.length} (${newOrderValue.toFixed(2)} €), fulfillment=${fulfillment.length}, test=${tests.length} → ${recipients.length} recipients`
      );
      result.skipped = 1;
      return result;
    }

    const emailResult = await sendPostWave2BreakdownEmail(recipients, {
      totalCount: all.length,
      refundCount: refunds.length,
      refundValue: `${refundValue.toFixed(2)} €`,
      newOrderCount: newOrders.length,
      newOrderValue: `${newOrderValue.toFixed(2)} €`,
      fulfillmentCount: fulfillment.length,
      testCount: tests.length,
      refundsHtml,
      newOrdersHtml,
      fulfillmentHtml,
      testOrdersHtml,
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
    console.error('[EventReadiness] Error in checkRecentOrderChanges:', error);
  }

  return result;
}

const STAFF_REMINDER_DAYS_BEFORE = 7;

/**
 * Send a reminder email to assigned staff 7 days before their event.
 * Runs daily. Only sends for events exactly 7 days out (date match, not range)
 * so each event is only processed once.
 */
export async function checkStaffEventReminder(dryRun = false): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();
    const allEvents = await airtable.getAllEvents();

    // Find events exactly 7 days from now
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + STAFF_REMINDER_DAYS_BEFORE);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const eventsIn7Days = allEvents.filter((event) => {
      if (!event.event_date) return false;
      if (event.status !== 'Confirmed') return false;
      if (!event.assigned_staff || event.assigned_staff.length === 0) return false;
      return event.event_date.split('T')[0] === targetDateStr;
    });

    if (eventsIn7Days.length === 0) {
      console.log(`[EventReadiness] No staffed events on ${targetDateStr}`);
      result.skipped = 1;
      return result;
    }

    console.log(`[EventReadiness] Found ${eventsIn7Days.length} event(s) in 7 days for staff reminder`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';

    for (const event of eventsIn7Days) {
      const staffId = event.assigned_staff![0];

      // Resolve staff person
      let staff: { id: string; staff_name: string; email?: string } | null = null;
      try {
        staff = await airtable.getPersonById(staffId);
      } catch (err) {
        console.warn(`[EventReadiness] Could not resolve staff ${staffId}:`, err);
      }

      if (!staff?.email) {
        console.warn(`[EventReadiness] Staff ${staffId} has no email, skipping reminder for event ${event.event_id}`);
        result.skipped++;
        continue;
      }

      // Get booking details for contact info
      let contactName = '—';
      let contactEmail = '—';
      let contactPhone = '—';
      let estimatedChildren = '—';

      if (event.simplybook_booking?.[0]) {
        try {
          const booking = await airtable.getSchoolBookingById(event.simplybook_booking[0]);
          if (booking) {
            contactName = booking.schoolContactName || '—';
            contactEmail = booking.schoolContactEmail || '—';
            contactPhone = booking.schoolPhone || '—';
            estimatedChildren = booking.estimatedChildren?.toString() || '—';
          }
        } catch (err) {
          console.warn(`[EventReadiness] Could not fetch booking for event ${event.event_id}:`, err);
        }
      }

      if (dryRun) {
        console.log(`[EventReadiness] DRY RUN: Would send staff reminder to ${staff.email} for ${event.school_name} on ${event.event_date}`);
        result.skipped++;
        continue;
      }

      try {
        const emailResult = await sendStaffEventReminderEmail(staff.email, {
          staffName: staff.staff_name,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type || 'MiniMusiker',
          schoolAddress: event.school_address || '',
          contactName,
          contactEmail,
          contactPhone,
          estimatedChildren,
          staffPortalUrl: `${baseUrl}/staff/events/${event.event_id}`,
        });

        if (emailResult.success) {
          result.sent++;

          // Log activity for audit trail
          getActivityService().logActivity({
            eventRecordId: event.id,
            activityType: 'staff_event_reminder',
            description: `7-day event reminder sent to ${staff.staff_name} (${staff.email})`,
            actorEmail: 'system',
            actorType: 'system',
          });
        } else {
          result.failed++;
          result.errors.push(`Staff reminder failed for ${event.event_id}: ${emailResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Staff reminder error for ${event.event_id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('[EventReadiness] Error in checkStaffEventReminder:', error);
  }

  return result;
}

/**
 * Registration shortfall reminder. Three independent triggers, each with its own
 * date offset and ratio gate (see REGISTRATION_SHORTFALL_TRIGGERS).
 *
 * Idempotency: exact-date match means each event passes through each trigger
 * exactly once over its lifetime — same model as `checkStaffEventReminder`.
 */
export async function checkRegistrationShortfall(
  triggerKey: RegistrationShortfallTriggerKey,
  dryRun = false,
): Promise<ReadinessResult> {
  const result: ReadinessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const trigger = REGISTRATION_SHORTFALL_TRIGGERS[triggerKey];

  try {
    const airtable = getAirtableService();
    const allEvents = await airtable.getAllEvents();

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + trigger.daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const candidates = allEvents.filter((event) => {
      if (!event.event_date) return false;
      if (event.status !== 'Confirmed') return false;
      if (!event.simplybook_booking?.[0]) return false;
      const takesRegistrations = !!(event.is_minimusikertag || event.is_plus || event.is_kita);
      if (!takesRegistrations) return false;
      return event.event_date.split('T')[0] === targetDateStr;
    });

    if (candidates.length === 0) {
      console.log(`[EventReadiness] Registration shortfall (${triggerKey}): no candidates on ${targetDateStr}`);
      result.skipped = 1;
      return result;
    }

    console.log(`[EventReadiness] Registration shortfall (${triggerKey}): ${candidates.length} candidate(s) at ${targetDateStr}`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';

    for (const event of candidates) {
      const bookingId = event.simplybook_booking![0];
      let estimatedChildren = 0;
      try {
        const booking = await airtable.getSchoolBookingById(bookingId);
        estimatedChildren = booking?.estimatedChildren ?? 0;
      } catch (err) {
        console.warn(`[EventReadiness] Could not fetch booking for ${event.event_id}:`, err);
      }

      if (!estimatedChildren || estimatedChildren <= 0) {
        result.skipped++;
        continue;
      }

      const registrations = await airtable.getRegistrationsByEventId(event.id);
      const registeredCount = registrations.filter((r) => r.registered_complete).length;

      if (!shouldFire(registeredCount, estimatedChildren, triggerKey)) {
        continue; // ratio at or above threshold
      }

      const teacherRecipients = await getTeacherRecipientsForEvent(
        event.event_id,
        event.id,
        {
          eventId: event.event_id,
          eventRecordId: event.id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type || 'MiniMusiker',
          daysUntilEvent: trigger.daysOffset,
          accessCode: event.access_code,
          isKita: event.is_kita,
          isMinimusikertag: event.is_minimusikertag,
          isPlus: event.is_plus,
          isSchulsong: event.is_schulsong,
        },
      );

      const teacher = teacherRecipients[0];
      if (!teacher?.email) {
        console.warn(`[EventReadiness] No teacher email for ${event.event_id}, skipping shortfall`);
        result.skipped++;
        continue;
      }

      // Pre-check active flag — disabled templates would otherwise be reported as "sent"
      // by the resendService disabled-shortcut (returns success: true, messageId: 'disabled').
      const template = await getTriggerTemplate(trigger.slug);
      if (!template.active) {
        result.skipped++;
        continue;
      }

      // Defensive: skip when admin has flipped active=true without filling subject + body.
      // Prevents sending an email with empty content wrapped in brand chrome.
      if (!template.subject.trim() || !template.bodyHtml.trim()) {
        console.warn(
          `[EventReadiness] Template ${trigger.slug} is active but subject/body is empty — `
          + `skipping. Admin must fill content before activation.`,
        );
        result.skipped++;
        continue;
      }

      const percentRegistered = Math.floor((registeredCount / estimatedChildren) * 100);

      if (dryRun) {
        console.log(
          `[EventReadiness] DRY RUN (${triggerKey}): would send ${trigger.slug} to ${teacher.email} `
          + `(ratio: ${percentRegistered}%, registered: ${registeredCount}/${estimatedChildren})`,
        );
        result.skipped++;
        continue;
      }

      try {
        const r = await sendRegistrationShortfallEmail(
          teacher.email,
          trigger.slug,
          {
            teacherName: teacher.name || 'Lehrkraft',
            schoolName: event.school_name,
            eventDate: formatDateGerman(event.event_date),
            registeredCount: String(registeredCount),
            expectedCount: String(estimatedChildren),
            percentRegistered: String(percentRegistered),
            teacherPortalUrl: `${baseUrl}/paedagogen/events/${event.event_id}`,
          },
        );

        if (r.success) {
          result.sent++;
          getActivityService().logActivity({
            eventRecordId: event.id,
            activityType: 'email_sent',
            description: `Registration shortfall (${triggerKey}, ${trigger.slug}) — ${percentRegistered}% (${registeredCount}/${estimatedChildren})`,
            actorEmail: 'system',
            actorType: 'system',
            metadata: { slug: trigger.slug, triggerKey, ratio: percentRegistered },
          });
        } else {
          result.failed++;
          result.errors.push(`Shortfall send failed for ${event.event_id} (${triggerKey}): ${r.error}`);
        }
      } catch (err) {
        result.failed++;
        result.errors.push(
          `Shortfall send error for ${event.event_id} (${triggerKey}): ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }
  } catch (error) {
    result.failed = 1;
    result.errors.push(
      `[EventReadiness] checkRegistrationShortfall(${triggerKey}): ${error instanceof Error ? error.message : 'Unknown'}`,
    );
    console.error(`[EventReadiness] Error in checkRegistrationShortfall(${triggerKey}):`, error);
  }

  return result;
}
