'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LanguageSelector from '@/components/shared/LanguageSelector';
import PreviewPlayer from '@/components/landing/PreviewPlayer';
import AudioComingSoon from '@/components/parent-portal/AudioComingSoon';
import ProductSelector from '@/components/parent-portal/ProductSelector';
import VideoCard from '@/components/parent-portal/VideoCard';
import { CartProvider } from '@/lib/contexts/CartContext';
import { FeaturedProducts, CartSummary, CartDrawer } from '@/components/shop';
import { useProducts } from '@/lib/hooks/useProducts';
import { ParentSession, ParentPortalData } from '@/lib/types';

// Audio status response type
interface AudioStatus {
  hasAudio: boolean;
  audioUrl?: string;
  schoolLogoUrl?: string;
}

// Inner component that uses hooks
function ParentPortalContent() {
  const router = useRouter();
  const t = useTranslations('header');
  const tCommon = useTranslations('common');
  const tChild = useTranslations('childSelector');
  const tBanner = useTranslations('schoolBanner');
  const tPreview = useTranslations('recordingPreview');
  const [session, setSession] = useState<ParentSession | null>(null);
  const [portalData, setPortalData] = useState<ParentPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [audioStatus, setAudioStatus] = useState<AudioStatus | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [hasDigitalAccess, setHasDigitalAccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
        router.push('/familie-login');
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

  // Fetch audio status for the current class
  const fetchAudioStatus = useCallback(async (eventId: string, classId: string, schoolId?: string) => {
    setIsLoadingAudio(true);
    try {
      const params = new URLSearchParams({ eventId, classId });
      if (schoolId) params.append('schoolId', schoolId);

      const response = await fetch(`/api/r2/class-audio-status?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAudioStatus(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching audio status:', err);
      // On error, default to no audio (show coming soon)
      setAudioStatus({ hasAudio: false });
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  // Calculate derived values unconditionally (for hooks - must be before early returns)
  const children = session?.children || [];
  const selectedChild = children[selectedChildIndex] || null;
  const eventId = selectedChild?.bookingId || portalData?.parentJourney?.booking_id || session?.bookingId || '';
  const classId = selectedChild?.classId || portalData?.parentJourney?.class_id || '';

  // Fetch audio status when class or event changes (MUST be before early returns)
  useEffect(() => {
    if (!session) return; // Guard inside hook
    if (eventId && classId) {
      fetchAudioStatus(eventId, classId);
    } else {
      setAudioStatus(null);
    }
  }, [session, eventId, classId, fetchAudioStatus]);

  // Check digital access when event changes
  const checkDigitalAccess = useCallback(async (evId: string) => {
    try {
      const response = await fetch('/api/parent/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId: evId, checkOnly: true }),
      });
      // If we get a 200, they have access; 403 means no access
      setHasDigitalAccess(response.ok);
    } catch (err) {
      console.error('Error checking digital access:', err);
      setHasDigitalAccess(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !eventId) return;
    checkDigitalAccess(eventId);
  }, [session, eventId, checkDigitalAccess]);

  // Handle download button click
  const handleDownload = async () => {
    if (!eventId) return;

    setIsDownloading(true);
    try {
      const response = await fetch('/api/parent/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId,
          classId,
          className: selectedChild?.class,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get download link');
      }

      const data = await response.json();
      if (data.downloadUrl) {
        // Open download in new tab
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/parent-logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/familie-login');
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

  // Use data from session and portal data (children, selectedChild, eventId, classId already calculated above)
  const hasMultipleChildren = children.length > 1;
  const schoolName = selectedChild?.schoolName || session?.schoolName || portalData?.parentJourney?.school_name || 'Springfield Elementary School';
  const schoolColor = '#94B8B3'; // Default sage color
  const eventType = selectedChild?.eventType || session?.eventType || portalData?.parentJourney?.event_type || 'Spring Concert';
  const eventDate = selectedChild?.bookingDate || session?.bookingDate || portalData?.parentJourney?.booking_date || '2024-12-15';
  const className = selectedChild?.class || portalData?.parentJourney?.class || '';

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
                <h1 className="text-xl font-bold text-gray-900">{t('minimusiker')}</h1>
                <p className="text-xs text-gray-600">{t('parentPortal')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Shop Link */}
              <Link
                href="/familie/shop"
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
                {tCommon('shop')}
              </Link>
              {/* Language Selector */}
              <LanguageSelector />
              <span className="text-sm text-gray-700">
                {t('welcome', { firstName: session.firstName })}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {tCommon('signOut')}
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
                {tChild('viewingFor')}
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
              {tBanner('class', { className })}
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
              {tBanner('recordingFor', { childName: selectedChild.childName })}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Media Section - Audio Preview + Video Card side by side */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Left - Audio Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <img src="/images/minimusiker_logo.jpeg" alt="" className="h-6 w-auto mr-2" />
              {tPreview('title')}
            </h3>

            {isLoadingAudio ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : audioStatus?.hasAudio && audioStatus.audioUrl ? (
              <div>
                <PreviewPlayer
                  eventId={eventId || 'demo'}
                  classId={classId}
                  className={className}
                  audioUrl={audioStatus.audioUrl}
                  isLocked={true}
                  previewLimit={10}
                  fadeOutDuration={1}
                  title={tPreview('title')}
                  previewBadge={tPreview('previewBadge')}
                  previewMessage={tPreview('previewMessage')}
                />
                <div className="mt-4 p-4 bg-sage-50 border border-sage-200 rounded-lg">
                  <p className="text-sm text-sage-800">
                    {selectedChild
                      ? tPreview('previewDescription', { childName: `${selectedChild.childName}'s` })
                      : tPreview('previewDescriptionSchool')
                    }
                  </p>
                </div>

                {/* Download Button - Shows when parent has purchased digital access */}
                {hasDigitalAccess && (
                  <div className="mt-4">
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDownloading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Preparing Download...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Full Recording
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-xs text-center text-gray-500">
                      Your purchase includes the full high-quality recording
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <AudioComingSoon
                schoolLogoUrl={audioStatus?.schoolLogoUrl}
                message={tPreview('comingSoon')}
                title={tPreview('title')}
              />
            )}
          </div>

          {/* Right - Video Card */}
          <VideoCard
            title="Unser Video"
            videoUrl={undefined}
          />
        </section>

        {/* Shopping Section - Full Width */}
        <section className="mb-12">
          <ProductSelector
            eventId={eventId}
            classId={classId}
            parentId={session.parentId}
            parentEmail={session.email}
            schoolName={schoolName}
            children={children}
          />
        </section>

        {/* Featured Products Section */}
        {shopProducts.length > 0 && (
          <section>
            <FeaturedProducts products={shopProducts} maxItems={3} />
          </section>
        )}
      </div>

      {/* Cart Components */}
      <CartSummary />
      <CartDrawer parentId={session.parentId} parentEmail={session.email} eventId={eventId} classId={classId} />
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
