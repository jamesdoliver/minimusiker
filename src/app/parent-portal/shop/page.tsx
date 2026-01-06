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

// Inner component that uses hooks
function ShopContent() {
  const router = useRouter();
  const [parentId, setParentId] = useState<string>('');
  const [parentEmail, setParentEmail] = useState<string>('');
  const [eventId, setEventId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(true);

  const { products, isLoading, error } = useProducts({
    tagFilter: 'minimusiker-shop',
  });

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
        if (data.session) {
          setParentId(data.session.parentId || '');
          setParentEmail(data.session.email || '');
          // Extract eventId and classId from first child for checkout
          if (data.session.children?.length > 0) {
            setEventId(data.session.children[0].eventId || '');
            setClassId(data.session.children[0].classId || '');
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
