'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Track {
  fileId: string;
  className: string;
  classType: string;
  songTitle?: string;
  displayName: string;
  fileSizeBytes?: number;
  isSchulsong: boolean;
}

interface AudioDownloadResponse {
  tracks: Track[];
}

interface AudioDownloadSectionProps {
  eventId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    // Schulsong last
    if (a.isSchulsong !== b.isSchulsong) {
      return a.isSchulsong ? 1 : -1;
    }
    // Then alphabetical by className
    return a.displayName.localeCompare(b.displayName, 'de');
  });
}

export default function AudioDownloadSection({ eventId }: AudioDownloadSectionProps) {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [zipDownloading, setZipDownloading] = useState(false);

  // Audio player state
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads`);
        const data: AudioDownloadResponse = await response.json();
        setTracks(sortTracks(data.tracks || []));
      } catch (err) {
        console.error('Error fetching audio downloads:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
  }, [eventId]);

  // Set up audio element and event listeners
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const handlePlayPause = useCallback(async (trackId: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If clicking the active track, toggle play/pause
    if (activeTrackId === trackId) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      return;
    }

    // New track: fetch streaming URL and play
    setIsLoadingAudio(true);
    setActiveTrackId(trackId);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const res = await fetch(
        `/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(trackId)}?stream=1`
      );
      if (!res.ok) throw new Error('Failed to fetch audio URL');
      const data = await res.json();

      audio.src = data.url;
      audio.load();
      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      setActiveTrackId(null);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [activeTrackId, isPlaying, eventId]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  if (loading || tracks.length === 0) {
    return null;
  }

  const handleDownloadTrack = (fileId: string) => {
    window.open(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(fileId)}`, '_blank');
  };

  const handleDownloadZip = () => {
    setZipDownloading(true);
    const zipWindow = window.open(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads/zip`, '_blank');
    // Reset zip downloading state after a delay since we can't track the download progress
    // of a window.open in another tab
    setTimeout(() => setZipDownloading(false), 5000);
    if (!zipWindow) {
      setZipDownloading(false);
    }
  };

  return (
    <div className="mb-8 bg-white rounded-xl border border-green-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Aufnahmen</h2>
            <p className="text-sm text-gray-500">Alle Aufnahmen sind fertig — anhören oder herunterladen.</p>
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={zipDownloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {zipDownloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Wird erstellt...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Alle herunterladen (.zip)
            </>
          )}
        </button>
      </div>

      {/* Track List */}
      <div className="divide-y divide-gray-100">
        {tracks.map((track) => (
          <div key={track.fileId}>
            <div className="flex items-center justify-between py-3 first:pt-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Play/Pause button */}
                <button
                  onClick={() => handlePlayPause(track.fileId)}
                  disabled={isLoadingAudio && activeTrackId === track.fileId}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 hover:bg-green-200 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isLoadingAudio && activeTrackId === track.fileId ? (
                    <svg className="w-4 h-4 text-green-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : activeTrackId === track.fileId && isPlaying ? (
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-green-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{track.displayName}</span>
                    {track.isSchulsong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0">
                        Schulsong
                      </span>
                    )}
                  </div>
                  {track.classType && track.classType !== 'regular' && (
                    <p className="text-xs text-gray-500 truncate">
                      {track.classType === 'choir' ? 'Chor' : track.classType === 'teacher_song' ? 'Lehrerlied' : track.classType}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                {track.fileSizeBytes != null && (
                  <span className="text-xs text-gray-400">{formatFileSize(track.fileSizeBytes)}</span>
                )}
                <button
                  onClick={() => handleDownloadTrack(track.fileId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Herunterladen
                </button>
              </div>
            </div>

            {/* Seek bar — shown when this track is active */}
            {activeTrackId === track.fileId && (
              <div className="flex items-center gap-3 pb-3 pl-11">
                <span className="text-xs text-gray-500 w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-green-600 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:appearance-none"
                />
                <span className="text-xs text-gray-500 w-10 tabular-nums">{formatTime(duration)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
