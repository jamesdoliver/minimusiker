/**
 * Field definitions for the Flyer 1 form-mode editor.
 *
 * Coordinate system: CSS pixels at canvasScale = 1. Since the partially-blank
 * PDF is 600.75 × 303 pt and the form-mode editor uses 1:1 scale, the values
 * here are effectively in PDF point space (origin top-left for editor; the
 * generator flips Y to PDF's bottom-left origin).
 *
 * Positions are hand-measured against the reference filled examples:
 *   public/printables/Flyers (MiniMusiker)/Filled out Flyers/Flyer 1/
 *
 * They are STARTING POINTS — admins can drag to fine-tune per event, and
 * Task 14 of Phase 0 iterates the defaults until rendered output matches
 * the references within tolerance.
 */

import type { PrintableFieldDef } from '../printableFields';

export const FLYER1_FIELDS: PrintableFieldDef[] = [
  {
    key: 'event-date-location',
    label: 'Event date + location',
    kind: 'text',
    // Right of the calendar X icon, lower-left quadrant of the front page.
    defaultPosition: { x: 130, y: 165 },
    defaultSize: { width: 220, height: 60 },
    defaultFontSize: 18,
    defaultFontFamily: 'fredoka',
    defaultColor: '#FFFFFF',
    draggable: true,
    multiline: true,
    textAlign: 'left',
    source: { type: 'computed', name: 'eventDateLocation' },
  },
];

export const FLYER1_BACK_FIELDS: PrintableFieldDef[] = [
  {
    key: 'hoodie-mockup-label',
    label: 'Hoodie label',
    kind: 'text',
    // On the hoodie mockup (top-right of the back page).
    defaultPosition: { x: 522, y: 70 },
    defaultSize: { width: 60, height: 12 },
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
    // Inside the yellow box in the upper-middle of the back page.
    defaultPosition: { x: 245, y: 85 },
    defaultSize: { width: 100, height: 100 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  },
  {
    key: 'tshirt-body-paragraph',
    label: 'T-shirt section body',
    kind: 'text',
    // Below the "T-shirts & Hoodies" headline, between headline and mockups.
    // Width widened so wrapped lines don't crowd the t-shirt graphic.
    defaultPosition: { x: 405, y: 100 },
    defaultSize: { width: 130, height: 75 },
    defaultFontSize: 9,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    multiline: true,
    textAlign: 'left',
    source: { type: 'computed', name: 'tshirtBodyParagraph' },
  },
  {
    key: 'tshirt-mockup-label',
    label: 'T-shirt label',
    kind: 'text',
    // On the t-shirt mockup (below the hoodie).
    defaultPosition: { x: 532, y: 130 },
    defaultSize: { width: 60, height: 12 },
    defaultFontSize: 7,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'schoolName' },
  },
  {
    key: 'qr-caption',
    label: 'QR caption (URL text)',
    kind: 'text',
    // Below the QR image, inside the yellow box.
    defaultPosition: { x: 245, y: 195 },
    defaultSize: { width: 100, height: 12 },
    defaultFontSize: 8,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  },
  {
    key: 'discount-end-date',
    label: 'Discount end date',
    kind: 'date',
    // Inside the "Spare 10%" pill, lower-right of the back page.
    defaultPosition: { x: 502, y: 245 },
    defaultSize: { width: 70, height: 14 },
    defaultFontSize: 11,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    source: { type: 'computed', name: 'earlyBirdDeadline' },
  },
];
