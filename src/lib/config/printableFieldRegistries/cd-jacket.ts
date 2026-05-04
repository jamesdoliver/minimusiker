/**
 * Field definitions for the CD Booklet form-mode editor.
 * Single-page 2-panel layout (697.5 × 357 pt — folded jewel-case insert).
 *
 * Left panel: song list (auto-pulled from tracklist) + a date overlay at the
 * centerfold. The "Das war unser Minimusikertag am" prefix is baked into the
 * partial-blank PDF, so this registry only overlays the DD.MM.YYYY date.
 * Right panel: large school-name display.
 *
 * Static layout (numbered slot placeholders 1-16, "Unsere Lieder" header,
 * "So singt und klingt die" subhead, and the date prefix sentence) is baked
 * into the partial-blank PDF.
 *
 * Positions are starting points; admins iterate.
 */

import type { PrintableFieldDef } from '../printableFields';

export const CD_JACKET_FIELDS: PrintableFieldDef[] = [
  {
    key: 'song-list',
    label: 'Song list (from tracklist)',
    kind: 'text',
    defaultPosition: { x: 20, y: 20 },
    defaultSize: { width: 270, height: 320 },
    defaultFontSize: 11,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    multiline: true,
    source: { type: 'computed', name: 'songList' },
  },
  {
    // Date-only overlay. The "Das war unser Minimusikertag am" prefix is baked
    // into the partial-blank PDF, so we only render the DD.MM.YYYY date here
    // to avoid duplicating the prefix.
    key: 'event-date-postheadline',
    label: 'Date (centerfold)',
    kind: 'text',
    defaultPosition: { x: 350, y: 25 },
    defaultSize: { width: 80, height: 18 },
    defaultFontSize: 12,
    defaultFontFamily: 'fredoka',
    defaultColor: '#C8385A',
    draggable: true,
    multiline: true,
    source: { type: 'computed', name: 'eventDateShort' },
  },
  {
    key: 'school-name-display',
    label: 'School name (large display)',
    kind: 'text',
    defaultPosition: { x: 440, y: 80 },
    defaultSize: { width: 240, height: 70 },
    defaultFontSize: 24,
    defaultFontFamily: 'fredoka',
    defaultColor: '#1F1F1F',
    draggable: true,
    multiline: true,
    source: { type: 'computed', name: 'schoolName' },
  },
];
