'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import type { TaskMatrixCell } from '@/lib/types/tasks';
import { getTimelineEntry, PREFIX_STYLES } from '@/lib/config/taskTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderInfo {
  orderNumber: string;
  itemCount: number;
  fulfillmentStatus: string;
}

interface OrderSummary {
  totalOrders: number;
  totalItems: number;
  orders: OrderInfo[];
}

interface TaskMatrixPopoverProps {
  cell: TaskMatrixCell;
  templateId: string;
  eventId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onAction: (action: string, data?: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fulfillmentBadge(status: string) {
  const styles: Record<string, string> = {
    fulfilled: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    unfulfilled: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={cn(
        'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
        styles[status] || styles.unfulfilled,
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskMatrixPopover({
  cell,
  templateId,
  eventId,
  anchorRect,
  onClose,
  onAction,
}: TaskMatrixPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState('');
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Close on click-outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const entry = getTimelineEntry(templateId);
  const prefixStyle = entry ? PREFIX_STYLES[entry.prefix] : null;

  // Determine if this is an order/shipment task
  const isOrderTask =
    templateId.startsWith('order_') || templateId.startsWith('shipment_');

  // Fetch order data for order/shipment tasks
  const fetchOrderData = useCallback(async () => {
    if (!isOrderTask) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/admin/orders/events/${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const data = json.data;
      let orders: Array<{
        orderNumber: string;
        lineItems: Array<{ quantity: number }>;
        fulfillmentStatus: string;
      }> = [];

      if (templateId === 'shipment_welle_1') {
        orders = data.welle1?.orders ?? [];
      } else if (templateId === 'shipment_welle_2') {
        orders = data.welle2?.orders ?? [];
      } else {
        // order_* tasks — show all orders
        orders = [...(data.welle1?.orders ?? []), ...(data.welle2?.orders ?? [])];
      }

      const orderInfos: OrderInfo[] = orders.map((o) => ({
        orderNumber: o.orderNumber,
        itemCount: o.lineItems?.reduce((sum: number, li: { quantity: number }) => sum + li.quantity, 0) ?? 0,
        fulfillmentStatus: o.fulfillmentStatus || 'unfulfilled',
      }));

      setOrderSummary({
        totalOrders: orderInfos.length,
        totalItems: orderInfos.reduce((sum, o) => sum + o.itemCount, 0),
        orders: orderInfos,
      });
    } catch {
      // Silently fail — order info is supplementary
    } finally {
      setIsLoadingOrders(false);
    }
  }, [eventId, isOrderTask, templateId]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // Position below the anchor, centred horizontally
  const popoverWidth = isOrderTask ? 384 : 288; // w-96 or w-72
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 50,
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - popoverWidth / 2),
  };

  // If popover would go off bottom of screen, show above instead
  if (anchorRect.bottom + 300 > window.innerHeight) {
    style.bottom = window.innerHeight - anchorRect.top + 8;
  } else {
    style.top = anchorRect.bottom + 8;
  }

  // Status flags
  const isCompleted = cell.cellStatus === 'green';
  const isSkipped = cell.status === 'skipped';
  const isPartial = cell.status === 'partial';
  const canComplete = !['green', 'grey', 'orange'].includes(cell.cellStatus);
  const canRevert = isCompleted || isSkipped || isPartial;

  return (
    <div
      ref={popoverRef}
      style={style}
      className={cn(
        'bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden',
        isOrderTask ? 'w-96' : 'w-72',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-2.5 border-b',
          prefixStyle ? prefixStyle.bg : 'bg-gray-50 border-gray-200',
        )}
      >
        <p
          className={cn(
            'text-sm font-semibold',
            prefixStyle ? prefixStyle.text : 'text-gray-700',
          )}
        >
          {entry?.displayName || templateId}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Deadline */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Deadline</span>
          <span className="font-medium text-gray-900">
            {cell.deadline
              ? formatDate(cell.deadline, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A'}
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Status</span>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Completed
            </span>
          ) : isSkipped ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Skipped
            </span>
          ) : isPartial ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              Partially complete
            </span>
          ) : cell.cellStatus === 'grey' ? (
            <span className="text-xs text-gray-400 font-medium">
              Not applicable
            </span>
          ) : cell.daysUntilDue < 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {Math.abs(cell.daysUntilDue)}d overdue
            </span>
          ) : cell.daysUntilDue === 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              Due today
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {cell.daysUntilDue}d remaining
            </span>
          )}
        </div>

        {/* Completed At */}
        {cell.completedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {isSkipped ? 'Skipped' : isPartial ? 'Partial' : 'Completed'}
            </span>
            <span className="text-gray-700">
              {formatDate(cell.completedAt, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Order Info Section */}
        {isOrderTask && (
          <div className="border-t border-gray-100 pt-2.5 mt-2.5">
            {isLoadingOrders ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Loading orders...
              </div>
            ) : orderSummary ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Orders</span>
                  <span className="text-gray-700 font-semibold">
                    {orderSummary.totalOrders} orders, {orderSummary.totalItems} items
                  </span>
                </div>
                {orderSummary.orders.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {orderSummary.orders.map((order) => (
                      <div
                        key={order.orderNumber}
                        className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                      >
                        <span className="font-semibold text-gray-800">
                          {order.orderNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">
                            {order.itemCount} items
                          </span>
                          {fulfillmentBadge(order.fulfillmentStatus)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No order data</p>
            )}
          </div>
        )}

        {/* Notes input for partial completion */}
        {showNotesInput && (
          <div className="border-t border-gray-100 pt-2.5 mt-2.5 space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              Notes (required for partial)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was done and what remains..."
              rows={3}
              className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none"
            />
            <button
              type="button"
              disabled={!notes.trim()}
              onClick={() => onAction('partial', { notes: notes.trim() })}
              className="w-full px-3 py-1.5 text-xs text-white font-medium rounded bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm Partial
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/admin/tasks/${eventId}`}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            View event
          </Link>

          <div className="flex items-center gap-1.5">
            {canRevert && (
              <button
                type="button"
                onClick={() => onAction('revert')}
                className="px-2.5 py-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium rounded hover:bg-amber-50 transition-colors"
              >
                Revert
              </button>
            )}
            {canComplete && !showNotesInput && (
              <>
                <button
                  type="button"
                  onClick={() => onAction('skip')}
                  className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotesInput(true)}
                  className="px-2.5 py-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium rounded hover:bg-orange-50 transition-colors"
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => onAction('complete')}
                  className="px-3 py-1.5 text-xs text-white font-medium rounded bg-[#94B8B3] hover:bg-[#7da39e] transition-colors"
                >
                  Complete
                </button>
              </>
            )}
            {!canComplete && !canRevert && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium rounded hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
