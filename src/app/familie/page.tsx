'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LanguageSelector from '@/components/shared/LanguageSelector';
import PreviewPlayer from '@/components/landing/PreviewPlayer';
import ProductSelector from '@/components/parent-portal/ProductSelector';
import OrderDeadlineCountdown from '@/components/parent-portal/OrderDeadlineCountdown';
import HeroIntroSection from '@/components/parent-portal/HeroIntroSection';
import PreparationSection from '@/components/parent-portal/PreparationSection';
import SchulsongSection from '@/components/parent-portal/SchulsongSection';
import MinicardUpsell from '@/components/parent-portal/MinicardUpsell';
import EventAudioTracklist from '@/components/parent-portal/EventAudioTracklist';
// Note: VideoCard removed - video is now handled in HeroIntroSection
import { CartProvider } from '@/lib/contexts/CartContext';
import { CartDrawer } from '@/components/shop';
import { ManageChildren } from '@/components/parent';
import { ParentSession } from '@/lib/types';
import { ShopProfile, MINIMUSIKERTAG_PROFILE, resolveShopProfile } from '@/lib/config/shopProfiles';

// Audio access response from /api/parent/audio-access
interface AudioAccessResponse {
  success: boolean;
  hasMinicard: boolean;
  isReleased: boolean;
  hasPreviewsAvailable?: boolean;
  classPreview: {
    hasAudio: boolean;
    previewUrl?: string;
  };
  classFull?: {
    audioUrl: string;
    downloadUrl: string;
  };
  collections?: AudioAccessCollection[];
  groups?: AudioAccessGroup[];
  allAudio?: {
    parentClassId: string;
    sections: {
      sectionId: string;
      sectionName: string;
      sectionType: 'class' | 'choir' | 'teacher_song' | 'group';
      memberClasses?: Array<{ classId: string; className: string }>;
      tracks: {
        songId?: string;
        title: string;
        artist?: string;
        order: number;
        durationSeconds?: number;
        fileSizeBytes?: number;
        audioUrl: string;
        downloadUrl: string;
        filename: string;
      }[];
    }[];
    totalTracks: number;
    totalSizeBytes: number;
  };
  releaseDate?: string;
}

interface AudioAccessCollection {
  classId: string;
  name: string;
  type: 'choir' | 'teacher_song';
  songs: { id: string; title: string; artist?: string }[];
  audioUrl?: string;
  downloadUrl?: string;
}

interface AudioAccessGroup {
  groupId: string;
  groupName: string;
  memberClasses: { classId: string; className: string }[];
  audioUrl?: string;
  downloadUrl?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [audioAccess, setAudioAccess] = useState<AudioAccessResponse | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(MINIMUSIKERTAG_PROFILE);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

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
        // Log session data for debugging
        console.log('[familie] Session loaded:', {
          parentId: sessionData.data.parentId,
          email: sessionData.data.email,
          eventId: sessionData.data.eventId,
          schoolName: sessionData.data.schoolName,
          childrenCount: sessionData.data.children?.length,
          children: sessionData.data.children?.map((c: any) => ({
            childName: c.childName,
            eventId: c.eventId,
            bookingId: c.bookingId,
            classId: c.classId,
            schoolName: c.schoolName,
          })),
        });
        setSession(sessionData.data);

      }
    } catch (err) {
      console.error('Error loading portal:', err);
      setError('Failed to load your portal. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch unified audio access for the current class/event
  const fetchAudioAccess = useCallback(async (evtId: string, clsId: string) => {
    setIsLoadingAudio(true);
    try {
      const params = new URLSearchParams({ eventId: evtId, classId: clsId });
      const response = await fetch(`/api/parent/audio-access?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAudioAccess(data);
        }
      }
    } catch (err) {
      console.error('Error fetching audio access:', err);
      setAudioAccess(null);
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  // Calculate derived values unconditionally (for hooks - must be before early returns)
  const children = session?.children || [];
  const selectedChild = children[selectedChildIndex] || null;
  const eventId = selectedChild?.eventId || session?.eventId || '';
  const classId = selectedChild?.classId || '';

  // Fetch audio access when class or event changes (MUST be before early returns)
  useEffect(() => {
    if (!session) return; // Guard inside hook
    if (eventId && classId) {
      fetchAudioAccess(eventId, classId);
    } else {
      setAudioAccess(null);
    }
  }, [session, eventId, classId, fetchAudioAccess]);

  // Fetch schulsong status to determine if this is a schulsong-only event
  useEffect(() => {
    if (!session || !eventId) {
      setIsProfileLoading(false);
      return;
    }

    const fetchSchulsongStatus = async () => {
      setIsProfileLoading(true);
      setShopProfile(MINIMUSIKERTAG_PROFILE); // Reset to default while loading to prevent stale profile flash
      try {
        const response = await fetch(
          `/api/parent/schulsong-status?eventId=${encodeURIComponent(eventId)}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setShopProfile(resolveShopProfile({
            isMinimusikertag: data.isMinimusikertag,
            isPlus: data.isPlus,
            isSchulsong: data.isSchulsong,
          }));
        }
      } catch (err) {
        console.error('Error fetching schulsong status:', err);
        // shopProfile stays as MINIMUSIKERTAG_PROFILE (safe default — shows more products, not fewer)
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchSchulsongStatus();
  }, [session, eventId]);

  // Derive isSchulsongOnly from shop profile for non-shop UI sections
  const isSchulsongOnly = shopProfile.profileType === 'schulsong-only';

  // Derive audio access state for rendering
  const hasAudio = audioAccess?.classPreview?.hasAudio ?? false;
  const isReleased = audioAccess?.isReleased ?? false;
  const hasMinicard = audioAccess?.hasMinicard ?? false;
  const hasPreviewsAvailable = audioAccess?.hasPreviewsAvailable ?? false;

  // Scroll to shop section (for MinicardUpsell CTA)
  const scrollToShop = useCallback(() => {
    const shopSection = document.querySelector('#shop-section');
    if (shopSection) {
      shopSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

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

  if (isLoading || isProfileLoading) {
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
  const schoolName = selectedChild?.schoolName || session?.schoolName || 'Springfield Elementary School';
  const schoolColor = '#94B8B3'; // Default sage color
  const eventType = selectedChild?.eventType || session?.eventType || 'Minimusiker';
  const eventDate = selectedChild?.bookingDate || session?.bookingDate;
  const className = selectedChild?.class || '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img
                src="/images/familie/mascot_logo.png"
                alt="MiniMusiker Logo"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{t('minimusiker')}</h1>
                <p className="text-xs text-gray-600">{t('parentPortal')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
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

      {/* School Banner - Blue background */}
      <div
        className="relative py-8 md:py-12 px-4 overflow-hidden"
        style={{
          background: '#25A3B9',
        }}
      >
        {/* Girl Image - Positioned on the left */}
        <div className="absolute left-4 md:left-8 lg:left-12 bottom-0 w-44 h-44 md:w-64 md:h-64 lg:w-72 lg:h-72">
          <Image
            src="/images/familie_portal/girl_with_headphones.png"
            alt="Girl with headphones"
            fill
            className="object-contain object-bottom"
            priority
          />
        </div>

        {/* School Info - Centered on the page */}
        <div className="max-w-7xl mx-auto">
          <div className="text-white text-center py-4 md:py-8">
            <h2 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'white' }}>{schoolName}</h2>
            {className && (
              <p className="text-lg md:text-xl font-medium opacity-90">
                {tBanner('class', { className })}
              </p>
            )}
            <p className="text-xl md:text-2xl opacity-95 mt-2">{eventType}</p>
            {eventDate && (
              <p className="text-base md:text-lg mt-2 opacity-90">
                {new Date(eventDate).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            )}
            {hasMultipleChildren && selectedChild && (
              <p className="text-sm mt-1 opacity-90">
                {tBanner('recordingFor', { childName: selectedChild.childName })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hero Intro Section - Video and Introduction (hidden for Schulsong-only) */}
      {!isSchulsongOnly && <HeroIntroSection />}

      {/* Preparation Section - Yellow PDF Download (hidden for Schulsong-only) */}
      {!isSchulsongOnly && <PreparationSection />}

      {/* Schulsong Section - Free school song with waveform player */}
      {eventId && <SchulsongSection eventId={eventId} />}

      {/* ================================================================
          AUDIO SECTION — Conditional rendering based on access level
          State A: !isReleased && !hasPreviewsAvailable → Coming Soon
          State B: (hasPreviewsAvailable || isReleased) && !(isReleased && hasMinicard) → Preview + upsell CTA
          State C: isReleased && hasMinicard → Full tabbed interface
         ================================================================ */}

      {/* State A: Audio not yet released and no previews available — Coming Soon */}
      {!isSchulsongOnly && hasAudio && !isReleased && !hasPreviewsAvailable && !isLoadingAudio && (
        <section className="bg-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-sage-50 border border-sage-200 rounded-xl p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-sage-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold text-sage-900 mb-2">Aufnahme kommt bald</h3>
              <p className="text-sage-700">
                Die Aufnahme wird nach der Veranstaltung hier verfügbar sein.
              </p>
              {audioAccess?.releaseDate && (
                <p className="text-sm text-sage-600 mt-2">
                  Verfügbar ab: {new Date(audioAccess.releaseDate).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* State B: Previews available or released, but not full access — Preview with upsell */}
      {!isSchulsongOnly && hasAudio && (hasPreviewsAvailable || isReleased) && !(isReleased && hasMinicard) && !isLoadingAudio && (
        <section className="bg-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <img src="/images/familie/mascot_logo.png" alt="" className="h-6 w-auto mr-2" />
                {tPreview('title')}
              </h3>

              {audioAccess?.classPreview?.previewUrl ? (
                <PreviewPlayer
                  eventId={eventId || 'demo'}
                  classId={classId}
                  className={className}
                  audioUrl={audioAccess.classPreview.previewUrl}
                  isLocked={true}
                  previewLimit={10}
                  fadeOutDuration={1}
                  title={tPreview('title')}
                  previewBadge={tPreview('previewBadge')}
                  previewMessage={tPreview('previewMessage')}
                />
              ) : (
                <div className="bg-sage-50 border border-sage-200 rounded-lg p-6 text-center">
                  <p className="text-sage-700 font-medium">Vorschau wird vorbereitet...</p>
                </div>
              )}

              <div className="mt-4 p-4 bg-sage-50 border border-sage-200 rounded-lg">
                <p className="text-sm text-sage-800">
                  {selectedChild
                    ? tPreview('previewDescription', { childName: `${selectedChild.childName}'s` })
                    : tPreview('previewDescriptionSchool')
                  }
                </p>
              </div>

              {/* Minicard Upsell CTA */}
              <MinicardUpsell schoolName={schoolName} onScrollToShop={scrollToShop} />
            </div>
          </div>
        </section>
      )}

      {/* State C: Released + has minicard — Full audio tracklist */}
      {!isSchulsongOnly && isReleased && hasMinicard && !isLoadingAudio && audioAccess?.allAudio && (
        <EventAudioTracklist
          allAudio={audioAccess.allAudio}
          schoolName={schoolName}
          eventId={eventId}
        />
      )}

      {/* Main Content - Shopping Section */}
      <div id="shop-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Shopping Section */}
        <section className="mb-12">
          {eventDate && (
            <OrderDeadlineCountdown eventDate={eventDate} profileType={shopProfile.profileType} />
          )}
          <ProductSelector
            eventId={eventId}
            eventDate={eventDate}
            classId={classId}
            parentId={session.parentId}
            parentEmail={session.email}
            schoolName={schoolName}
            children={children}
            shopProfile={shopProfile}
          />
        </section>

        {/* Manage Registration Section */}
        <section className="mb-12">
          <ManageChildren
            eventId={eventId}
            classId={classId}
            parentEmail={session.email}
            parentFirstName={session.firstName}
            parentPhone=""
            onDataChange={verifySessionAndLoadData}
          />
        </section>

      </div>

      {/* Cart Drawer */}
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
