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
];

export function getTriggerEvent(key: string): TriggerEvent | undefined {
  return TRIGGER_EVENT_CATALOG.find((e) => e.key === key);
}
