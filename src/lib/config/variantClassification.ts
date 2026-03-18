// src/lib/config/variantClassification.ts

/**
 * Variant classification config for shipment wave auto-computation.
 *
 * Categorizes Shopify line item variants so the orders-paid webhook
 * can determine which shipment wave an order belongs to.
 */

import { CLOTHING_VARIANTS, STANDARD_CLOTHING_VARIANTS } from './clothingVariants';
import type { ShipmentWave } from '@/lib/types/tasks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VariantCategory = 'clothing' | 'audio' | 'standard';

// ---------------------------------------------------------------------------
// Audio variant lookup
// Variant IDs sourced from src/lib/config/shopProfiles.ts
// ---------------------------------------------------------------------------

export const AUDIO_VARIANTS: Record<string, { type: string; description: string }> = {
  // Minimusikertag variants
  '53258099720538': { type: 'minicard', description: 'Minicard (standalone)' },
  '53258098639194': { type: 'cd', description: 'CD' },
  '53327238824282': { type: 'minicard-cd-bundle', description: 'Minicard+CD Bundle' },
  '53265570824538': { type: 'bluetooth-box', description: 'Kinderliederbox' },
  // PLUS variants
  '53440629375322': { type: 'minicard', description: 'Minicard PLUS' },
  '53525559771482': { type: 'cd', description: 'CD PLUS' },
  '53525549089114': { type: 'minicard-cd-bundle', description: 'Minicard+CD Bundle PLUS' },
  '53836123472218': { type: 'bluetooth-box', description: 'Kinderliederbox (+)' },
};

// ---------------------------------------------------------------------------
// Single-variant classification
// ---------------------------------------------------------------------------

/**
 * Classify a Shopify variant ID into a category.
 *
 * Accepts both the full GID format (`gid://shopify/ProductVariant/12345`)
 * and the plain numeric string (`12345`).
 *
 * Returns `undefined` for unrecognised variants (e.g. digital products).
 */
export function classifyVariant(variantId: string): VariantCategory | undefined {
  const numericId = variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');

  if (numericId in CLOTHING_VARIANTS) return 'clothing';
  if (numericId in STANDARD_CLOTHING_VARIANTS) return 'standard';
  if (numericId in AUDIO_VARIANTS) return 'audio';

  return undefined;
}

// ---------------------------------------------------------------------------
// Order-level shipment wave computation
// ---------------------------------------------------------------------------

/**
 * Determine the shipment wave for an order based on its line items.
 *
 * Rules:
 *  - Only standard items              -> 'Rolling'
 *  - Only clothing (school-branded)    -> 'Welle 1'
 *  - Only audio                        -> 'Welle 2'
 *  - Clothing + audio                  -> 'Both'
 *  - Standard + clothing               -> 'Welle 1'  (school items take priority)
 *  - Standard + audio                  -> 'Welle 2'
 *  - No recognised physical items      -> null  (digital-only order)
 */
export function computeShipmentWave(
  lineItems: Array<{ variant_id: string; quantity: number }>,
): ShipmentWave | null {
  const categories = new Set<VariantCategory>();

  for (const item of lineItems) {
    const category = classifyVariant(String(item.variant_id));
    if (category) {
      categories.add(category);
    }
  }

  if (categories.size === 0) return null;

  const hasClothing = categories.has('clothing');
  const hasAudio = categories.has('audio');
  const hasStandard = categories.has('standard');

  // Mixed clothing + audio (with or without standard)
  if (hasClothing && hasAudio) return 'Both';

  // Clothing (possibly with standard) — school items take priority
  if (hasClothing) return 'Welle 1';

  // Audio (possibly with standard)
  if (hasAudio) return 'Welle 2';

  // Only standard items remain
  if (hasStandard) return 'Rolling';

  return null;
}
