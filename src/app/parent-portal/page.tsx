'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PreviewPlayer from '@/components/landing/PreviewPlayer';
import ProductSelector from '@/components/parent-portal/ProductSelector';
import { CartProvider } from '@/lib/contexts/CartContext';
import { FeaturedProducts, CartSummary, CartDrawer } from '@/components/shop';
import { useProducts } from '@/lib/hooks/useProducts';
import { ParentSession, ParentPortalData } from '@/lib/types';

// Inner component that uses hooks
function ParentPortalContent() {
  const router = useRouter();
  const [session, setSession] = useState<ParentSession | null>(null);
  const [portalData, setPortalData] = useState<ParentPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  // Fetch shop products
  const { products: shopProducts } = useProducts({
    tagFilter: 'minimusiker-shop',
  });

  useEffect(() => {
    verifySessionAndLoadData();
  }, []);

  const verifySessionAndLoadData = async () => {
    try {
      // Verify parent session
      const sessionResponse = await fetch('/api/auth/verify-parent-session', {
        credentials: 'include',
      });

      if (!sessionResponse.ok) {
        // Redirect to login if not authenticated
        router.push('/parent-login');
        return;
      }

      const sessionData = await sessionResponse.json();
      if (sessionData.success) {
        setSession(sessionData.data);

        // Load parent portal data
        const portalResponse = await fetch(
          `/api/airtable/get-parent-data?accessToken=session`,
          {
            credentials: 'include',
            headers: {
              'X-Parent-ID': sessionData.data.parentId,
            },
          }
        );

        if (portalResponse.ok) {
          const portal = await portalResponse.json();
          if (portal.success) {
            setPortalData(portal.data);
          }
        }
      }
    } catch (err) {
      console.error('Error loading portal:', err);
      setError('Failed to load your portal. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/parent-logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/parent-login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  // Use data from session and portal data
  // Support multi-child: use selected child's data if available
  const children = session?.children || [];
  const hasMultipleChildren = children.length > 1;
  const selectedChild = children[selectedChildIndex] || null;

  const schoolName = selectedChild?.schoolName || session?.schoolName || portalData?.parentJourney?.school_name || 'Springfield Elementary School';
  const schoolColor = '#94B8B3'; // Default sage color
  const eventType = selectedChild?.eventType || session?.eventType || portalData?.parentJourney?.event_type || 'Spring Concert';
  const eventDate = selectedChild?.bookingDate || session?.bookingDate || portalData?.parentJourney?.booking_date || '2024-12-15';
  const classId = selectedChild?.classId || portalData?.parentJourney?.class_id;
  const className = selectedChild?.class || portalData?.parentJourney?.class || '';
  const hasRecording = !!classId; // Show player if we have a class_id

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img
                src="/images/minimusiker_logo.jpeg"
                alt="MiniMusiker Logo"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">MiniMusiker</h1>
                <p className="text-xs text-gray-600">Parent Portal</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Shop Link */}
              <Link
                href="/parent-portal/shop"
                className="flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                Shop
              </Link>
              <span className="text-sm text-gray-700">
                Welcome, {session.firstName}!
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Child Selector - Only show if multiple children */}
      {hasMultipleChildren && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-2 overflow-x-auto">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">
                Viewing for:
              </span>
              {children.map((child, index) => (
                <button
                  key={child.bookingId}
                  onClick={() => setSelectedChildIndex(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedChildIndex === index
                      ? 'bg-sage-100 text-sage-900 border-2 border-sage-500'
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

      {/* School Banner */}
      <div
        className="relative py-12 px-4"
        style={{
          background: `linear-gradient(135deg, ${schoolColor} 0%, ${schoolColor}dd 100%)`,
        }}
      >
        <div className="max-w-7xl mx-auto text-center text-sage-900">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">{schoolName}</h2>
          <p className="text-xl opacity-95">{eventType}</p>
          {className && (
            <p className="text-lg mt-1 opacity-90 font-medium">
              Class: {className}
            </p>
          )}
          <p className="text-sm mt-2 opacity-90">
            {new Date(eventDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {hasMultipleChildren && selectedChild && (
            <p className="text-sm mt-1 opacity-90">
              Recording for: {selectedChild.childName}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Recording Preview */}
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <img src="/images/minimusiker_logo.jpeg" alt="" className="h-6 w-auto mr-2" />
                School Recording Preview
              </h3>

              {hasRecording ? (
                <div>
                  <PreviewPlayer
                    eventId={selectedChild?.bookingId || portalData?.parentJourney?.booking_id || session?.bookingId || 'demo'}
                    classId={classId}
                    className={className}
                    previewKey="preview.mp3"
                    isLocked={true}
                  />
                  <div className="mt-4 p-4 bg-sage-50 border border-sage-200 rounded-lg">
                    <p className="text-sm text-sage-800">
                      This is a 30-second preview of {selectedChild ? `${selectedChild.childName}'s` : 'your school\'s'} performance.
                      Purchase the bundle below to unlock the full recording!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-gray-600">
                    Recording will be available after the event
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column - Product Selector */}
          <div>
            <ProductSelector
              eventId={session.eventId || 'demo'}
              parentId={session.parentId}
              schoolName={schoolName}
              children={children}
            />
          </div>
        </div>

        {/* Featured Products Section */}
        {shopProducts.length > 0 && (
          <div className="mt-8">
            <FeaturedProducts products={shopProducts} maxItems={3} />
          </div>
        )}
      </div>

      {/* Cart Components */}
      <CartSummary />
      <CartDrawer parentId={session.parentId} parentEmail={session.email} />
    </div>
  );
}

// Main page component with CartProvider
export default function ParentPortalPage() {
  return (
    <CartProvider>
      <ParentPortalContent />
    </CartProvider>
  );
}
