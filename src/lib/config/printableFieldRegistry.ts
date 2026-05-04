import type { PrintableItemType } from './printableTextConfig';
import type { PrintableFieldDef } from './printableFields';
import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from './printableFieldRegistries/flyer1';
import { FLYER2_FIELDS, FLYER2_BACK_FIELDS } from './printableFieldRegistries/flyer2';
import { FLYER3_FIELDS } from './printableFieldRegistries/flyer3';
import { MINICARD_FIELDS } from './printableFieldRegistries/minicard';
import { CD_JACKET_FIELDS } from './printableFieldRegistries/cd-jacket';

/**
 * Per-item field definitions. An item present here uses the form-mode editor;
 * an item absent here (or mapped to null) falls through to the legacy
 * draggable editor. Phases 0+ migrate one item at a time.
 *
 * Note: 'minicard-back' is not in the PrintableItemType union — Minicards
 * are dispatched as a single item type whose template is a 2-page PDF. The
 * back-side fields (QR + caption) live in MINICARD_BACK_FIELDS but are not
 * yet wired here; registering them requires extending PrintableItemType to
 * include 'minicard-back' and updating the dispatch logic. Tracked as
 * Phase 5+ work.
 */
const REGISTRIES: Partial<Record<PrintableItemType, PrintableFieldDef[]>> = {
  'flyer1': FLYER1_FIELDS,
  'flyer1-back': FLYER1_BACK_FIELDS,
  'flyer2': FLYER2_FIELDS,
  'flyer2-back': FLYER2_BACK_FIELDS,
  'flyer3': FLYER3_FIELDS,
  'minicard': MINICARD_FIELDS,
  'cd-jacket': CD_JACKET_FIELDS,
};

export function getFieldRegistry(itemType: PrintableItemType): PrintableFieldDef[] | null {
  return REGISTRIES[itemType] ?? null;
}

export function hasFormMode(itemType: PrintableItemType): boolean {
  return getFieldRegistry(itemType) !== null;
}
