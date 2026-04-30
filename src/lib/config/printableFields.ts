import type { FontFamily } from './printableTextConfig';

export type PrintableFieldKind = 'text' | 'qr' | 'date';

/**
 * Where the default value for a field comes from.
 * - static: literal string baked into the registry
 * - computed: derived from the booking by the resolver (`name` selects which derivation)
 */
export type PrintableFieldSource =
  | { type: 'static'; value: string }
  | { type: 'computed'; name: ComputedFieldName };

/**
 * Names of computed values the resolver knows how to produce. Adding a new
 * source here is the contract: the resolver must implement it.
 */
export type ComputedFieldName =
  | 'schoolName'
  | 'eventDateLocation'   // "Am DD.MM.YYYY in der {schoolName}"
  | 'schuleOrKita'        // "Schule" | "KiTa"
  | 'qrUrl'               // "minimusiker.app/e/{accessCode}" (or full https://)
  | 'earlyBirdDeadline';  // "DD.MM.YYYY" (eventDate - threshold days)

export interface PrintableFieldDef {
  /** Stable key used to address this field in saved state. Unique per item type. */
  key: string;
  /** Human-readable label shown in the form UI. */
  label: string;
  kind: PrintableFieldKind;
  /** Default position in CSS pixels at canvasScale = 1. */
  defaultPosition: { x: number; y: number };
  /** Default size in CSS pixels at canvasScale = 1. */
  defaultSize: { width: number; height: number };
  /** For text/date kinds. */
  defaultFontSize?: number;
  defaultFontFamily?: FontFamily;
  defaultColor?: string;
  /** When false, the form UI hides the position handle and the canvas shows the field as a non-draggable badge. */
  draggable: boolean;
  source: PrintableFieldSource;
}

export type ResolvedFieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'qr'; url: string }
  | { kind: 'date'; text: string };

/** Map of fieldKey -> resolved default value for one item. */
export type ResolvedFieldValues = Record<string, ResolvedFieldValue>;
