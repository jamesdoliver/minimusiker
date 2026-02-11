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

// Content tab type
type ContentTab = 'class' | 'choir' | 'teacher' | 'shared';

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
  const [activeTab, setActiveTab] = useState<ContentTab>('class');

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
  const collections = audioAccess?.collections ?? [];
  const groups = audioAccess?.groups ?? [];

  // Handle download button click — uses pre-signed URL from audio-access response
  const handleDownload = () => {
    const downloadUrl = audioAccess?.classFull?.downloadUrl;
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

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
          State A: !isReleased → Coming Soon
          State B: isReleased && !hasMinicard → Preview only + upsell CTA
          State C: isReleased && hasMinicard → Full tabbed interface
         ================================================================ */}

      {/* State A: Audio not yet released — Coming Soon */}
      {!isSchulsongOnly && hasAudio && !isReleased && !isLoadingAudio && (
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

      {/* State B: Released, no minicard — Preview only with upsell */}
      {!isSchulsongOnly && hasAudio && isReleased && !hasMinicard && !isLoadingAudio && (
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

      {/* State C: Released + has minicard — Full tabbed interface */}
      {!isSchulsongOnly && isReleased && hasMinicard && !isLoadingAudio && (
        <>
          {/* Content Tabs */}
          {(hasAudio || collections.length > 0 || groups.length > 0) && (
            <section className="bg-gray-50 py-6">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-wrap gap-2 justify-center">
                  {/* My Class Tab */}
                  {hasAudio && (
                    <button
                      onClick={() => setActiveTab('class')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'class'
                          ? 'bg-sage-600 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Meine Klasse
                      </span>
                    </button>
                  )}

                  {/* Choir Tab */}
                  {collections.filter(c => c.type === 'choir').length > 0 && (
                    <button
                      onClick={() => setActiveTab('choir')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'choir'
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        Chor ({collections.filter(c => c.type === 'choir').length})
                      </span>
                    </button>
                  )}

                  {/* Teacher Songs Tab */}
                  {collections.filter(c => c.type === 'teacher_song').length > 0 && (
                    <button
                      onClick={() => setActiveTab('teacher')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'teacher'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        Lehrerlied ({collections.filter(c => c.type === 'teacher_song').length})
                      </span>
                    </button>
                  )}

                  {/* Shared/Groups Tab */}
                  {groups.length > 0 && (
                    <button
                      onClick={() => setActiveTab('shared')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'shared'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Gruppen ({groups.length})
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* My Class Audio — Full access */}
          {activeTab === 'class' && hasAudio && (
            <section className="bg-white py-12">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <img src="/images/familie/mascot_logo.png" alt="" className="h-6 w-auto mr-2" />
                    {tPreview('title')}
                  </h3>

                  {audioAccess?.classFull?.audioUrl ? (
                    <>
                      <PreviewPlayer
                        eventId={eventId || 'demo'}
                        classId={classId}
                        className={className}
                        audioUrl={audioAccess.classFull.audioUrl}
                        isLocked={false}
                        title={tPreview('title')}
                      />
                      <div className="mt-4 p-4 bg-sage-50 border border-sage-200 rounded-lg">
                        <p className="text-sm text-sage-800">
                          {selectedChild
                            ? tPreview('previewDescription', { childName: `${selectedChild.childName}'s` })
                            : tPreview('previewDescriptionSchool')
                          }
                        </p>
                      </div>

                      {/* Download Button */}
                      <div className="mt-4">
                        <button
                          onClick={handleDownload}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Full Recording
                        </button>
                        <p className="mt-2 text-xs text-center text-gray-500">
                          Your purchase includes the full high-quality recording
                        </p>
                      </div>
                    </>
                  ) : audioAccess?.classPreview?.previewUrl ? (
                    <PreviewPlayer
                      eventId={eventId || 'demo'}
                      classId={classId}
                      className={className}
                      audioUrl={audioAccess.classPreview.previewUrl}
                      isLocked={false}
                      title={tPreview('title')}
                    />
                  ) : (
                    <div className="bg-sage-50 border border-sage-200 rounded-lg p-6 text-center">
                      <p className="text-sage-700 font-medium">Aufnahme wird vorbereitet...</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Choir Collection Sections — Full access */}
          {activeTab === 'choir' && collections.filter(c => c.type === 'choir').map((collection) => (
            <section key={collection.classId} className="bg-teal-50 py-12">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-teal-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{collection.name}</h3>
                      <p className="text-sm text-teal-600 font-medium">
                        Chor - {collection.songs.length} {collection.songs.length === 1 ? 'Lied' : 'Lieder'}
                      </p>
                    </div>
                  </div>

                  {collection.audioUrl ? (
                    <>
                      <PreviewPlayer
                        eventId={eventId || 'demo'}
                        classId={collection.classId}
                        className={collection.name}
                        audioUrl={collection.audioUrl}
                        isLocked={false}
                        title={`${collection.name} - Chor`}
                      />
                      <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                        <p className="text-sm text-teal-800">
                          Diese Aufnahme ist für alle Eltern dieser Veranstaltung verfügbar.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 text-center">
                      <svg className="w-12 h-12 mx-auto text-teal-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-teal-700 font-medium">Aufnahme in Bearbeitung</p>
                      <p className="text-sm text-teal-600 mt-1">Die Choraufnahme wird nach der Veranstaltung hier verfügbar sein.</p>
                    </div>
                  )}

                  {/* Song list */}
                  {collection.songs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Lieder in dieser Sammlung:</h4>
                      <ul className="space-y-1">
                        {collection.songs.map((song) => (
                          <li key={song.id} className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-3 h-3 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            {song.title}{song.artist && <span className="text-gray-400"> - {song.artist}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}

          {/* Teacher Song Collection Sections — Full access */}
          {activeTab === 'teacher' && collections.filter(c => c.type === 'teacher_song').map((collection) => (
            <section key={collection.classId} className="bg-amber-50 py-12">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-amber-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{collection.name}</h3>
                      <p className="text-sm text-amber-600 font-medium">
                        Lehrerlied - {collection.songs.length} {collection.songs.length === 1 ? 'Lied' : 'Lieder'}
                      </p>
                    </div>
                  </div>

                  {collection.audioUrl ? (
                    <>
                      <PreviewPlayer
                        eventId={eventId || 'demo'}
                        classId={collection.classId}
                        className={collection.name}
                        audioUrl={collection.audioUrl}
                        isLocked={false}
                        title={`${collection.name} - Lehrerlied`}
                      />
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          Diese Aufnahme ist für alle Eltern dieser Veranstaltung verfügbar.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                      <svg className="w-12 h-12 mx-auto text-amber-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-amber-700 font-medium">Aufnahme in Bearbeitung</p>
                      <p className="text-sm text-amber-600 mt-1">Die Lehreraufnahme wird nach der Veranstaltung hier verfügbar sein.</p>
                    </div>
                  )}

                  {/* Song list */}
                  {collection.songs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Lieder in dieser Sammlung:</h4>
                      <ul className="space-y-1">
                        {collection.songs.map((song) => (
                          <li key={song.id} className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            {song.title}{song.artist && <span className="text-gray-400"> - {song.artist}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}

          {/* Group Audio Sections — Full access */}
          {activeTab === 'shared' && groups.filter(g => g.audioUrl).map((group) => (
            <section key={group.groupId} className="bg-purple-50 py-12">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{group.groupName}</h3>
                      <p className="text-sm text-purple-600 font-medium">
                        Gruppen-Aufnahme: {group.memberClasses.map(c => c.className).join(' + ')}
                      </p>
                    </div>
                  </div>

                  <PreviewPlayer
                    eventId={eventId || 'demo'}
                    classId={group.groupId}
                    className={group.groupName}
                    audioUrl={group.audioUrl!}
                    isLocked={false}
                    title={`${group.groupName} - Gruppenaufnahme`}
                  />

                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800">
                      Diese Aufnahme enthält alle Klassen der Gruppe: {group.memberClasses.map(c => c.className).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </>
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
