'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ParentSessionChild } from '@/types/airtable';
import { TSHIRT_SIZES, HOODIE_SIZES, TshirtSize, HoodieSize } from '@/lib/types/stock';

// ============================================================================
// TYPES
// ============================================================================

type AudioOption = 'minicard' | 'cd' | 'bundle' | null;
type ClothingType = 'tshirt' | 'hoodie' | 'bundle';

interface ClothingItem {
  id: string;
  type: ClothingType;
  quantity: number;
  tshirtSize: TshirtSize;
  hoodieSize: HoodieSize;
}

interface ProductSelection {
  audio: AudioOption;
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
// PRICING (Placeholder prices - to be updated)
// ============================================================================

const PRICES = {
  audio: {
    minicard: 14.99,
    cd: 19.99,
    bundle: 29.99, // Save €5
  },
  clothing: {
    tshirt: 19.99,
    hoodie: 34.99,
    bundle: 49.99, // Save €5
  },
  comboDiscountPercent: 10,
};

const AUDIO_BUNDLE_SAVINGS = PRICES.audio.minicard + PRICES.audio.cd - PRICES.audio.bundle;
const CLOTHING_BUNDLE_SAVINGS = PRICES.clothing.tshirt + PRICES.clothing.hoodie - PRICES.clothing.bundle;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function calculateTotal(selection: ProductSelection) {
  let subtotal = 0;

  // Audio (required)
  if (selection.audio) {
    subtotal += PRICES.audio[selection.audio];
  }

  // Clothing (optional, sum all items)
  selection.clothing.forEach((item) => {
    subtotal += PRICES.clothing[item.type] * item.quantity;
  });

  // Apply combo discount if both audio AND clothing
  const hasClothing = selection.clothing.length > 0;
  const discountPercent = hasClothing && selection.audio ? PRICES.comboDiscountPercent : 0;
  const discount = subtotal * (discountPercent / 100);

  return {
    subtotal,
    discount,
    discountPercent,
    total: subtotal - discount,
    hasComboDiscount: hasClothing && selection.audio !== null,
  };
}

// ============================================================================
// SIZE SELECTOR COMPONENT
// ============================================================================

interface SizeSelectorProps<T extends string> {
  value: T;
  onChange: (size: T) => void;
  sizes: readonly T[];
  label?: string;
}

function SizeSelector<T extends string>({ value, onChange, sizes, label }: SizeSelectorProps<T>) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
      >
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// AUDIO CARD COMPONENT
// ============================================================================

interface AudioCardProps {
  type: AudioOption;
  selected: boolean;
  onSelect: () => void;
}

function AudioCard({ type, selected, onSelect }: AudioCardProps) {
  if (!type) return null;
  const t = useTranslations('audio');

  const config = {
    minicard: {
      title: t('minicard'),
      description: t('minicardDescription'),
      icon: '💳',
      price: PRICES.audio.minicard,
    },
    cd: {
      title: t('cd'),
      description: t('cdDescription'),
      icon: '💿',
      price: PRICES.audio.cd,
    },
    bundle: {
      title: t('bundle'),
      description: t('bundleDescription'),
      icon: '🎁',
      price: PRICES.audio.bundle,
      savings: AUDIO_BUNDLE_SAVINGS,
    },
  };

  const { title, description, icon, price, savings } = config[type] as typeof config.cd & { savings?: number };

  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
        selected
          ? 'border-sage-600 bg-sage-50 shadow-md ring-2 ring-sage-200'
          : 'border-gray-200 bg-white hover:border-sage-300'
      }`}
    >
      {/* Savings Badge */}
      {savings && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          {t('save', { amount: savings.toFixed(0) })}
        </div>
      )}

      {/* Selection Indicator */}
      <div
        className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-sage-600 bg-sage-600' : 'border-gray-300 bg-white'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <span className="text-3xl mb-2">{icon}</span>
      <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
      <p className="text-xs text-gray-500 text-center mt-1">{description}</p>
      <p className="text-lg font-bold text-gray-900 mt-2">€{price.toFixed(2)}</p>
    </button>
  );
}

// ============================================================================
// AUDIO SECTION COMPONENT
// ============================================================================

interface AudioSectionProps {
  selected: AudioOption;
  onSelect: (option: AudioOption) => void;
}

function AudioSection({ selected, onSelect }: AudioSectionProps) {
  const t = useTranslations('productSelector');

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
          1
        </span>
        <h3 className="text-lg font-bold text-gray-900">{t('chooseAudio')}</h3>
        <span className="text-xs text-red-500 font-medium">{t('required')}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AudioCard type="minicard" selected={selected === 'minicard'} onSelect={() => onSelect('minicard')} />
        <AudioCard type="cd" selected={selected === 'cd'} onSelect={() => onSelect('cd')} />
        <AudioCard type="bundle" selected={selected === 'bundle'} onSelect={() => onSelect('bundle')} />
      </div>
    </div>
  );
}

// ============================================================================
// CLOTHING CARD COMPONENT
// ============================================================================

interface ClothingCardProps {
  type: ClothingType;
  onAdd: (type: ClothingType, tshirtSize: TshirtSize, hoodieSize: HoodieSize) => void;
  hasComboDiscount: boolean;
}

function ClothingCard({ type, onAdd, hasComboDiscount }: ClothingCardProps) {
  const t = useTranslations('clothing');
  const tProduct = useTranslations('productSelector');
  const [tshirtSize, setTshirtSize] = useState<TshirtSize>(TSHIRT_SIZES[2]); // Default to middle size '122/128 (7-8J)'
  const [hoodieSize, setHoodieSize] = useState<HoodieSize>(HOODIE_SIZES[1]); // Default to '128 (7-8 J)'

  const config = {
    tshirt: {
      title: t('tshirt'),
      description: t('tshirtDescription'),
      icon: '👕',
      price: PRICES.clothing.tshirt,
      showTshirtSize: true,
      showHoodieSize: false,
    },
    hoodie: {
      title: t('hoodie'),
      description: t('hoodieDescription'),
      icon: '🧥',
      price: PRICES.clothing.hoodie,
      showTshirtSize: false,
      showHoodieSize: true,
    },
    bundle: {
      title: t('bundle'),
      description: t('bundleDescription'),
      icon: '🎁',
      price: PRICES.clothing.bundle,
      savings: CLOTHING_BUNDLE_SAVINGS,
      showTshirtSize: true,
      showHoodieSize: true,
    },
  };

  const { title, description, icon, price, savings, showTshirtSize, showHoodieSize } = config[type] as typeof config.tshirt & { savings?: number };

  const handleAdd = () => {
    onAdd(type, tshirtSize, hoodieSize);
  };

  return (
    <div className="relative flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-sage-300 transition-all duration-200 hover:shadow-md">
      {/* Savings Badge */}
      {savings && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          {t('save', { amount: savings.toFixed(0) })}
        </div>
      )}

      <span className="text-3xl mb-2">{icon}</span>
      <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
      <p className="text-xs text-gray-500 text-center mt-1">{description}</p>
      <p className="text-lg font-bold text-gray-900 mt-2">€{price.toFixed(2)}</p>

      {/* Size Selectors */}
      <div className="flex flex-col gap-2 mt-3 w-full">
        {showTshirtSize && (
          <SizeSelector
            value={tshirtSize}
            onChange={setTshirtSize}
            sizes={TSHIRT_SIZES}
            label={showHoodieSize ? tProduct('tshirtLabel') : undefined}
          />
        )}
        {showHoodieSize && (
          <SizeSelector
            value={hoodieSize}
            onChange={setHoodieSize}
            sizes={HOODIE_SIZES}
            label={showTshirtSize ? tProduct('hoodieLabel') : undefined}
          />
        )}
      </div>

      {/* Add Button */}
      <button
        onClick={handleAdd}
        className="mt-3 w-full py-2 px-4 bg-sage-600 text-white text-sm font-semibold rounded-lg hover:bg-sage-700 transition-colors flex items-center justify-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {tProduct('addButton')}
      </button>

      {/* Combo Discount Hint */}
      {hasComboDiscount && (
        <p className="text-xs text-sage-600 font-medium mt-2 text-center">
          {tProduct('comboHint')}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// CLOTHING SECTION COMPONENT
// ============================================================================

interface ClothingSectionProps {
  clothing: ClothingItem[];
  onAdd: (type: ClothingType, tshirtSize: TshirtSize, hoodieSize: HoodieSize) => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  hasAudioSelected: boolean;
}

function ClothingSection({ clothing, onAdd, onRemove, onUpdateQuantity, hasAudioSelected }: ClothingSectionProps) {
  const t = useTranslations('productSelector');
  const tClothing = useTranslations('clothing');

  const getItemLabel = (type: ClothingType) => {
    return type === 'tshirt' ? tClothing('tshirt') : type === 'hoodie' ? tClothing('hoodie') : tClothing('bundleLabel');
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center w-7 h-7 bg-sage-600 text-white text-sm font-bold rounded-full">
          2
        </span>
        <h3 className="text-lg font-bold text-gray-900">{t('addClothing')}</h3>
        <span className="text-xs text-gray-500 font-medium">{t('optional')}</span>
      </div>

      {/* Discount Banner */}
      {hasAudioSelected && clothing.length === 0 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
            <span className="text-lg">🎉</span>
            {t('discountBanner')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <ClothingCard type="tshirt" onAdd={onAdd} hasComboDiscount={hasAudioSelected} />
        <ClothingCard type="hoodie" onAdd={onAdd} hasComboDiscount={hasAudioSelected} />
        <ClothingCard type="bundle" onAdd={onAdd} hasComboDiscount={hasAudioSelected} />
      </div>

      {/* Added Items List */}
      {clothing.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">{t('addedItems')}</p>
          <div className="space-y-2">
            {clothing.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {item.type === 'tshirt' ? '👕' : item.type === 'hoodie' ? '🧥' : '🎁'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getItemLabel(item.type)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.type === 'bundle'
                        ? `${t('tshirtLabel')} ${item.tshirtSize}, ${t('hoodieLabel')} ${item.hoodieSize}`
                        : item.type === 'tshirt'
                        ? `${t('size')} ${item.tshirtSize}`
                        : `${t('size')} ${item.hoodieSize}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.quantity}
                    onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const tAudio = useTranslations('audio');
  const tClothing = useTranslations('clothing');

  const audioLabels = {
    minicard: tAudio('minicard'),
    cd: tAudio('cd'),
    bundle: tAudio('bundleLabel'),
  };

  const clothingLabels = {
    tshirt: tClothing('tshirt'),
    hoodie: tClothing('hoodie'),
    bundle: tClothing('bundleLabel'),
  };

  const hasItems = selection.audio !== null || selection.clothing.length > 0;
  const canCheckout = selection.audio !== null;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-4">
      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {t('title')}
      </h3>

      {!hasItems ? (
        <p className="text-sm text-gray-500 text-center py-4">{t('selectItems')}</p>
      ) : (
        <div className="space-y-2">
          {/* Audio Line Item */}
          {selection.audio && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{audioLabels[selection.audio]}</span>
              <span className="font-medium text-gray-900">€{PRICES.audio[selection.audio].toFixed(2)}</span>
            </div>
          )}

          {/* Clothing Line Items */}
          {selection.clothing.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {clothingLabels[item.type]}
                {item.quantity > 1 && ` x${item.quantity}`}
                <span className="text-xs text-gray-400 ml-1">
                  ({item.type === 'bundle'
                    ? `${item.tshirtSize} / ${item.hoodieSize}`
                    : item.type === 'tshirt'
                    ? item.tshirtSize
                    : item.hoodieSize})
                </span>
              </span>
              <span className="font-medium text-gray-900">
                €{(PRICES.clothing[item.type] * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}

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
    audio: null,
    clothing: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = useMemo(() => calculateTotal(selection), [selection]);

  // Audio selection handler
  const handleAudioSelect = (option: AudioOption) => {
    setSelection((prev) => ({
      ...prev,
      audio: option,
    }));
  };

  // Clothing handlers
  const handleAddClothing = (type: ClothingType, tshirtSize: TshirtSize, hoodieSize: HoodieSize) => {
    const newItem: ClothingItem = {
      id: generateId(),
      type,
      quantity: 1,
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

  const handleUpdateQuantity = (id: string, quantity: number) => {
    setSelection((prev) => ({
      ...prev,
      clothing: prev.clothing.map((item) => (item.id === id ? { ...item, quantity } : item)),
    }));
  };

  // Checkout handler
  const handleCheckout = async () => {
    if (!selection.audio) return;

    setIsProcessing(true);

    try {
      // If custom checkout handler provided, use it
      if (onCheckout) {
        onCheckout(selection, totals.total);
        return;
      }

      // Default: show confirmation (in production, integrate with Shopify)
      const itemsSummary = [];
      if (selection.audio) {
        itemsSummary.push(
          selection.audio === 'bundle' ? 'Minicard + CD Bundle' : selection.audio === 'minicard' ? 'Minicard' : 'CD'
        );
      }
      selection.clothing.forEach((item) => {
        const name = item.type === 'bundle' ? 'T-Shirt + Hoodie' : item.type === 'tshirt' ? 'T-Shirt' : 'Hoodie';
        itemsSummary.push(`${name} x${item.quantity}`);
      });

      alert(`Order submitted!\n\nItems: ${itemsSummary.join(', ')}\nTotal: €${totals.total.toFixed(2)}`);
    } catch (error) {
      console.error('Checkout error:', error);
      alert('There was an error processing your order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-sage-50 to-cream-100 rounded-xl shadow-xl p-6 border-2 border-sage-200">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          {t('title')}
        </h2>
        <p className="text-gray-600 mt-1">
          {t('subtitle', { schoolName })}
        </p>
      </div>

      {/* Audio Section - Required */}
      <AudioSection selected={selection.audio} onSelect={handleAudioSelect} />

      {/* Divider */}
      <div className="border-t border-sage-200 my-6" />

      {/* Clothing Section - Optional */}
      <ClothingSection
        clothing={selection.clothing}
        onAdd={handleAddClothing}
        onRemove={handleRemoveClothing}
        onUpdateQuantity={handleUpdateQuantity}
        hasAudioSelected={selection.audio !== null}
      />

      {/* Divider */}
      <div className="border-t border-sage-200 my-6" />

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
