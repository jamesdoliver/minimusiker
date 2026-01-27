'use client';

import { useEffect, useRef, useState } from 'react';

interface PdfCanvasInnerProps {
  pdfUrl: string;
  containerWidth: number;
  pdfDimensions: { width: number; height: number };
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
}

/**
 * Inner component that renders PDF using browser's native PDF viewer
 * Uses <object> element which provides better fallback than iframe
 */
export default function PdfCanvasInner({
  pdfUrl,
  containerWidth,
  pdfDimensions,
  onLoad,
  onError,
}: PdfCanvasInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate height from actual PDF dimensions
  const scale = containerWidth / pdfDimensions.width;
  const height = pdfDimensions.height * scale;

  useEffect(() => {
    // Reset state when URL changes
    setLoaded(false);
    setError(null);
  }, [pdfUrl]);

  const handleLoad = () => {
    setLoaded(true);
    // Report scale=1 so CSS positions (initialized at scale=1) map directly to PDF points
    // during generation. The real scale is only used for computing correct display height.
    onLoad?.({
      width: containerWidth,
      height: height,
      scale: 1,
    });
  };

  const handleError = () => {
    const errorMsg = 'Failed to load PDF';
    setError(errorMsg);
    onError?.(errorMsg);
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-red-50 rounded-lg border border-red-200"
        style={{ width: containerWidth, height: 300 }}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-red-700 font-medium">Error loading PDF</span>
          <span className="text-xs text-red-600">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative rounded-lg overflow-hidden shadow-md bg-gray-100">
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100"
          style={{ width: containerWidth, height: height }}
        >
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-gray-500">Loading PDF...</span>
          </div>
        </div>
      )}
      <object
        data={pdfUrl}
        type="application/pdf"
        width={containerWidth}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        className="rounded-lg"
        style={{
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        {/* Fallback for browsers that don't support object/embed for PDF */}
        <div className="flex flex-col items-center justify-center p-8 text-center" style={{ height }}>
          <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 mb-2">PDF preview not supported in this browser</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Open PDF in new tab
          </a>
        </div>
      </object>
    </div>
  );
}
