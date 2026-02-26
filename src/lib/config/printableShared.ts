/**
 * Shared types and utilities for the printables system.
 * Single source of truth for type mappings, status types, and constants
 * used across UI components, API routes, and services.
 */

import type { PrintableItemType, TextElement } from './printableTextConfig';
import { getPrintableConfig, cssToPdfPosition, cssToPdfSize, hexToRgb } from './printableTextConfig';
import type { PrintableType } from '../services/r2Service';

/**
 * Status of a printable item in the confirmation workflow.
 * - pending: not yet processed
 * - confirmed: PDF has been generated
 * - skipped: admin chose to skip this item
 */
export type ItemStatus = 'pending' | 'confirmed' | 'skipped';

/**
 * All printable item types in wizard order.
 * Used by getPrintablesStatus and anywhere that needs the full list.
 */
export const PRINTABLE_ITEM_TYPES: PrintableItemType[] = [
  'tshirt', 'hoodie',
  'flyer1', 'flyer1-back',
  'flyer2', 'flyer2-back',
  'flyer3', 'flyer3-back',
  'button', 'minicard', 'cd-jacket',
];

/**
 * Map UI PrintableItemType to R2 PrintableType.
 * tshirt -> tshirt-print, hoodie -> hoodie-print, others pass through.
 */
const ITEM_TO_R2: Partial<Record<PrintableItemType, PrintableType>> = {
  'tshirt': 'tshirt-print',
  'hoodie': 'hoodie-print',
};

export function itemTypeToR2Type(itemType: PrintableItemType): PrintableType {
  return (ITEM_TO_R2[itemType] || itemType) as PrintableType;
}

/**
 * Map R2 PrintableType back to UI PrintableItemType.
 * tshirt-print -> tshirt, hoodie-print -> hoodie, others pass through.
 */
const R2_TO_ITEM: Partial<Record<PrintableType, PrintableItemType>> = {
  'tshirt-print': 'tshirt',
  'hoodie-print': 'hoodie',
};

export function r2TypeToItemType(r2Type: PrintableType): PrintableItemType {
  return (R2_TO_ITEM[r2Type] || r2Type) as PrintableItemType;
}

// ─── Coordinate conversion types and utility ─────────────────────────

/**
 * A single text element in PDF coordinates (output of conversion).
 * Defined here to avoid importing from printableService (which has heavy deps).
 */
export interface TextElementConfig {
  id: string;
  type: 'headline' | 'subline' | 'calendar' | 'custom';
  text: string;
  x: number;        // PDF coordinates
  y: number;        // PDF coordinates
  width: number;    // PDF points
  height: number;   // PDF points
  fontSize: number; // PDF points
  color: { r: number; g: number; b: number }; // RGB 0-1
  fontFamily?: 'fredoka' | 'springwood-display';
}

/**
 * Config for a single printable item in PDF coordinates (output of conversion).
 * Mirrors PrintableItemConfig from printableService.
 */
export interface PrintableItemConfig {
  type: string;
  textElements: TextElementConfig[];
  qrPosition?: { x: number; y: number; size: number };
}

/**
 * Input to convertItemToPdfConfig — editor-state data with CSS coordinates.
 */
export interface EditorItemInput {
  type: PrintableItemType;
  textElements: TextElement[];
  qrPosition?: { x: number; y: number; size: number };
  canvasScale?: number;
}

/**
 * Convert an editor item (CSS coordinates) to PDF coordinates for generation.
 *
 * - Flips Y axis (CSS top-left → PDF bottom-left)
 * - Divides by canvasScale to convert CSS pixels → PDF points
 * - Clamps canvasScale to [0.1, 5.0] for safety
 * - Converts hex colors to RGB 0-1 range
 */
export function convertItemToPdfConfig(item: EditorItemInput): PrintableItemConfig {
  const printableConfig = getPrintableConfig(item.type);
  const pdfHeight = printableConfig?.pdfDimensions.height || 1000;

  let scale = item.canvasScale || 1;
  if (scale < 0.1 || scale > 5.0) {
    scale = Math.max(0.1, Math.min(5.0, scale));
  }

  const textElements: TextElementConfig[] = item.textElements.map(element => {
    const pdfPosition = cssToPdfPosition(
      element.position.x,
      element.position.y + element.size.height,
      pdfHeight,
      scale
    );
    const pdfSize = cssToPdfSize(element.size.width, element.size.height, scale);
    const color = hexToRgb(element.color);

    return {
      id: element.id,
      type: element.type,
      text: element.text,
      x: pdfPosition.x,
      y: pdfPosition.y,
      width: pdfSize.width,
      height: pdfSize.height,
      fontSize: element.fontSize / scale,
      color,
      fontFamily: element.fontFamily,
    };
  });

  let qrPositionPdf: { x: number; y: number; size: number } | undefined;
  if (item.qrPosition) {
    const pdfQrPos = cssToPdfPosition(
      item.qrPosition.x,
      item.qrPosition.y + item.qrPosition.size,
      pdfHeight,
      scale
    );
    qrPositionPdf = {
      x: pdfQrPos.x,
      y: pdfQrPos.y,
      size: item.qrPosition.size / scale,
    };
  }

  return {
    type: itemTypeToR2Type(item.type),
    textElements,
    qrPosition: qrPositionPdf,
  };
}
