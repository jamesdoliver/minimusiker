'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ParentSessionChild } from '@/types/airtable';
import { TSHIRT_SIZES, HOODIE_SIZES, TshirtSize, HoodieSize } from '@/lib/types/stock';
import AudioProductCard from './AudioProductCard';
import ClothingProductCard from './ClothingProductCard';

// ============================================================================
// TYPES
// ============================================================================

type AudioProductId = 'minicard' | 'cd' | 'tonie' | 'minicard-cd-bundle' | 'minicard-tonie-bundle';
type ClothingProductId = 'tshirt' | 'hoodie' | 'clothing-bundle';

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
  parentId: string;
  schoolName: string;
  children?: ParentSessionChild[];
  onCheckout?: (selection: ProductSelection, total: number) => void;
}

// ============================================================================
// PRODUCT DEFINITIONS
// ============================================================================

interface AudioProduct {
  id: AudioProductId;
  name: string;
  description: string;
  price: number;
  imageEmoji: string;
  savings?: number;
}

const AUDIO_PRODUCTS: AudioProduct[] = [
  {
    id: 'minicard',
    name: 'Minicard',
    description: 'Kompakte Karte mit QR-Code zum Abspielen',
    price: 14.99,
    imageEmoji: '💳',
  },
  {
    id: 'cd',
    name: 'CD',
    description: 'Klassische Audio-CD im Jewel Case',
    price: 19.99,
    imageEmoji: '💿',
  },
  {
    id: 'tonie',
    name: 'Tonie',
    description: 'Toniefigur mit eurem Lied',
    price: 29.99,
    imageEmoji: '🎵',
  },
  {
    id: 'minicard-cd-bundle',
    name: 'Minicard + CD',
    description: 'Beide Formate zum Sparpreis',
    price: 29.99,
    savings: 5,
    imageEmoji: '🎁',
  },
  {
    id: 'minicard-tonie-bundle',
    name: 'Minicard + Tonie',
    description: 'Minicard und Tonie zum Sparpreis',
    price: 29.99,
    savings: 15,
    imageEmoji: '🎁',
  },
];

interface ClothingProduct {
  id: ClothingProductId;
  name: string;
  description: string;
  price: number;
  imageSrc: string;
  showTshirtSize: boolean;
  showHoodieSize: boolean;
  savings?: number;
}

const CLOTHING_PRODUCTS: ClothingProduct[] = [
  {
    id: 'tshirt',
    name: 'T-Shirt',
    description: 'Personalisiertes T-Shirt mit eurem Design',
    price: 19.99,
    imageSrc: '/images/products/tshirt.jpeg',
    showTshirtSize: true,
    showHoodieSize: false,
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    description: 'Kuscheliger Hoodie mit eurem Design',
    price: 34.99,
    imageSrc: '/images/products/hoodie.jpeg',
    showTshirtSize: false,
    showHoodieSize: true,
  },
  {
    id: 'clothing-bundle',
    name: 'T-Shirt + Hoodie',
    description: 'Beide Kleidungsstücke zum Sparpreis',
    price: 49.99,
    savings: 5,
    imageSrc: '/images/products/tshirt.jpeg',
    showTshirtSize: true,
    showHoodieSize: true,
  },
];

const COMBO_DISCOUNT_PERCENT = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getAudioProduct(id: AudioProductId) {
  return AUDIO_PRODUCTS.find(p => p.id === id);
}

function getClothingProduct(id: ClothingProductId) {
  return CLOTHING_PRODUCTS.find(p => p.id === id);
}

function calculateTotal(selection: ProductSelection) {
  let subtotal = 0;

  // Audio products (sum all selected with quantities)
  selection.audioProducts.forEach((item) => {
    const product = getAudioProduct(item.productId);
    if (product) {
      subtotal += product.price * item.quantity;
    }
  });

  // Clothing (sum all items)
  selection.clothing.forEach((item) => {
    const product = getClothingProduct(item.productId);
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
  onCheckout: () => void;
  isProcessing: boolean;
}

function OrderSummary({ selection, totals, onCheckout, isProcessing }: OrderSummaryProps) {
  const t = useTranslations('orderSummary');

  const hasItems = selection.audioProducts.length > 0 || selection.clothing.length > 0;
  const canCheckout = selection.audioProducts.length > 0;

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
            const product = getAudioProduct(item.productId);
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
            const product = getClothingProduct(item.productId);
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
          t('selectAudio')
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

export default function ProductSelector({
  eventId,
  parentId,
  schoolName,
  children = [],
  onCheckout,
}: ProductSelectorProps) {
  const t = useTranslations('productSelector');
  const [selection, setSelection] = useState<ProductSelection>({
    audioProducts: [],
    clothing: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = useMemo(() => calculateTotal(selection), [selection]);

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
    if (selection.audioProducts.length === 0) return;

    setIsProcessing(true);

    try {
      if (onCheckout) {
        onCheckout(selection, totals.total);
        return;
      }

      // Default: show confirmation
      const itemsSummary: string[] = [];
      selection.audioProducts.forEach((item) => {
        const product = getAudioProduct(item.productId);
        if (product) {
          itemsSummary.push(`${product.name} x${item.quantity}`);
        }
      });
      selection.clothing.forEach((item) => {
        const product = getClothingProduct(item.productId);
        if (product) {
          itemsSummary.push(`${product.name} x${item.quantity}`);
        }
      });

      alert(`Order submitted!\n\nItems: ${itemsSummary.join(', ')}\nTotal: €${totals.total.toFixed(2)}`);
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
        <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          {t('title')}
        </h2>
        <p className="text-gray-600 mt-1">
          {t('subtitle', { schoolName })}
        </p>
      </div>

      {/* Audio Section - Multi-select */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
            1
          </span>
          <h3 className="text-lg font-bold text-gray-900">{t('chooseAudio')}</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {AUDIO_PRODUCTS.map((product) => (
            <AudioProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
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

      {/* Divider */}
      <div className="border-t border-sage-200 my-8" />

      {/* Clothing Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
            2
          </span>
          <h3 className="text-lg font-bold text-gray-900">{t('addClothing')}</h3>
          <span className="text-xs text-gray-500 font-medium">{t('optional')}</span>
        </div>

        {/* Discount Banner */}
        {selection.audioProducts.length > 0 && selection.clothing.length === 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
              <span className="text-lg">🎉</span>
              {t('discountBanner')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {CLOTHING_PRODUCTS.map((product) => (
            <ClothingProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              imageSrc={product.imageSrc}
              savings={product.savings}
              showTshirtSize={product.showTshirtSize}
              showHoodieSize={product.showHoodieSize}
              onAdd={handleAddClothing}
            />
          ))}
        </div>

        {/* Added Clothing Items List */}
        {selection.clothing.length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-4 border border-sage-200">
            <p className="text-sm font-medium text-gray-700 mb-3">{t('addedItems')}</p>
            <div className="space-y-2">
              {selection.clothing.map((item) => {
                const product = getClothingProduct(item.productId);
                if (!product) return null;
                return (
                  <div key={item.id} className="flex items-center justify-between bg-sage-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      {product.imageSrc && (
                        <div className="relative w-12 h-12 rounded overflow-hidden">
                          <Image
                            src={product.imageSrc}
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
        onCheckout={handleCheckout}
        isProcessing={isProcessing}
      />
    </div>
  );
}
