'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface SchulsongWaveformPlayerProps {
  audioUrl: string;
  downloadUrl?: string;
  filename?: string;
}

export default function SchulsongWaveformPlayer({ audioUrl, downloadUrl, filename }: SchulsongWaveformPlayerProps) {
  const t = useTranslations('schulsong');
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

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
        waveColor: '#C4DBD5',
        progressColor: '#6B8B84',
        cursorColor: '#3D504C',
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        barRadius: 2,
        height: 64,
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

  const handleDownload = async () => {
    if (!downloadUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'schulsong.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      window.open(downloadUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6">
      {/* Player controls */}
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={togglePlayPause}
          disabled={!isReady}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-sage-600 hover:bg-sage-700 flex items-center justify-center shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? t('pause') : t('play')}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="text-sm text-sage-800 font-medium tabular-nums min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Waveform */}
      <div ref={waveformRef} className="w-full rounded-lg overflow-hidden" />

      {/* Loading state */}
      {!isReady && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-sage-200 border-t-sage-600 rounded-full animate-spin" />
          <span className="ml-2 text-sm text-sage-700">{t('loading')}</span>
        </div>
      )}

      {/* Download button */}
      {downloadUrl && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sage-500 to-sage-700 hover:from-sage-600 hover:to-sage-800 text-white rounded-lg transition-colors font-button font-bold uppercase tracking-wide shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('downloading')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('download')}
            </>
          )}
        </button>
      )}
    </div>
  );
}
