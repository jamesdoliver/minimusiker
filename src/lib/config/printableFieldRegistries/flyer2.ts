/**
 * Field definitions for the Flyer 2 form-mode editor.
 * Pre-event flyer: "Minimusikertag am DD.MM.YYYY" headline + countdown subtitle.
 *
 * Coordinate system: CSS pixels at canvasScale = 1, equivalent to PDF point space
 * for the partial-blank PDF (600.75 × 303). Y axis is top-down in editor;
 * convertFormModeItemToPdfConfig flips for PDF generation.
 *
 * Positions are starting points — admins fine-tune per event.
 */

import type { PrintableFieldDef } from '../printableFields';

export const FLYER2_FIELDS: PrintableFieldDef[] = [
  {
    key: 'event-date-headline',
    label: 'Event date headline',
    kind: 'text',
    // Top-center large white headline.
    defaultPosition: { x: 15, y: 12 },
    defaultSize: { width: 475, height: 35 },
    defaultFontSize: 28,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    source: { type: 'computed', name: 'eventDateHeadline' },
  },
  {
    key: 'pre-event-subtitle',
    label: 'Subtitle (countdown)',
    kind: 'text',
    // Below the headline, pink/red over the lavender backdrop. Left-aligned
    // so wrapped lines (long school names like "Hexentalschule") share an
    // anchor point.
    defaultPosition: { x: 15, y: 55 },
    defaultSize: { width: 410, height: 50 },
    defaultFontSize: 14,
    defaultFontFamily: 'fredoka',
    defaultColor: '#C8385A',
    draggable: true,
    multiline: true,
    textAlign: 'left',
    source: { type: 'computed', name: 'flyerSubtitlePreEvent' },
  },
];

export const FLYER2_BACK_FIELDS: PrintableFieldDef[] = [
  {
    key: 'hoodie-mockup-label',
    label: 'Hoodie label',
    kind: 'text',
    // Center of the hoodie graphic (mockup pair sits roughly center-bottom).
    defaultPosition: { x: 295, y: 195 },
    defaultSize: { width: 90, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'schoolName' },
  },
  {
    key: 'tshirt-mockup-label',
    label: 'T-shirt label',
    kind: 'text',
    // Center of the t-shirt graphic (sits to the right of the hoodie).
    defaultPosition: { x: 360, y: 230 },
    defaultSize: { width: 80, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'schoolName' },
  },
  {
    key: 'qr-code',
    label: 'QR code',
    kind: 'qr',
    // Inside the orange "Gratis!" box on the upper-right.
    defaultPosition: { x: 480, y: 105 },
    defaultSize: { width: 80, height: 80 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  },
  {
    key: 'qr-caption',
    label: 'QR caption (URL text)',
    kind: 'text',
    defaultPosition: { x: 478, y: 192 },
    defaultSize: { width: 85, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  },
];
