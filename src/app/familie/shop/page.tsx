'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartProvider } from '@/lib/contexts/CartContext';
import { useProducts } from '@/lib/hooks/useProducts';
import ShopHeader from '@/components/shop/ShopHeader';
import ProductCatalog from '@/components/shop/ProductCatalog';
import CartSummary from '@/components/shop/CartSummary';
import CartDrawer from '@/components/shop/CartDrawer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// Child type from session
interface SessionChild {
  childName: string;
  eventId?: string;
  classId?: string;
  bookingId?: string;
  class?: string;
  schoolName?: string;
}

// Inner component that uses hooks
function ShopContent() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string>('');
  const [parentEmail, setParentEmail] = useState<string>('');
  const [children, setChildren] = useState<SessionChild[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(true);

  const { products, isLoading, error } = useProducts({
    tagFilter: 'minimusiker-shop',
  });

  // Derive eventId and classId from selected child
  const selectedChild = children[selectedChildIndex] || null;
  const eventId = selectedChild?.eventId || selectedChild?.bookingId || '';
  const classId = selectedChild?.classId || '';
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
            // Log session data for debugging
            console.log('[shop] Session loaded:', {
              parentId: data.data.parentId,
              childrenCount: data.data.children.length,
              children: data.data.children.map((c: SessionChild) => ({
                childName: c.childName,
                eventId: c.eventId,
                bookingId: c.bookingId,
                classId: c.classId,
              })),
            });
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

  if (isVerifying) {
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
        />
      </main>

      <CartSummary />
      <CartDrawer parentId={parentId} parentEmail={parentEmail} eventId={eventId} classId={classId} />
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
