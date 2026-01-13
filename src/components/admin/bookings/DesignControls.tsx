'use client';

import { ChangeEvent, useCallback } from 'react';

interface DesignControlsProps {
  text: string;
  fontSize: number;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onResetToDefault: () => void;
  itemName: string;
  isBack?: boolean;
  hasQrCode?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  qrPosition?: { x: number; y: number };
  qrSize?: number;
  pdfScale?: number;
}

/**
 * DesignControls - Sidebar controls for the printable editor
 *
 * Provides:
 * - Text input (textarea for multiline)
 * - Font size slider/input
 * - Reset to default button
 * - Position display (in PDF points)
 */
export default function DesignControls({
  text,
  fontSize,
  onTextChange,
  onFontSizeChange,
  onResetToDefault,
  itemName,
  isBack = false,
  hasQrCode = false,
  position,
  size,
  qrPosition,
  qrSize,
  pdfScale,
}: DesignControlsProps) {
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onTextChange(e.target.value);
    },
    [onTextChange]
  );

  const handleFontSizeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value > 0 && value <= 100) {
        onFontSizeChange(value);
      }
    },
    [onFontSizeChange]
  );

  const handleSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      onFontSizeChange(value);
    },
    [onFontSizeChange]
  );

  // Convert CSS pixels to PDF points for display
  const toPdfPoints = (cssValue: number) => {
    if (!pdfScale) return '—';
    return Math.round(cssValue / pdfScale);
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-900 text-lg">{itemName}</h3>

      {isBack ? (
        // Back items - no text input, just QR info
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">Back Side</p>
                <p className="text-sm text-blue-700 mt-1">
                  This is the back of the flyer. Only the QR code position can be adjusted.
                </p>
              </div>
            </div>
          </div>

          {hasQrCode && qrPosition && qrSize && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                QR Code Position
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">X:</span> {toPdfPoints(qrPosition.x)} pt
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">Y:</span> {toPdfPoints(qrPosition.y)} pt
                </div>
                <div className="bg-gray-50 p-2 rounded col-span-2">
                  <span className="text-gray-400">Size:</span> {toPdfPoints(qrSize)} pt
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Drag the QR code to reposition. Resize from corners.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Front items - text input and controls
        <div className="space-y-4">
          {/* Text Input */}
          <div>
            <label
              htmlFor="school-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              School Name
            </label>
            <textarea
              id="school-name"
              value={text}
              onChange={handleTextChange}
              rows={3}
              placeholder="Enter school name (press Enter for new line)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F4A261] focus:border-transparent resize-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Press Enter to create a new line
            </p>
          </div>

          {/* Font Size */}
          <div>
            <label
              htmlFor="font-size"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Font Size
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                id="font-size-slider"
                min="8"
                max="72"
                value={fontSize}
                onChange={handleSliderChange}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#F4A261]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  id="font-size"
                  min="8"
                  max="100"
                  value={fontSize}
                  onChange={handleFontSizeChange}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#F4A261] focus:border-transparent"
                />
                <span className="text-sm text-gray-500">pt</span>
              </div>
            </div>
          </div>

          {/* Position Info */}
          {position && size && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Text Position
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">X:</span> {toPdfPoints(position.x)} pt
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">Y:</span> {toPdfPoints(position.y)} pt
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">W:</span> {toPdfPoints(size.width)} pt
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-400">H:</span> {toPdfPoints(size.height)} pt
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Drag the text block to reposition. Resize from corners.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={onResetToDefault}
        className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Reset to Default
      </button>

      {/* Help Text */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
        <p className="text-xs text-gray-500">
          <strong>Tip:</strong> Drag elements directly on the preview to position them.
          Use the corner handles to resize.
        </p>
      </div>
    </div>
  );
}
