'use client';

import { useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker from CDN (most reliable for Next.js)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfCanvasInnerProps {
  pdfUrl: string;
  containerWidth: number;
  onLoad?: (dimensions: { width: number; height: number; scale: number }) => void;
  onError?: (error: string) => void;
}

// Loading spinner component
function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ minHeight: '300px' }}>
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-gray-500">{message}</span>
      </div>
    </div>
  );
}

/**
 * Inner component that handles react-pdf rendering
 * This is dynamically imported to avoid SSR issues
 */
export default function PdfCanvasInner({
  pdfUrl,
  containerWidth,
  onLoad,
  onError,
}: PdfCanvasInnerProps) {
  const handleDocumentLoadSuccess = useCallback(() => {
    // Document loaded, page will render next
  }, []);

  const handleDocumentLoadError = useCallback((error: Error) => {
    const errorMsg = error.message || 'Failed to load PDF document';
    onError?.(errorMsg);
  }, [onError]);

  const handlePageLoadSuccess = useCallback((page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
    const scale = containerWidth / page.originalWidth;
    onLoad?.({
      width: containerWidth,
      height: page.originalHeight * scale,
      scale,
    });
  }, [containerWidth, onLoad]);

  return (
    <Document
      file={pdfUrl}
      onLoadSuccess={handleDocumentLoadSuccess}
      onLoadError={handleDocumentLoadError}
      loading={<LoadingSpinner message="Rendering PDF..." />}
    >
      <Page
        pageNumber={1}
        width={containerWidth}
        onLoadSuccess={handlePageLoadSuccess}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="rounded-lg shadow-md"
      />
    </Document>
  );
}
