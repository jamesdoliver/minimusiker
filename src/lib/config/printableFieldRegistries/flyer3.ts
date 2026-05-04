/**
 * Field definitions for the Flyer 3 form-mode editor.
 * Single-page post-event "Gut gemacht!" thank-you flyer (A5 portrait, 425.25 × 600.75 pt).
 *
 * Body paragraphs are static defaults that admins can edit inline (e.g. swap
 * "Schule" for "KiTa" on KiTa events). The teacher-signature is a free-form
 * name field admins fill per event. QR code + caption resolve from booking.
 *
 * The "Unser Schulsong" sticker variant is deferred — adds when a designer-
 * sourced asset is available.
 *
 * Positions are starting points; admins iterate via the wizard.
 */

import type { PrintableFieldDef } from '../printableFields';

export const FLYER3_FIELDS: PrintableFieldDef[] = [
  {
    key: 'wow-body',
    label: '"Wow!" body paragraph',
    kind: 'text',
    // Sits directly under the "Wow! Was ein cooler Tag…" sub-headline baked
    // into the partial (top-left quadrant).
    defaultPosition: { x: 30, y: 185 },
    defaultSize: { width: 230, height: 60 },
    defaultFontSize: 10,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    multiline: true,
    textAlign: 'left',
    // Branches on isKita via the resolver. Word-wrap happens at render time
    // (B3) so we no longer need hand-inserted '\n' in the source string.
    source: { type: 'computed', name: 'flyer3WowBody' },
  },
  // 'ab-ins-studio-body' intentionally not registered: the current partial
  // template still bakes this paragraph in. Re-adding the field would render
  // duplicate overlapping text. Add back once the designer re-exports the
  // partial with this area blank.
  {
    key: 'liebe-erwachsene-body',
    label: '"Liebe Erwachsene" body paragraph',
    kind: 'text',
    // Left column under "Liebe Erwachsene" sub-headline (mid-page).
    defaultPosition: { x: 30, y: 405 },
    defaultSize: { width: 195, height: 75 },
    defaultFontSize: 10,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    multiline: true,
    textAlign: 'left',
    source: { type: 'computed', name: 'flyer3LiebeBody' },
  },
  // 'wohooo-body' intentionally not registered: the current partial bakes
  // "Wir fanden den Tag bei euch an der Schule…" into this slot. Same
  // re-export prerequisite as ab-ins-studio-body above.
  {
    key: 'teacher-signature',
    label: 'Engineer signature',
    kind: 'text',
    // Below the "Wohooo!" body, signed name (e.g. "Steffen").
    defaultPosition: { x: 230, y: 545 },
    defaultSize: { width: 130, height: 16 },
    defaultFontSize: 11,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    textAlign: 'left',
    source: { type: 'static', value: '' },
  },
  {
    key: 'qr-code',
    label: 'QR code',
    kind: 'qr',
    defaultPosition: { x: 30, y: 440 },
    defaultSize: { width: 100, height: 100 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  },
  {
    key: 'qr-caption',
    label: 'QR caption (URL text)',
    kind: 'text',
    defaultPosition: { x: 30, y: 545 },
    defaultSize: { width: 100, height: 12 },
    defaultFontSize: 8,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  },
];
