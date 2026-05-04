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
  | 'earlyBirdDeadline'   // "DD.MM.YYYY" (eventDate - threshold days)
  | 'tshirtBodyParagraph'
  | 'qrCaption'
  | 'songList'            // Multi-line "N. Title Class" rendered from tracklist
  | 'eventDateHeadline'   // "Minimusikertag am DD.MM.YYYY"
  | 'flyerSubtitlePreEvent' // "Nur noch wenige Tage bis zum Minimusikertag im {schoolName}"
  | 'eventDatePostHeadline' // "Das war unser Minimusikertag am DD.MM.YYYY"
  | 'eventDateShort'         // "DD.MM.YYYY" only (when prefix is baked into the partial)
  | 'flyer3WowBody'          // "Heute haben wir mit der ganzen {Schule|KiTa}…"
  | 'flyer3LiebeBody';       // "Über diesen QR-Code könnt ihr die Aufnahmen … Namen eurer {Schule|KiTa}."

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
  /** When true, the form panel renders a multi-line textarea instead of a single-line input. Only meaningful for kind 'text'. */
  multiline?: boolean;
  /** Horizontal alignment within the text box. Defaults to 'center' to preserve legacy behavior. */
  textAlign?: 'left' | 'center' | 'right';
  source: PrintableFieldSource;
}

export type ResolvedFieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'qr'; url: string }
  | { kind: 'date'; text: string };

/** Map of fieldKey -> resolved default value for one item. */
export type ResolvedFieldValues = Record<string, ResolvedFieldValue>;
