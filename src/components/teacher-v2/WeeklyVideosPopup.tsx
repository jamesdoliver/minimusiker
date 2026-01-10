'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WeekInfo, VideoFolder } from '@/lib/utils/weekCalculator';
import { getPassedWeeks, getFolderLabel } from '@/lib/utils/weekCalculator';
import type { TeacherVideo } from '@/lib/types/teacher-videos';
import WeekRow from './WeekRow';

interface WeeklyVideosPopupProps {
  eventDate: string;
  eventId: string;
  weekInfo: WeekInfo;
  onClose: () => void;
}

export default function WeeklyVideosPopup({
  eventDate,
  weekInfo,
  onClose,
}: WeeklyVideosPopupProps) {
  // Active week and video state
  const [activeWeek, setActiveWeek] = useState<VideoFolder>(weekInfo.folder);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  // Videos cache by week
  const [videosByWeek, setVideosByWeek] = useState<
    Record<VideoFolder, TeacherVideo[]>
  >({} as Record<VideoFolder, TeacherVideo[]>);

  // Passed weeks to display
  const [passedWeeks, setPassedWeeks] = useState<VideoFolder[]>([]);

  // Loading state per week
  const [loadingWeeks, setLoadingWeeks] = useState<Set<VideoFolder>>(new Set());

  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch videos for a specific week
  const fetchVideosForWeek = useCallback(
    async (folder: VideoFolder) => {
      // Skip if already loaded
      if (videosByWeek[folder]) return videosByWeek[folder];

      setLoadingWeeks((prev) => new Set(prev).add(folder));

      try {
        const response = await fetch(
          `/api/teacher/videos?eventDate=${encodeURIComponent(eventDate)}&folder=${folder}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch videos');
        }

        const data = await response.json();

        if (data.success) {
          setVideosByWeek((prev) => ({
            ...prev,
            [folder]: data.videos || [],
          }));
          return data.videos || [];
        }
        return [];
      } catch (err) {
        console.error(`Error fetching videos for ${folder}:`, err);
        return [];
      } finally {
        setLoadingWeeks((prev) => {
          const next = new Set(prev);
          next.delete(folder);
          return next;
        });
      }
    },
    [eventDate, videosByWeek]
  );

  // Initial load: fetch current week and calculate passed weeks
  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      setError(null);

      // Calculate passed weeks
      const passed = getPassedWeeks(weekInfo.folder);
      setPassedWeeks(passed);

      // Fetch current week's videos
      const videos = await fetchVideosForWeek(weekInfo.folder);

      if (!videos || videos.length === 0) {
        setError('Keine Videos für diese Woche verfügbar.');
      }

      setIsInitialLoading(false);

      // Pre-fetch passed weeks in background (lazy load)
      passed.forEach((folder) => {
        fetchVideosForWeek(folder);
      });
    };

    init();
  }, [weekInfo.folder, eventDate]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when popup is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Handle video selection within current active week
  const handleVideoSelect = (index: number) => {
    if (index === activeVideoIndex) return;

    // Pause current video
    if (videoRef.current) {
      videoRef.current.pause();
    }

    setActiveVideoIndex(index);
  };

  // Handle clicking a video from a different (passed) week
  const handleWeekVideoClick = async (folder: VideoFolder, index: number) => {
    // Pause current video
    if (videoRef.current) {
      videoRef.current.pause();
    }

    // Ensure videos are loaded for this week
    if (!videosByWeek[folder]) {
      await fetchVideosForWeek(folder);
    }

    // Switch to that week
    setActiveWeek(folder);
    setActiveVideoIndex(index);

    // Scroll to top smoothly
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Get current active week's videos and active video
  const activeWeekVideos = videosByWeek[activeWeek] || [];
  const activeVideo = activeWeekVideos[activeVideoIndex];
  const activeWeekLabel = getFolderLabel(activeWeek);

  // Filter passed weeks to exclude the currently active week
  const displayedPassedWeeks = passedWeeks.filter((w) => w !== activeWeek);

  // If current week was changed to a passed week, add original week to passed list
  const allPassedWeeks =
    activeWeek !== weekInfo.folder
      ? [weekInfo.folder, ...displayedPassedWeeks].filter(
          (w) => w !== activeWeek
        )
      : displayedPassedWeeks;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header with close button */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1a365d] rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Wochenvideos
              </h2>
              <p className="text-sm text-gray-500">{activeWeekLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Schließen"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Main content area - scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto">
          {isInitialLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a365d]"></div>
              <p className="text-sm text-gray-500">Videos werden geladen...</p>
            </div>
          ) : error && !activeVideo ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
              <svg
                className="w-12 h-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p>{error}</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Active Week Section */}
              <div className="grid md:grid-cols-[280px_1fr] gap-6">
                {/* Left: Title and Description */}
                <div className="space-y-4">
                  <div>
                    {activeVideo?.isIntro && (
                      <span className="inline-block px-2 py-0.5 bg-[#F4A261] text-white text-xs font-medium rounded mb-2">
                        Einführung
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {activeVideo?.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {activeVideo?.description}
                    </p>
                  </div>

                  {/* Video count indicator */}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
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
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4"
                      />
                    </svg>
                    Video {activeVideoIndex + 1} von {activeWeekVideos.length}
                  </div>

                  {/* Keyboard hint */}
                  <div className="text-xs text-gray-400 pt-4 border-t">
                    <span className="font-medium">Tipp:</span> Drücke ESC zum
                    Schließen
                  </div>
                </div>

                {/* Right: Video Player */}
                <div className="bg-black rounded-lg overflow-hidden aspect-video shadow-lg">
                  {activeVideo && (
                    <video
                      ref={videoRef}
                      key={activeVideo.key}
                      src={activeVideo.url}
                      controls
                      autoPlay
                      className="w-full h-full"
                      controlsList="nodownload"
                      playsInline
                    >
                      Ihr Browser unterstützt keine Video-Wiedergabe.
                    </video>
                  )}
                </div>
              </div>

              {/* Current week's video carousel */}
              {activeWeekVideos.length > 1 && (
                <div className="border-t mt-6 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {activeWeekLabel}
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {activeWeekVideos.map((video, index) => (
                      <button
                        key={video.key}
                        onClick={() => handleVideoSelect(index)}
                        className={`flex-shrink-0 w-36 group transition-all ${
                          index === activeVideoIndex
                            ? 'ring-2 ring-[#F4A261] ring-offset-2 rounded-lg'
                            : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <div
                          className={`aspect-video rounded-lg overflow-hidden mb-1.5 relative ${
                            index === activeVideoIndex
                              ? 'opacity-60'
                              : 'group-hover:ring-2 group-hover:ring-[#1a365d]'
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-[#1a365d]/90 to-[#2c5282]/90 flex items-center justify-center">
                            {video.isIntro ? (
                              <svg
                                className="w-6 h-6 text-white/70"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            ) : (
                              <span className="text-white/70 text-lg font-bold">
                                {video.order}
                              </span>
                            )}
                          </div>

                          {/* Now playing indicator */}
                          {index === activeVideoIndex && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="text-white text-xs font-medium px-2 py-1 bg-[#F4A261] rounded flex items-center gap-1">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                Spielt
                              </span>
                            </div>
                          )}

                          {/* Intro badge */}
                          {video.isIntro && index !== activeVideoIndex && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#F4A261] text-white text-[10px] font-medium rounded">
                              Intro
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <p className="text-xs text-gray-700 truncate text-left px-0.5">
                          {video.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Weeks Section */}
              {allPassedWeeks.length > 0 && (
                <div className="border-t mt-6 pt-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">
                    Vorherige Wochen
                  </h4>
                  <div className="space-y-2">
                    {allPassedWeeks.map((folder) => (
                      <WeekRow
                        key={folder}
                        folder={folder}
                        videos={videosByWeek[folder]}
                        isLoading={loadingWeeks.has(folder)}
                        onVideoClick={(index) =>
                          handleWeekVideoClick(folder, index)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
