'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface PreviewPlayerProps {
  eventId: string;
  classId?: string;
  className?: string;
  previewKey?: string;
  isLocked: boolean;
  /** Direct audio URL (when provided, bypasses URL generation) */
  audioUrl?: string;
  /** Preview time limit in seconds (default: 10) */
  previewLimit?: number;
  /** Fade out duration in seconds (default: 1) */
  fadeOutDuration?: number;
  /** Title to display */
  title?: string;
  /** Preview badge text */
  previewBadge?: string;
  /** Preview limit message */
  previewMessage?: string;
}

export default function PreviewPlayer({
  eventId,
  classId,
  className,
  previewKey,
  isLocked,
  audioUrl: directAudioUrl,
  previewLimit = 10,
  fadeOutDuration = 1,
  title,
  previewBadge = 'Preview Only',
  previewMessage,
}: PreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use direct URL if provided, otherwise build URL from parameters
  const audioUrl = directAudioUrl
    ? directAudioUrl
    : previewKey
      ? `/api/r2/generate-preview-url?eventId=${eventId}${classId ? `&classId=${encodeURIComponent(classId)}` : ''}${className ? `&className=${encodeURIComponent(className)}` : ''}`
      : null;

  // Calculate the effective max time (either preview limit or full duration)
  const effectiveMaxTime = isLocked ? Math.min(previewLimit, duration || previewLimit) : duration;

  // Cleanup fade interval on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // Handle fade out effect
  const startFadeOut = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isFadingOut) return;

    setIsFadingOut(true);
    const startVolume = audio.volume;
    const fadeSteps = 20; // 20 steps over fadeOutDuration
    const stepDuration = (fadeOutDuration * 1000) / fadeSteps;
    const volumeStep = startVolume / fadeSteps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
      audio.volume = newVolume;

      if (currentStep >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        audio.pause();
        audio.volume = 1; // Reset volume for next play
        setIsPlaying(false);
        setIsFadingOut(false);
      }
    }, stepDuration);
  }, [fadeOutDuration, isFadingOut]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);

      // Check if we should start fade out (when approaching preview limit)
      if (isLocked && time >= previewLimit - fadeOutDuration && time < previewLimit && !isFadingOut) {
        startFadeOut();
      }

      // Hard stop at preview limit (safety check)
      if (isLocked && time >= previewLimit) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        setIsPlaying(false);
        setIsFadingOut(false);
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }
    };

    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setIsFadingOut(false);
    };
    const handleError = () => {
      setError('Failed to load audio');
      setIsPlaying(false);
      setIsLoading(false);
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [isLocked, previewLimit, fadeOutDuration, isFadingOut, startFadeOut]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      // Cancel any ongoing fade
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      audioRef.current.volume = 1;
      setIsFadingOut(false);
    } else {
      // Reset to beginning if at or past the limit
      if (isLocked && audioRef.current.currentTime >= previewLimit) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch((err) => {
        console.error('Playback error:', err);
        setError('Unable to play audio');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    // Limit seeking to preview limit when locked
    const limitedTime = isLocked ? Math.min(time, previewLimit - 0.5) : time;
    if (audioRef.current) {
      audioRef.current.currentTime = limitedTime;
      setCurrentTime(limitedTime);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress bar percentage for the preview limit marker
  const previewLimitPercentage = duration > 0 ? (previewLimit / duration) * 100 : 100;

  if (!previewKey && !directAudioUrl) {
    return (
      <div className="bg-gray-100 rounded-lg p-8 text-center">
        <p className="text-gray-600">Preview will be available after the event</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {title || (isLocked ? 'Audiovorschau' : 'Full Recording')}
          </h3>
          {isLocked && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage-100 text-sage-800">
              {previewBadge}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Player Controls */}
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlayPause}
              disabled={isLoading || !!error}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                isLoading || error
                  ? 'bg-gray-200 cursor-not-allowed'
                  : 'bg-sage-600 hover:bg-sage-700 text-white',
              )}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <div className="flex-1 space-y-1">
              {/* Progress bar container with limit marker */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!audioUrl || isLoading}
                />
                {/* Preview limit marker */}
                {isLocked && duration > 0 && previewLimit < duration && (
                  <div
                    className="absolute top-0 w-0.5 h-2 bg-sage-400 pointer-events-none"
                    style={{ left: `${previewLimitPercentage}%` }}
                    title={`Preview ends at ${formatTime(previewLimit)}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>
                  {isLocked && duration > previewLimit
                    ? `${formatTime(previewLimit)} / ${formatTime(duration)}`
                    : formatTime(duration)
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Message */}
        {isLocked && (
          <div className="bg-sage-50 border border-sage-200 rounded-md p-4">
            <p className="text-sm text-sage-800">
              {previewMessage || `🎵 This is a ${previewLimit}-second preview. Purchase the full recording to enjoy the complete performance!`}
            </p>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
        />
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #94B8B3;
          border-radius: 50%;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #94B8B3;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
