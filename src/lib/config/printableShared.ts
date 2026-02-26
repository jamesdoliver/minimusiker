/**
 * Shared types and utilities for the printables system.
 * Single source of truth for type mappings, status types, and constants
 * used across UI components, API routes, and services.
 */

import type { PrintableItemType } from './printableTextConfig';
import type { PrintableType } from '../services/r2Service';

/**
 * Status of a printable item in the confirmation workflow.
 * - pending: not yet processed
 * - confirmed: PDF has been generated
 * - skipped: admin chose to skip this item
 */
export type ItemStatus = 'pending' | 'confirmed' | 'skipped';

/**
 * All printable item types in wizard order.
 * Used by getPrintablesStatus and anywhere that needs the full list.
 */
export const PRINTABLE_ITEM_TYPES: PrintableItemType[] = [
  'tshirt', 'hoodie',
  'flyer1', 'flyer1-back',
  'flyer2', 'flyer2-back',
  'flyer3', 'flyer3-back',
  'button', 'minicard', 'cd-jacket',
];

/**
 * Map UI PrintableItemType to R2 PrintableType.
 * tshirt -> tshirt-print, hoodie -> hoodie-print, others pass through.
 */
const ITEM_TO_R2: Partial<Record<PrintableItemType, PrintableType>> = {
  'tshirt': 'tshirt-print',
  'hoodie': 'hoodie-print',
};

export function itemTypeToR2Type(itemType: PrintableItemType): PrintableType {
  return (ITEM_TO_R2[itemType] || itemType) as PrintableType;
}

/**
 * Map R2 PrintableType back to UI PrintableItemType.
 * tshirt-print -> tshirt, hoodie-print -> hoodie, others pass through.
 */
const R2_TO_ITEM: Partial<Record<PrintableType, PrintableItemType>> = {
  'tshirt-print': 'tshirt',
  'hoodie-print': 'hoodie',
};

export function r2TypeToItemType(r2Type: PrintableType): PrintableItemType {
  return (R2_TO_ITEM[r2Type] || r2Type) as PrintableItemType;
}
