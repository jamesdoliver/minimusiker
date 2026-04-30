import type { PrintableItemType } from './printableTextConfig';
import type { PrintableFieldDef } from './printableFields';

/**
 * Per-item field definitions. An item present here uses the form-mode editor;
 * an item absent here (or mapped to null) falls through to the legacy
 * draggable editor. Phase 0+ adds entries one item at a time.
 */
const REGISTRIES: Partial<Record<PrintableItemType, PrintableFieldDef[]>> = {
  // Intentionally empty in Phase -1.
};

export function getFieldRegistry(itemType: PrintableItemType): PrintableFieldDef[] | null {
  return REGISTRIES[itemType] ?? null;
}

export function hasFormMode(itemType: PrintableItemType): boolean {
  return getFieldRegistry(itemType) !== null;
}
