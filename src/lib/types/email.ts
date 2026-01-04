/**
 * Email types for Brevo integration
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  templateId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  tags?: string[];
  scheduledAt?: Date;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Template parameter interfaces
export interface MagicLinkParams {
  teacherName: string;
  magicLinkUrl: string;
}

export interface RecordingReadyParams {
  schoolName: string;
  className: string;
  eventDate: string;
  portalUrl: string;
}

export interface NewBookingAlertParams {
  schoolName: string;
  contactName: string;
  contactEmail: string;
  bookingDate: string;
  estimatedChildren: number;
  region?: string;
}

export interface ParentWelcomeParams {
  parentName: string;
  childName: string;
  schoolName: string;
}
