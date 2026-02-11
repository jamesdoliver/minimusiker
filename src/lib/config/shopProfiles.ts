/**
 * Shop Profile Configuration
 *
 * Defines product catalogs and Shopify variant mappings per event type.
 * The admin toggles (is_minimusikertag, is_plus, is_schulsong) determine
 * which profile the parent portal shop displays.
 */

// ============================================================================
// TYPES
// ============================================================================

export type AudioProductId = 'minicard' | 'cd' | 'tonie' | 'minicard-cd-bundle';
export type ClothingProductId = 'tshirt' | 'hoodie' | 'tshirt-hoodie';

export interface AudioProduct {
  id: AudioProductId;
  name: string;
  description: string;
  price: number;
  imageEmoji: string;
  savings?: number;
}

export interface ClothingProduct {
  id: ClothingProductId;
  name: string;
  description: string;
  price: number;
  imageSrc: string;
  showTshirtSize: boolean;
  showHoodieSize: boolean;
  savings?: number;
  isPersonalized?: boolean;
}

export type ShopProfileType = 'minimusikertag' | 'plus' | 'schulsong-only';

export interface ShopProfile {
  profileType: ShopProfileType;
  audioProducts: AudioProduct[];
  personalizedClothingProducts: ClothingProduct[];
  standardClothingProducts: ClothingProduct[];
  shopifyVariantMap: Record<string, string>;
  shopifyTagFilter: string;
}

// ============================================================================
// SHARED CLOTHING DATA (identical across profiles for now)
// ============================================================================

const STANDARD_CLOTHING: ClothingProduct[] = [
  {
    id: 'tshirt',
    name: 'T-Shirt',
    description: 'Minimusiker T-Shirt mit Mini',
    price: 25.00,
    imageSrc: '/images/familie_portal/T-Shirt Fallback Picture.png',
    showTshirtSize: true,
    showHoodieSize: false,
    isPersonalized: false,
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    description: 'Kuscheliger Hoodie mit Minimusiker Design',
    price: 49.00,
    imageSrc: '/images/familie_portal/Hoodie Fallback Picture.png',
    showTshirtSize: false,
    showHoodieSize: true,
    isPersonalized: false,
  },
  {
    id: 'tshirt-hoodie',
    name: 'T-Shirt & Hoodie',
    description: 'Das komplette Minimusiker Set',
    price: 59.00,
    imageSrc: '/images/products/tshirt&hoodie_bundle pic.jpeg',
    showTshirtSize: true,
    showHoodieSize: true,
    savings: 15,
    isPersonalized: false,
  },
];

const PERSONALIZED_CLOTHING: ClothingProduct[] = [
  {
    id: 'tshirt',
    name: 'Minimusiker Schul-T-Shirt',
    description: 'Der gemütliche Minimusiker Schul-T-Shirt – extra für eure Schule gemacht',
    price: 25.00,
    imageSrc: '/images/familie_portal/T-Shirt Fallback Picture.png',
    showTshirtSize: true,
    showHoodieSize: false,
    isPersonalized: true,
  },
  {
    id: 'hoodie',
    name: 'Minimusiker Schul-Hoodie',
    description: 'Der gemütliche Minimusiker Schul-Hoodie – extra für eure Schule gemacht',
    price: 49.00,
    imageSrc: '/images/familie_portal/Hoodie Fallback Picture.png',
    showTshirtSize: false,
    showHoodieSize: true,
    isPersonalized: true,
  },
  {
    id: 'tshirt-hoodie',
    name: 'Minimusiker Schul-T-Shirt & Schul-Hoodie Bundle',
    description: 'Das komplette Minimusiker Schul-Set – extra für eure Schule gemacht',
    price: 59.00,
    imageSrc: '/images/products/tshirt&hoodie_bundle pic.jpeg',
    showTshirtSize: true,
    showHoodieSize: true,
    savings: 15,
    isPersonalized: true,
  },
];

// ============================================================================
// MINIMUSIKERTAG PROFILE (default — current behavior)
// ============================================================================

const MINIMUSIKERTAG_AUDIO: AudioProduct[] = [
  {
    id: 'minicard',
    name: 'Minicard',
    description: 'Kompakte Karte mit QR-Code zum Abspielen',
    price: 17.00,
    imageEmoji: '💳',
  },
  {
    id: 'cd',
    name: 'CD',
    description: 'Die klassische CD für deinen CD-Player - im plastikfreien Digifile mit Liederliste',
    price: 19.00,
    imageEmoji: '💿',
  },
  {
    id: 'tonie',
    name: 'Tonie',
    description: 'Kreativ-Tonie mit Minicard',
    price: 29.00,
    imageEmoji: '🎵',
  },
  {
    id: 'minicard-cd-bundle',
    name: 'Minicard + CD',
    description: 'Beide Formate zum Sparpreis',
    price: 27.00,
    savings: 9,
    imageEmoji: '🎁',
  },
];

const MINIMUSIKERTAG_VARIANT_MAP: Record<string, string> = {
  // Audio products
  'minicard': 'gid://shopify/ProductVariant/53258099720538',
  'cd': 'gid://shopify/ProductVariant/53258098639194',
  'tonie': 'gid://shopify/ProductVariant/53271523557722',
  'minicard-cd-bundle': 'gid://shopify/ProductVariant/53327238824282',

  // Standard T-Shirt sizes
  'tshirt-standard-98/104 (3-4J)': 'gid://shopify/ProductVariant/53328491512154',
  'tshirt-standard-110/116 (5-6J)': 'gid://shopify/ProductVariant/53328491544922',
  'tshirt-standard-122/128 (7-8J)': 'gid://shopify/ProductVariant/53328491577690',
  'tshirt-standard-134/146 (9-11J)': 'gid://shopify/ProductVariant/53328491610458',
  'tshirt-standard-152/164 (12-14J)': 'gid://shopify/ProductVariant/53328491643226',

  // Personalised T-Shirt sizes
  'tshirt-personalized-98/104 (3-4J)': 'gid://shopify/ProductVariant/53328502194522',
  'tshirt-personalized-110/116 (5-6J)': 'gid://shopify/ProductVariant/53328502227290',
  'tshirt-personalized-122/128 (7-8J)': 'gid://shopify/ProductVariant/53328502260058',
  'tshirt-personalized-134/146 (9-11J)': 'gid://shopify/ProductVariant/53328502292826',
  'tshirt-personalized-152/164 (12-14J)': 'gid://shopify/ProductVariant/53328502325594',

  // Standard Hoodie sizes
  'hoodie-standard-116 (5-6 J)': 'gid://shopify/ProductVariant/53325998948698',
  'hoodie-standard-128 (7-8 J)': 'gid://shopify/ProductVariant/53325998981466',
  'hoodie-standard-140 (9-11 J)': 'gid://shopify/ProductVariant/53325999014234',
  'hoodie-standard-152 (12-13 J)': 'gid://shopify/ProductVariant/53325999047002',
  'hoodie-standard-164 (14-15 J)': 'gid://shopify/ProductVariant/53325999079770',

  // Personalised Hoodie sizes
  'hoodie-personalized-116 (5-6 J)': 'gid://shopify/ProductVariant/53328494788954',
  'hoodie-personalized-128 (7-8 J)': 'gid://shopify/ProductVariant/53328494821722',
  'hoodie-personalized-140 (9-11 J)': 'gid://shopify/ProductVariant/53328494854490',
  'hoodie-personalized-152 (12-13 J)': 'gid://shopify/ProductVariant/53328494887258',
  'hoodie-personalized-164 (14-15 J)': 'gid://shopify/ProductVariant/53328494920026',
};

export const MINIMUSIKERTAG_PROFILE: ShopProfile = {
  profileType: 'minimusikertag',
  audioProducts: MINIMUSIKERTAG_AUDIO,
  personalizedClothingProducts: PERSONALIZED_CLOTHING,
  standardClothingProducts: STANDARD_CLOTHING,
  shopifyVariantMap: MINIMUSIKERTAG_VARIANT_MAP,
  shopifyTagFilter: 'minimusiker-shop',
};

// ============================================================================
// PLUS PROFILE (same layout, different Shopify products)
// ============================================================================

const PLUS_AUDIO: AudioProduct[] = [
  {
    id: 'minicard',
    name: 'Minicard',
    description: 'Kompakte Karte mit QR-Code zum Abspielen',
    price: 9.00,
    imageEmoji: '💳',
  },
  {
    id: 'cd',
    name: 'CD',
    description: 'Die klassische CD für deinen CD-Player - im plastikfreien Digifile mit Liederliste',
    price: 13.00,
    imageEmoji: '💿',
  },
  {
    id: 'tonie',
    name: 'Tonie',
    description: 'Kreativ-Tonie mit Minicard',
    price: 23.00,
    imageEmoji: '🎵',
  },
  {
    id: 'minicard-cd-bundle',
    name: 'Minicard + CD',
    description: 'Beide Formate zum Sparpreis',
    price: 19.00,
    savings: 3,
    imageEmoji: '🎁',
  },
];

const PLUS_VARIANT_MAP: Record<string, string> = {
  ...MINIMUSIKERTAG_VARIANT_MAP,
  // PLUS audio products (override minimusikertag audio entries)
  'minicard': 'gid://shopify/ProductVariant/53440629375322',
  'cd': 'gid://shopify/ProductVariant/53525559771482',
  'tonie': 'gid://shopify/ProductVariant/53525526217050',
  'minicard-cd-bundle': 'gid://shopify/ProductVariant/53525549089114',
};

export const PLUS_PROFILE: ShopProfile = {
  profileType: 'plus',
  audioProducts: PLUS_AUDIO,
  personalizedClothingProducts: PERSONALIZED_CLOTHING,
  standardClothingProducts: STANDARD_CLOTHING,
  shopifyVariantMap: PLUS_VARIANT_MAP,
  shopifyTagFilter: 'PLUS',
};

// ============================================================================
// SCHULSONG-ONLY PROFILE (no audio, clothing only)
// ============================================================================

export const SCHULSONG_ONLY_PROFILE: ShopProfile = {
  profileType: 'schulsong-only',
  audioProducts: [],
  personalizedClothingProducts: PERSONALIZED_CLOTHING,
  standardClothingProducts: STANDARD_CLOTHING,
  shopifyVariantMap: MINIMUSIKERTAG_VARIANT_MAP,
  shopifyTagFilter: 'minimusiker-shop',
};

// ============================================================================
// MINICARD VARIANT IDs (for access detection)
// ============================================================================

/**
 * All Shopify variant IDs that include a Minicard (grants full audio access).
 * Includes standalone Minicard, Minicard+CD bundles, and Tonie products
 * (Kreativ-Tonie ships with a Minicard).
 *
 * Variant IDs are the numeric portion after "gid://shopify/ProductVariant/"
 */
export const MINICARD_VARIANT_IDS = new Set([
  // Minimusikertag variants
  '53258099720538',   // Minicard (standalone)
  '53327238824282',   // Minicard+CD bundle
  '53271523557722',   // Tonie (Kreativ-Tonie mit Minicard)
  // PLUS variants
  '53440629375322',   // Minicard PLUS
  '53525549089114',   // Minicard+CD bundle PLUS
  '53525526217050',   // Tonie PLUS
]);

// ============================================================================
// PROFILE RESOLUTION
// ============================================================================

interface ShopProfileFlags {
  isMinimusikertag?: boolean;
  isPlus?: boolean;
  isSchulsong?: boolean;
}

/**
 * Resolve the shop profile from admin event type flags.
 *
 * Priority: schulsong-only > plus > minimusikertag
 *
 * - schulsong-only: isSchulsong=true AND isMinimusikertag=false
 * - plus: isPlus=true (when not schulsong-only)
 * - minimusikertag: default fallback
 */
export function resolveShopProfile(flags: ShopProfileFlags): ShopProfile {
  const { isMinimusikertag, isPlus, isSchulsong } = flags;

  // Schulsong-only takes highest priority
  if (isSchulsong && !isMinimusikertag) {
    return SCHULSONG_ONLY_PROFILE;
  }

  // PLUS takes next priority
  if (isPlus) {
    return PLUS_PROFILE;
  }

  // Default to minimusikertag
  return MINIMUSIKERTAG_PROFILE;
}
