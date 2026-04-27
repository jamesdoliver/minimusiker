/**
 * Admin Orders Resync from Shopify
 *
 * POST /api/admin/orders/backfill-from-shopify
 *
 * For every Airtable order with a Shopify GID, fetch the canonical Shopify
 * state and overwrite the mirrored fields in Airtable. Catches up after
 * webhook drops (refunds the orders/updated webhook missed, late
 * cancellations, fulfillment status drift) and backfills is_test for
 * pre-flag orders.
 *
 * Body (optional): { dryRun?: boolean }
 *
 * Idempotent: only writes when Shopify and Airtable disagree.
 */

import { NextRequest, NextResponse } from 'next/server';
import Airtable, { FieldSet } from 'airtable';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '@/lib/types/airtable';
import { shopifyAdminService } from '@/lib/services/shopifyAdminService';
import {
  diffShopifyVsAirtable,
  type ExistingAirtableOrderFields,
} from '@/lib/utils/shopifyOrderSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SHOPIFY_NODES_BATCH_SIZE = 50;
const AIRTABLE_UPDATE_BATCH_SIZE = 10;

interface BackfillResult {
  success: boolean;
  dryRun: boolean;
  totalAirtableOrders: number;
  ordersWithGid: number;
  ordersResolvedFromShopify: number;
  ordersUpdated: number;
  ordersUnchanged: number;
  ordersMissingFromShopify: number;
  ordersWithoutGid: number;
  fieldChangeCounts: Record<string, number>;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const [, errorResponse] = requireAdmin(request);
  if (errorResponse) return errorResponse;

  let dryRun = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = body?.dryRun === true;
  } catch {
    // empty body is fine
  }

  const result: BackfillResult = {
    success: true,
    dryRun,
    totalAirtableOrders: 0,
    ordersWithGid: 0,
    ordersResolvedFromShopify: 0,
    ordersUpdated: 0,
    ordersUnchanged: 0,
    ordersMissingFromShopify: 0,
    ordersWithoutGid: 0,
    fieldChangeCounts: {},
    errors: [],
  };

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    const allRecords = await base(ORDERS_TABLE_ID)
      .select({ returnFieldsByFieldId: true })
      .all();

    result.totalAirtableOrders = allRecords.length;

    interface PendingUpdate {
      recordId: string;
      gid: string;
      existing: ExistingAirtableOrderFields;
    }

    const pending: PendingUpdate[] = [];
    for (const record of allRecords) {
      const gid = record.get(ORDERS_FIELD_IDS.order_id) as string | undefined;
      if (!gid || !gid.startsWith('gid://shopify/Order/')) {
        result.ordersWithoutGid++;
        continue;
      }
      pending.push({
        recordId: record.id,
        gid,
        existing: {
          payment_status: record.get(ORDERS_FIELD_IDS.payment_status) as string | undefined,
          fulfillment_status: record.get(ORDERS_FIELD_IDS.fulfillment_status) as string | undefined,
          refund_amount: record.get(ORDERS_FIELD_IDS.refund_amount) as number | undefined,
          cancel_reason: record.get(ORDERS_FIELD_IDS.cancel_reason) as string | undefined,
          is_test: record.get(ORDERS_FIELD_IDS.is_test) === true,
        },
      });
    }

    result.ordersWithGid = pending.length;

    const updates: Array<{ id: string; fields: Partial<FieldSet> }> = [];

    for (let i = 0; i < pending.length; i += SHOPIFY_NODES_BATCH_SIZE) {
      const chunk = pending.slice(i, i + SHOPIFY_NODES_BATCH_SIZE);
      const ids = chunk.map((p) => p.gid);

      try {
        const snapshots = await shopifyAdminService.getOrdersSyncSnapshot(ids);

        for (const item of chunk) {
          const snap = snapshots.get(item.gid);
          if (!snap) {
            result.ordersMissingFromShopify++;
            continue;
          }
          result.ordersResolvedFromShopify++;

          const diff = diffShopifyVsAirtable(snap, item.existing);
          if (!diff) {
            result.ordersUnchanged++;
            continue;
          }
          for (const field of diff.changed) {
            result.fieldChangeCounts[field] =
              (result.fieldChangeCounts[field] || 0) + 1;
          }
          updates.push({
            id: item.recordId,
            fields: diff.fields as Partial<FieldSet>,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Shopify batch ${i / SHOPIFY_NODES_BATCH_SIZE} failed: ${msg}`
        );
      }
    }

    if (dryRun) {
      result.ordersUpdated = updates.length;
      console.log(
        `[backfill-from-shopify] DRY RUN: would update ${updates.length}/${result.ordersWithGid} orders`,
        result.fieldChangeCounts
      );
      return NextResponse.json(result);
    }

    for (let i = 0; i < updates.length; i += AIRTABLE_UPDATE_BATCH_SIZE) {
      const batch = updates.slice(i, i + AIRTABLE_UPDATE_BATCH_SIZE);
      try {
        await base(ORDERS_TABLE_ID).update(batch);
        result.ordersUpdated += batch.length;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Airtable update batch ${i / AIRTABLE_UPDATE_BATCH_SIZE} failed: ${msg}`
        );
      }
    }

    console.log(`[backfill-from-shopify] Completed:`, result);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-from-shopify] Fatal error:', error);
    result.success = false;
    result.errors.push(msg);
    return NextResponse.json(result, { status: 500 });
  }
}
