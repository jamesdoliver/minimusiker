'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Track {
  fileId: string;
  className: string;
  classType?: string;
  songTitle?: string;
  fileSizeBytes?: number;
  isSchulsong: boolean;
}

interface StaffAudioSectionProps {
  eventId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
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
    if (a.isSchulsong !== b.isSchulsong) return a.isSchulsong ? 1 : -1;
    // Then alphabetical by className
    return a.className.localeCompare(b.className, 'de');
  });
}

export default function StaffAudioSection({ eventId }: StaffAudioSectionProps) {
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
        const response = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads`);
        const data = await response.json();
        setTracks(sortTracks(data.tracks || []));
      } catch (err) {
        console.error('Error fetching audio downloads:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDownloads();
  }, [eventId]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

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

    if (activeTrackId === trackId) {
      if (isPlaying) { audio.pause(); } else { audio.play(); }
      return;
    }

    setIsLoadingAudio(true);
    setActiveTrackId(trackId);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const res = await fetch(
        `/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(trackId)}?stream=1`
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

  if (loading || tracks.length === 0) return null;

  const handleDownloadTrack = (fileId: string) => {
    window.open(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(fileId)}`, '_blank');
  };

  const handleDownloadZip = () => {
    setZipDownloading(true);
    const zipWindow = window.open(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/zip`, '_blank');
    setTimeout(() => setZipDownloading(false), 5000);
    if (!zipWindow) setZipDownloading(false);
  };

  return (
    <div className="mb-8 bg-white rounded-xl border border-[#94B8B3] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#94B8B3]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audio Tracks</h2>
            <p className="text-sm text-gray-500">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} available</p>
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={zipDownloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#5a8a82] text-white rounded-lg hover:bg-[#4a7a72] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {zipDownloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Preparing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download All (.zip)
            </>
          )}
        </button>
      </div>

      {/* Track list */}
      <div className="divide-y divide-gray-100">
        {tracks.map((track) => (
          <div key={track.fileId}>
            <div className="flex items-center justify-between py-3 first:pt-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Play/Pause */}
                <button
                  onClick={() => handlePlayPause(track.fileId)}
                  disabled={isLoadingAudio && activeTrackId === track.fileId}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#94B8B3]/20 hover:bg-[#94B8B3]/40 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isLoadingAudio && activeTrackId === track.fileId ? (
                    <svg className="w-4 h-4 text-[#5a8a82] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : activeTrackId === track.fileId && isPlaying ? (
                    <svg className="w-4 h-4 text-[#5a8a82]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[#5a8a82] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{track.className}</span>
                    {track.isSchulsong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">
                        Schulsong
                      </span>
                    )}
                    {track.classType === 'choir' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 flex-shrink-0">
                        Chor
                      </span>
                    )}
                    {track.classType === 'teacher_song' && !track.isSchulsong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                        Lehrerlied
                      </span>
                    )}
                  </div>
                  {track.songTitle && (
                    <p className="text-xs text-gray-500 truncate">{track.songTitle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                {track.fileSizeBytes != null && (
                  <span className="text-xs text-gray-400">{formatFileSize(track.fileSizeBytes)}</span>
                )}
                <button
                  onClick={() => handleDownloadTrack(track.fileId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#5a8a82] bg-[#94B8B3]/10 rounded-lg hover:bg-[#94B8B3]/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {/* Seek bar */}
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
                  className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#5a8a82] [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5a8a82] [&::-webkit-slider-thumb]:appearance-none"
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
