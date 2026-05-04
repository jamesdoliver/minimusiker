/**
 * Shared types and utilities for the printables system.
 * Single source of truth for type mappings, status types, and constants
 * used across UI components, API routes, and services.
 */

import type { PrintableItemType, TextElement } from './printableTextConfig';
import { getPrintableConfig, cssToPdfPosition, cssToPdfSize, hexToRgb } from './printableTextConfig';
import type { PrintableType } from '../services/r2Service';
import { resolveFieldValues, type ResolverBooking } from './printableFieldResolver';
import { mergeFieldRender, type FormModeItemState } from './formModeState';
import type { PrintableFieldDef } from './printableFields';
import type { EventTimelineOverrides } from '@/lib/utils/eventThresholds';
import type { MasterCdTrack } from '@/lib/services/masterCdService';

/**
 * Status of a printable item in the confirmation workflow.
 * - pending: not yet processed
 * - confirmed: PDF has been generated
 * - skipped: admin chose to skip this item
 */
export type ItemStatus = 'pending' | 'confirmed' | 'skipped';

/**
 * Canonical list of all printable item types. Items appear in this array
 * regardless of how they are grouped into wizard tabs (see
 * PRINTABLE_TAB_GROUPS). Used by getPrintablesStatus and anywhere that
 * needs the full list.
 */
export const PRINTABLE_ITEM_TYPES: PrintableItemType[] = [
  'tshirt', 'hoodie',
  'flyer1', 'flyer1-back',
  'flyer2', 'flyer2-back',
  'flyer3',
  'button', 'minicard', 'cd-jacket',
];

/**
 * Tab groupings for the wizard modal.
 * Splits printable items into "Papers" (flat printables) and "Clothing" (wearables).
 */
export type PrintableTab = 'papersPreEvent' | 'papersPostEvent' | 'clothing';

export const PRINTABLE_TAB_GROUPS: Record<PrintableTab, PrintableItemType[]> = {
  papersPreEvent: [
    'flyer1', 'flyer1-back',
    'flyer2', 'flyer2-back',
    'flyer3',
  ],
  papersPostEvent: [
    'minicard', 'cd-jacket',
  ],
  clothing: ['tshirt', 'hoodie', 'button'],
};

export function itemTab(itemType: PrintableItemType): PrintableTab {
  if (PRINTABLE_TAB_GROUPS.clothing.includes(itemType)) return 'clothing';
  if (PRINTABLE_TAB_GROUPS.papersPostEvent.includes(itemType)) return 'papersPostEvent';
  return 'papersPreEvent'; // default — pre-event papers is the widest set in early-flow events
}

/**
 * Single source of truth: how to derive the partial-template basename from a
 * PrintableItemType. Consumed by:
 *   - the runtime generator (printableService.getPartialTemplate(basename))
 *   - the pre-flight health check (HEADs `<basename>-partial-template.pdf`)
 *   - the editor's PNG backdrop loader (`<basename>-partial-<side>.png`)
 *   - the upload script (uploads to R2 under `<basename>-partial-template.pdf`)
 *
 * The default rule strips a trailing `-back` (front + back share one PDF).
 * The override map handles items where the type doesn't match the asset
 * basename (the partial PDFs were authored under different names).
 */
const ITEM_TYPE_TO_PARTIAL_BASENAME: Partial<Record<PrintableItemType, string>> = {
  'minicard': 'minicards',
  'cd-jacket': 'cd-booklet',
};

export function partialBasenameFor(itemType: PrintableItemType): string {
  const stripped = itemType.endsWith('-back')
    ? (itemType.slice(0, -'-back'.length) as PrintableItemType)
    : itemType;
  return ITEM_TYPE_TO_PARTIAL_BASENAME[stripped] ?? stripped;
}

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
  /** Horizontal alignment within the text box. Defaults to 'center' when undefined. */
  textAlign?: 'left' | 'center' | 'right';
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

export interface FormModeItemInput {
  type: PrintableItemType;
  fields: PrintableFieldDef[];
  state: FormModeItemState;
  booking: ResolverBooking;
  overrides?: EventTimelineOverrides | null;
  tracklist?: MasterCdTrack[] | null;
}

/**
 * Suffix appended to a `PrintableItemType` to produce the corresponding
 * "partial-blank template" config type. The form-mode converter writes this
 * suffix; printableService dispatches on it to load the shared partial-blank
 * template instead of the legacy single-page template.
 */
export const PARTIAL_TYPE_SUFFIX = '-partial';

export function isPartialType(type: string): boolean {
  return type.endsWith(PARTIAL_TYPE_SUFFIX);
}

/**
 * Strip the partial suffix to recover the canonical `PrintableItemType`.
 * Returns the input unchanged if it has no `-partial` suffix.
 */
export function stripPartialSuffix(type: string): string {
  return isPartialType(type) ? type.slice(0, -PARTIAL_TYPE_SUFFIX.length) : type;
}

/**
 * Form-mode parallel of `convertItemToPdfConfig`. Resolves field values from
 * the booking, applies admin overrides, flips CSS→PDF coordinates, and returns
 * the same `PrintableItemConfig` shape consumed by `printableService`.
 *
 * The output `type` is `<itemType>-partial` so the generator can dispatch on
 * the suffix to load the partial-blank R2 template instead of the legacy one.
 */
export function convertFormModeItemToPdfConfig(input: FormModeItemInput): PrintableItemConfig {
  const printableConfig = getPrintableConfig(input.type);
  const pdfHeight = printableConfig?.pdfDimensions.height ?? 1000;
  const scale = 1; // Form-mode state is stored at canvasScale=1 always.

  const resolved = resolveFieldValues(input.fields, input.booking, input.overrides ?? null, input.tracklist ?? null);

  const textElements: TextElementConfig[] = [];
  let qrPosition: { x: number; y: number; size: number } | undefined;

  for (const def of input.fields) {
    const render = mergeFieldRender(def, input.state[def.key], resolved[def.key] ?? defaultResolvedFor(def.kind));
    const pdfPosition = cssToPdfPosition(
      render.position.x,
      render.position.y + render.size.height,
      pdfHeight,
      scale,
    );
    const pdfSize = cssToPdfSize(render.size.width, render.size.height, scale);

    if (render.kind === 'qr') {
      qrPosition = {
        x: pdfPosition.x,
        y: pdfPosition.y,
        // QR is intended to be square. Defensive: take the smaller dimension
        // so a corrupted state with width !== height still produces a valid PDF.
        size: Math.min(pdfSize.width, pdfSize.height),
      };
      continue;
    }

    // Diverges from convertItemToPdfConfig: form-mode resolves missing booking
    // data to '' (e.g. earlyBirdDeadline with no bookingDate). Skip rather than
    // emit a zero-content text element into the PDF.
    if (!render.text) continue;

    textElements.push({
      id: render.key,
      type: 'custom',
      text: render.text,
      x: pdfPosition.x,
      y: pdfPosition.y,
      width: pdfSize.width,
      height: pdfSize.height,
      fontSize: render.fontSize ?? 14,
      color: hexToRgb(render.color ?? '#000000'),
      fontFamily: render.fontFamily,
      textAlign: render.textAlign,
    });
  }

  return {
    type: `${input.type}${PARTIAL_TYPE_SUFFIX}`,
    textElements,
    qrPosition,
  };
}

function defaultResolvedFor(kind: 'text' | 'qr' | 'date') {
  if (kind === 'qr') return { kind: 'qr' as const, url: '' };
  return { kind, text: '' };
}
