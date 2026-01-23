'use client';

import { ChangeEvent, useCallback } from 'react';
import { TextElement, TSHIRT_HOODIE_TEXT_DEFAULTS } from '@/lib/config/printableTextConfig';

interface LogoDesignControlsProps {
  itemName: string;
  textElement: TextElement | null;
  onUpdateTextElement: (id: string, updates: Partial<TextElement>) => void;
  onResetPosition: () => void;
  canvasScale?: number;
}

/**
 * LogoDesignControls - Simplified controls for t-shirt/hoodie logo editing
 *
 * Provides:
 * - School name textarea (pre-filled, multiline)
 * - Font size slider (40-140 range, scaled by canvas)
 * - Reset position button
 *
 * Unlike DesignControls, this component:
 * - Has no "add element" buttons (single text element only)
 * - Has no color picker (fixed teal)
 * - Has no element list (single element)
 */
export default function LogoDesignControls({
  itemName,
  textElement,
  onUpdateTextElement,
  onResetPosition,
  canvasScale,
}: LogoDesignControlsProps) {
  // Calculate scale factor for slider range (before handlers so they can use these values)
  const scaledMin = canvasScale ? 40 * canvasScale : 40;
  const scaledMax = canvasScale ? 140 * canvasScale : 140;

  // Handle text change
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (textElement) {
        onUpdateTextElement(textElement.id, { text: e.target.value });
      }
    },
    [textElement, onUpdateTextElement]
  );

  // Handle font size slider change
  const handleFontSizeSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!textElement) return;
      const value = parseFloat(e.target.value);
      onUpdateTextElement(textElement.id, { fontSize: value });
    },
    [textElement, onUpdateTextElement]
  );

  // Handle font size input change
  const handleFontSizeInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!textElement) return;
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= scaledMin && value <= scaledMax) {
        onUpdateTextElement(textElement.id, { fontSize: value });
      }
    },
    [textElement, onUpdateTextElement, scaledMin, scaledMax]
  );

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-900 text-lg">{itemName}</h3>

      {/* Info box */}
      <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0"
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
            <p className="text-sm font-medium text-teal-800">Logo Editor</p>
            <p className="text-sm text-teal-700 mt-1">
              Position the school name text on the logo. Drag to move, adjust font size below.
            </p>
          </div>
        </div>
      </div>

      {textElement ? (
        <div className="space-y-4">
          {/* School Name Text Input */}
          <div>
            <label
              htmlFor="school-name-text"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              School Name
            </label>
            <textarea
              id="school-name-text"
              value={textElement.text}
              onChange={handleTextChange}
              rows={3}
              placeholder="Enter school name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Press Enter to add line breaks for long names
            </p>
          </div>

          {/* Font Size Slider */}
          <div>
            <label
              htmlFor="font-size-slider"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Font Size
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                id="font-size-slider"
                min={scaledMin}
                max={scaledMax}
                step="1"
                value={textElement.fontSize}
                onChange={handleFontSizeSliderChange}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  id="font-size-input"
                  min={scaledMin}
                  max={scaledMax}
                  step="1"
                  value={Math.round(textElement.fontSize)}
                  onChange={handleFontSizeInputChange}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <span className="text-xs text-gray-500">px</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          {/* Text Color Info (fixed, not editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Color
            </label>
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: TSHIRT_HOODIE_TEXT_DEFAULTS.color }}
              />
              <div>
                <span className="text-sm font-mono text-gray-700">
                  {TSHIRT_HOODIE_TEXT_DEFAULTS.color}
                </span>
                <p className="text-xs text-gray-400">Teal (fixed for brand consistency)</p>
              </div>
            </div>
          </div>

          {/* Position Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="bg-gray-50 p-2 rounded border border-gray-200">
                <span className="text-gray-400">X:</span>{' '}
                {Math.round(textElement.position.x)} px
              </div>
              <div className="bg-gray-50 p-2 rounded border border-gray-200">
                <span className="text-gray-400">Y:</span>{' '}
                {Math.round(textElement.position.y)} px
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Drag the text on the preview to reposition
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700">
            No text element found. This shouldn&apos;t happen - please reload the page.
          </p>
        </div>
      )}

      {/* Reset Position Button */}
      <button
        onClick={onResetPosition}
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
        Reset Position
      </button>

      {/* Help Text */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
        <p className="text-xs text-gray-500">
          <strong>Tip:</strong> The text should be positioned above the character&apos;s
          headphones. For long school names, add a line break to wrap to two lines.
        </p>
      </div>
    </div>
  );
}
