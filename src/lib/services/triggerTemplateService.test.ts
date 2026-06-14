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
const mockCreateEmailTemplate = jest.fn(async () => ({ id: 'rec_new' }));
const mockUpdateEmailTemplate = jest.fn(async () => undefined);

jest.mock('./airtableService', () => ({
  getAirtableService: () => ({
    getAllEmailTemplates: async () => [],
    createEmailTemplate: mockCreateEmailTemplate,
    updateEmailTemplate: mockUpdateEmailTemplate,
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

import {
  getAllTriggerTemplates,
  getTriggerTemplate,
  getTriggerTemplateBySlug,
  seedMissingTriggerTemplates,
  renderTriggerTemplate,
  getSampleVariables,
} from './triggerTemplateService';

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

describe('seedMissingTriggerTemplates honors defaultActive', () => {
  beforeEach(() => {
    mockCreateEmailTemplate.mockClear();
  });

  it('seeds with active=false when defaultActive is explicitly false', async () => {
    await seedMissingTriggerTemplates();
    expect(mockCreateEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSlug: 'test_default_inactive', active: false }),
    );
  });

  it('seeds with active=true when defaultActive is unset', async () => {
    await seedMissingTriggerTemplates();
    expect(mockCreateEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSlug: 'test_default_active', active: true }),
    );
  });
});

describe('getTriggerTemplateBySlug honors defaultActive', () => {
  it('returns active=true for unset defaultActive', async () => {
    const t = await getTriggerTemplateBySlug('test_default_active');
    expect(t?.active).toBe(true);
  });

  it('returns active=false when defaultActive=false and no Airtable record', async () => {
    const t = await getTriggerTemplateBySlug('test_default_inactive');
    expect(t?.active).toBe(false);
  });
});

describe('renderTriggerTemplate variable resolution', () => {
  // The trigger send-path injects camelCase keys (childName, parentFirstName)
  // while the timeline/preview editor documents snake_case ({{child_name}}).
  // A template override authored in snake_case must still render.
  it('resolves snake_case body tokens from a camelCase variables map', () => {
    const out = renderTriggerTemplate(
      'Hallo {{parent_first_name}}, hier singt {{child_name}} an der {{school_name}}.',
      { parentFirstName: 'Anna', childName: 'Max', schoolName: 'GS Sonnenschein' }
    );
    expect(out).toBe('Hallo Anna, hier singt Max an der GS Sonnenschein.');
  });

  it('still resolves camelCase tokens (no regression)', () => {
    const out = renderTriggerTemplate(
      'Hallo {{parentFirstName}}, hier singt {{childName}}.',
      { parentFirstName: 'Anna', childName: 'Max' }
    );
    expect(out).toBe('Hallo Anna, hier singt Max.');
  });

  it('resolves triple-brace (unescaped) tokens under both conventions', () => {
    const out = renderTriggerTemplate('{{{child_name}}} / {{{childName}}}', {
      childName: 'Max & Co',
    });
    expect(out).toBe('Max & Co / Max & Co');
  });

  it('strips genuinely unknown placeholders', () => {
    const out = renderTriggerTemplate('Hallo {{unknown_token}}!', { childName: 'Max' });
    expect(out).toBe('Hallo !');
  });

  it('inserts $ sequences in values literally (no replacement-string interpolation)', () => {
    // URL-bearing variables (signed tokens) can contain $&, $1, $$ — these must
    // not be interpreted as String.replace replacement patterns.
    const out = renderTriggerTemplate('Link: {{parentPortalLink}}', {
      parentPortalLink: 'https://x.test/p?t=a$1b$&c$$d',
    });
    expect(out).toBe('Link: https://x.test/p?t=a$1b$&c$$d');
  });
});

describe('getSampleVariables for mix-ready trigger templates', () => {
  it.each([
    'parent_mix_ready_audio_buyer',
    'parent_mix_ready_non_audio_buyer',
    'teacher_mix_ready',
  ])('returns non-empty preview sample data for %s', (slug) => {
    const vars = getSampleVariables(slug);
    expect(Object.keys(vars).length).toBeGreaterThan(0);
    // childName/parentFirstName drive the personalization that broke in prod.
    if (slug.startsWith('parent_')) {
      expect(vars.childName).toBeTruthy();
      expect(vars.parentFirstName).toBeTruthy();
    }
  });
});
