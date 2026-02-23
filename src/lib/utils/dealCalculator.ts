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
  cheaper_music_small: 1000,
  cheaper_music_large: 2000,
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

/**
 * Calculate the school-facing fee for a deal.
 *
 * #mimu: starts at €0, surcharges added
 * #mimuSCS: starts at €9,500, surcharges/opt-outs applied
 * #schus / #schusXL: no fee tracking
 */
export function calculateDealFee(
  dealType: DealType,
  config: DealConfig,
  estimatedChildren?: number
): FeeBreakdown | null {
  if (dealType === 'schus' || dealType === 'schus_xl') {
    return null; // No fee tracking
  }

  const kids = estimatedChildren ?? 0;
  const cf = config.custom_fees;

  if (dealType === 'mimu') {
    const base = fee(cf, 'base', MIMU_DEFAULTS.base);
    const items: { label: string; amount: number }[] = [];

    if (kids < 100) {
      items.push({ label: 'Unter 100 Kinder', amount: fee(cf, 'under_100_kids', MIMU_DEFAULTS.under_100_kids) });
    }
    if (config.distance_surcharge) {
      items.push({ label: 'Entfernungszuschlag', amount: fee(cf, 'distance_surcharge', MIMU_DEFAULTS.distance_surcharge) });
    }
    if (config.cheaper_music) {
      const surcharge = kids > 250
        ? fee(cf, 'cheaper_music_large', MIMU_DEFAULTS.cheaper_music_large)
        : fee(cf, 'cheaper_music_small', MIMU_DEFAULTS.cheaper_music_small);
      items.push({
        label: `Günstiger Musik (${kids > 250 ? '>250' : '≤250'} Kinder)`,
        amount: surcharge,
      });
    }

    const total = base + items.reduce((sum, i) => sum + i.amount, 0);
    return { base, items, total };
  }

  if (dealType === 'mimu_scs') {
    const base = fee(cf, 'base', MIMU_SCS_DEFAULTS.base);
    const items: { label: string; amount: number }[] = [];

    if (kids > 250) {
      items.push({ label: 'Über 250 Kinder', amount: fee(cf, 'over_250_kids', MIMU_SCS_DEFAULTS.over_250_kids) });
    }
    if (config.scs_song_option === 'schus') {
      items.push({ label: 'Standard-Schulsong', amount: fee(cf, 'standard_song_discount', MIMU_SCS_DEFAULTS.standard_song_discount) });
    } else if (config.scs_song_option === 'none') {
      items.push({ label: 'Kein Schulsong', amount: fee(cf, 'no_song_discount', MIMU_SCS_DEFAULTS.no_song_discount) });
    }
    if (config.scs_shirts_included === false) {
      items.push({ label: 'Keine T-Shirts', amount: fee(cf, 'no_shirts_discount', MIMU_SCS_DEFAULTS.no_shirts_discount) });
    }

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
        is_minimusikertag: !config.cheaper_music,
        is_plus: config.cheaper_music === true,
        is_kita: false,
        is_schulsong: true,
      };
    case 'mimu_scs':
      return {
        is_minimusikertag: config.scs_audio_pricing !== 'plus',
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
