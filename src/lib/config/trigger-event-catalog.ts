/**
 * Trigger Event Catalog
 *
 * Registry of system events that fire trigger emails.
 * Each entry describes when and how a trigger fires, what variables it provides,
 * and how recipients are determined.
 */

export interface TriggerEvent {
  key: string;                    // e.g. 'webhook:new_booking'
  name: string;                   // German display name
  description: string;            // When this event fires
  availableVariables: string[];   // Variables the code path provides
  recipientMode: 'specific' | 'configurable';
  // 'specific' = code path determines recipient (the teacher, the parent, etc.)
  // 'configurable' = recipients come from Airtable notification settings
}

export const TRIGGER_EVENT_CATALOG: TriggerEvent[] = [
  {
    key: 'user:teacher_magic_link',
    name: 'Lehrer Login-Link angefordert',
    description: 'Lehrer fordert einen Login-Link für das Pädagogen-Portal an.',
    availableVariables: ['teacherName', 'magicLinkUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'webhook:new_booking',
    name: 'Neue Buchung (SimplyBook)',
    description: 'SimplyBook-Webhook meldet eine neue Buchung.',
    availableVariables: ['schoolName', 'eventDate', 'contactName', 'contactEmail', 'contactPhone', 'estimatedChildren', 'region', 'address'],
    recipientMode: 'configurable',
  },
  {
    key: 'admin:date_change',
    name: 'Terminänderung',
    description: 'Admin ändert das Datum eines Events.',
    availableVariables: ['schoolName', 'oldDate', 'newDate', 'contactName', 'contactEmail', 'contactPhone'],
    recipientMode: 'configurable',
  },
  {
    key: 'admin:cancellation',
    name: 'Stornierung / Löschung',
    description: 'Admin storniert oder löscht ein Event.',
    availableVariables: ['schoolName', 'eventDate', 'contactName', 'contactEmail', 'contactPhone', 'title', 'message', 'reasonText'],
    recipientMode: 'configurable',
  },
  {
    key: 'teacher:schulsong_approved',
    name: 'Schulsong Lehrer-Freigabe',
    description: 'Lehrer gibt den Schulsong im Portal frei.',
    availableVariables: ['schoolName', 'eventDate', 'adminUrl'],
    recipientMode: 'configurable',
  },
  {
    key: 'user:parent_registration',
    name: 'Eltern-Registrierung',
    description: 'Eltern registrieren ihre Kinder für ein Event.',
    availableVariables: ['parentName', 'childName', 'schoolName'],
    recipientMode: 'specific',
  },
  {
    key: 'webhook:staff_assigned',
    name: 'Staff zugewiesen (Buchung)',
    description: 'Neuer Staff wird bei einer Buchung automatisch zugewiesen.',
    availableVariables: ['staffName', 'schoolName', 'contactName', 'contactEmail', 'bookingDate', 'estimatedChildren', 'region'],
    recipientMode: 'specific',
  },
  {
    key: 'admin:staff_reassigned',
    name: 'Staff neu zugewiesen',
    description: 'Admin weist einen Mitarbeiter einem Event neu zu.',
    availableVariables: ['staffName', 'schoolName', 'eventDate', 'schoolAddress', 'contactPerson', 'contactEmail', 'contactPhone', 'staffPortalUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'staff:first_audio_upload',
    name: 'Erste Aufnahme hochgeladen',
    description: 'Zum ersten Mal werden Audiodateien für ein Event hochgeladen.',
    availableVariables: ['engineerName', 'schoolName', 'eventDate', 'eventId', 'engineerPortalUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'staff:schulsong_upload',
    name: 'Schulsong Logic Project hochgeladen',
    description: 'Staff lädt ein Schulsong Logic Project für ein Event hoch.',
    availableVariables: ['engineerName', 'schoolName', 'eventDate', 'eventId', 'engineerPortalUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'staff:minimusiker_upload',
    name: 'Minimusiker Logic Project hochgeladen',
    description: 'Staff lädt ein Minimusiker Logic Project für ein Event hoch.',
    availableVariables: ['engineerName', 'schoolName', 'eventDate', 'eventId', 'engineerPortalUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'webhook:unassigned_staff',
    name: 'CRON: Kein Mitarbeiter bei Buchung',
    description: 'SimplyBook-Webhook konnte keinen Mitarbeiter automatisch zuordnen (weder über Provider ID noch über Region). Wird sofort bei Buchungseingang ausgelöst.',
    availableVariables: ['schoolName', 'eventDate', 'region', 'bookingId', 'unitId', 'reason'],
    recipientMode: 'configurable',
  },
  {
    key: 'cron:event_readiness_no_staff',
    name: 'CRON: Tägliche Übersicht — Events ohne Mitarbeiter',
    description: 'Läuft täglich um 7 Uhr. Listet alle bestätigten Events innerhalb der nächsten 42 Tage auf, die noch keinen zugeordneten Mitarbeiter haben.',
    availableVariables: ['count', 'eventListHtml'],
    recipientMode: 'configurable',
  },
  {
    key: 'cron:event_readiness_teacher_nudge',
    name: 'CRON: Wöchentliche Erinnerung an Lehrer',
    description: 'Läuft jeden Montag um 7 Uhr. Erinnert Lehrkräfte an fehlende Vorbereitungen (Klassen anlegen, Lieder auswählen) für Events innerhalb der nächsten 42 Tage.',
    availableVariables: ['teacherName', 'schoolName', 'eventDate', 'checklistHtml', 'portalUrl'],
    recipientMode: 'specific',
  },
  {
    key: 'cron:event_readiness_admin_digest',
    name: 'CRON: Wöchentliche Event-Vorbereitung (Admin)',
    description: 'Läuft jeden Montag um 7 Uhr. Zeigt Admins alle Events innerhalb der nächsten 42 Tage, bei denen Lehrkräfte noch Klassen oder Lieder einrichten müssen.',
    availableVariables: ['count', 'digestHtml'],
    recipientMode: 'configurable',
  },
  {
    key: 'cron:post_wave2_orders_digest',
    name: 'CRON: Wöchentliche Nachzügler-Bestellungen (Admin)',
    description: 'Läuft jeden Montag um 7 Uhr. Listet alle offenen Bestellungen für Events, deren Welle-2-Frist (Event +14 Tage) abgelaufen ist.',
    availableVariables: ['orderCount', 'eventCount', 'totalValue', 'ordersTableHtml'],
    recipientMode: 'configurable',
  },
  {
    key: 'event:mix_ready_for_release',
    name: 'Mix fertig (Audio-Release)',
    description:
      'Wird ausgelöst, wenn der Mix für ein Mimi-/Plus-Event fertiggestellt ist: ' +
      'der Engineer hat die Finals abgegeben (audio_pipeline_stage=finals_submitted) ' +
      'und – falls Schulsong angehängt ist – der Lehrer hat den Schulsong freigegeben ' +
      '(schulsong_released_at gesetzt). Polled hourly im 6–8 Uhr Berlin Fenster.',
    availableVariables: ['schoolName', 'eventDate', 'parentName', 'parentFirstName', 'childName', 'className', 'parentPortalLink'],
    recipientMode: 'specific',
  },
  {
    key: 'cron:registration_shortfall_t7',
    name: 'CRON: Registrierungen unter Schwelle (T-7)',
    description:
      'Läuft täglich um 7 Uhr. Sendet eine Erinnerung an die Lehrkraft, '
      + 'wenn 7 Tage vor dem Event weniger als 50% der erwarteten Kinder '
      + 'registriert sind. Zwei Schwere-Stufen: <50%, <33%.',
    availableVariables: [
      'teacherName', 'schoolName', 'eventDate',
      'registeredCount', 'expectedCount', 'percentRegistered',
      'daysUntilEvent', 'teacherPortalUrl',
    ],
    recipientMode: 'specific',
  },
];

export function getTriggerEvent(key: string): TriggerEvent | undefined {
  return TRIGGER_EVENT_CATALOG.find((e) => e.key === key);
}
