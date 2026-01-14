'use client';

import { useState, useRef } from 'react';

interface VideoCardProps {
  videoUrl?: string;
  posterUrl?: string;
  title?: string;
  className?: string;
}

export default function VideoCard({
  videoUrl,
  posterUrl,
  title = 'Unser Video',
  className = ''
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (!videoRef.current || !videoUrl) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsPlaying(false);
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {/* Header */}
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-sage-600"
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
        {title}
      </h3>

      {/* Video Container - 4:5 aspect ratio (Instagram vertical) */}
      <div className="relative aspect-[4/5] bg-gradient-to-br from-sage-100 to-cream-200 rounded-lg overflow-hidden">
        {videoUrl && !hasError ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl}
              className="absolute inset-0 w-full h-full object-cover"
              onEnded={handleVideoEnd}
              onError={handleError}
              playsInline
            />
            {/* Play/Pause Overlay */}
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
            >
              {!isPlaying && (
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg
                    className="w-8 h-8 text-sage-600 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </button>
          </>
        ) : (
          /* Placeholder when no video */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 bg-sage-200 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-sage-500"
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
            </div>
            <p className="text-sage-600 font-medium text-lg">
              {hasError ? 'Video nicht verfügbar' : 'Video kommt bald'}
            </p>
            <p className="text-sage-500 text-sm mt-2">
              {hasError
                ? 'Bitte versuchen Sie es später erneut'
                : 'Hier erscheint bald ein Video von eurem Auftritt'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
