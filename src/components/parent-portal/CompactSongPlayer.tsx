'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface CompactSongPlayerProps {
  audioUrl: string;
  durationSeconds?: number;
  isActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onEnded: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CompactSongPlayer({
  audioUrl,
  durationSeconds,
  isActive,
  isPlaying,
  onTogglePlay,
  onEnded,
}: CompactSongPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);

  // Sync play/pause with parent state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isActive && isPlaying) {
      audio.play().catch(() => {
        // Autoplay blocked - ignore
      });
    } else {
      audio.pause();
    }
  }, [isActive, isPlaying]);

  // Reset when becoming inactive
  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, [isActive]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Play/Pause Button */}
      <button
        onClick={onTogglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-sage-600 hover:bg-sage-700 text-white flex items-center justify-center transition-colors"
        aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
      >
        {isActive && isPlaying ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Seekbar */}
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200"
          style={{
            background: `linear-gradient(to right, #6B8F71 0%, #6B8F71 ${progress}%, #e5e7eb ${progress}%, #e5e7eb 100%)`,
          }}
        />
      </div>

      {/* Time Display */}
      <span className="flex-shrink-0 text-xs text-gray-500 font-mono tabular-nums w-[72px] text-right">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={isActive ? audioUrl : undefined}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
      />
    </div>
  );
}
