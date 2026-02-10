'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LanguageSelector from '@/components/shared/LanguageSelector';
import PreviewPlayer from '@/components/landing/PreviewPlayer';
import ProductSelector from '@/components/parent-portal/ProductSelector';
import OrderDeadlineCountdown from '@/components/parent-portal/OrderDeadlineCountdown';
import HeroIntroSection from '@/components/parent-portal/HeroIntroSection';
import PreparationSection from '@/components/parent-portal/PreparationSection';
import SchulsongSection from '@/components/parent-portal/SchulsongSection';
// Note: VideoCard removed - video is now handled in HeroIntroSection
import { CartProvider } from '@/lib/contexts/CartContext';
import { CartDrawer } from '@/components/shop';
import { ManageChildren } from '@/components/parent';
import { ParentSession } from '@/lib/types';
import { ShopProfile, MINIMUSIKERTAG_PROFILE, resolveShopProfile } from '@/lib/config/shopProfiles';

// Audio status response type
interface AudioStatus {
  hasAudio: boolean;
  audioUrl?: string;
  schoolLogoUrl?: string;
}

// Group type for parent portal
interface ParentGroup {
  groupId: string;
  groupName: string;
  eventId: string;
  memberClasses: { classId: string; className: string }[];
  songs: { id: string; title: string; artist?: string }[];
  audioStatus: {
    hasRawAudio: boolean;
    hasPreview: boolean;
    hasFinal: boolean;
  };
}

// Collection type for parent portal (Choir and Teacher Song)
interface ParentCollection {
  classId: string;
  name: string;
  type: 'choir' | 'teacher_song';
  songs: { id: string; title: string; artist?: string }[];
  audioStatus: {
    hasRawAudio: boolean;
    hasPreview: boolean;
    hasFinal: boolean;
  };
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
  const [audioStatus, setAudioStatus] = useState<AudioStatus | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [hasDigitalAccess, setHasDigitalAccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [groups, setGroups] = useState<ParentGroup[]>([]);
  const [groupAudioStatuses, setGroupAudioStatuses] = useState<Record<string, AudioStatus>>({});
  const [shopProfile, setShopProfile] = useState<ShopProfile>(MINIMUSIKERTAG_PROFILE);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [collections, setCollections] = useState<ParentCollection[]>([]);
  const [collectionAudioStatuses, setCollectionAudioStatuses] = useState<Record<string, AudioStatus>>({});
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
  const eventId = selectedChild?.eventId || session?.eventId || '';
  const classId = selectedChild?.classId || '';

  // Fetch audio status when class or event changes (MUST be before early returns)
  useEffect(() => {
    if (!session) return; // Guard inside hook
    if (eventId && classId) {
      fetchAudioStatus(eventId, classId);
    } else {
      setAudioStatus(null);
    }
  }, [session, eventId, classId, fetchAudioStatus]);

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

  // Fetch groups for the current class
  const fetchGroups = useCallback(async (clsId: string, evtId: string) => {
    try {
      const response = await fetch(`/api/parent/groups?classId=${encodeURIComponent(clsId)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.groups) {
          setGroups(data.groups);

          // Fetch audio status for each group that has audio
          const audioStatuses: Record<string, AudioStatus> = {};
          for (const group of data.groups) {
            if (group.audioStatus.hasFinal || group.audioStatus.hasPreview) {
              try {
                const audioResponse = await fetch(
                  `/api/r2/class-audio-status?eventId=${encodeURIComponent(evtId)}&classId=${encodeURIComponent(group.groupId)}`,
                  { credentials: 'include' }
                );
                if (audioResponse.ok) {
                  const audioData = await audioResponse.json();
                  if (audioData.success && audioData.data) {
                    audioStatuses[group.groupId] = audioData.data;
                  }
                }
              } catch (err) {
                console.error(`Error fetching audio for group ${group.groupId}:`, err);
              }
            }
          }
          setGroupAudioStatuses(audioStatuses);
        }
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  }, []);

  // Fetch groups when class changes
  useEffect(() => {
    if (!session) return;
    if (classId && eventId) {
      fetchGroups(classId, eventId);
    } else {
      setGroups([]);
      setGroupAudioStatuses({});
    }
  }, [session, classId, eventId, fetchGroups]);

  // Fetch collections (Choir and Teacher Song) for the event
  const fetchCollections = useCallback(async (evtId: string) => {
    try {
      const response = await fetch(`/api/parent/collections?eventId=${encodeURIComponent(evtId)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.collections) {
          setCollections(data.collections);

          // Fetch audio status for each collection that has audio
          const audioStatuses: Record<string, AudioStatus> = {};
          for (const collection of data.collections) {
            if (collection.audioStatus.hasFinal || collection.audioStatus.hasPreview) {
              try {
                const audioResponse = await fetch(
                  `/api/r2/class-audio-status?eventId=${encodeURIComponent(evtId)}&classId=${encodeURIComponent(collection.classId)}`,
                  { credentials: 'include' }
                );
                if (audioResponse.ok) {
                  const audioData = await audioResponse.json();
                  if (audioData.success && audioData.data) {
                    audioStatuses[collection.classId] = audioData.data;
                  }
                }
              } catch (err) {
                console.error(`Error fetching audio for collection ${collection.classId}:`, err);
              }
            }
          }
          setCollectionAudioStatuses(audioStatuses);
        }
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
      setCollections([]);
    }
  }, []);

  // Fetch collections when event changes
  useEffect(() => {
    if (!session || !eventId) return;
    fetchCollections(eventId);
  }, [session, eventId, fetchCollections]);

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
              {/* Shop Link (hidden for Schulsong-only — inline ProductSelector is their shop) */}
              {!isSchulsongOnly && (
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
              )}
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

      {/* Content Tabs Section - Only show when not schulsong-only and has any content */}
      {!isSchulsongOnly && (audioStatus?.hasAudio || collections.length > 0 || groups.length > 0) && (
        <section className="bg-gray-50 py-6">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-2 justify-center">
              {/* My Class Tab */}
              {audioStatus?.hasAudio && (
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

      {/* My Class Audio Section - Show when class tab is active */}
      {!isSchulsongOnly && activeTab === 'class' && !isLoadingAudio && audioStatus?.hasAudio && audioStatus.audioUrl && (
        <section className="bg-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <img src="/images/familie/mascot_logo.png" alt="" className="h-6 w-auto mr-2" />
                {tPreview('title')}
              </h3>

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
            </div>
          </div>
        </section>
      )}

      {/* Choir Collection Sections - Show when choir tab is active */}
      {!isSchulsongOnly && activeTab === 'choir' && collections.filter(c => c.type === 'choir').map((collection) => {
        const collectionAudio = collectionAudioStatuses[collection.classId];

        return (
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

                {collectionAudio?.hasAudio && collectionAudio.audioUrl ? (
                  <>
                    <PreviewPlayer
                      eventId={eventId || 'demo'}
                      classId={collection.classId}
                      className={collection.name}
                      audioUrl={collectionAudio.audioUrl}
                      isLocked={true}
                      previewLimit={10}
                      fadeOutDuration={1}
                      title={`${collection.name} - Chor`}
                      previewBadge={tPreview('previewBadge')}
                      previewMessage={tPreview('previewMessage')}
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
        );
      })}

      {/* Teacher Song Collection Sections - Show when teacher tab is active */}
      {!isSchulsongOnly && activeTab === 'teacher' && collections.filter(c => c.type === 'teacher_song').map((collection) => {
        const collectionAudio = collectionAudioStatuses[collection.classId];

        return (
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

                {collectionAudio?.hasAudio && collectionAudio.audioUrl ? (
                  <>
                    <PreviewPlayer
                      eventId={eventId || 'demo'}
                      classId={collection.classId}
                      className={collection.name}
                      audioUrl={collectionAudio.audioUrl}
                      isLocked={true}
                      previewLimit={10}
                      fadeOutDuration={1}
                      title={`${collection.name} - Lehrerlied`}
                      previewBadge={tPreview('previewBadge')}
                      previewMessage={tPreview('previewMessage')}
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
        );
      })}

      {/* Group Audio Sections - Show when shared tab is active */}
      {!isSchulsongOnly && activeTab === 'shared' && groups.filter(g => groupAudioStatuses[g.groupId]?.hasAudio).map((group) => {
        const groupAudio = groupAudioStatuses[group.groupId];
        if (!groupAudio?.hasAudio || !groupAudio.audioUrl) return null;

        return (
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
                  audioUrl={groupAudio.audioUrl}
                  isLocked={true}
                  previewLimit={10}
                  fadeOutDuration={1}
                  title={`${group.groupName} - Gruppenaufnahme`}
                  previewBadge={tPreview('previewBadge')}
                  previewMessage={tPreview('previewMessage')}
                />

                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800">
                    Diese Aufnahme enthält alle Klassen der Gruppe: {group.memberClasses.map(c => c.className).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Main Content - Shopping Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
