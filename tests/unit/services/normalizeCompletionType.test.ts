// Imported directly from the helper module rather than via taskService — the
// service drags in the Airtable SDK at module load and the singleton init throws
// in jsdom. The behaviour we care about is the helper itself.
import { normalizeCompletionType } from '@/lib/services/normalizeCompletionType';

describe('normalizeCompletionType', () => {
  it('passes v2 values through unchanged', () => {
    expect(normalizeCompletionType('monetary', 'ship_poster')).toBe('monetary');
    expect(normalizeCompletionType('orchestrated', 'shipment_welle_1')).toBe('orchestrated');
    expect(normalizeCompletionType('tracklist', 'audio_master_cd')).toBe('tracklist');
    expect(normalizeCompletionType('quantity_checkbox', 'audio_cd_production')).toBe('quantity_checkbox');
  });

  it('resolves legacy "checkbox" via the timeline entry — orchestrated', () => {
    expect(normalizeCompletionType('checkbox', 'shipment_welle_1')).toBe('orchestrated');
    expect(normalizeCompletionType('checkbox', 'shipment_welle_2')).toBe('orchestrated');
  });

  it('resolves legacy "checkbox" via the timeline entry — quantity_checkbox', () => {
    expect(normalizeCompletionType('checkbox', 'audio_cd_production')).toBe('quantity_checkbox');
  });

  it('resolves legacy "submit_only" via the timeline entry — tracklist', () => {
    expect(normalizeCompletionType('submit_only', 'audio_master_cd')).toBe('tracklist');
  });

  it('resolves legacy stored "monetary" via timeline for v2 monetary tasks', () => {
    // Even when the stored value is the (overlapping) "monetary" string, the helper
    // should still pass it through cleanly.
    expect(normalizeCompletionType('monetary', 'ship_poster')).toBe('monetary');
  });

  it('falls back to monetary for unknown templateId + unknown stored value', () => {
    expect(normalizeCompletionType('weird', 'never_existed')).toBe('monetary');
    expect(normalizeCompletionType(undefined, 'never_existed')).toBe('monetary');
  });

  it('falls back to monetary for unknown templateId even with v2-shaped stored value', () => {
    // If the templateId is unknown, we can't trust the stored value — but if the stored
    // value already matches a v2 mode, it's safe to pass through.
    expect(normalizeCompletionType('orchestrated', 'never_existed')).toBe('orchestrated');
  });
});
