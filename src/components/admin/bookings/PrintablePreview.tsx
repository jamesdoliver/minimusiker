'use client';

import { PrintableTextConfig, TextLines } from '@/lib/config/printableTextConfig';

interface PrintablePreviewProps {
  itemConfig: PrintableTextConfig;
  textLines: TextLines;
}

/**
 * Preview component for printable items
 *
 * Phase A: Shows a placeholder preview with text overlay
 * Phase B: Will show actual mockup image with pixel-perfect text positioning
 */
export default function PrintablePreview({ itemConfig, textLines }: PrintablePreviewProps) {
  // TODO: Phase B - Replace with actual mockup image and server-generated preview
  // For now, show a styled placeholder that demonstrates the concept

  return (
    <div className="w-full max-w-md">
      {/* Preview container */}
      <div className="relative bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        {/* Mockup placeholder - aspect ratio varies by item type */}
        <div
          className="relative bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
          style={{
            aspectRatio: `${itemConfig.pdfDimensions.width} / ${itemConfig.pdfDimensions.height}`,
          }}
        >
          {/* Placeholder mockup indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <ItemIcon type={itemConfig.type} />
            <span className="text-sm mt-2">{itemConfig.name} Mockup</span>
            <span className="text-xs text-gray-300 mt-1">(Awaiting mockup image)</span>
          </div>

          {/* Text overlay preview */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg px-6 py-4 text-center shadow-sm">
              {textLines.line1 && (
                <div className="text-lg font-semibold text-gray-900 leading-tight">
                  {textLines.line1}
                </div>
              )}
              {textLines.line2 && (
                <div className="text-lg font-semibold text-gray-900 leading-tight">
                  {textLines.line2}
                </div>
              )}
              {textLines.line3 && (
                <div className="text-lg font-semibold text-gray-900 leading-tight">
                  {textLines.line3}
                </div>
              )}
              {!textLines.line1 && !textLines.line2 && !textLines.line3 && (
                <div className="text-gray-400 italic">No text entered</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item info */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">{itemConfig.description}</p>
        <p className="text-xs text-gray-400 mt-1">
          PDF Size: {Math.round(itemConfig.pdfDimensions.width / 2.83)}mm ×{' '}
          {Math.round(itemConfig.pdfDimensions.height / 2.83)}mm
        </p>
      </div>

      {/* Preview note */}
      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-xs text-amber-700 text-center">
          <strong>Preview Mode:</strong> Final preview will show exact mockup image with
          pixel-perfect text positioning once mockup images are uploaded.
        </p>
      </div>
    </div>
  );
}

/**
 * Icon component for different item types
 */
function ItemIcon({ type }: { type: string }) {
  const iconClass = 'w-16 h-16 text-gray-300';

  switch (type) {
    case 'tshirt':
    case 'hoodie':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0"
          />
        </svg>
      );
    case 'flyer1':
    case 'flyer2':
    case 'flyer3':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'minicard':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    case 'cd-jacket':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={1} />
          <circle cx="12" cy="12" r="3" strokeWidth={1} />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1} />
        </svg>
      );
  }
}
