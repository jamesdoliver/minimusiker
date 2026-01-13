'use client';

import { useState, useCallback, useEffect } from 'react';
import PdfCanvas, { pdfToCssCoords, cssToPdfCoords } from './PdfCanvas';
import DraggableText from './DraggableText';
import DraggableQrCode from './DraggableQrCode';
import DesignControls from './DesignControls';
import {
  PrintableTextConfig,
  PrintableEditorState,
  initializeEditorState,
} from '@/lib/config/printableTextConfig';

interface PrintableEditorProps {
  itemConfig: PrintableTextConfig;
  schoolName: string;
  accessCode?: string | number;
  editorState: PrintableEditorState;
  onEditorStateChange: (state: PrintableEditorState) => void;
}

/**
 * PrintableEditor - Interactive editor for positioning text and QR codes on templates
 *
 * Combines:
 * - PdfCanvas for rendering the template background
 * - DraggableText for positioning the school name
 * - DraggableQrCode for positioning QR codes (on back items)
 * - DesignControls for text input, font size, and reset
 */
export default function PrintableEditor({
  itemConfig,
  schoolName,
  accessCode,
  editorState,
  onEditorStateChange,
}: PrintableEditorProps) {
  const [canvasDimensions, setCanvasDimensions] = useState<{
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  const [templateExists, setTemplateExists] = useState(true);

  // Handle PDF canvas load
  const handleCanvasLoad = useCallback(
    (dims: { width: number; height: number; scale: number }) => {
      setCanvasDimensions(dims);
      setTemplateExists(true);
    },
    []
  );

  // Handle PDF canvas error (template doesn't exist)
  const handleCanvasError = useCallback(() => {
    setTemplateExists(false);
  }, []);

  // Get CSS coordinates from PDF coordinates
  const getCssPosition = useCallback(
    (pdfX: number, pdfY: number) => {
      if (!canvasDimensions) return { x: 0, y: 0 };
      return pdfToCssCoords(
        pdfX,
        pdfY + editorState.textPosition.height, // Adjust for text box height
        itemConfig.pdfDimensions.height,
        canvasDimensions.scale
      );
    },
    [canvasDimensions, itemConfig.pdfDimensions.height, editorState.textPosition.height]
  );

  // Get CSS size from PDF size
  const getCssSize = useCallback(
    (pdfWidth: number, pdfHeight: number) => {
      if (!canvasDimensions) return { width: 100, height: 50 };
      return {
        width: pdfWidth * canvasDimensions.scale,
        height: pdfHeight * canvasDimensions.scale,
      };
    },
    [canvasDimensions]
  );

  // Get QR CSS position from PDF coordinates
  const getQrCssPosition = useCallback(
    (pdfX: number, pdfY: number, qrSize: number) => {
      if (!canvasDimensions) return { x: 0, y: 0 };
      return pdfToCssCoords(
        pdfX,
        pdfY + qrSize, // Adjust for QR height
        itemConfig.pdfDimensions.height,
        canvasDimensions.scale
      );
    },
    [canvasDimensions, itemConfig.pdfDimensions.height]
  );

  // Handle text position change (CSS -> PDF conversion)
  const handleTextPositionChange = useCallback(
    (cssPosition: { x: number; y: number }) => {
      if (!canvasDimensions) return;
      const pdfCoords = cssToPdfCoords(
        cssPosition.x,
        cssPosition.y + editorState.textPosition.height * canvasDimensions.scale,
        itemConfig.pdfDimensions.height,
        canvasDimensions.scale
      );
      onEditorStateChange({
        ...editorState,
        textPosition: {
          ...editorState.textPosition,
          x: pdfCoords.x,
          y: pdfCoords.y,
        },
      });
    },
    [canvasDimensions, editorState, itemConfig.pdfDimensions.height, onEditorStateChange]
  );

  // Handle text size change
  const handleTextSizeChange = useCallback(
    (cssSize: { width: number; height: number }) => {
      if (!canvasDimensions) return;
      onEditorStateChange({
        ...editorState,
        textPosition: {
          ...editorState.textPosition,
          width: cssSize.width / canvasDimensions.scale,
          height: cssSize.height / canvasDimensions.scale,
        },
      });
    },
    [canvasDimensions, editorState, onEditorStateChange]
  );

  // Handle QR position change
  const handleQrPositionChange = useCallback(
    (cssPosition: { x: number; y: number }) => {
      if (!canvasDimensions || !editorState.qrPosition) return;
      const pdfCoords = cssToPdfCoords(
        cssPosition.x,
        cssPosition.y + editorState.qrPosition.size * canvasDimensions.scale,
        itemConfig.pdfDimensions.height,
        canvasDimensions.scale
      );
      onEditorStateChange({
        ...editorState,
        qrPosition: {
          ...editorState.qrPosition,
          x: pdfCoords.x,
          y: pdfCoords.y,
        },
      });
    },
    [canvasDimensions, editorState, itemConfig.pdfDimensions.height, onEditorStateChange]
  );

  // Handle QR size change
  const handleQrSizeChange = useCallback(
    (cssSize: number) => {
      if (!canvasDimensions || !editorState.qrPosition) return;
      onEditorStateChange({
        ...editorState,
        qrPosition: {
          ...editorState.qrPosition,
          size: cssSize / canvasDimensions.scale,
        },
      });
    },
    [canvasDimensions, editorState, onEditorStateChange]
  );

  // Handle text change
  const handleTextChange = useCallback(
    (text: string) => {
      onEditorStateChange({
        ...editorState,
        text,
      });
    },
    [editorState, onEditorStateChange]
  );

  // Handle font size change
  const handleFontSizeChange = useCallback(
    (fontSize: number) => {
      onEditorStateChange({
        ...editorState,
        fontSize,
      });
    },
    [editorState, onEditorStateChange]
  );

  // Handle reset to default
  const handleResetToDefault = useCallback(() => {
    const defaultState = initializeEditorState(itemConfig.type, schoolName);
    onEditorStateChange(defaultState);
  }, [itemConfig.type, schoolName, onEditorStateChange]);

  // Calculate CSS positions for overlay elements
  const textCssPosition = canvasDimensions
    ? getCssPosition(editorState.textPosition.x, editorState.textPosition.y)
    : { x: 0, y: 0 };

  const textCssSize = canvasDimensions
    ? getCssSize(editorState.textPosition.width, editorState.textPosition.height)
    : { width: 100, height: 50 };

  const qrCssPosition =
    canvasDimensions && editorState.qrPosition
      ? getQrCssPosition(
          editorState.qrPosition.x,
          editorState.qrPosition.y,
          editorState.qrPosition.size
        )
      : { x: 0, y: 0 };

  const qrCssSize =
    canvasDimensions && editorState.qrPosition
      ? editorState.qrPosition.size * canvasDimensions.scale
      : 100;

  // Calculate font size in CSS pixels
  const cssFontSize = canvasDimensions
    ? editorState.fontSize * canvasDimensions.scale
    : editorState.fontSize;

  const qrUrl = accessCode ? `minimusiker.app/e/${accessCode}` : undefined;

  return (
    <div className="flex gap-6 h-full">
      {/* Left panel - Controls */}
      <div className="w-1/3 min-w-[250px] max-w-[350px] p-4 border-r border-gray-200 overflow-y-auto">
        <DesignControls
          text={editorState.text}
          fontSize={editorState.fontSize}
          onTextChange={handleTextChange}
          onFontSizeChange={handleFontSizeChange}
          onResetToDefault={handleResetToDefault}
          itemName={itemConfig.name}
          isBack={itemConfig.isBack}
          hasQrCode={!!editorState.qrPosition}
          position={textCssPosition}
          size={textCssSize}
          qrPosition={qrCssPosition}
          qrSize={qrCssSize}
          pdfScale={canvasDimensions?.scale}
        />
      </div>

      {/* Right panel - Canvas with overlays */}
      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto flex items-center justify-center">
        <div className="relative w-full max-w-2xl">
          {/* PDF Canvas background */}
          <PdfCanvas
            templateType={itemConfig.type}
            onLoad={handleCanvasLoad}
            onError={handleCanvasError}
          />

          {/* Overlay container - positioned over the canvas */}
          {canvasDimensions && templateExists && (
            <div
              className="absolute top-0 left-0"
              style={{
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              }}
            >
              {/* Text overlay - only for front items */}
              {!itemConfig.isBack && (
                <DraggableText
                  text={editorState.text}
                  fontSize={cssFontSize}
                  position={textCssPosition}
                  size={textCssSize}
                  onPositionChange={handleTextPositionChange}
                  onSizeChange={handleTextSizeChange}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                  color={itemConfig.textDefaults?.color
                    ? `rgb(${Math.round(itemConfig.textDefaults.color.r * 255)}, ${Math.round(itemConfig.textDefaults.color.g * 255)}, ${Math.round(itemConfig.textDefaults.color.b * 255)})`
                    : '#000000'
                  }
                />
              )}

              {/* QR Code overlay - for back items */}
              {editorState.qrPosition && (
                <DraggableQrCode
                  position={qrCssPosition}
                  size={qrCssSize}
                  onPositionChange={handleQrPositionChange}
                  onSizeChange={handleQrSizeChange}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                  qrUrl={qrUrl}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
