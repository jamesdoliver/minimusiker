/**
 * Email Automation Types
 *
 * Types for the automated email marketing system that sends time-triggered
 * emails to teachers and parents based on event dates.
 */

// =============================================================================
// Table IDs - Update these after creating tables in Airtable
// =============================================================================

export const EMAIL_TEMPLATES_TABLE_ID = 'tbl9M6cOhR6OpYJRe';
export const EMAIL_LOGS_TABLE_ID = 'tblxLemlKY8p8cIwS';

// =============================================================================
// Field IDs for EMAIL_TEMPLATES table
// =============================================================================

export const EMAIL_TEMPLATES_FIELD_IDS = {
  name: 'fldJnr0LjUf1fG3aK',                     // Single line text
  audience: 'fldnmFNebIrstXsWT',                 // Multi select: teacher, parent, non-buyers
  trigger_days: 'fldqvR1BPJg3oSEFN',             // Number (negative = before, positive = after)
  trigger_hour: 'fldZdp0R50gmHwLl2',             // Number (0-23, German time hour)
  email_subject: 'fldmkqyWITt9y8462',            // Single line text with {{variables}}
  email_body_html: 'fldhg7doIpDXwxcoO',          // Long text (HTML)
  active: 'fldBcHlpMUQCCN8iZ',                   // Checkbox
  is_minimusikertag: 'fldn63uUb14CkH4l3',       // Checkbox
  is_kita: 'fldBCfeWCeVNErpQW',                 // Checkbox
  is_plus: 'fldHIcAFxGOHLMZD9',                 // Checkbox
  is_schulsong: 'fldbYsFdCwHoTvhmh',            // Checkbox
  template_type: 'fld1FaqKGyWwWwOp6',            // Single Select: timeline, trigger
  trigger_slug: 'fldBJsRxe1PxvTXoL',              // Single line text
  trigger_description: 'fldibypBMULVBtcIH',        // Long text
  only_under_100: 'fld5822FIA25rLMdn',          // Checkbox - when true, only send to <100 kid events
} as const;

// =============================================================================
// Field IDs for EMAIL_LOGS table
// =============================================================================

export const EMAIL_LOGS_FIELD_IDS = {
  template_name: 'fldcNHa3GTYmp1mzp',            // Single line text
  event_id: 'fldejWMhTGwxz4Dr8',                 // Linked record to Events
  recipient_email: 'fldsg3jsbFjCtCj4O',          // Email
  recipient_type: 'fldP4i5NjOFb8n711',           // Single select: teacher, parent
  sent_at: 'fldHi7daVcCWpjrFj',                  // Date/time
  status: 'fld0HyrvPQtWQDGTj',                   // Single select: sent, failed, skipped
  error_message: 'fldObgfIAwwOjVWJC',            // Long text
  resend_message_id: 'fldlxL1Dav8yx3NoI',        // Single line text
} as const;

// =============================================================================
// Audience Types
// =============================================================================

export type AudienceValue = 'teacher' | 'parent' | 'non-buyers';
export type Audience = AudienceValue[];

export type EventTier = 'plus' | 'minimusikertag' | 'schulsong';

// =============================================================================
// Core Interfaces
// =============================================================================

/**
 * Email template stored in Airtable
 */
export interface EmailTemplate {
  id: string;                                    // Airtable record ID
  name: string;                                  // Human-readable name
  audience: Audience;                             // Who receives this email
  triggerDays: number;                           // Days relative to event (negative = before)
  triggerHour: number;                           // Hour of day to send (0-23 in Europe/Berlin time)
  subject: string;                               // Email subject with {{variables}}
  bodyHtml: string;                              // HTML body with {{variables}}
  active: boolean;                               // Whether template is active
  is_minimusikertag: boolean;                    // Event type filter
  is_kita: boolean;                              // Event type filter
  is_plus: boolean;                              // Event type filter
  is_schulsong: boolean;                         // Event type filter
  templateType?: 'timeline' | 'trigger';         // Template category
  triggerSlug?: string;                          // Unique slug for trigger templates
  triggerDescription?: string;                   // Description of when trigger fires
  only_under_100: boolean;                        // When true, only send to events with <100 kids
}

/**
 * Trigger email template — event-driven email with Airtable-stored overrides
 */
export interface TriggerEmailTemplate {
  id?: string;                                   // Airtable record ID (undefined if not yet seeded)
  triggerSlug: string;                           // Unique identifier e.g. 'teacher_magic_link'
  name: string;                                  // Human-readable name
  description: string;                           // When this trigger fires
  recipientType: 'admin' | 'teacher' | 'parent' | 'staff' | 'engineer';
  subject: string;                               // Email subject with {{variables}}
  bodyHtml: string;                              // HTML body with {{variables}}
  active: boolean;                               // Whether template is active
  availableVariables: string[];                  // Variables available for substitution
  isCustomized: boolean;                         // true if Airtable template differs from default
  triggerEventKey?: string;                      // Key from TRIGGER_EVENT_CATALOG
  triggerEventName?: string;                     // Resolved display name from catalog
  triggerEventDescription?: string;              // Resolved description from catalog
  hasSendNow?: boolean;                          // true if this trigger supports manual "Send Now"
}

/**
 * Email log entry stored in Airtable
 */
export interface EmailLog {
  id: string;                                    // Airtable record ID
  templateName: string;                          // Name of template used
  eventId: string;                               // Event identifier (or linked record ID)
  recipientEmail: string;                        // Email address sent to
  recipientType: 'teacher' | 'parent' | 'non-buyer'; // Type of recipient
  sentAt: string;                                // ISO timestamp
  status: 'sent' | 'failed' | 'skipped';         // Send status
  errorMessage?: string;                         // Error details if failed
  resendMessageId?: string;                      // Resend tracking ID
}

// =============================================================================
// Input/Output Types for Service Functions
// =============================================================================

/**
 * Input for creating a new email template
 */
export interface CreateEmailTemplateInput {
  name: string;
  audience: Audience;
  triggerDays: number;
  triggerHour?: number;                          // defaults to 7
  subject: string;
  bodyHtml: string;
  active?: boolean;
  is_minimusikertag?: boolean;
  is_kita?: boolean;
  is_plus?: boolean;
  is_schulsong?: boolean;
  templateType?: 'timeline' | 'trigger';
  triggerSlug?: string;
  triggerDescription?: string;
  only_under_100?: boolean;
}

/**
 * Input for updating an email template
 */
export interface UpdateEmailTemplateInput {
  name?: string;
  audience?: Audience;
  triggerDays?: number;
  triggerHour?: number;
  subject?: string;
  bodyHtml?: string;
  active?: boolean;
  is_minimusikertag?: boolean;
  is_kita?: boolean;
  is_plus?: boolean;
  is_schulsong?: boolean;
  templateType?: 'timeline' | 'trigger';
  triggerSlug?: string;
  triggerDescription?: string;
  only_under_100?: boolean;
}

/**
 * Input for creating an email log entry
 */
export interface CreateEmailLogInput {
  templateName: string;
  eventId: string;
  recipientEmail: string;
  recipientType: 'teacher' | 'parent' | 'non-buyer';
  status: 'sent' | 'failed' | 'skipped';
  errorMessage?: string;
  resendMessageId?: string;
}

// =============================================================================
// Template Variable Substitution
// =============================================================================

/**
 * Data available for template variable substitution
 * Variables in templates use {{variable_name}} syntax
 */
export interface TemplateData {
  // Event information
  school_name: string;
  event_date: string;                            // Formatted date string
  event_link: string;                            // URL to event/portal
  event_type?: string;                           // concert, recital, etc.

  // Teacher information (for teacher emails)
  teacher_name?: string;
  teacher_first_name?: string;
  teacher_portal_link?: string;

  // Parent information (for parent emails)
  parent_name?: string;
  parent_first_name?: string;
  child_name?: string;
  parent_portal_link?: string;
  access_code?: string;

  // Class information
  class_name?: string;
  class_time?: string;

  // Order/purchase information
  order_link?: string;

  // Internal: ISO date string for date math (not directly substitutable)
  _event_date_iso?: string;

  // Dynamic: any additional variables
  [key: string]: string | undefined;
}

// =============================================================================
// Recipient Types
// =============================================================================

/**
 * Recipient information for sending emails
 */
export interface EmailRecipient {
  email: string;
  name?: string;
  type: 'teacher' | 'parent' | 'non-buyer';
  eventId: string;
  classId?: string;
  // Additional data for template substitution
  templateData: Partial<TemplateData>;
}

// =============================================================================
// Automation Results
// =============================================================================

/**
 * Result of processing a single email send
 */
export interface EmailSendResult {
  recipientEmail: string;
  recipientType: 'teacher' | 'parent' | 'non-buyer';
  eventId: string;
  templateName: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Result of running the full email automation process
 */
export interface AutomationResult {
  processedAt: string;                           // ISO timestamp
  templatesProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;                         // Already sent or no recipients
  details: EmailSendResult[];
  errors: string[];
}

// =============================================================================
// Events Hitting Threshold
// =============================================================================

/**
 * Event that matches a template's trigger threshold
 */
export interface EventThresholdMatch {
  eventId: string;
  eventRecordId: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
  daysUntilEvent: number;                        // Positive = future, negative = past
  accessCode?: number;                           // Event short URL code for {{event_link}}
  isKita?: boolean;                              // true = KiTa event, false/undefined = Schule
  isMinimusikertag?: boolean;
  isPlus?: boolean;
  isSchulsong?: boolean;
  isUnder100?: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from the email automation cron endpoint
 */
export interface CronAutomationResponse {
  success: boolean;
  mode?: 'live' | 'dry-run';
  result?: AutomationResult;
  schulsongResult?: { sent: number; skipped: number; failed: number; errors: string[] };
  error?: string;
}

/**
 * Response from the test email endpoint
 */
export interface TestEmailResponse {
  success: boolean;
  messageId?: string;
  previewData?: TemplateData;
  error?: string;
}
