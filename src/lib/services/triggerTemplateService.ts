/**
 * Trigger Template Service
 *
 * Manages trigger email templates: Airtable lookup with hardcoded fallback,
 * variable substitution, seeding, and caching.
 */

import { getAirtableService } from './airtableService';
import { getCampaignEmailTemplate, EmailTemplateOptions } from './emailTemplateWrapper';
import { TRIGGER_EMAIL_REGISTRY, getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { getTriggerEvent } from '@/lib/config/trigger-event-catalog';
import { TriggerEmailTemplate } from '@/lib/types/email-automation';

// ─── In-memory cache (60s TTL) ────────────────────────────────────────
interface CacheEntry {
  data: TriggerTemplateResult;
  expiresAt: number;
}

const templateCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached(slug: string): TriggerTemplateResult | null {
  const entry = templateCache.get(slug);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) templateCache.delete(slug);
  return null;
}

function setCache(slug: string, data: TriggerTemplateResult): void {
  templateCache.set(slug, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Types ────────────────────────────────────────────────────────────

export interface TriggerTemplateResult {
  active: boolean;
  subject: string;
  bodyHtml: string;
  isCustomized: boolean;
}

// ─── Batch cache population ──────────────────────────────────────────

let populatePromise: Promise<void> | null = null;

/**
 * Fetch all templates from Airtable once and populate cache entries
 * for every registry slug. Uses a concurrency guard to prevent
 * duplicate Airtable calls from concurrent requests.
 */
async function populateAllTriggerCaches(): Promise<void> {
  try {
    const airtable = getAirtableService();
    const allTemplates = await airtable.getAllEmailTemplates();
    const triggerRecords = new Map(
      allTemplates
        .filter((t) => t.templateType === 'trigger' && t.triggerSlug)
        .map((t) => [t.triggerSlug!, t])
    );

    for (const entry of TRIGGER_EMAIL_REGISTRY) {
      const record = triggerRecords.get(entry.slug);
      let result: TriggerTemplateResult;

      if (record) {
        if (!record.active) {
          result = { active: false, subject: '', bodyHtml: '', isCustomized: false };
        } else {
          const isCustomized =
            record.subject !== entry.defaultSubject ||
            record.bodyHtml !== entry.defaultBodyHtml;
          result = {
            active: true,
            subject: record.subject,
            bodyHtml: record.bodyHtml,
            isCustomized,
          };
        }
      } else {
        result = {
          active: true,
          subject: entry.defaultSubject,
          bodyHtml: entry.defaultBodyHtml,
          isCustomized: false,
        };
      }

      setCache(entry.slug, result);
    }
  } catch (error) {
    console.error('[TriggerTemplate] Error batch-populating cache, using defaults:', error);
    // Populate cache with registry defaults so we don't retry on every call
    for (const entry of TRIGGER_EMAIL_REGISTRY) {
      if (!getCached(entry.slug)) {
        setCache(entry.slug, {
          active: true,
          subject: entry.defaultSubject,
          bodyHtml: entry.defaultBodyHtml,
          isCustomized: false,
        });
      }
    }
  }
}

async function ensureCachePopulated(): Promise<void> {
  if (populatePromise) {
    await populatePromise;
    return;
  }
  populatePromise = populateAllTriggerCaches();
  try {
    await populatePromise;
  } finally {
    populatePromise = null;
  }
}

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Get a trigger template by slug.
 * On cache miss, batch-fetches all templates from Airtable in one call.
 */
export async function getTriggerTemplate(slug: string): Promise<TriggerTemplateResult> {
  // Check cache first
  const cached = getCached(slug);
  if (cached) return cached;

  const registryEntry = getRegistryEntry(slug);
  if (!registryEntry) {
    return { active: false, subject: '', bodyHtml: '', isCustomized: false };
  }

  // Batch-populate all slugs on any cache miss
  await ensureCachePopulated();

  // Re-check cache after population
  const populated = getCached(slug);
  if (populated) return populated;

  // Shouldn't happen, but fall back to registry default
  return {
    active: true,
    subject: registryEntry.defaultSubject,
    bodyHtml: registryEntry.defaultBodyHtml,
    isCustomized: false,
  };
}

/**
 * Substitute {{variable}} placeholders in a template string.
 */
export function renderTriggerTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
  }
  // Remove any remaining unsubstituted placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

/**
 * Render a full trigger email: substitute variables and wrap in branded template.
 */
export function renderFullTriggerEmail(
  bodyHtml: string,
  variables: Record<string, string>,
  templateOptions?: EmailTemplateOptions
): string {
  const substituted = renderTriggerTemplate(bodyHtml, variables);
  return getCampaignEmailTemplate(substituted, templateOptions);
}

/**
 * Seed missing trigger templates into Airtable.
 * For each slug in the registry, creates an Airtable record if one doesn't exist.
 */
export async function seedMissingTriggerTemplates(): Promise<{ seeded: string[]; existing: string[] }> {
  const seeded: string[] = [];
  const existing: string[] = [];

  try {
    const airtable = getAirtableService();
    const allTemplates = await airtable.getAllEmailTemplates();
    const existingSlugs = new Set(
      allTemplates
        .filter((t) => t.templateType === 'trigger' && t.triggerSlug)
        .map((t) => t.triggerSlug!)
    );

    for (const entry of TRIGGER_EMAIL_REGISTRY) {
      if (existingSlugs.has(entry.slug)) {
        existing.push(entry.slug);
        continue;
      }

      await airtable.createEmailTemplate({
        name: entry.name,
        // Audience field only accepts 'teacher'|'parent'|'non-buyers'.
        // For trigger templates, audience is cosmetic — recipientType from registry
        // determines actual routing. Map unsupported types to 'teacher'.
        audience: [entry.recipientType === 'parent' ? 'parent' : 'teacher'] as ('teacher' | 'parent' | 'non-buyers')[],
        triggerDays: 0,
        triggerHour: 0,
        subject: entry.defaultSubject,
        bodyHtml: entry.defaultBodyHtml,
        active: true,
        templateType: 'trigger',
        triggerSlug: entry.slug,
        triggerDescription: entry.description,
      });

      seeded.push(entry.slug);
    }
  } catch (error) {
    console.error('[TriggerTemplate] Error seeding templates:', error);
  }

  // Clear cache after seeding
  templateCache.clear();

  return { seeded, existing };
}

/**
 * Get all trigger templates, merged with registry data.
 * Returns one entry per registry slug.
 */
export async function getAllTriggerTemplates(): Promise<TriggerEmailTemplate[]> {
  try {
    const airtable = getAirtableService();
    const allTemplates = await airtable.getAllEmailTemplates();
    const triggerRecords = allTemplates.filter(
      (t) => t.templateType === 'trigger' && t.triggerSlug
    );

    // Build a map of slug → Airtable record
    const recordMap = new Map(
      triggerRecords.map((r) => [r.triggerSlug!, r])
    );

    return TRIGGER_EMAIL_REGISTRY.map((entry) => {
      const record = recordMap.get(entry.slug);
      const isCustomized = record
        ? record.subject !== entry.defaultSubject || record.bodyHtml !== entry.defaultBodyHtml
        : false;
      const triggerEvent = entry.triggerEventKey
        ? getTriggerEvent(entry.triggerEventKey)
        : undefined;

      return {
        id: record?.id,
        triggerSlug: entry.slug,
        name: entry.name,
        description: entry.description,
        recipientType: entry.recipientType,
        subject: record?.subject ?? entry.defaultSubject,
        bodyHtml: record?.bodyHtml ?? entry.defaultBodyHtml,
        active: record?.active ?? true,
        availableVariables: entry.availableVariables,
        isCustomized,
        triggerEventKey: entry.triggerEventKey,
        triggerEventName: triggerEvent?.name,
        triggerEventDescription: triggerEvent?.description,
        hasSendNow: !!entry.sendNow,
      };
    });
  } catch (error) {
    console.error('[TriggerTemplate] Error fetching all templates:', error);
    // Fall back to registry defaults
    return TRIGGER_EMAIL_REGISTRY.map((entry) => {
      const triggerEvent = entry.triggerEventKey
        ? getTriggerEvent(entry.triggerEventKey)
        : undefined;
      return {
        triggerSlug: entry.slug,
        name: entry.name,
        description: entry.description,
        recipientType: entry.recipientType,
        subject: entry.defaultSubject,
        bodyHtml: entry.defaultBodyHtml,
        active: true,
        availableVariables: entry.availableVariables,
        isCustomized: false,
        triggerEventKey: entry.triggerEventKey,
        triggerEventName: triggerEvent?.name,
        triggerEventDescription: triggerEvent?.description,
        hasSendNow: !!entry.sendNow,
      };
    });
  }
}

/**
 * Get a single trigger template by slug (full detail for editor).
 */
export async function getTriggerTemplateBySlug(slug: string): Promise<TriggerEmailTemplate | null> {
  const entry = getRegistryEntry(slug);
  if (!entry) return null;

  try {
    const airtable = getAirtableService();
    const allTemplates = await airtable.getAllEmailTemplates();
    const record = allTemplates.find(
      (t) => t.templateType === 'trigger' && t.triggerSlug === slug
    );

    const isCustomized = record
      ? record.subject !== entry.defaultSubject || record.bodyHtml !== entry.defaultBodyHtml
      : false;
    const triggerEvent = entry.triggerEventKey
      ? getTriggerEvent(entry.triggerEventKey)
      : undefined;

    return {
      id: record?.id,
      triggerSlug: entry.slug,
      name: entry.name,
      description: entry.description,
      recipientType: entry.recipientType,
      subject: record?.subject ?? entry.defaultSubject,
      bodyHtml: record?.bodyHtml ?? entry.defaultBodyHtml,
      active: record?.active ?? true,
      availableVariables: entry.availableVariables,
      isCustomized,
      triggerEventKey: entry.triggerEventKey,
      triggerEventName: triggerEvent?.name,
      triggerEventDescription: triggerEvent?.description,
      hasSendNow: !!entry.sendNow,
    };
  } catch (error) {
    console.error(`[TriggerTemplate] Error fetching template ${slug}:`, error);
    const triggerEvent = entry.triggerEventKey
      ? getTriggerEvent(entry.triggerEventKey)
      : undefined;
    return {
      triggerSlug: entry.slug,
      name: entry.name,
      description: entry.description,
      recipientType: entry.recipientType,
      subject: entry.defaultSubject,
      bodyHtml: entry.defaultBodyHtml,
      active: true,
      availableVariables: entry.availableVariables,
      isCustomized: false,
      triggerEventKey: entry.triggerEventKey,
      triggerEventName: triggerEvent?.name,
      triggerEventDescription: triggerEvent?.description,
      hasSendNow: !!entry.sendNow,
    };
  }
}

/**
 * Update a trigger template in Airtable.
 */
export async function updateTriggerTemplate(
  slug: string,
  updates: { subject?: string; bodyHtml?: string; active?: boolean }
): Promise<TriggerEmailTemplate | null> {
  const entry = getRegistryEntry(slug);
  if (!entry) return null;

  const airtable = getAirtableService();
  const allTemplates = await airtable.getAllEmailTemplates();
  const record = allTemplates.find(
    (t) => t.templateType === 'trigger' && t.triggerSlug === slug
  );

  if (!record) {
    // Need to seed first
    await seedMissingTriggerTemplates();
    // Retry
    const allTemplatesRetry = await airtable.getAllEmailTemplates();
    const retryRecord = allTemplatesRetry.find(
      (t) => t.templateType === 'trigger' && t.triggerSlug === slug
    );
    if (!retryRecord) return null;
    await airtable.updateEmailTemplate(retryRecord.id, updates);
  } else {
    await airtable.updateEmailTemplate(record.id, updates);
  }

  // Clear cache for this slug
  templateCache.delete(slug);

  return getTriggerTemplateBySlug(slug);
}

/**
 * Reset a trigger template to its registry default.
 */
export async function resetTriggerTemplate(slug: string): Promise<TriggerEmailTemplate | null> {
  const entry = getRegistryEntry(slug);
  if (!entry) return null;

  return updateTriggerTemplate(slug, {
    subject: entry.defaultSubject,
    bodyHtml: entry.defaultBodyHtml,
  });
}

/**
 * Get sample variables for preview rendering of a trigger template.
 */
export function getSampleVariables(slug: string): Record<string, string> {
  const samples: Record<string, Record<string, string>> = {
    teacher_magic_link: {
      teacherName: 'Frau Müller',
      magicLinkUrl: 'https://app.minimusiker.de/lehrer/login?token=sample-token-123',
    },
    new_booking_notification: {
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      contactName: 'Herr Schmidt',
      contactEmail: 'schmidt@schule.de',
      contactPhone: '0171 1234567',
      estimatedChildren: '120',
      region: 'Bayern',
      address: 'Schulstraße 1, 80331 München',
    },
    date_change_notification: {
      schoolName: 'Grundschule Sonnenschein',
      oldDate: 'Montag, 15. März 2025',
      newDate: 'Mittwoch, 17. März 2025',
      contactName: 'Herr Schmidt',
      contactEmail: 'schmidt@schule.de',
      contactPhone: '0171 1234567',
    },
    cancellation_notification: {
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      contactName: 'Herr Schmidt',
      contactEmail: 'schmidt@schule.de',
      contactPhone: '0171 1234567',
      title: 'Buchung storniert',
      message: 'Diese Buchung wurde im System als storniert markiert.',
      reasonText: 'Storniert',
    },
    schulsong_teacher_approved: {
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      adminUrl: 'https://app.minimusiker.de/admin/bookings',
    },
    parent_welcome: {
      parentName: 'Anna',
      childName: 'Max, Lena',
      schoolName: 'Grundschule Sonnenschein',
    },
    staff_booking_alert: {
      staffName: 'Thomas',
      schoolName: 'Grundschule Sonnenschein',
      contactName: 'Herr Schmidt',
      contactEmail: 'schmidt@schule.de',
      bookingDate: 'Montag, 15. März 2025',
      estimatedChildren: '120',
      region: 'Bayern',
    },
    staff_reassignment: {
      staffName: 'Thomas',
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      schoolAddress: 'Schulstraße 1, 80331 München',
      contactPerson: 'Herr Schmidt',
      contactEmail: 'schmidt@schule.de',
      contactPhone: '0171 1234567',
      staffPortalUrl: 'https://app.minimusiker.de/staff',
    },
    engineer_audio_uploaded: {
      engineerName: 'Max',
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      eventId: 'evt_example_123',
      engineerPortalUrl: 'https://app.minimusiker.de/engineer',
    },
    schulsong_audio_release: {
      schoolName: 'Grundschule Sonnenschein',
      eventLink: 'https://minimusiker.app/e/1234',
      parentPortalLink: 'https://minimusiker.app/familie',
    },
    schulsong_parent_release: {
      schoolName: 'Grundschule Sonnenschein',
      eventLink: 'https://minimusiker.app/e/1234',
      parentPortalLink: 'https://minimusiker.app/familie',
      parentName: 'Anna',
      merchandiseDeadline: '15.03.2025',
    },
    engineer_schulsong_uploaded: {
      engineerName: 'Max',
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      eventId: 'evt_example_123',
      engineerPortalUrl: 'https://app.minimusiker.de/engineer',
    },
    engineer_minimusiker_uploaded: {
      engineerName: 'Max',
      schoolName: 'Grundschule Sonnenschein',
      eventDate: 'Montag, 15. März 2025',
      eventId: 'evt_example_123',
      engineerPortalUrl: 'https://app.minimusiker.de/engineer',
    },
  };

  return samples[slug] || {};
}
