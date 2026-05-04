// Stub airtable transitively — same pattern as emailAutomationService.test.ts
jest.mock('airtable', () => ({
  __esModule: true,
  default: class AirtableStub {
    static configure() {}
    base() { return () => ({ select: () => ({ all: async () => [] }) }); }
  },
}));

// Stub the airtable service module so getAllEmailTemplates returns nothing.
// This simulates the pre-seed window: registry entries exist but no Airtable row.
jest.mock('./airtableService', () => ({
  getAirtableService: () => ({
    getAllEmailTemplates: async () => [],
    createEmailTemplate: jest.fn(async () => ({ id: 'rec_new' })),
    updateEmailTemplate: jest.fn(async () => undefined),
  }),
}));

// Replace the registry with a synthetic one we control.
jest.mock('@/lib/config/trigger-email-registry', () => {
  const TRIGGER_EMAIL_REGISTRY = [
    {
      slug: 'test_default_active',
      name: 'Default active',
      description: 'd',
      recipientType: 'teacher',
      defaultSubject: 's',
      defaultBodyHtml: 'b',
      availableVariables: [],
    },
    {
      slug: 'test_default_inactive',
      name: 'Default inactive',
      description: 'd',
      recipientType: 'teacher',
      defaultSubject: 's',
      defaultBodyHtml: 'b',
      availableVariables: [],
      defaultActive: false,
    },
  ];
  return {
    __esModule: true,
    TRIGGER_EMAIL_REGISTRY,
    getRegistryEntry: (slug: string) =>
      TRIGGER_EMAIL_REGISTRY.find((e: { slug: string }) => e.slug === slug),
  };
});

import { getAllTriggerTemplates, getTriggerTemplate } from './triggerTemplateService';

describe('defaultActive plumbing', () => {
  it('getAllTriggerTemplates returns active=true when defaultActive is unset', async () => {
    const all = await getAllTriggerTemplates();
    const e = all.find((t) => t.triggerSlug === 'test_default_active');
    expect(e?.active).toBe(true);
  });

  it('getAllTriggerTemplates returns active=false when defaultActive is explicitly false', async () => {
    const all = await getAllTriggerTemplates();
    const e = all.find((t) => t.triggerSlug === 'test_default_inactive');
    expect(e?.active).toBe(false);
  });

  it('getTriggerTemplate cache fallback returns active=false for defaultActive=false slug', async () => {
    const t = await getTriggerTemplate('test_default_inactive');
    expect(t.active).toBe(false);
  });

  it('getTriggerTemplate cache fallback returns active=true for unset slug', async () => {
    const t = await getTriggerTemplate('test_default_active');
    expect(t.active).toBe(true);
  });
});
