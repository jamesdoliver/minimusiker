'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getPrintableConfig, PrintableItemType } from '@/lib/config/printableTextConfig';

interface ImageCanvasProps {
  templateType: PrintableItemType;
  maxHeight?: number;
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * ImageCanvas - Renders a PNG preview image for any printable type
 *
 * Uses a native <img> with CSS containment (max-width/max-height + object-fit)
 * so the image fits within available space. After load, measures the actual
 * rendered size to report accurate dimensions/scale to the parent.
 */
export default function ImageCanvas({
  templateType,
  maxHeight,
  onLoad,
  onError,
  className = '',
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Get config for this template type
  const config = getPrintableConfig(templateType);

  // Use config dimensions or fallback
  const previewDimensions = config?.previewDimensions ?? { width: 1414, height: 2000 };
  const previewImage = config?.previewImage ?? '/images/printable_blank_logo/printable_logo_blank.png';

  // Reset state when template type changes
  useEffect(() => {
    setImageLoaded(false);
    setHasError(false);
  }, [templateType]);

  // Timeout fallback - if image doesn't load within 5 seconds, show error
  useEffect(() => {
    if (imageLoaded || hasError) return;

    const timeoutId = setTimeout(() => {
      if (!imageLoaded && !hasError) {
        setHasError(true);
        onError?.(`Preview image timed out for ${config?.name ?? templateType}`);
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [templateType, imageLoaded, hasError, onError, config?.name]);

  // Ref for onLoad so reportDimensions doesn't depend on it.
  // Without this, every parent re-render (e.g. text edit → new editorState →
  // new handleCanvasLoad → new onLoad prop) would recreate reportDimensions,
  // fire the effect, and trigger a cascade of extra re-renders.
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  // Measure the actual rendered image size and report to parent
  const reportDimensions = useCallback(() => {
    const img = imgRef.current;
    if (!img || !imageLoaded) return;

    const rect = img.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const scale = width / previewDimensions.width;

    onLoadRef.current?.({ width, height, scale });
  }, [imageLoaded, previewDimensions.width]);

  // Report dimensions whenever the image loads or the container resizes
  useEffect(() => {
    if (!imageLoaded) return;

    // Report initial dimensions
    reportDimensions();

    // Watch for container size changes (window resize, layout shifts)
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(reportDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [imageLoaded, reportDimensions]);

  // Also re-report when maxHeight changes
  useEffect(() => {
    if (imageLoaded) {
      // Small delay to let CSS recalculate after maxHeight prop changes
      requestAnimationFrame(reportDimensions);
    }
  }, [maxHeight, imageLoaded, reportDimensions]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setImageLoaded(false);
    onError?.(`Failed to load preview image for ${config?.name ?? templateType}`);
  }, [onError, config?.name, templateType]);

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
          <span className="text-sm text-red-700 font-medium">Error loading preview</span>
          <span className="text-xs text-red-600">The template preview image could not be loaded.</span>
        </div>
      </div>
    );
  }

  // Compute a placeholder height for the loading state
  const aspectRatio = previewDimensions.height / previewDimensions.width;
  const placeholderHeight = maxHeight ? Math.min(500 * aspectRatio, maxHeight) : 500 * aspectRatio;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
    >
      {/* Loading state */}
      {!imageLoaded && (
        <div
          className="flex items-center justify-center bg-gray-100 rounded-lg"
          style={{ width: '100%', height: placeholderHeight, minHeight: '300px' }}
        >
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-500">Loading preview...</span>
          </div>
        </div>
      )}

      {/* Template preview image - CSS controls sizing */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={previewImage}
        alt={`${config?.name ?? 'Template'} preview`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`rounded-lg shadow-md ${imageLoaded ? '' : 'hidden'}`}
        style={{
          maxWidth: '100%',
          maxHeight: maxHeight ? `${maxHeight}px` : '100%',
          width: 'auto',
          height: 'auto',
          display: imageLoaded ? 'block' : 'none',
        }}
      />
    </div>
  );
}
