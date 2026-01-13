'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PrintableItemType } from '@/lib/config/printableTextConfig';

// Dynamically import pdfjs-dist only on client side
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfjs() {
  if (!pdfjsLib && typeof window !== 'undefined') {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

interface PdfCanvasProps {
  templateType: PrintableItemType;
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface CanvasState {
  loading: boolean;
  error: string | null;
  exists: boolean;
  dimensions: { width: number; height: number; scale: number } | null;
}

/**
 * PdfCanvas - Renders a PDF template from R2 storage to a canvas
 *
 * Fetches the template PDF via signed URL and renders the first page
 * using PDF.js. Returns the rendered dimensions for coordinate transformations.
 */
export default function PdfCanvas({
  templateType,
  onLoad,
  onError,
  className = '',
}: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CanvasState>({
    loading: true,
    error: null,
    exists: false,
    dimensions: null,
  });

  const fetchAndRenderPdf = useCallback(async () => {
    setState({ loading: true, error: null, exists: false, dimensions: null });

    try {
      // Get pdfjs dynamically (client-side only)
      const pdfjs = await getPdfjs();
      if (!pdfjs) {
        throw new Error('PDF.js failed to load');
      }

      // Fetch the signed URL for the template
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
          dimensions: null,
        });
        return;
      }

      // Fetch and render the PDF
      const pdfDoc = await pdfjs.getDocument(data.url).promise;
      const page = await pdfDoc.getPage(1);

      // Get the container width to calculate scale
      const containerWidth = containerRef.current?.clientWidth || 500;

      // Get the viewport at scale 1 to know the PDF dimensions
      const viewport1 = page.getViewport({ scale: 1 });
      const pdfWidth = viewport1.width;
      const pdfHeight = viewport1.height;

      // Calculate scale to fit within container while maintaining aspect ratio
      const scale = containerWidth / pdfWidth;
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the PDF page to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      const dimensions = {
        width: viewport.width,
        height: viewport.height,
        scale: scale,
      };

      setState({
        loading: false,
        error: null,
        exists: true,
        dimensions,
      });

      onLoad?.(dimensions);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error loading PDF';
      setState({
        loading: false,
        error: errorMsg,
        exists: false,
        dimensions: null,
      });
      onError?.(errorMsg);
    }
  }, [templateType, onLoad, onError]);

  useEffect(() => {
    fetchAndRenderPdf();
  }, [fetchAndRenderPdf]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (state.exists && !state.loading) {
        fetchAndRenderPdf();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state.exists, state.loading, fetchAndRenderPdf]);

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
      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-md"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
        }}
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
