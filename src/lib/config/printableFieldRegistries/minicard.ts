/**
 * Field definitions for the Minicards form-mode editor.
 * Post-event cards (DIN Long landscape, 600.75 × 283.5 pt, 2 pages).
 * Front: song list auto-pulled from the event tracklist.
 * Back: QR code + URL caption.
 *
 * Most of the layout (headlines, body paragraphs, decorative scenes) is
 * baked into the partial-blank template. Only the dynamic per-event content
 * is overlaid here.
 *
 * Positions are starting points; admins iterate.
 */

import type { PrintableFieldDef } from '../printableFields';

export const MINICARD_FIELDS: PrintableFieldDef[] = [
  {
    key: 'song-list',
    label: 'Song list (from tracklist)',
    kind: 'text',
    defaultPosition: { x: 20, y: 40 },
    defaultSize: { width: 560, height: 200 },
    defaultFontSize: 8,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    multiline: true,
    source: { type: 'computed', name: 'songList' },
  },
];

export const MINICARD_BACK_FIELDS: PrintableFieldDef[] = [
  {
    key: 'qr-code',
    label: 'QR code',
    kind: 'qr',
    defaultPosition: { x: 70, y: 40 },
    defaultSize: { width: 80, height: 80 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  },
  {
    key: 'qr-caption',
    label: 'QR caption (URL text)',
    kind: 'text',
    defaultPosition: { x: 70, y: 125 },
    defaultSize: { width: 85, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  },
];
