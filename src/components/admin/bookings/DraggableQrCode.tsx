'use client';

import { Rnd } from 'react-rnd';
import { useCallback } from 'react';

interface DraggableQrCodeProps {
  position: { x: number; y: number };
  size: number;
  onPositionChange: (position: { x: number; y: number }) => void;
  onSizeChange: (size: number) => void;
  onResize?: (position: { x: number; y: number }, size: number) => void;
  canvasWidth: number;
  canvasHeight: number;
  qrUrl?: string;
  disabled?: boolean;
}

/**
 * DraggableQrCode - A draggable and resizable QR code placeholder
 *
 * Uses react-rnd for drag and resize functionality.
 * Maintains square aspect ratio during resize.
 * Shows a placeholder QR code pattern.
 */
export default function DraggableQrCode({
  position,
  size,
  onPositionChange,
  onSizeChange,
  onResize,
  canvasWidth,
  canvasHeight,
  qrUrl,
  disabled = false,
}: DraggableQrCodeProps) {
  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
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
      // Keep square aspect ratio - use the smaller dimension
      const newSize = Math.min(ref.offsetWidth, ref.offsetHeight);
      // Use combined callback to avoid stale closure race condition
      if (onResize) {
        onResize(newPosition, newSize);
      } else {
        onSizeChange(newSize);
        onPositionChange(newPosition);
      }
    },
    [onSizeChange, onPositionChange, onResize]
  );

  return (
    <Rnd
      position={{ x: position.x, y: position.y }}
      size={{ width: size, height: size }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      minWidth={40}
      minHeight={40}
      maxWidth={Math.min(canvasWidth, canvasHeight)}
      maxHeight={Math.min(canvasWidth, canvasHeight)}
      lockAspectRatio={true}
      disableDragging={disabled}
      enableResizing={!disabled}
      className={`${disabled ? '' : 'cursor-move'}`}
      style={{
        zIndex: 11,
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
        className={`w-full h-full flex items-center justify-center rounded ${
          disabled
            ? 'bg-gray-200/80'
            : 'bg-white border-2 border-dashed border-green-400 hover:border-green-600'
        }`}
      >
        {/* QR Code placeholder pattern */}
        <div className="relative w-full h-full p-2">
          <QrPlaceholder />
          {qrUrl && (
            <div className="absolute -bottom-6 left-0 right-0 text-center bg-white/90 py-0.5 text-[8px] text-gray-500 truncate px-1">
              {qrUrl}
            </div>
          )}
        </div>
      </div>

      {/* Resize handles visual indicators */}
      {!disabled && (
        <>
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
        </>
      )}
    </Rnd>
  );
}

/**
 * QR Code placeholder pattern
 */
function QrPlaceholder() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top-left position pattern */}
      <rect x="5" y="5" width="25" height="25" rx="2" stroke="#333" strokeWidth="3" />
      <rect x="10" y="10" width="15" height="15" fill="#333" />

      {/* Top-right position pattern */}
      <rect x="70" y="5" width="25" height="25" rx="2" stroke="#333" strokeWidth="3" />
      <rect x="75" y="10" width="15" height="15" fill="#333" />

      {/* Bottom-left position pattern */}
      <rect x="5" y="70" width="25" height="25" rx="2" stroke="#333" strokeWidth="3" />
      <rect x="10" y="75" width="15" height="15" fill="#333" />

      {/* Data cells pattern (simplified) */}
      <rect x="35" y="5" width="8" height="8" fill="#333" />
      <rect x="47" y="5" width="8" height="8" fill="#333" />
      <rect x="59" y="5" width="8" height="8" fill="#333" />

      <rect x="35" y="17" width="8" height="8" fill="#333" />
      <rect x="47" y="17" width="8" height="8" fill="#333" />

      <rect x="5" y="35" width="8" height="8" fill="#333" />
      <rect x="17" y="35" width="8" height="8" fill="#333" />

      <rect x="5" y="47" width="8" height="8" fill="#333" />
      <rect x="17" y="47" width="8" height="8" fill="#333" />

      <rect x="5" y="59" width="8" height="8" fill="#333" />
      <rect x="17" y="59" width="8" height="8" fill="#333" />

      {/* Center pattern */}
      <rect x="38" y="38" width="24" height="24" rx="2" stroke="#333" strokeWidth="2" />
      <rect x="44" y="44" width="12" height="12" fill="#333" />

      {/* Bottom-right area */}
      <rect x="70" y="35" width="8" height="8" fill="#333" />
      <rect x="82" y="35" width="8" height="8" fill="#333" />

      <rect x="70" y="47" width="8" height="8" fill="#333" />
      <rect x="82" y="59" width="8" height="8" fill="#333" />

      <rect x="35" y="70" width="8" height="8" fill="#333" />
      <rect x="47" y="70" width="8" height="8" fill="#333" />
      <rect x="59" y="70" width="8" height="8" fill="#333" />

      <rect x="35" y="82" width="8" height="8" fill="#333" />
      <rect x="59" y="82" width="8" height="8" fill="#333" />

      <rect x="70" y="70" width="8" height="8" fill="#333" />
      <rect x="82" y="82" width="8" height="8" fill="#333" />
    </svg>
  );
}
