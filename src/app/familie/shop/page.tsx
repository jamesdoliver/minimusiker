'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CartProvider } from '@/lib/contexts/CartContext';
import { useProducts } from '@/lib/hooks/useProducts';
import ShopHeader from '@/components/shop/ShopHeader';
import ProductCatalog from '@/components/shop/ProductCatalog';
import CartSummary from '@/components/shop/CartSummary';
import CartDrawer from '@/components/shop/CartDrawer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { resolveShopProfile } from '@/lib/config/shopProfiles';
import { canOrderPersonalizedClothing } from '@/lib/utils/eventTimeline';
import { parseOverrides, getThreshold } from '@/lib/utils/eventThresholds';

// Child type from session
interface SessionChild {
  childName: string;
  eventId?: string;
  classId?: string;
  bookingId?: string;
  class?: string;
  schoolName?: string;
}

/**
 * Build a set of Shopify variant GIDs that should be excluded based on cutoff.
 * If personalized clothing is available, exclude standard clothing variants.
 * If personalized clothing is NOT available, exclude personalized clothing variants.
 */
function buildExcludedVariantIds(
  variantMap: Record<string, string>,
  showPersonalized: boolean
): Set<string> {
  const excluded = new Set<string>();
  const excludePrefix = showPersonalized ? '-standard-' : '-personalized-';

  for (const [key, gid] of Object.entries(variantMap)) {
    if (key.includes(excludePrefix)) {
      excluded.add(gid);
    }
  }

  return excluded;
}

// Inner component that uses hooks
function ShopContent() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string>('');
  const [parentEmail, setParentEmail] = useState<string>('');
  const [children, setChildren] = useState<SessionChild[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(true);
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [timelineOverridesJson, setTimelineOverridesJson] = useState<string | null>(null);
  const [shopProfile, setShopProfile] = useState<ReturnType<typeof resolveShopProfile> | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const { products, isLoading, error } = useProducts({
    tagFilter: 'minimusiker-shop',
  });

  // Derive eventId and classId from selected child
  const selectedChild = children[selectedChildIndex] || null;
  const eventId = selectedChild?.eventId || selectedChild?.bookingId || '';
  const classId = selectedChild?.classId || '';
  const schoolName = selectedChild?.schoolName || '';
  const hasMultipleChildren = children.length > 1;

  // Verify parent session
  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/auth/verify-parent-session');
        if (!response.ok) {
          router.push('/parent-login');
          return;
        }

        const data = await response.json();
        if (data.success && data.data) {
          setParentId(data.data.parentId || '');
          setParentEmail(data.data.email || '');
          // Store all children for selection
          if (data.data.children?.length > 0) {
            setChildren(data.data.children);
          }
        }
      } catch (error) {
        console.error('Session verification error:', error);
        router.push('/parent-login');
      } finally {
        setIsVerifying(false);
      }
    };

    verifySession();
  }, [router]);

  // Fetch event profile and date for cutoff filtering
  useEffect(() => {
    if (isVerifying || !eventId) {
      // Don't resolve profile loading until we have an eventId from the session
      if (!isVerifying && !eventId) {
        setIsProfileLoading(false);
      }
      return;
    }

    const fetchEventProfile = async () => {
      setIsProfileLoading(true);
      try {
        const response = await fetch(
          `/api/parent/schulsong-status?eventId=${encodeURIComponent(eventId)}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setShopProfile(resolveShopProfile(
            {
              isMinimusikertag: data.isMinimusikertag,
              isPlus: data.isPlus,
              isSchulsong: data.isSchulsong,
            },
            {
              enabled: data.dealBuilderEnabled,
              type: data.dealType,
              config: data.dealConfig,
            }
          ));
          setEventDate(data.eventDate || null);
          if (data.timelineOverrides) {
            setTimelineOverridesJson(data.timelineOverrides);
          }
        }
      } catch (err) {
        console.error('Error fetching event profile:', err);
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchEventProfile();
  }, [isVerifying, eventId]);

  // Compute excluded variant IDs based on cutoff (with per-event overrides)
  const overrides = useMemo(() => parseOverrides(timelineOverridesJson), [timelineOverridesJson]);
  const excludedVariantIds = useMemo(() => {
    if (!shopProfile || !eventDate) return new Set<string>();

    const isSchulsongOnly = shopProfile.audioProducts.length === 0;
    const cutoffDays = isSchulsongOnly
      ? getThreshold('schulsong_clothing_cutoff_days', overrides)
      : getThreshold('personalized_clothing_cutoff_days', overrides);
    const showPersonalized = canOrderPersonalizedClothing(eventDate, cutoffDays);
    return buildExcludedVariantIds(shopProfile.shopifyVariantMap, showPersonalized);
  }, [shopProfile, eventDate, overrides]);

  if (isVerifying || isProfileLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <ShopHeader />

      {/* Child Selector - Only show if multiple children */}
      {hasMultipleChildren && (
        <div className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-2 overflow-x-auto">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">
                Shopping for:
              </span>
              {children.map((child, index) => (
                <button
                  key={child.bookingId || index}
                  onClick={() => setSelectedChildIndex(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedChildIndex === index
                      ? 'bg-[#F4A261] text-white border-2 border-[#E07B3A]'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {child.childName}
                  {child.class && (
                    <span className="ml-2 text-xs opacity-75">({child.class})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <ProductCatalog
          products={products}
          isLoading={isLoading}
          error={error}
          excludedVariantIds={excludedVariantIds}
        />
      </main>

      <CartSummary />
      <CartDrawer parentId={parentId} parentEmail={parentEmail} eventId={eventId} classId={classId} schoolName={schoolName} />
    </div>
  );
}

// Main page component with CartProvider
export default function ShopPage() {
  return (
    <CartProvider>
      <ShopContent />
    </CartProvider>
  );
}
