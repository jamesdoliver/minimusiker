'use client';

import { useState, useCallback } from 'react';
import PdfCanvas from './PdfCanvas';
import LogoCanvas from './LogoCanvas';
import DraggableText from './DraggableText';
import DraggableQrCode from './DraggableQrCode';
import DesignControls from './DesignControls';
import LogoDesignControls from './LogoDesignControls';
import {
  PrintableTextConfig,
  PrintableEditorState,
  TextElement,
  TextElementType,
  createTextElement,
  getFontFamilyForType,
  TSHIRT_HOODIE_TEXT_DEFAULTS,
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
 * - DraggableText for each text element
 * - DraggableQrCode for positioning QR codes (on back items)
 * - DesignControls for adding/managing text elements
 *
 * All coordinates stored in CSS pixels during editing - converted to PDF at generation time.
 */
export default function PrintableEditor({
  itemConfig,
  schoolName: _schoolName, // Used for initialization, not directly in render
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Handle PDF canvas load - store scale factor for later PDF conversion
  const handleCanvasLoad = useCallback(
    (dims: { width: number; height: number; scale: number }) => {
      setCanvasDimensions(dims);
      setTemplateExists(true);
      // Store scale in editor state for PDF generation
      if (editorState.canvasScale !== dims.scale) {
        onEditorStateChange({
          ...editorState,
          canvasScale: dims.scale,
        });
      }
    },
    [editorState, onEditorStateChange]
  );

  // Handle PDF canvas error (template doesn't exist)
  const handleCanvasError = useCallback(() => {
    setTemplateExists(false);
  }, []);

  // Handle adding a new text element
  const handleAddTextElement = useCallback(
    (elementType: TextElementType) => {
      if (!canvasDimensions) return;

      const newElement = createTextElement(
        itemConfig.type,
        elementType,
        canvasDimensions.width,
        canvasDimensions.height,
        canvasDimensions.scale
      );

      onEditorStateChange({
        ...editorState,
        textElements: [...editorState.textElements, newElement],
      });

      // Select the new element
      setSelectedElementId(newElement.id);
    },
    [canvasDimensions, editorState, itemConfig.type, onEditorStateChange]
  );

  // Handle deleting a text element
  const handleDeleteTextElement = useCallback(
    (elementId: string) => {
      onEditorStateChange({
        ...editorState,
        textElements: editorState.textElements.filter((el) => el.id !== elementId),
      });
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
      }
    },
    [editorState, onEditorStateChange, selectedElementId]
  );

  // Handle updating a text element (position, size, text, fontSize, color)
  const handleUpdateTextElement = useCallback(
    (elementId: string, updates: Partial<TextElement>) => {
      onEditorStateChange({
        ...editorState,
        textElements: editorState.textElements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el
        ),
      });
    },
    [editorState, onEditorStateChange]
  );

  // Handle text position change - CSS values stored directly
  const handleTextPositionChange = useCallback(
    (elementId: string, position: { x: number; y: number }) => {
      handleUpdateTextElement(elementId, { position });
    },
    [handleUpdateTextElement]
  );

  // Handle text size change - CSS values stored directly
  const handleTextSizeChange = useCallback(
    (elementId: string, size: { width: number; height: number }) => {
      handleUpdateTextElement(elementId, { size });
    },
    [handleUpdateTextElement]
  );

  // Handle QR position change - CSS values stored directly
  const handleQrPositionChange = useCallback(
    (position: { x: number; y: number }) => {
      if (!editorState.qrPosition) return;
      onEditorStateChange({
        ...editorState,
        qrPosition: {
          ...editorState.qrPosition,
          x: position.x,
          y: position.y,
        },
      });
    },
    [editorState, onEditorStateChange]
  );

  // Handle QR size change - CSS values stored directly
  const handleQrSizeChange = useCallback(
    (size: number) => {
      if (!editorState.qrPosition) return;
      onEditorStateChange({
        ...editorState,
        qrPosition: {
          ...editorState.qrPosition,
          size,
        },
      });
    },
    [editorState, onEditorStateChange]
  );

  // Handle reset to default (clear all text elements for generic, reset position for logo)
  const handleResetToDefault = useCallback(() => {
    onEditorStateChange({
      ...editorState,
      textElements: [],
    });
    setSelectedElementId(null);
  }, [editorState, onEditorStateChange]);

  // Handle reset position for logo type (snap back to default position)
  const handleResetLogoPosition = useCallback(() => {
    if (!canvasDimensions || editorState.textElements.length === 0) return;
    const scale = canvasDimensions.scale;
    const element = editorState.textElements[0];
    onEditorStateChange({
      ...editorState,
      textElements: [{
        ...element,
        position: {
          x: TSHIRT_HOODIE_TEXT_DEFAULTS.position.x * scale,
          y: TSHIRT_HOODIE_TEXT_DEFAULTS.position.y * scale,
        },
        size: {
          width: TSHIRT_HOODIE_TEXT_DEFAULTS.size.width * scale,
          height: TSHIRT_HOODIE_TEXT_DEFAULTS.size.height * scale,
        },
        fontSize: TSHIRT_HOODIE_TEXT_DEFAULTS.fontSize * scale,
      }],
    });
  }, [canvasDimensions, editorState, onEditorStateChange]);

  const qrUrl = accessCode ? `minimusiker.app/e/${accessCode}` : undefined;
  const fontFamily = getFontFamilyForType(itemConfig.type);
  const isLogoType = itemConfig.type === 'tshirt' || itemConfig.type === 'hoodie';

  return (
    <div className="flex gap-6 h-full min-h-0">
      {/* Font face styles - loaded from API */}
      <style jsx global>{`
        @font-face {
          font-family: 'Fredoka';
          src: url('/api/admin/fonts/fredoka') format('truetype');
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Springwood Display';
          src: url('/api/admin/fonts/springwood-display') format('opentype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      {/* Left panel - Controls */}
      <div className="w-80 flex-shrink-0 overflow-y-auto p-4 border-r border-gray-200">
        {isLogoType ? (
          <LogoDesignControls
            itemName={itemConfig.name}
            textElement={editorState.textElements[0] || null}
            onUpdateTextElement={handleUpdateTextElement}
            onResetPosition={handleResetLogoPosition}
            canvasScale={canvasDimensions?.scale}
          />
        ) : (
          <DesignControls
            itemName={itemConfig.name}
            isBack={itemConfig.isBack}
            templateType={itemConfig.type}
            textElements={editorState.textElements}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onAddTextElement={handleAddTextElement}
            onDeleteTextElement={handleDeleteTextElement}
            onUpdateTextElement={handleUpdateTextElement}
            onResetToDefault={handleResetToDefault}
            hasQrCode={!!editorState.qrPosition}
            qrPosition={editorState.qrPosition}
            qrSize={editorState.qrPosition?.size}
            canvasScale={canvasDimensions?.scale}
          />
        )}
      </div>

      {/* Right panel - Canvas with overlays */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-start justify-center">
        <div className="relative w-full max-w-2xl">
          {/* Canvas background - Logo or PDF */}
          {isLogoType ? (
            <LogoCanvas
              onLoad={handleCanvasLoad}
              onError={handleCanvasError}
            />
          ) : (
            <PdfCanvas
              templateType={itemConfig.type}
              onLoad={handleCanvasLoad}
              onError={handleCanvasError}
            />
          )}

          {/* Overlay container - positioned over the canvas */}
          {canvasDimensions && templateExists && (
            <div
              className="absolute top-0 left-0"
              style={{
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              }}
            >
              {/* Render all text elements */}
              {editorState.textElements.map((element) => (
                <DraggableText
                  key={element.id}
                  text={element.text}
                  fontSize={element.fontSize}
                  position={element.position}
                  size={element.size}
                  color={element.color}
                  fontFamily={fontFamily}
                  isSelected={isLogoType || element.id === selectedElementId}
                  elementType={isLogoType ? undefined : element.type}
                  onPositionChange={(pos) => handleTextPositionChange(element.id, pos)}
                  onSizeChange={(size) => handleTextSizeChange(element.id, size)}
                  onSelect={isLogoType ? undefined : () => setSelectedElementId(element.id)}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                />
              ))}

              {/* QR Code overlay - for back items */}
              {editorState.qrPosition && (
                <DraggableQrCode
                  position={{ x: editorState.qrPosition.x, y: editorState.qrPosition.y }}
                  size={editorState.qrPosition.size}
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
