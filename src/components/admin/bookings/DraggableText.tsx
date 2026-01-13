'use client';

import { Rnd } from 'react-rnd';
import { useCallback } from 'react';
import { TextElementType } from '@/lib/config/printableTextConfig';

interface DraggableTextProps {
  text: string;
  fontSize: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  canvasWidth: number;
  canvasHeight: number;
  color?: string;
  fontFamily?: string;
  isSelected?: boolean;
  elementType?: TextElementType;
  onSelect?: () => void;
  disabled?: boolean;
}

// Labels for element types
const TYPE_LABELS: Record<TextElementType, string> = {
  headline: 'H',
  subline: 'S',
  calendar: 'C',
  custom: '✎',
};

const TYPE_COLORS: Record<TextElementType, string> = {
  headline: 'bg-blue-500',
  subline: 'bg-green-500',
  calendar: 'bg-orange-500',
  custom: 'bg-purple-500',
};

/**
 * DraggableText - A draggable and resizable text block
 *
 * Uses react-rnd for drag and resize functionality.
 * Displays multi-line text with the specified font size.
 * All position and size values are CSS pixels - no conversion needed.
 */
export default function DraggableText({
  text,
  fontSize,
  position,
  size,
  onPositionChange,
  onSizeChange,
  canvasWidth,
  canvasHeight,
  color = '#000000',
  fontFamily = 'inherit',
  isSelected = false,
  elementType,
  onSelect,
  disabled = false,
}: DraggableTextProps) {
  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      // Store CSS values directly - no conversion
      onPositionChange({ x: d.x, y: d.y });
    },
    [onPositionChange]
  );

  const handleResizeStop = useCallback(
    (
      _e: unknown,
      _direction: unknown,
      ref: HTMLElement,
      _delta: unknown,
      newPosition: { x: number; y: number }
    ) => {
      // Store CSS values directly - no conversion
      onSizeChange({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
      onPositionChange(newPosition);
    },
    [onSizeChange, onPositionChange]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.();
    },
    [onSelect]
  );

  // Split text into lines for display
  const lines = text.split('\n').filter((line) => line.trim() !== '');

  const borderColor = isSelected ? 'border-blue-600' : 'border-blue-400';
  const borderWidth = isSelected ? 'border-2' : 'border';

  return (
    <Rnd
      position={{ x: position.x, y: position.y }}
      size={{ width: size.width, height: size.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      minWidth={50}
      minHeight={20}
      maxWidth={canvasWidth}
      maxHeight={canvasHeight}
      disableDragging={disabled}
      enableResizing={!disabled}
      className={`${disabled ? '' : 'cursor-move'}`}
      style={{
        zIndex: isSelected ? 20 : 10,
      }}
      resizeHandleStyles={{
        bottomRight: {
          width: '12px',
          height: '12px',
          bottom: '-6px',
          right: '-6px',
          cursor: 'se-resize',
        },
        bottomLeft: {
          width: '12px',
          height: '12px',
          bottom: '-6px',
          left: '-6px',
          cursor: 'sw-resize',
        },
        topRight: {
          width: '12px',
          height: '12px',
          top: '-6px',
          right: '-6px',
          cursor: 'ne-resize',
        },
        topLeft: {
          width: '12px',
          height: '12px',
          top: '-6px',
          left: '-6px',
          cursor: 'nw-resize',
        },
      }}
    >
      <div
        onClick={handleClick}
        className={`w-full h-full flex flex-col items-center justify-center text-center overflow-hidden rounded ${
          disabled
            ? 'bg-gray-100/50'
            : `bg-white/30 ${borderWidth} border-dashed ${borderColor} hover:border-blue-600`
        }`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.2,
          color: color,
          fontFamily: fontFamily,
        }}
      >
        {/* Element type badge */}
        {elementType && !disabled && (
          <div
            className={`absolute -top-2 -left-2 w-5 h-5 ${TYPE_COLORS[elementType]} text-white text-xs font-bold rounded-full flex items-center justify-center shadow`}
            title={elementType}
          >
            {TYPE_LABELS[elementType]}
          </div>
        )}

        {lines.length > 0 ? (
          lines.map((line, index) => (
            <div key={index} className="whitespace-nowrap">
              {line}
            </div>
          ))
        ) : (
          <div className="text-gray-400 italic" style={{ fontSize: '14px', fontFamily: 'inherit' }}>
            Enter text...
          </div>
        )}
      </div>

      {/* Resize handles visual indicators */}
      {!disabled && (
        <>
          <div className={`absolute -bottom-1.5 -right-1.5 w-3 h-3 ${isSelected ? 'bg-blue-600' : 'bg-blue-500'} rounded-full border-2 border-white shadow`} />
          <div className={`absolute -bottom-1.5 -left-1.5 w-3 h-3 ${isSelected ? 'bg-blue-600' : 'bg-blue-500'} rounded-full border-2 border-white shadow`} />
          <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 ${isSelected ? 'bg-blue-600' : 'bg-blue-500'} rounded-full border-2 border-white shadow`} />
          <div className={`absolute -top-1.5 -left-1.5 w-3 h-3 ${isSelected ? 'bg-blue-600' : 'bg-blue-500'} rounded-full border-2 border-white shadow`} />
        </>
      )}
    </Rnd>
  );
}
