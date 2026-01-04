/**
 * Email Service using Brevo (formerly Sendinblue)
 * Handles all transactional email sending via Brevo templates
 */

import * as Brevo from '@getbrevo/brevo';
import {
  EmailRecipient,
  SendEmailOptions,
  SendEmailResult,
  MagicLinkParams,
  RecordingReadyParams,
  NewBookingAlertParams,
  ParentWelcomeParams,
} from '@/lib/types/email';

class EmailService {
  private api: Brevo.TransactionalEmailsApi;
  private fromEmail: string;
  private fromName: string;
  private isConfigured: boolean;

  constructor() {
    this.api = new Brevo.TransactionalEmailsApi();
    this.fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@minimusiker.de';
    this.fromName = process.env.BREVO_FROM_NAME || 'MiniMusiker';

    const apiKey = process.env.BREVO_API_KEY;
    this.isConfigured = !!apiKey;

    if (apiKey) {
      this.api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    }
  }

  /**
   * Core method to send an email via Brevo template
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.isConfigured) {
      // Development fallback - log instead of sending
      console.log('========================================');
      console.log('EMAIL (Brevo not configured):');
      console.log('To:', options.to);
      console.log('Template ID:', options.templateId);
      console.log('Params:', JSON.stringify(options.params, null, 2));
      console.log('========================================');
      return { success: true, messageId: 'dev-mode' };
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { email: this.fromEmail, name: this.fromName };
      sendSmtpEmail.to = recipients.map((r) => ({ email: r.email, name: r.name }));
      sendSmtpEmail.templateId = options.templateId;
      sendSmtpEmail.params = options.params;
      if (options.tags) {
        sendSmtpEmail.tags = options.tags;
      }
      if (options.scheduledAt) {
        sendSmtpEmail.scheduledAt = options.scheduledAt;
      }

      const result = await this.api.sendTransacEmail(sendSmtpEmail);

      return {
        success: true,
        messageId: result.body?.messageId,
      };
    } catch (error) {
      console.error('Brevo email error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
      };
    }
  }

  /**
   * Send magic link email to teacher for portal login
   */
  async sendTeacherMagicLink(
    email: string,
    name: string,
    magicLinkUrl: string
  ): Promise<SendEmailResult> {
    const templateId = this.getTemplateId('BREVO_TEMPLATE_TEACHER_MAGIC_LINK');

    const params: MagicLinkParams = {
      teacherName: name,
      magicLinkUrl,
    };

    return this.sendEmail({
      to: { email, name },
      templateId,
      params,
      tags: ['teacher-portal', 'magic-link'],
    });
  }

  /**
   * Send recording ready notification to parents
   */
  async sendRecordingReadyNotification(
    recipients: EmailRecipient[],
    params: RecordingReadyParams
  ): Promise<SendEmailResult> {
    const templateId = this.getTemplateId('BREVO_TEMPLATE_RECORDING_READY');

    return this.sendEmail({
      to: recipients,
      templateId,
      params,
      tags: ['parent-notification', 'recording-ready'],
    });
  }

  /**
   * Send new booking alert to staff member
   */
  async sendNewBookingAlert(
    staffEmail: string,
    staffName: string,
    params: NewBookingAlertParams
  ): Promise<SendEmailResult> {
    const templateId = this.getTemplateId('BREVO_TEMPLATE_NEW_BOOKING_ALERT');

    return this.sendEmail({
      to: { email: staffEmail, name: staffName },
      templateId,
      params,
      tags: ['staff-notification', 'new-booking'],
    });
  }

  /**
   * Send welcome email to new parent
   */
  async sendParentWelcome(
    email: string,
    params: ParentWelcomeParams
  ): Promise<SendEmailResult> {
    const templateId = this.getTemplateId('BREVO_TEMPLATE_PARENT_WELCOME');

    return this.sendEmail({
      to: { email, name: params.parentName },
      templateId,
      params,
      tags: ['parent-notification', 'welcome'],
    });
  }

  /**
   * Get template ID from environment variable
   */
  private getTemplateId(envVar: string): number {
    const value = process.env[envVar];

    if (!value) {
      throw new Error(`Template ID not configured: ${envVar}`);
    }

    const templateId = parseInt(value, 10);
    if (isNaN(templateId)) {
      throw new Error(`Invalid template ID for ${envVar}: ${value}`);
    }

    return templateId;
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

export { EmailService };
