import { validateTimelineOverrideValues } from './eventThresholds';

describe('validateTimelineOverrideValues', () => {
  it('accepts an empty object', () => {
    expect(validateTimelineOverrideValues({})).toBeNull();
  });

  describe('numeric day thresholds', () => {
    it('accepts in-range numbers (positive and negative)', () => {
      expect(validateTimelineOverrideValues({ early_bird_deadline_days: 19 })).toBeNull();
      expect(validateTimelineOverrideValues({ personalized_clothing_cutoff_days: -4 })).toBeNull();
      expect(validateTimelineOverrideValues({ early_bird_deadline_days: 0 })).toBeNull();
    });

    it('rejects numbers beyond +/-365', () => {
      expect(validateTimelineOverrideValues({ early_bird_deadline_days: 400 })).toBe(
        'Invalid value for early_bird_deadline_days: must be a finite number between -365 and 365'
      );
      expect(validateTimelineOverrideValues({ early_bird_deadline_days: -366 })).toBe(
        'Invalid value for early_bird_deadline_days: must be a finite number between -365 and 365'
      );
    });

    it('rejects non-finite and non-number values', () => {
      expect(validateTimelineOverrideValues({ full_release_days: NaN })).toContain('must be a finite number');
      expect(validateTimelineOverrideValues({ full_release_days: '7' as unknown as number })).toContain(
        'must be a finite number'
      );
    });
  });

  describe('audio_hidden (boolean kill-switch)', () => {
    it('accepts boolean values', () => {
      expect(validateTimelineOverrideValues({ audio_hidden: true })).toBeNull();
      expect(validateTimelineOverrideValues({ audio_hidden: false })).toBeNull();
    });

    it('rejects non-boolean values', () => {
      expect(validateTimelineOverrideValues({ audio_hidden: 1 })).toBe(
        'Invalid value for audio_hidden: must be a boolean'
      );
    });
  });

  describe('communications_paused (boolean kill-switch)', () => {
    // Regression: this boolean key previously fell through to the numeric guard and
    // produced "must be a finite number between -365 and 365", making it impossible
    // to pause communications from the event settings UI.
    it('accepts boolean values', () => {
      expect(validateTimelineOverrideValues({ communications_paused: true })).toBeNull();
      expect(validateTimelineOverrideValues({ communications_paused: false })).toBeNull();
    });

    it('rejects non-boolean values', () => {
      expect(validateTimelineOverrideValues({ communications_paused: 5 })).toBe(
        'Invalid value for communications_paused: must be a boolean'
      );
    });
  });

  describe('hidden_products (string array)', () => {
    it('accepts arrays of strings, including empty', () => {
      expect(validateTimelineOverrideValues({ hidden_products: [] })).toBeNull();
      expect(validateTimelineOverrideValues({ hidden_products: ['bluetooth-box', 'tshirt'] })).toBeNull();
    });

    it('rejects non-arrays and non-string members', () => {
      expect(validateTimelineOverrideValues({ hidden_products: 'tshirt' as unknown as string[] })).toBe(
        'Invalid value for hidden_products: must be an array of strings'
      );
      expect(validateTimelineOverrideValues({ hidden_products: [1] as unknown as string[] })).toBe(
        'Invalid value for hidden_products: must be an array of strings'
      );
    });
  });

  describe('nested Phase 2 objects', () => {
    it('skips milestones and task_offsets without validating their shape', () => {
      expect(validateTimelineOverrideValues({ milestones: { foo: 3 } })).toBeNull();
      expect(validateTimelineOverrideValues({ task_offsets: { 'some-task': -2 } })).toBeNull();
    });
  });

  it('accepts a realistic combined override blob', () => {
    expect(
      validateTimelineOverrideValues({
        early_bird_deadline_days: 19,
        personalized_clothing_cutoff_days: -4,
        audio_hidden: false,
        communications_paused: true,
        hidden_products: ['bluetooth-box'],
        milestones: { preview: 7 },
      })
    ).toBeNull();
  });

  it('returns the first error when multiple keys are invalid', () => {
    const result = validateTimelineOverrideValues({ communications_paused: 5, early_bird_deadline_days: 999 });
    expect(result).not.toBeNull();
  });
});
