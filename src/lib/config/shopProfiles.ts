/**
 * Shop Profile Configuration
 *
 * Defines product catalogs and Shopify variant mappings per event type.
 * The admin flags (is_minimusikertag, is_plus, is_schulsong, is_scs)
 * determine which profile the parent portal shop displays.
 */

// ============================================================================
// TYPES
// ============================================================================

export type AudioProductId = 'minicard' | 'cd' | 'minicard-cd-bundle' | 'bluetooth-box';
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

export type ShopProfileType = 'minimusikertag' | 'plus' | 'schulsong-only' | 'scs' | 'scs-plus';

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
    id: 'minicard-cd-bundle',
    name: 'Minicard + CD',
    description: 'Beide Formate zum Sparpreis',
    price: 27.00,
    savings: 9,
    imageEmoji: '🎁',
  },
  {
    id: 'bluetooth-box',
    name: 'Kinderliederbox',
    description: 'BT-Lautsprecher inkl. aller Songs',
    price: 39.00,
    imageEmoji: '🔊',
  },
];

const MINIMUSIKERTAG_VARIANT_MAP: Record<string, string> = {
  // Audio products
  'minicard': 'gid://shopify/ProductVariant/53258099720538',
  'cd': 'gid://shopify/ProductVariant/53258098639194',
  'minicard-cd-bundle': 'gid://shopify/ProductVariant/53327238824282',
  'bluetooth-box': 'gid://shopify/ProductVariant/53265570824538',

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
    id: 'minicard-cd-bundle',
    name: 'Minicard + CD',
    description: 'Beide Formate zum Sparpreis',
    price: 19.00,
    savings: 3,
    imageEmoji: '🎁',
  },
  {
    id: 'bluetooth-box',
    name: 'Kinderliederbox',
    description: 'BT-Lautsprecher inkl. aller Songs',
    price: 34.00,
    imageEmoji: '🔊',
  },
];

const PLUS_VARIANT_MAP: Record<string, string> = {
  ...MINIMUSIKERTAG_VARIANT_MAP,
  // PLUS audio products (override minimusikertag audio entries)
  'minicard': 'gid://shopify/ProductVariant/53440629375322',
  'cd': 'gid://shopify/ProductVariant/53525559771482',
  'minicard-cd-bundle': 'gid://shopify/ProductVariant/53525549089114',
  'bluetooth-box': 'gid://shopify/ProductVariant/53836123472218',
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
// SCS PROFILE (Startchancenschule — reduced product set)
// ============================================================================

// SCS audio: CD, Kinderliederbox only — NO Minicard, NO MC+CD bundle
const SCS_AUDIO: AudioProduct[] = [
  {
    id: 'cd',
    name: 'CD',
    description: 'Die klassische CD für deinen CD-Player - im plastikfreien Digifile mit Liederliste',
    price: 19.00,
    imageEmoji: '💿',
  },
  {
    id: 'bluetooth-box',
    name: 'Kinderliederbox',
    description: 'BT-Lautsprecher inkl. aller Songs',
    price: 39.00,
    imageEmoji: '🔊',
  },
];

const SCS_PLUS_AUDIO: AudioProduct[] = [
  {
    id: 'cd',
    name: 'CD',
    description: 'Die klassische CD für deinen CD-Player - im plastikfreien Digifile mit Liederliste',
    price: 13.00,
    imageEmoji: '💿',
  },
  {
    id: 'bluetooth-box',
    name: 'Kinderliederbox',
    description: 'BT-Lautsprecher inkl. aller Songs',
    price: 34.00,
    imageEmoji: '🔊',
  },
];

// SCS clothing: Hoodie only — T-shirt is free via SchulClothingOrder, not sold in shop
const SCS_HOODIE_ONLY: ClothingProduct[] = [
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
];

export const SCS_PROFILE: ShopProfile = {
  profileType: 'scs',
  audioProducts: SCS_AUDIO,
  personalizedClothingProducts: SCS_HOODIE_ONLY,
  standardClothingProducts: SCS_HOODIE_ONLY,
  shopifyVariantMap: MINIMUSIKERTAG_VARIANT_MAP,
  shopifyTagFilter: 'minimusiker-shop',
};

export const SCS_PLUS_PROFILE: ShopProfile = {
  profileType: 'scs-plus',
  audioProducts: SCS_PLUS_AUDIO,
  personalizedClothingProducts: SCS_HOODIE_ONLY,
  standardClothingProducts: SCS_HOODIE_ONLY,
  shopifyVariantMap: PLUS_VARIANT_MAP,
  shopifyTagFilter: 'PLUS',
};

// ============================================================================
// MINICARD VARIANT IDs (for access detection)
// ============================================================================

/**
 * All Shopify variant IDs that grant full audio access in the parent portal.
 * Includes standalone Minicard, Minicard+CD bundles, and Kinderliederbox.
 *
 * Variant IDs are the numeric portion after "gid://shopify/ProductVariant/"
 */
export const MINICARD_VARIANT_IDS = new Set([
  // Minimusikertag variants
  '53258099720538',   // Minicard (standalone)
  '53327238824282',   // Minicard+CD bundle
  '53265570824538',   // Kinderliederbox
  // PLUS variants
  '53440629375322',   // Minicard PLUS
  '53525549089114',   // Minicard+CD bundle PLUS
  '53836123472218',   // Kinderliederbox (+)
]);

// ============================================================================
// PROFILE RESOLUTION
// ============================================================================

export interface ShopProfileFlags {
  isMinimusikertag?: boolean;
  isPlus?: boolean;
  isSchulsong?: boolean;
  isScs?: boolean;
}

/**
 * Resolve the shop profile from admin event type flags.
 *
 * Priority: SCS > schulsong-only > plus > minimusikertag
 */
export function resolveShopProfile(
  flags: ShopProfileFlags
): ShopProfile {
  const { isMinimusikertag, isPlus, isSchulsong, isScs } = flags;

  // SCS takes highest priority
  if (isScs) {
    return isPlus ? SCS_PLUS_PROFILE : SCS_PROFILE;
  }

  // Schulsong-only (schulsong flag set but NOT minimusikertag)
  if (isSchulsong && !isMinimusikertag) {
    return SCHULSONG_ONLY_PROFILE;
  }

  // PLUS pricing tier
  if (isPlus) {
    return PLUS_PROFILE;
  }

  // Default
  return MINIMUSIKERTAG_PROFILE;
}
