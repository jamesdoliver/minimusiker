'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PrintableItemType } from '@/lib/config/printableTextConfig';

// Dynamically import the PDF rendering component with no SSR
// This is required because pdfjs-dist uses browser APIs that don't work during SSR
const PdfCanvasInner = dynamic(
  () => import('./PdfCanvasInner'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ minHeight: '300px' }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-gray-500">Loading PDF viewer...</span>
        </div>
      </div>
    )
  }
);

interface PdfCanvasProps {
  templateType: PrintableItemType;
  pdfDimensions: { width: number; height: number };
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface CanvasState {
  loading: boolean;
  error: string | null;
  exists: boolean;
  pdfUrl: string | null;
}

/**
 * PdfCanvas - Renders a PDF template from R2 storage using react-pdf
 *
 * Fetches the template PDF via signed URL and renders the first page.
 * Returns the rendered dimensions for coordinate transformations.
 */
export default function PdfCanvas({
  templateType,
  pdfDimensions,
  onLoad,
  onError,
  className = '',
}: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [state, setState] = useState<CanvasState>({
    loading: true,
    error: null,
    exists: false,
    pdfUrl: null,
  });

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

  // Fetch signed URL on mount or template change
  useEffect(() => {
    const fetchPdfUrl = async () => {
      setState({ loading: true, error: null, exists: false, pdfUrl: null });

      try {
        const response = await fetch(`/api/admin/templates/${templateType}/preview-url`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to get template URL');
        }

        if (!data.exists || !data.url) {
          setState({
            loading: false,
            error: null,
            exists: false,
            pdfUrl: null,
          });
          return;
        }

        setState({
          loading: false,
          error: null,
          exists: true,
          pdfUrl: data.url,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error loading PDF';
        setState({
          loading: false,
          error: errorMsg,
          exists: false,
          pdfUrl: null,
        });
        onError?.(errorMsg);
      }
    };

    fetchPdfUrl();
  }, [templateType, onError]);

  const handleInnerError = useCallback((errorMsg: string) => {
    setState(prev => ({ ...prev, error: errorMsg }));
    onError?.(errorMsg);
  }, [onError]);

  if (state.loading) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ minHeight: '300px' }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-8 h-8 animate-spin text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-gray-500">Loading template...</span>
        </div>
      </div>
    );
  }

  if (state.error) {
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
          <span className="text-sm text-red-700 font-medium">Error loading template</span>
          <span className="text-xs text-red-600">{state.error}</span>
        </div>
      </div>
    );
  }

  if (!state.exists) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-amber-50 rounded-lg border border-amber-200 ${className}`}
        style={{ minHeight: '300px' }}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <svg
            className="w-10 h-10 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm text-amber-700 font-medium">Template not uploaded</span>
          <span className="text-xs text-amber-600">
            This template needs to be uploaded to R2 storage.
          </span>
          <span className="text-xs text-amber-500 mt-1">
            You can still confirm this item - it will use default positioning.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <PdfCanvasInner
        pdfUrl={state.pdfUrl!}
        containerWidth={containerWidth}
        pdfDimensions={pdfDimensions}
        onLoad={onLoad}
        onError={handleInnerError}
      />
    </div>
  );
}

/**
 * Hook to get the PDF canvas dimensions for coordinate transformations
 */
export function usePdfCanvasDimensions() {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  const handleLoad = useCallback(
    (dims: { width: number; height: number; scale: number }) => {
      setDimensions(dims);
    },
    []
  );

  return { dimensions, handleLoad };
}

/**
 * Convert PDF coordinates (origin bottom-left) to CSS coordinates (origin top-left)
 */
export function pdfToCssCoords(
  pdfX: number,
  pdfY: number,
  pdfHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: pdfX * scale,
    y: (pdfHeight - pdfY) * scale,
  };
}

/**
 * Convert CSS coordinates (origin top-left) to PDF coordinates (origin bottom-left)
 */
export function cssToPdfCoords(
  cssX: number,
  cssY: number,
  pdfHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: cssX / scale,
    y: pdfHeight - cssY / scale,
  };
}
