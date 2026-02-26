'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ParentSessionChild } from '@/types/airtable';
import { TSHIRT_SIZES, HOODIE_SIZES, TshirtSize, HoodieSize } from '@/lib/types/stock';
import { useProducts } from '@/lib/hooks/useProducts';
import { Product } from '@/lib/types/airtable';
import { canOrderPersonalizedClothing, getDaysUntilEvent, SCHULSONG_CLOTHING_CUTOFF_DAYS } from '@/lib/utils/eventTimeline';
import { parseOverrides, getThreshold } from '@/lib/utils/eventThresholds';
import { ShopProfile, AudioProductId, ClothingProductId, AudioProduct, ClothingProduct } from '@/lib/config/shopProfiles';
import AudioProductCard from './AudioProductCard';
import ClothingProductCard from './ClothingProductCard';

// ============================================================================
// TYPES
// ============================================================================

interface AudioSelection {
  productId: AudioProductId;
  quantity: number;
}

interface ClothingItem {
  id: string;
  productId: ClothingProductId;
  quantity: number;
  tshirtSize: TshirtSize | null;
  hoodieSize: HoodieSize | null;
}

interface ProductSelection {
  audioProducts: AudioSelection[];
  clothing: ClothingItem[];
}

interface ProductSelectorProps {
  eventId: string;
  eventDate?: string;
  classId?: string;
  parentId: string;
  parentEmail?: string;
  schoolName: string;
  children?: ParentSessionChild[];
  shopProfile: ShopProfile;
  onCheckout?: (selection: ProductSelection, total: number) => void;
  timelineOverrides?: string | null;
  isStandardMerchOnly?: boolean;
}

const COMBO_DISCOUNT_PERCENT = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getAudioProduct(audioProducts: AudioProduct[], id: AudioProductId) {
  return audioProducts.find(p => p.id === id);
}

function getClothingProduct(clothingProducts: ClothingProduct[], id: ClothingProductId) {
  return clothingProducts.find(p => p.id === id);
}

function calculateTotal(
  selection: ProductSelection,
  audioProducts: AudioProduct[],
  clothingProducts: ClothingProduct[],
) {
  let subtotal = 0;

  // Audio products (sum all selected with quantities)
  selection.audioProducts.forEach((item) => {
    const product = getAudioProduct(audioProducts, item.productId);
    if (product) {
      subtotal += product.price * item.quantity;
    }
  });

  // Clothing (sum all items)
  selection.clothing.forEach((item) => {
    const product = getClothingProduct(clothingProducts, item.productId);
    if (product) {
      subtotal += product.price * item.quantity;
    }
  });

  // Apply combo discount if both audio AND clothing
  const hasAudio = selection.audioProducts.length > 0;
  const hasClothing = selection.clothing.length > 0;
  const discountPercent = hasAudio && hasClothing ? COMBO_DISCOUNT_PERCENT : 0;
  const discount = subtotal * (discountPercent / 100);

  return {
    subtotal,
    discount,
    discountPercent,
    total: subtotal - discount,
    hasComboDiscount: hasAudio && hasClothing,
  };
}

// ============================================================================
// ORDER SUMMARY COMPONENT
// ============================================================================

interface OrderSummaryProps {
  selection: ProductSelection;
  totals: ReturnType<typeof calculateTotal>;
  audioProducts: AudioProduct[];
  clothingProducts: ClothingProduct[];
  onCheckout: () => void;
  isProcessing: boolean;
}

function OrderSummary({ selection, totals, audioProducts, clothingProducts, onCheckout, isProcessing }: OrderSummaryProps) {
  const t = useTranslations('orderSummary');

  const hasItems = selection.audioProducts.length > 0 || selection.clothing.length > 0;
  const canCheckout = hasItems;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {t('title')}
      </h3>

      {!hasItems ? (
        <p className="text-sm text-gray-500 text-center py-4">{t('selectItems')}</p>
      ) : (
        <div className="space-y-2">
          {/* Audio Line Items */}
          {selection.audioProducts.map((item) => {
            const product = getAudioProduct(audioProducts, item.productId);
            if (!product) return null;
            return (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {product.name}
                  {item.quantity > 1 && ` x${item.quantity}`}
                </span>
                <span className="font-medium text-gray-900">
                  €{(product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            );
          })}

          {/* Clothing Line Items */}
          {selection.clothing.map((item) => {
            const product = getClothingProduct(clothingProducts, item.productId);
            if (!product) return null;
            return (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {product.name}
                  {item.quantity > 1 && ` x${item.quantity}`}
                  <span className="text-xs text-gray-400 ml-1">
                    ({item.tshirtSize && item.hoodieSize
                      ? `${item.tshirtSize} / ${item.hoodieSize}`
                      : item.tshirtSize || item.hoodieSize})
                  </span>
                </span>
                <span className="font-medium text-gray-900">
                  €{(product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            );
          })}

          {/* Divider */}
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('subtotal')}</span>
              <span className="text-gray-900">€{totals.subtotal.toFixed(2)}</span>
            </div>

            {/* Combo Discount */}
            {totals.hasComboDiscount && (
              <div className="flex justify-between text-sm text-sage-600">
                <span className="flex items-center gap-1">
                  <span className="text-xs">🎉</span>
                  {t('comboDiscount', { percent: totals.discountPercent })}
                </span>
                <span>-€{totals.discount.toFixed(2)}</span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
              <span className="text-lg font-bold text-gray-900">{t('total')}</span>
              <span className="text-2xl font-bold text-sage-700">€{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Button */}
      <button
        onClick={onCheckout}
        disabled={!canCheckout || isProcessing}
        className={`w-full mt-4 py-3 px-6 rounded-lg font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
          canCheckout && !isProcessing
            ? 'bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('processing')}
          </>
        ) : canCheckout ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {t('checkout', { total: totals.total.toFixed(2) })}
          </>
        ) : (
          t('addItems')
        )}
      </button>

      {/* Trust Badges */}
      <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 text-sage-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          {t('secure')}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 text-sage-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
          </svg>
          {t('fastDelivery')}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PRODUCT SELECTOR COMPONENT
// ============================================================================

// Helper to extract the numeric part from a Shopify variant GID
function extractVariantNumericId(gid: string): string | null {
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// Helper to find Shopify product image by variant ID
function findProductImageByVariantId(products: Product[], variantIdSubstring: string): string | null {
  for (const product of products) {
    if (product.variants) {
      const hasVariant = product.variants.some(v => v.id.includes(variantIdSubstring));
      if (hasVariant && product.images?.length > 0) {
        return product.images[0].url;
      }
    }
  }
  return null;
}

export default function ProductSelector({
  eventId,
  eventDate,
  classId,
  parentId,
  parentEmail,
  schoolName,
  children = [],
  shopProfile,
  onCheckout,
  timelineOverrides,
  isStandardMerchOnly = false,
}: ProductSelectorProps) {
  const t = useTranslations('productSelector');
  const [selection, setSelection] = useState<ProductSelection>({
    audioProducts: [],
    clothing: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Derive isSchulsongOnly from profile
  const isSchulsongOnly = shopProfile.audioProducts.length === 0;

  // Determine if personalized products should be shown
  // Use per-event override if available, otherwise fall back to global defaults
  const overrides = useMemo(() => parseOverrides(timelineOverrides), [timelineOverrides]);
  const cutoffDays = isSchulsongOnly
    ? getThreshold('schulsong_clothing_cutoff_days', overrides)
    : getThreshold('personalized_clothing_cutoff_days', overrides);
  // Standard merch gate: under-100-kid schools only see standard clothing
  const showPersonalized = isStandardMerchOnly
    ? false
    : canOrderPersonalizedClothing(eventDate, cutoffDays);

  // Select the appropriate clothing products based on time until event
  const activeClothingProducts = useMemo(
    () => showPersonalized
      ? shopProfile.personalizedClothingProducts
      : shopProfile.standardClothingProducts,
    [showPersonalized, shopProfile]
  );

  // Fetch products from Shopify for images
  const { products: shopifyProducts } = useProducts({ tagFilter: shopProfile.shopifyTagFilter });

  // Get Shopify product images for audio items (derived from variant map)
  const audioImages = useMemo(() => {
    const defaultImages: Record<string, string | null> = {};
    for (const product of shopProfile.audioProducts) {
      defaultImages[product.id] = null;
    }

    if (!shopifyProducts || shopifyProducts.length === 0) {
      return defaultImages;
    }

    const images: Record<string, string | null> = {};
    for (const product of shopProfile.audioProducts) {
      const variantGid = shopProfile.shopifyVariantMap[product.id];
      const numericId = variantGid ? extractVariantNumericId(variantGid) : null;
      images[product.id] = numericId
        ? findProductImageByVariantId(shopifyProducts, numericId)
        : null;
    }
    return images;
  }, [shopifyProducts, shopProfile]);

  // Get Shopify product images for clothing items
  // Uses different variant IDs based on whether showing personalized or standard products
  const clothingImages = useMemo(() => {
    if (!shopifyProducts || shopifyProducts.length === 0) {
      return {
        tshirt: '/images/familie_portal/T-Shirt Fallback Picture.png',
        hoodie: '/images/familie_portal/Hoodie Fallback Picture.png',
        'tshirt-hoodie': '/images/familie_portal/Hoodie and T-Shirt Picture.jpeg',
      };
    }

    // Use different variant IDs based on personalized vs standard
    const variantPrefix = showPersonalized ? 'personalized' : 'standard';
    const tshirtVariantGid = shopProfile.shopifyVariantMap[`tshirt-${variantPrefix}-98/104 (3-4J)`];
    const hoodieVariantGid = shopProfile.shopifyVariantMap[`hoodie-${variantPrefix}-116 (5-6 J)`];
    const tshirtNumericId = tshirtVariantGid ? extractVariantNumericId(tshirtVariantGid) : null;
    const hoodieNumericId = hoodieVariantGid ? extractVariantNumericId(hoodieVariantGid) : null;

    // Find bundle product by requiring clothing-specific terms and excluding audio products
    const bundleImage = shopifyProducts.find(p => {
      const title = p.title.toLowerCase();
      return (title.includes('t-shirt') || title.includes('tshirt')) &&
             title.includes('hoodie') &&
             !title.includes('minicard') && !title.includes('cd') && !title.includes('tonie');
    })?.images?.[0]?.url;

    return {
      tshirt: (tshirtNumericId && findProductImageByVariantId(shopifyProducts, tshirtNumericId)) || '/images/familie_portal/T-Shirt Fallback Picture.png',
      hoodie: (hoodieNumericId && findProductImageByVariantId(shopifyProducts, hoodieNumericId)) || '/images/familie_portal/Hoodie Fallback Picture.png',
      'tshirt-hoodie': bundleImage || '/images/familie_portal/Hoodie and T-Shirt Picture.jpeg',
    };
  }, [shopifyProducts, showPersonalized, shopProfile]);

  const totals = useMemo(
    () => calculateTotal(selection, shopProfile.audioProducts, activeClothingProducts),
    [selection, shopProfile.audioProducts, activeClothingProducts]
  );

  // Audio selection handlers
  const handleAudioToggle = (productId: string) => {
    setSelection((prev) => {
      const exists = prev.audioProducts.find(p => p.productId === productId);
      if (exists) {
        // Remove product
        return {
          ...prev,
          audioProducts: prev.audioProducts.filter(p => p.productId !== productId)
        };
      } else {
        // Add product with quantity 1
        return {
          ...prev,
          audioProducts: [...prev.audioProducts, { productId: productId as AudioProductId, quantity: 1 }]
        };
      }
    });
  };

  const handleAudioQuantityChange = (productId: string, quantity: number) => {
    setSelection((prev) => ({
      ...prev,
      audioProducts: prev.audioProducts.map(p =>
        p.productId === productId ? { ...p, quantity } : p
      )
    }));
  };

  // Clothing handlers
  const handleAddClothing = (
    productId: string,
    tshirtSize: TshirtSize | null,
    hoodieSize: HoodieSize | null,
    quantity: number
  ) => {
    const newItem: ClothingItem = {
      id: generateId(),
      productId: productId as ClothingProductId,
      quantity,
      tshirtSize,
      hoodieSize,
    };

    setSelection((prev) => ({
      ...prev,
      clothing: [...prev.clothing, newItem],
    }));
  };

  const handleRemoveClothing = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      clothing: prev.clothing.filter((item) => item.id !== id),
    }));
  };

  // Checkout handler
  const handleCheckout = async () => {
    if (selection.audioProducts.length === 0 && selection.clothing.length === 0) return;

    setIsProcessing(true);

    try {
      if (onCheckout) {
        onCheckout(selection, totals.total);
        return;
      }

      // Build line items for Shopify cart (with productType for discount code logic)
      const lineItems: Array<{ variantId: string; quantity: number; productType?: 'tshirt' | 'hoodie' | 'audio' }> = [];

      // Track any missing variant mappings to prevent silent checkout failures
      const missingVariants: string[] = [];

      // Add audio products
      selection.audioProducts.forEach((item) => {
        const variantId = shopProfile.shopifyVariantMap[item.productId];
        if (variantId) {
          lineItems.push({ variantId, quantity: item.quantity, productType: 'audio' });
        } else {
          console.error(`[Checkout] Missing variant mapping for audio key: ${item.productId}`);
          missingVariants.push(item.productId);
        }
      });

      // Add clothing items with size variants
      // Use personalized or standard variant IDs based on showPersonalized
      const variantPrefix = showPersonalized ? 'personalized' : 'standard';

      selection.clothing.forEach((item) => {
        if (item.productId === 'tshirt' && item.tshirtSize) {
          const variantKey = `tshirt-${variantPrefix}-${item.tshirtSize}`;
          const variantId = shopProfile.shopifyVariantMap[variantKey];
          if (variantId) {
            lineItems.push({ variantId, quantity: item.quantity, productType: 'tshirt' });
          } else {
            console.error(`[Checkout] Missing variant mapping for key: ${variantKey}`);
            missingVariants.push(variantKey);
          }
        } else if (item.productId === 'hoodie' && item.hoodieSize) {
          const variantKey = `hoodie-${variantPrefix}-${item.hoodieSize}`;
          const variantId = shopProfile.shopifyVariantMap[variantKey];
          if (variantId) {
            lineItems.push({ variantId, quantity: item.quantity, productType: 'hoodie' });
          } else {
            console.error(`[Checkout] Missing variant mapping for key: ${variantKey}`);
            missingVariants.push(variantKey);
          }
        } else if (item.productId === 'tshirt-hoodie' && item.tshirtSize && item.hoodieSize) {
          // Bundle: add both t-shirt and hoodie as separate line items with their types
          const tshirtKey = `tshirt-${variantPrefix}-${item.tshirtSize}`;
          const hoodieKey = `hoodie-${variantPrefix}-${item.hoodieSize}`;
          const tshirtVariantId = shopProfile.shopifyVariantMap[tshirtKey];
          const hoodieVariantId = shopProfile.shopifyVariantMap[hoodieKey];
          if (tshirtVariantId) {
            lineItems.push({ variantId: tshirtVariantId, quantity: item.quantity, productType: 'tshirt' });
          } else {
            console.error(`[Checkout] Missing variant mapping for key: ${tshirtKey}`);
            missingVariants.push(tshirtKey);
          }
          if (hoodieVariantId) {
            lineItems.push({ variantId: hoodieVariantId, quantity: item.quantity, productType: 'hoodie' });
          } else {
            console.error(`[Checkout] Missing variant mapping for key: ${hoodieKey}`);
            missingVariants.push(hoodieKey);
          }
        }
      });

      // Block checkout if any variant mappings are missing — prevent silent partial orders
      if (missingVariants.length > 0) {
        console.error('[Checkout] Missing variant mappings:', missingVariants);
        alert('Some items could not be added to your cart. Please try again or contact support.');
        return;
      }

      if (lineItems.length === 0) {
        alert('Could not add items to cart. Please try again.');
        return;
      }

      // Log attributes for debugging
      console.log('[ProductSelector] Checkout attributes:', {
        parentId,
        parentEmail,
        eventId,
        classId,
        schoolName,
      });

      // Create Shopify cart via API
      const response = await fetch('/api/shopify/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems,
          customAttributes: {
            parentId,
            parentEmail,
            eventId,
            classId,
            schoolName,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Checkout error:', data);
        alert(`Checkout error: ${data.details || data.error || 'Unknown error'}`);
        return;
      }

      // Check if we got a mock checkout (Shopify integration disabled)
      if (data.message?.includes('mock')) {
        console.log('Mock checkout created:', data);
        alert(`Mock order created (Shopify integration disabled).\n\nCart ID: ${data.cartId}`);
        return;
      }

      // Redirect to Shopify checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('Could not create checkout. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('There was an error processing your order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if audio product is selected
  const isAudioSelected = (productId: AudioProductId) => {
    return selection.audioProducts.some(p => p.productId === productId);
  };

  // Get audio product quantity
  const getAudioQuantity = (productId: AudioProductId) => {
    const item = selection.audioProducts.find(p => p.productId === productId);
    return item?.quantity || 1;
  };

  return (
    <div className="bg-gradient-to-br from-sage-50 to-cream-100 rounded-xl shadow-xl p-6 md:p-8 border-2 border-sage-200">
      {/* Header */}
      <div className="mb-8">
        {isSchulsongOnly ? (
          <h2 className="text-2xl font-heading font-bold text-gray-900">
            {t('titleSchulsongOnly', { schoolName })}
          </h2>
        ) : (
          <>
            <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              {t('title')}
            </h2>
            <p className="text-gray-600 mt-1">
              {t('subtitle', { schoolName })}
            </p>
          </>
        )}
      </div>

      {/* Audio Section - Multi-select (hidden for schulsong-only events) */}
      {!isSchulsongOnly && (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
            1
          </span>
          <h3 className="text-lg font-bold text-gray-900">{t('chooseAudio')}</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {shopProfile.audioProducts.map((product) => (
            <AudioProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              imageSrc={audioImages[product.id] || undefined}
              imageEmoji={product.imageEmoji}
              isSelected={isAudioSelected(product.id)}
              quantity={getAudioQuantity(product.id)}
              savings={product.savings}
              onToggle={handleAudioToggle}
              onQuantityChange={handleAudioQuantityChange}
            />
          ))}
        </div>
      </div>
      )}

      {/* Divider */}
      {!isSchulsongOnly && <div className="border-t border-sage-200 my-8" />}

      {/* Clothing Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
            {isSchulsongOnly ? '1' : '2'}
          </span>
          <h3 className="text-lg font-bold text-gray-900">{t('addClothing')}</h3>
          <span className="text-xs text-gray-500 font-medium">{t('optional')}</span>
        </div>

        {/* Discount Banner - only show before event day (not applicable for schulsong-only) */}
        {!isSchulsongOnly &&
         selection.audioProducts.length > 0 &&
         selection.clothing.length === 0 &&
         eventDate &&
         getDaysUntilEvent(eventDate) > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
              <span className="text-lg">🎉</span>
              {t('discountBanner', {
                date: (() => {
                  const event = new Date(eventDate);
                  const day = event.getDate().toString().padStart(2, '0');
                  const month = (event.getMonth() + 1).toString().padStart(2, '0');
                  const year = event.getFullYear().toString().slice(-2);
                  return `${day}.${month}.${year}`;
                })()
              })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {activeClothingProducts.map((product) => (
            <ClothingProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              imageSrc={clothingImages[product.id as keyof typeof clothingImages]}
              savings={product.savings}
              showTshirtSize={product.showTshirtSize}
              showHoodieSize={product.showHoodieSize}
              onAdd={handleAddClothing}
              className={product.id === 'tshirt-hoodie' ? 'col-span-2 lg:col-span-1' : ''}
            />
          ))}
        </div>

        {/* Added Clothing Items List */}
        {selection.clothing.length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-4 border border-sage-200">
            <p className="text-sm font-medium text-gray-700 mb-3">{t('addedItems')}</p>
            <div className="space-y-2">
              {selection.clothing.map((item) => {
                const product = getClothingProduct(activeClothingProducts, item.productId);
                if (!product) return null;
                return (
                  <div key={item.id} className="flex items-center justify-between bg-sage-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      {clothingImages[item.productId as keyof typeof clothingImages] && (
                        <div className="relative w-12 h-12 rounded overflow-hidden">
                          <Image
                            src={clothingImages[item.productId as keyof typeof clothingImages]}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {product.name} x{item.quantity}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.tshirtSize && item.hoodieSize
                            ? `T-Shirt: ${item.tshirtSize}, Hoodie: ${item.hoodieSize}`
                            : item.tshirtSize
                            ? `Größe: ${item.tshirtSize}`
                            : `Größe: ${item.hoodieSize}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">
                        €{(product.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleRemoveClothing(item.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-sage-200 my-8" />

      {/* Order Summary */}
      <OrderSummary
        selection={selection}
        totals={totals}
        audioProducts={shopProfile.audioProducts}
        clothingProducts={activeClothingProducts}
        onCheckout={handleCheckout}
        isProcessing={isProcessing}
      />
    </div>
  );
}
