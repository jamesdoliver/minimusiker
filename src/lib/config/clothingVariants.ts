// src/lib/config/clothingVariants.ts

/**
 * Mapping of Shopify variant IDs to clothing item type and size
 * Used to filter and categorize clothing items from order line_items
 */

export type ClothingType = 'tshirt' | 'hoodie';

export interface ClothingVariant {
  type: ClothingType;
  size: string;
}

export const CLOTHING_VARIANTS: Record<string, ClothingVariant> = {
  // T-Shirt (Personalisiert) - Product ID: 10663662747994
  '53328502194522': { type: 'tshirt', size: '98/104' },
  '53328502227290': { type: 'tshirt', size: '110/116' },
  '53328502260058': { type: 'tshirt', size: '122/128' },
  '53328502292826': { type: 'tshirt', size: '134/146' },
  '53328502325594': { type: 'tshirt', size: '152/164' },
  // Hoodie (Personalisiert) - Product ID: 10664195916122
  '53328494788954': { type: 'hoodie', size: '116' },
  '53328494821722': { type: 'hoodie', size: '128' },
  '53328494854490': { type: 'hoodie', size: '140' },
  '53328494887258': { type: 'hoodie', size: '152' },
  '53328494920026': { type: 'hoodie', size: '164' },
};

// All clothing variant IDs for quick lookup
export const CLOTHING_VARIANT_IDS = Object.keys(CLOTHING_VARIANTS);

// T-Shirt sizes in display order
export const TSHIRT_SIZES = ['98/104', '110/116', '122/128', '134/146', '152/164'];

// Hoodie sizes in display order
export const HOODIE_SIZES = ['116', '128', '140', '152', '164'];

/**
 * Check if a variant ID is a clothing item
 */
export function isClothingVariant(variantId: string): boolean {
  // Handle both full Shopify GID format and numeric-only format
  const numericId = variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
  return numericId in CLOTHING_VARIANTS;
}

/**
 * Get clothing details for a variant ID
 */
export function getClothingDetails(variantId: string): ClothingVariant | null {
  const numericId = variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
  return CLOTHING_VARIANTS[numericId] || null;
}
