'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface SchulsongWaveformPlayerProps {
  audioUrl: string;
  downloadUrl?: string;
}

export default function SchulsongWaveformPlayer({ audioUrl, downloadUrl }: SchulsongWaveformPlayerProps) {
  const t = useTranslations('schulsong');
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!waveformRef.current) return;

    let ws: any = null;

    const initWaveSurfer = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;

      if (!waveformRef.current) return;

      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgba(255, 255, 255, 0.5)',
        progressColor: '#5B8A72',
        cursorColor: '#ffffff',
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        barRadius: 2,
        height: 80,
        normalize: true,
      });

      ws.on('ready', () => {
        setIsReady(true);
        setDuration(ws.getDuration());
      });

      ws.on('audioprocess', () => {
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('seeking', () => {
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      ws.load(audioUrl);
      wavesurferRef.current = ws;
    };

    initWaveSurfer();

    return () => {
      if (ws) {
        ws.destroy();
      }
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'schulsong.mp3';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="w-full">
      {/* Player controls */}
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={togglePlayPause}
          disabled={!isReady}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? t('pause') : t('play')}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="text-sm text-white/90 font-medium tabular-nums min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Waveform */}
      <div ref={waveformRef} className="w-full rounded-lg overflow-hidden" />

      {/* Loading state */}
      {!isReady && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="ml-2 text-sm text-white/70">{t('loading')}</span>
        </div>
      )}

      {/* Download button */}
      {downloadUrl && (
        <button
          onClick={handleDownload}
          className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#E91E63] text-white rounded-lg hover:bg-[#C2185B] transition-colors font-medium shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t('download')}
        </button>
      )}
    </div>
  );
}
