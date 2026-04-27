/**
 * Shared mappers + diff for syncing Shopify Order state into the Airtable
 * Orders table. Used by:
 *   - POST /api/admin/orders/backfill-from-shopify (bulk one-shot)
 *   - scripts/backfill-orders-from-shopify.ts        (local one-shot)
 *
 * The orders/updated webhook handler does the same mapping inline (REST
 * payload, lowercase enums) — this module is the GraphQL/uppercase variant.
 */

import { ORDERS_FIELD_IDS } from '@/lib/types/airtable';
import type { OrderSyncSnapshot } from '@/lib/services/shopifyAdminService';

export type AirtablePaymentStatus =
  | 'pending'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'voided';

export type AirtableFulfillmentStatus = 'pending' | 'fulfilled' | 'partial';

/**
 * Map Shopify GraphQL displayFinancialStatus (uppercase) to Airtable enum.
 * Mirrors the REST mapper in webhooks/shopify/orders-updated.
 */
export function mapPaymentStatusFromGraphQL(
  status: string | null
): AirtablePaymentStatus {
  if (!status) return 'pending';
  switch (status.toUpperCase()) {
    case 'PARTIALLY_REFUNDED':
      return 'partially_refunded';
    case 'REFUNDED':
      return 'refunded';
    case 'VOIDED':
      return 'voided';
    case 'PAID':
    case 'PARTIALLY_PAID':
      return 'paid';
    default:
      return 'pending';
  }
}

export function mapFulfillmentStatusFromGraphQL(
  status: string | null
): AirtableFulfillmentStatus {
  if (!status) return 'pending';
  switch (status.toUpperCase()) {
    case 'FULFILLED':
      return 'fulfilled';
    case 'PARTIALLY_FULFILLED':
    case 'PARTIAL':
      return 'partial';
    default:
      return 'pending';
  }
}

export function mapCancelReasonFromGraphQL(reason: string | null): string {
  // REST webhook stores lowercase values; mirror that for consistency.
  return (reason || '').toLowerCase();
}

export interface ExistingAirtableOrderFields {
  payment_status?: string;
  fulfillment_status?: string;
  refund_amount?: number;
  cancel_reason?: string;
  is_test?: boolean;
}

export interface SyncDiff {
  fields: Record<string, unknown>;
  changed: Array<keyof ExistingAirtableOrderFields>;
}

/**
 * Compare a Shopify snapshot against the current Airtable record and return
 * only the fields that need to change. Returns null if everything is in sync.
 *
 * Refund_amount uses an absolute-value tolerance of €0.01 to avoid float
 * jitter triggering writes.
 */
export function diffShopifyVsAirtable(
  snapshot: OrderSyncSnapshot,
  existing: ExistingAirtableOrderFields
): SyncDiff | null {
  const changed: Array<keyof ExistingAirtableOrderFields> = [];
  const fields: Record<string, unknown> = {};

  const newPayment = mapPaymentStatusFromGraphQL(snapshot.displayFinancialStatus);
  if (newPayment !== (existing.payment_status || 'pending')) {
    fields[ORDERS_FIELD_IDS.payment_status] = newPayment;
    changed.push('payment_status');
  }

  const newFulfillment = mapFulfillmentStatusFromGraphQL(
    snapshot.displayFulfillmentStatus
  );
  if (newFulfillment !== (existing.fulfillment_status || 'pending')) {
    fields[ORDERS_FIELD_IDS.fulfillment_status] = newFulfillment;
    changed.push('fulfillment_status');
  }

  const newRefund = snapshot.totalRefunded;
  const oldRefund = existing.refund_amount || 0;
  if (Math.abs(newRefund - oldRefund) > 0.01) {
    fields[ORDERS_FIELD_IDS.refund_amount] = newRefund;
    changed.push('refund_amount');
  }

  const newCancel = mapCancelReasonFromGraphQL(snapshot.cancelReason);
  const oldCancel = existing.cancel_reason || '';
  if (newCancel !== oldCancel) {
    fields[ORDERS_FIELD_IDS.cancel_reason] = newCancel;
    changed.push('cancel_reason');
  }

  const newIsTest = snapshot.test === true;
  const oldIsTest = existing.is_test === true;
  if (newIsTest !== oldIsTest) {
    fields[ORDERS_FIELD_IDS.is_test] = newIsTest;
    changed.push('is_test');
  }

  if (changed.length === 0) return null;
  fields[ORDERS_FIELD_IDS.updated_at] = new Date().toISOString();
  return { fields, changed };
}
