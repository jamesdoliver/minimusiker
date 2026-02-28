import { DealType, DealConfig, CustomFees } from '@/lib/types/airtable';

export interface FeeBreakdown {
  base: number;
  items: { label: string; amount: number }[];
  total: number;
}

export const MIMU_DEFAULTS = {
  base: 0,
  under_100_kids: 600,
  distance_surcharge: 200,
  music_pricing: 0,
  cheaper_music_small: 1000,     // LEGACY
  cheaper_music_large: 2000,     // LEGACY
} as const;

export const MIMU_SCS_DEFAULTS = {
  base: 9500,
  over_250_kids: 2000,
  standard_song_discount: -500,
  no_song_discount: -1000,
  no_shirts_discount: -3000,
} as const;

/** Return custom override if set, otherwise the default. Allows 0 as valid override. */
function fee(cf: CustomFees | undefined, key: keyof CustomFees, defaultValue: number): number {
  const v = cf?.[key];
  return v !== undefined ? v : defaultValue;
}

/** Auto-toggle: kleine Einrichtung ON when kids < 100 (admin can override) */
export function isKleineEinrichtungOn(config: DealConfig, estimatedChildren?: number): boolean {
  if (config.kleine_einrichtung_enabled !== undefined) return config.kleine_einrichtung_enabled;
  return (estimatedChildren ?? 0) < 100;
}

/** Auto-toggle: grosse Einrichtung ON when kids > 250 (admin can override) */
export function isGrosseEinrichtungOn(config: DealConfig, estimatedChildren?: number): boolean {
  if (config.grosse_einrichtung_enabled !== undefined) return config.grosse_einrichtung_enabled;
  return (estimatedChildren ?? 0) > 250;
}

/** Append gratis items and custom fees (shared across all deal types) */
function appendSharedItems(items: { label: string; amount: number }[], config: DealConfig): void {
  const cf = config.custom_fees;

  // Gratis T-Shirts
  if (config.gratis_tshirts_enabled) {
    const amount = fee(cf, 'gratis_tshirts', 0);
    if (amount !== 0) {
      const qty = config.gratis_tshirts_quantity ?? 0;
      items.push({ label: `Gratis T-Shirts (x${qty})`, amount });
    }
  }

  // Gratis Minicards
  if (config.gratis_minicards_enabled) {
    const amount = fee(cf, 'gratis_minicards', 0);
    if (amount !== 0) {
      const qty = config.gratis_minicards_quantity ?? 0;
      items.push({ label: `Gratis Minicards (x${qty})`, amount });
    }
  }

  // Additional custom fees
  if (config.additional_fees) {
    for (const f of config.additional_fees) {
      if (f.title || f.amount !== 0) {
        items.push({ label: f.title || 'Custom Fee', amount: f.amount });
      }
    }
  }
}

/**
 * Calculate the school-facing fee for a deal.
 *
 * #mimu: starts at €0, surcharges added
 * #mimuSCS: starts at €9,500, surcharges/opt-outs applied
 * #schus / #schusXL: returns breakdown only when gratis/custom fees exist
 */
export function calculateDealFee(
  dealType: DealType,
  config: DealConfig,
  estimatedChildren?: number
): FeeBreakdown | null {
  const kids = estimatedChildren ?? 0;
  const cf = config.custom_fees;

  if (dealType === 'schus' || dealType === 'schus_xl') {
    // Show breakdown only if there are gratis or custom fee items
    const items: { label: string; amount: number }[] = [];
    appendSharedItems(items, config);
    if (items.length === 0) return null;
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    return { base: 0, items, total };
  }

  if (dealType === 'mimu') {
    const base = config.pauschale_enabled !== false
      ? fee(cf, 'base', MIMU_DEFAULTS.base)
      : 0;
    const items: { label: string; amount: number }[] = [];

    // Plus-Preise für Musik
    if (config.music_pricing_enabled === true) {
      items.push({ label: 'Plus-Preise für Musik', amount: fee(cf, 'music_pricing', MIMU_DEFAULTS.music_pricing) });
    } else if (config.music_pricing_enabled === undefined && config.cheaper_music === true) {
      // Legacy fallback: old configs with cheaper_music
      const surcharge = kids > 250
        ? fee(cf, 'cheaper_music_large', MIMU_DEFAULTS.cheaper_music_large)
        : fee(cf, 'cheaper_music_small', MIMU_DEFAULTS.cheaper_music_small);
      items.push({
        label: `Günstiger Musik (${kids > 250 ? '>250' : '≤250'} Kinder)`,
        amount: surcharge,
      });
    }

    if (config.distance_surcharge) {
      items.push({ label: 'Entfernungspauschale', amount: fee(cf, 'distance_surcharge', MIMU_DEFAULTS.distance_surcharge) });
    }

    if (isKleineEinrichtungOn(config, estimatedChildren)) {
      items.push({ label: 'kleine Einrichtung', amount: fee(cf, 'under_100_kids', MIMU_DEFAULTS.under_100_kids) });
    }

    appendSharedItems(items, config);

    const total = base + items.reduce((sum, i) => sum + i.amount, 0);
    return { base, items, total };
  }

  if (dealType === 'mimu_scs') {
    const base = config.scs_pauschale_enabled !== false
      ? fee(cf, 'base', MIMU_SCS_DEFAULTS.base)
      : 0;
    const items: { label: string; amount: number }[] = [];

    if (config.scs_song_option === 'schus') {
      items.push({ label: 'Standard-Schulsong', amount: fee(cf, 'standard_song_discount', MIMU_SCS_DEFAULTS.standard_song_discount) });
    } else if (config.scs_song_option === 'none') {
      items.push({ label: 'Kein Schulsong', amount: fee(cf, 'no_song_discount', MIMU_SCS_DEFAULTS.no_song_discount) });
    }
    if (config.scs_shirts_included === false) {
      items.push({ label: 'Keine T-Shirts', amount: fee(cf, 'no_shirts_discount', MIMU_SCS_DEFAULTS.no_shirts_discount) });
    }
    if (isGrosseEinrichtungOn(config, estimatedChildren)) {
      items.push({ label: 'Grosse Einrichtung', amount: fee(cf, 'over_250_kids', MIMU_SCS_DEFAULTS.over_250_kids) });
    }

    appendSharedItems(items, config);

    const total = base + items.reduce((sum, i) => sum + i.amount, 0);
    return { base, items, total };
  }

  return null;
}

/**
 * Derive legacy boolean flags from a deal type.
 * Used to keep backward compatibility with existing booking views.
 */
export function dealTypeToFlags(dealType: DealType, config: DealConfig): {
  is_minimusikertag: boolean;
  is_plus: boolean;
  is_kita: boolean;
  is_schulsong: boolean;
} {
  switch (dealType) {
    case 'mimu':
      return {
        is_minimusikertag: true, // Always true — PLUS is a pricing tier, not a different event type
        is_plus: (config.music_pricing_enabled ?? config.cheaper_music) === true,
        is_kita: false,
        is_schulsong: true,
      };
    case 'mimu_scs':
      return {
        is_minimusikertag: true, // Always true — SCS is a pricing arrangement, not a different event type
        is_plus: config.scs_audio_pricing === 'plus',
        is_kita: false,
        is_schulsong: config.scs_song_option !== 'none',
      };
    case 'schus':
    case 'schus_xl':
      return {
        is_minimusikertag: false,
        is_plus: false,
        is_kita: false,
        is_schulsong: true,
      };
  }
}
