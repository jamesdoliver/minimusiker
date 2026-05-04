/**
 * Form-mode editor state types and helpers.
 *
 * Each field in a form-mode item has three layers:
 *   1. Registry defaults (from PrintableFieldDef): position, size, font, color.
 *   2. Resolved value (from resolveFieldValues): the auto-filled text or URL
 *      based on the booking.
 *   3. Admin overrides (FormModeFieldOverride, saved to localStorage): any of
 *      the above that the admin has edited or repositioned.
 *
 * mergeFieldRender combines all three into the final FieldRender shape that
 * the canvas overlays and PDF generator consume.
 */

import type { FontFamily } from './printableTextConfig';
import type { PrintableFieldDef, ResolvedFieldValue } from './printableFields';

/**
 * Per-field admin overrides on top of the registry defaults.
 * Each property is optional; undefined means "use the default".
 */
export interface FormModeFieldOverride {
  /** Text/date kinds: admin-edited text. */
  text?: string;
  /** Set true when the admin has typed into the input. Distinguishes
   *  "admin chose empty string" from "no override". */
  textOverridden?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  fontSize?: number;
  fontFamily?: FontFamily;
  color?: string;
}

/** Override map per item: { fieldKey: override }. Empty when no admin edits. */
export type FormModeItemState = Record<string, FormModeFieldOverride>;

/** The final renderable shape combining defaults + overrides + resolved value. */
export interface FieldRender {
  key: string;
  kind: 'text' | 'qr' | 'date';
  /** For text/date kinds. Undefined for qr. */
  text?: string;
  /** For qr kind. Undefined for text/date. */
  url?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  fontSize?: number;
  fontFamily?: FontFamily;
  color?: string;
  /** Horizontal alignment within the text box. Undefined for qr. */
  textAlign?: 'left' | 'center' | 'right';
}

/**
 * Initial FormModeItemState — empty object, no overrides applied.
 * Accepts (and ignores) the field list for symmetry with future variants
 * that may want to seed defaults per field.
 */
export function emptyFormModeState(_fields: PrintableFieldDef[]): FormModeItemState {
  return {};
}

/**
 * Combine field definition + (optional) admin override + resolved value into
 * the renderable shape consumed by the canvas overlay components and the
 * PDF generator.
 */
export function mergeFieldRender(
  def: PrintableFieldDef,
  override: FormModeFieldOverride | undefined,
  resolved: ResolvedFieldValue,
): FieldRender {
  const position = override?.position ?? def.defaultPosition;
  const size = override?.size ?? def.defaultSize;
  const fontSize = override?.fontSize ?? def.defaultFontSize;
  const fontFamily = override?.fontFamily ?? def.defaultFontFamily;
  const color = override?.color ?? def.defaultColor;

  if (def.kind === 'qr') {
    return {
      key: def.key,
      kind: 'qr',
      text: undefined,
      url: resolved.kind === 'qr' ? resolved.url : '',
      position,
      size,
      fontSize: undefined,
      fontFamily: undefined,
      color: undefined,
    };
  }

  // text or date
  const resolvedText = resolved.kind === 'text' || resolved.kind === 'date' ? resolved.text : '';
  const text = override?.textOverridden ? override.text ?? '' : resolvedText;

  return {
    key: def.key,
    kind: def.kind,
    text,
    url: undefined,
    position,
    size,
    fontSize,
    fontFamily,
    color,
    textAlign: def.textAlign,
  };
}
