/**
 * Trigger Email Registry
 *
 * Defines all event-driven (trigger) emails in the system.
 * Each entry contains the default template that can be overridden via Airtable.
 * HTML uses {{variable}} placeholders for substitution at send-time.
 */

export interface TriggerEmailDefinition {
  slug: string;
  name: string;
  description: string;
  recipientType: 'admin' | 'teacher' | 'parent' | 'staff';
  defaultSubject: string;
  defaultBodyHtml: string;
  availableVariables: string[];
}

/**
 * All 8 trigger emails in the system
 */
export const TRIGGER_EMAIL_REGISTRY: TriggerEmailDefinition[] = [
  // ─── 1. Teacher Magic Link ──────────────────────────────────────────
  {
    slug: 'teacher_magic_link',
    name: 'Lehrer Login-Link',
    description: 'Wird gesendet, wenn ein Lehrer einen Login-Link für das Pädagogen-Portal anfordert.',
    recipientType: 'teacher',
    defaultSubject: 'Dein Login-Link für das Minimusiker Pädagogen-Portal',
    defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{teacherName}},
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Du hast einen Login-Link für das Minimusiker Pädagogen-Portal angefordert.
  Klicke auf den Button unten, um dich anzumelden:
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0 32px 0;">
      <a href="{{magicLinkUrl}}"
         style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
        Jetzt einloggen
      </a>
    </td>
  </tr>
</table>

<p style="margin: 0 0 16px 0; color: #718096; font-size: 14px; line-height: 1.6;">
  <strong>Hinweis:</strong> Dieser Link ist <strong>24 Stunden</strong> gültig und kann nur einmal verwendet werden.
</p>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
  <a href="{{magicLinkUrl}}" style="color: #d85a6a; word-break: break-all;">{{magicLinkUrl}}</a>
</p>`,
    availableVariables: ['teacherName', 'magicLinkUrl'],
  },

  // ─── 2. New Booking Notification (Admin) ────────────────────────────
  {
    slug: 'new_booking_notification',
    name: 'Neue Buchung (Admin)',
    description: 'Wird an Admins gesendet, wenn ein SimplyBook-Webhook eine neue Buchung erstellt.',
    recipientType: 'admin',
    defaultSubject: 'Neue Buchung: {{schoolName}} - {{eventDate}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Neue Buchung eingegangen
</h2>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Datum:</strong>
      <span style="color: #4a5568; float: right;">{{eventDate}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Kontaktperson:</strong>
      <span style="color: #4a5568; float: right;">{{contactName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">E-Mail:</strong>
      <span style="color: #4a5568; float: right;">{{contactEmail}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Telefon:</strong>
      <span style="color: #4a5568; float: right;">{{contactPhone}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Geschätzte Kinderzahl:</strong>
      <span style="color: #4a5568; float: right;">{{estimatedChildren}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Region:</strong>
      <span style="color: #4a5568; float: right;">{{region}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Adresse:</strong>
      <span style="color: #4a5568; float: right;">{{address}}</span>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Diese Buchung wurde automatisch im System erfasst.
</p>`,
    availableVariables: ['schoolName', 'eventDate', 'contactName', 'contactEmail', 'contactPhone', 'estimatedChildren', 'region', 'address'],
  },

  // ─── 3. Date Change Notification (Admin) ────────────────────────────
  {
    slug: 'date_change_notification',
    name: 'Terminänderung',
    description: 'Wird an Admins gesendet, wenn ein Admin das Datum eines Events ändert.',
    recipientType: 'admin',
    defaultSubject: 'Terminänderung: {{schoolName}} - {{oldDate}} → {{newDate}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Terminänderung
</h2>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #FFF3CD; border-radius: 8px;">
  <tr>
    <td style="padding: 16px;">
      <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px;">
        <strong>Alter Termin:</strong> <span style="text-decoration: line-through;">{{oldDate}}</span>
      </p>
      <p style="margin: 0; color: #155724; font-size: 16px; font-weight: 600;">
        <strong>Neuer Termin:</strong> {{newDate}}
      </p>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Kontaktperson:</strong>
      <span style="color: #4a5568; float: right;">{{contactName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">E-Mail:</strong>
      <span style="color: #4a5568; float: right;">{{contactEmail}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Telefon:</strong>
      <span style="color: #4a5568; float: right;">{{contactPhone}}</span>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Der Termin wurde im Admin- oder Pädagogen-Portal geändert.
</p>`,
    availableVariables: ['schoolName', 'oldDate', 'newDate', 'contactName', 'contactEmail', 'contactPhone'],
  },

  // ─── 4. Cancellation Notification (Admin) ───────────────────────────
  {
    slug: 'cancellation_notification',
    name: 'Stornierung',
    description: 'Wird an Admins gesendet, wenn ein Event storniert oder gelöscht wird.',
    recipientType: 'admin',
    defaultSubject: 'Buchung {{reasonText}}: {{schoolName}} - {{eventDate}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #dc3545; font-size: 22px; font-weight: 600;">
  {{title}}
</h2>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f8d7da; border-radius: 8px;">
  <tr>
    <td style="padding: 16px;">
      <p style="margin: 0; color: #721c24; font-size: 14px;">
        {{message}}
      </p>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Geplantes Datum:</strong>
      <span style="color: #4a5568; float: right;">{{eventDate}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Kontaktperson:</strong>
      <span style="color: #4a5568; float: right;">{{contactName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">E-Mail:</strong>
      <span style="color: #4a5568; float: right;">{{contactEmail}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Telefon:</strong>
      <span style="color: #4a5568; float: right;">{{contactPhone}}</span>
    </td>
  </tr>
</table>`,
    availableVariables: ['schoolName', 'eventDate', 'contactName', 'contactEmail', 'contactPhone', 'title', 'message', 'reasonText'],
  },

  // ─── 5. Schulsong Teacher Approved (Admin) ──────────────────────────
  {
    slug: 'schulsong_teacher_approved',
    name: 'Schulsong Freigabe',
    description: 'Wird an Admins gesendet, wenn ein Lehrer den Schulsong im Portal freigibt.',
    recipientType: 'admin',
    defaultSubject: 'Schulsong freigegeben: {{schoolName}} - {{eventDate}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Schulsong vom Lehrer freigegeben
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.5;">
  Der Lehrer hat den Schulsong freigegeben. Bitte prüfen und bestätigen Sie die Veröffentlichung.
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Datum:</strong>
      <span style="color: #4a5568; float: right;">{{eventDate}}</span>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0;">
      <a href="{{adminUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #1e3a4c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Im Admin-Bereich prüfen
      </a>
    </td>
  </tr>
</table>`,
    availableVariables: ['schoolName', 'eventDate', 'adminUrl'],
  },

  // ─── 6. Parent Welcome (migrated from Brevo) ───────────────────────
  {
    slug: 'parent_welcome',
    name: 'Eltern Willkommen',
    description: 'Wird an Eltern gesendet, wenn sie ihre Kinder für ein Event registrieren.',
    recipientType: 'parent',
    defaultSubject: 'Willkommen bei Minimusiker, {{parentName}}!',
    defaultBodyHtml: `<h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{parentName}},
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  vielen Dank für die Anmeldung von <strong>{{childName}}</strong> zum Minimusiker-Event an der <strong>{{schoolName}}</strong>!
</p>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Wir freuen uns sehr, dass Ihr Kind dabei ist. Nach dem Event erhalten Sie über das Eltern-Portal Zugang zu den Aufnahmen und Fotos.
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f0f9ff; border-radius: 8px;">
  <tr>
    <td style="padding: 16px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">Was passiert als nächstes?</p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
        <li>Die Minimusiker kommen zur Schule und nehmen Songs mit den Kindern auf</li>
        <li>Nach dem Event werden die Aufnahmen im Eltern-Portal bereitgestellt</li>
        <li>Sie können die Songs dann als Download oder CD bestellen</li>
      </ul>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Bei Fragen können Sie sich jederzeit an uns wenden.
</p>`,
    availableVariables: ['parentName', 'childName', 'schoolName'],
  },

  // ─── 7. Staff Booking Alert (migrated from Brevo) ──────────────────
  {
    slug: 'staff_booking_alert',
    name: 'Neue Buchung (Staff)',
    description: 'Wird an den zugewiesenen Mitarbeiter gesendet, wenn eine neue Buchung über SimplyBook eingeht.',
    recipientType: 'staff',
    defaultSubject: 'Neue Buchung zugewiesen: {{schoolName}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{staffName}},
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Dir wurde eine neue Buchung zugewiesen. Hier sind die Details:
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Kontaktperson:</strong>
      <span style="color: #4a5568; float: right;">{{contactName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">E-Mail:</strong>
      <span style="color: #4a5568; float: right;">{{contactEmail}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Datum:</strong>
      <span style="color: #4a5568; float: right;">{{bookingDate}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Geschätzte Kinderzahl:</strong>
      <span style="color: #4a5568; float: right;">{{estimatedChildren}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Region:</strong>
      <span style="color: #4a5568; float: right;">{{region}}</span>
    </td>
  </tr>
</table>

<p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
  Bitte prüfe die Details und bereite dich auf den Termin vor.
</p>`,
    availableVariables: ['staffName', 'schoolName', 'contactName', 'contactEmail', 'bookingDate', 'estimatedChildren', 'region'],
  },

  // ─── 8. Staff Reassignment (migrated from Brevo) ───────────────────
  {
    slug: 'staff_reassignment',
    name: 'Staff Neuzuweisung',
    description: 'Wird an einen Mitarbeiter gesendet, wenn ein Event ihm neu zugewiesen wird.',
    recipientType: 'staff',
    defaultSubject: 'Event-Neuzuweisung: {{schoolName}} - {{eventDate}}',
    defaultBodyHtml: `<h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
  Hallo {{staffName}},
</h2>

<p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
  Dir wurde ein Event neu zugewiesen. Hier sind die Details:
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Schule:</strong>
      <span style="color: #4a5568; float: right;">{{schoolName}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Datum:</strong>
      <span style="color: #4a5568; float: right;">{{eventDate}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Adresse:</strong>
      <span style="color: #4a5568; float: right;">{{schoolAddress}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Kontaktperson:</strong>
      <span style="color: #4a5568; float: right;">{{contactPerson}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">E-Mail:</strong>
      <span style="color: #4a5568; float: right;">{{contactEmail}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
      <strong style="color: #2F4858;">Telefon:</strong>
      <span style="color: #4a5568; float: right;">{{contactPhone}}</span>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0;">
      <a href="{{staffPortalUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #1e3a4c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Im Staff-Portal ansehen
      </a>
    </td>
  </tr>
</table>`,
    availableVariables: ['staffName', 'schoolName', 'eventDate', 'schoolAddress', 'contactPerson', 'contactEmail', 'contactPhone', 'staffPortalUrl'],
  },
];

/**
 * Get a trigger email definition by slug
 */
export function getRegistryEntry(slug: string): TriggerEmailDefinition | undefined {
  return TRIGGER_EMAIL_REGISTRY.find((entry) => entry.slug === slug);
}
