'use client';

import { ChangeEvent, useCallback } from 'react';
import {
  TextElement,
  TextElementType,
  PrintableItemType,
  TEXT_ELEMENT_STYLES,
} from '@/lib/config/printableTextConfig';

interface DesignControlsProps {
  itemName: string;
  isBack?: boolean;
  templateType: PrintableItemType;
  textElements: TextElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddTextElement: (type: TextElementType) => void;
  onDeleteTextElement: (id: string) => void;
  onUpdateTextElement: (id: string, updates: Partial<TextElement>) => void;
  onResetToDefault: () => void;
  hasQrCode?: boolean;
  qrPosition?: { x: number; y: number };
  qrSize?: number;
  canvasScale?: number;
}

// Display names for element types
const TYPE_LABELS: Record<TextElementType, string> = {
  headline: 'Headline',
  subline: 'Subline',
  calendar: 'Calendar',
  custom: 'Custom',
};

const TYPE_COLORS: Record<TextElementType, string> = {
  headline: 'bg-blue-500',
  subline: 'bg-green-500',
  calendar: 'bg-orange-500',
  custom: 'bg-purple-500',
};

/**
 * DesignControls - Sidebar controls for the printable editor
 *
 * Provides:
 * - Add text element buttons (headline, subline, calendar, custom)
 * - List of text elements with selection
 * - Controls for selected element (text, font size, color)
 * - Delete and reset functionality
 */
export default function DesignControls({
  itemName,
  isBack = false,
  templateType,
  textElements,
  selectedElementId,
  onSelectElement,
  onAddTextElement,
  onDeleteTextElement,
  onUpdateTextElement,
  onResetToDefault,
  hasQrCode = false,
  qrPosition,
  qrSize,
  canvasScale,
}: DesignControlsProps) {
  // Get the selected element
  const selectedElement = textElements.find((el) => el.id === selectedElementId);

  // Convert CSS pixels to PDF points for display
  const toPdfPoints = (cssValue: number) => {
    if (!canvasScale) return '—';
    return Math.round(cssValue / canvasScale);
  };

  // Handle text change for selected element
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (selectedElementId) {
        onUpdateTextElement(selectedElementId, { text: e.target.value });
      }
    },
    [selectedElementId, onUpdateTextElement]
  );

  // Handle font size change for selected element
  const handleFontSizeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!selectedElementId) return;
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value > 0) {
        onUpdateTextElement(selectedElementId, { fontSize: value });
      }
    },
    [selectedElementId, onUpdateTextElement]
  );

  // Handle slider change for selected element
  const handleSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!selectedElementId) return;
      const value = parseFloat(e.target.value);
      onUpdateTextElement(selectedElementId, { fontSize: value });
    },
    [selectedElementId, onUpdateTextElement]
  );

  // Handle color change for selected element
  const handleColorChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (selectedElementId) {
        onUpdateTextElement(selectedElementId, { color: e.target.value });
      }
    },
    [selectedElementId, onUpdateTextElement]
  );

  // Get style defaults for this template type
  const styleDefaults = TEXT_ELEMENT_STYLES[templateType];

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
        // Front items - multi-element controls
        <div className="space-y-4">
          {/* Add Text Element Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Text Element
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['headline', 'subline', 'calendar', 'custom'] as TextElementType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => onAddTextElement(type)}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2"
                  >
                    <span
                      className={`w-3 h-3 rounded-full ${TYPE_COLORS[type]}`}
                    />
                    {TYPE_LABELS[type]}
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Click to add a new text element with default styling
            </p>
          </div>

          {/* Text Elements List */}
          {textElements.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Elements ({textElements.length})
              </label>
              <div className="space-y-2">
                {textElements.map((element) => (
                  <div
                    key={element.id}
                    onClick={() => onSelectElement(element.id)}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      element.id === selectedElementId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full ${TYPE_COLORS[element.type]}`}
                        />
                        <span className="text-sm font-medium">
                          {TYPE_LABELS[element.type]}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTextElement(element.id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete element"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {element.text || '(empty)'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Element Controls */}
          {selectedElement && (
            <div className="space-y-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${TYPE_COLORS[selectedElement.type]}`}
                />
                <span className="text-sm font-medium text-gray-900">
                  Edit {TYPE_LABELS[selectedElement.type]}
                </span>
              </div>

              {/* Text Input */}
              <div>
                <label
                  htmlFor="element-text"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Text Content
                </label>
                <textarea
                  id="element-text"
                  value={selectedElement.text}
                  onChange={handleTextChange}
                  rows={2}
                  placeholder="Enter text..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F4A261] focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Font Size */}
              <div>
                <label
                  htmlFor="element-font-size"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Font Size
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    id="element-font-size-slider"
                    min="8"
                    max="100"
                    step="1"
                    value={selectedElement.fontSize}
                    onChange={handleSliderChange}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#F4A261]"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      id="element-font-size"
                      min="8"
                      max="200"
                      step="1"
                      value={Math.round(selectedElement.fontSize)}
                      onChange={handleFontSizeChange}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#F4A261] focus:border-transparent"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label
                  htmlFor="element-color"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Text Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="element-color"
                    value={selectedElement.color}
                    onChange={handleColorChange}
                    className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedElement.color}
                    onChange={handleColorChange}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F4A261] focus:border-transparent"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Position Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-gray-400">X:</span>{' '}
                  {Math.round(selectedElement.position.x)} px
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-gray-400">Y:</span>{' '}
                  {Math.round(selectedElement.position.y)} px
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-gray-400">W:</span>{' '}
                  {Math.round(selectedElement.size.width)} px
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <span className="text-gray-400">H:</span>{' '}
                  {Math.round(selectedElement.size.height)} px
                </div>
              </div>
            </div>
          )}

          {/* No elements message */}
          {textElements.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
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
                <div>
                  <p className="text-sm font-medium text-yellow-800">No Text Elements</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Add text elements using the buttons above. Each element can be
                    positioned and styled independently.
                  </p>
                </div>
              </div>
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
        Clear All
      </button>

      {/* Help Text */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
        <p className="text-xs text-gray-500">
          <strong>Tip:</strong> Click on an element in the list or on the preview to select
          it. Drag elements to position them, resize from corners.
        </p>
      </div>
    </div>
  );
}
