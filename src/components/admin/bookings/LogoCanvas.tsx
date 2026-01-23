'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { LOGO_CANVAS_DIMENSIONS } from '@/lib/config/printableTextConfig';

interface LogoCanvasProps {
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * LogoCanvas - Renders the blank logo PNG for t-shirt/hoodie editing
 *
 * Simpler alternative to PdfCanvas that:
 * - Loads the blank logo PNG from /images/printable_blank_logo/printable_logo_blank.png
 * - Scales to fit container while maintaining aspect ratio
 * - Reports dimensions and scale factor to parent (for coordinate conversion)
 * - Has consistent API with PdfCanvas (onLoad callback with dimensions)
 */
export default function LogoCanvas({
  onLoad,
  onError,
  className = '',
}: LogoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Calculate dimensions based on container width
  const aspectRatio = LOGO_CANVAS_DIMENSIONS.height / LOGO_CANVAS_DIMENSIONS.width;
  const displayWidth = containerWidth;
  const displayHeight = containerWidth * aspectRatio;
  const scale = displayWidth / LOGO_CANVAS_DIMENSIONS.width;

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 500);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Notify parent when dimensions change and image is loaded
  useEffect(() => {
    if (imageLoaded && onLoad) {
      onLoad({
        width: displayWidth,
        height: displayHeight,
        scale: scale,
      });
    }
  }, [imageLoaded, displayWidth, displayHeight, scale, onLoad]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setImageLoaded(false);
    onError?.('Failed to load logo image');
  }, [onError]);

  if (hasError) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-red-50 rounded-lg border border-red-200 ${className}`}
        style={{ minHeight: '300px' }}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm text-red-700 font-medium">Error loading logo</span>
          <span className="text-xs text-red-600">The blank logo image could not be loaded.</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Loading state */}
      {!imageLoaded && (
        <div
          className="flex items-center justify-center bg-gray-100 rounded-lg"
          style={{ width: displayWidth, height: displayHeight, minHeight: '300px' }}
        >
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-500">Loading logo...</span>
          </div>
        </div>
      )}

      {/* Logo image */}
      <Image
        src="/images/printable_blank_logo/printable_logo_blank.png"
        alt="Logo template"
        width={displayWidth}
        height={displayHeight}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`rounded-lg shadow-md ${imageLoaded ? '' : 'hidden'}`}
        priority
        unoptimized // Preserve exact pixel dimensions for coordinate mapping
      />
    </div>
  );
}
