'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import type { TaskMatrixCell } from '@/lib/types/tasks';
import { getTimelineEntry, PREFIX_STYLES } from '@/lib/config/taskTimeline';
import type { MasterCdData } from '@/lib/services/masterCdService';

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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function trackStatusBadge(status: string) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Ready
      </span>
    );
  }
  if (status === 'processing' || status === 'pending') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">
        <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Processing
      </span>
    );
  }
  // missing / error
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Missing
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

  // Master CD state
  const isMasterCd = templateId === 'audio_master_cd';
  const [tracklist, setTracklist] = useState<MasterCdData | null>(null);
  const [isLoadingTracklist, setIsLoadingTracklist] = useState(false);
  const [tracklistError, setTracklistError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

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

  // Fetch tracklist for Master CD tasks
  const fetchTracklist = useCallback(async () => {
    if (!isMasterCd) return;
    setIsLoadingTracklist(true);
    setTracklistError(null);
    try {
      const res = await fetch(`/api/admin/tasks/tracklist?eventId=${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }
      const json = await res.json();
      if (json.success) {
        setTracklist(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch tracklist');
      }
    } catch (err) {
      setTracklistError(err instanceof Error ? err.message : 'Failed to load tracklist');
    } finally {
      setIsLoadingTracklist(false);
    }
  }, [eventId, isMasterCd]);

  useEffect(() => {
    fetchOrderData();
    fetchTracklist();
  }, [fetchOrderData, fetchTracklist]);

  // Download all tracks
  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setDownloadProgress(null);

    try {
      const res = await fetch(`/api/admin/tasks/download?eventId=${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to get download URLs');

      const tracks: Array<{ trackNumber: number; filename: string; url: string }> = json.data.tracks;
      setDownloadProgress({ current: 0, total: tracks.length });

      for (let i = 0; i < tracks.length; i++) {
        const { url, filename } = tracks[i];
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadProgress({ current: i + 1, total: tracks.length });

        if (i < tracks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      setTracklistError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  // Position below the anchor, centred horizontally
  const popoverWidth = isOrderTask ? 384 : isMasterCd ? 448 : 288;
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

  // For Master CD: gate completion on all tracks ready (empty CD is allowed)
  const masterCdCanComplete = isMasterCd
    ? (tracklist?.allReady ?? false) || tracklist?.totalCount === 0
    : true;

  return (
    <div
      ref={popoverRef}
      style={style}
      className={cn(
        'bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden',
        isMasterCd ? 'w-[28rem]' : isOrderTask ? 'w-96' : 'w-72',
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

        {/* Master CD Tracklist Section */}
        {isMasterCd && (
          <div className="border-t border-gray-100 pt-2.5 mt-2.5">
            {isLoadingTracklist ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Loading tracklist...
              </div>
            ) : tracklistError && !tracklist ? (
              <div className="space-y-1.5">
                <p className="text-xs text-red-600">{tracklistError}</p>
                <button
                  type="button"
                  onClick={fetchTracklist}
                  className="text-xs text-red-700 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : tracklist ? (
              <div className="space-y-2">
                {/* Track readiness header */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Tracks</span>
                  <span
                    className={cn(
                      'font-semibold',
                      tracklist.allReady ? 'text-green-600' : 'text-amber-600',
                    )}
                  >
                    {tracklist.readyCount}/{tracklist.totalCount} ready
                  </span>
                </div>

                {tracklist.totalCount === 0 ? (
                  <p className="text-xs text-gray-400">No tracks configured</p>
                ) : (
                  <>
                    {/* Compact tracklist table */}
                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-2 py-1 text-gray-500 font-medium w-6">#</th>
                            <th className="px-2 py-1 text-gray-500 font-medium">Title</th>
                            <th className="px-2 py-1 text-gray-500 font-medium">Class</th>
                            <th className="px-2 py-1 text-gray-500 font-medium text-right w-10">Dur</th>
                            <th className="px-2 py-1 text-gray-500 font-medium text-center w-16">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {tracklist.tracks.map((track) => (
                            <tr key={track.songId} className="hover:bg-gray-50">
                              <td className="px-2 py-1 font-mono text-gray-400">
                                {track.trackNumber}
                              </td>
                              <td className="px-2 py-1 text-gray-900 font-medium truncate max-w-[120px]">
                                {track.title}
                              </td>
                              <td className="px-2 py-1 text-gray-500 truncate max-w-[80px]">
                                {track.className}
                              </td>
                              <td className="px-2 py-1 text-gray-400 text-right font-mono">
                                {track.durationSeconds
                                  ? formatDuration(track.durationSeconds)
                                  : '\u2014'}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {trackStatusBadge(track.status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Download All button */}
                    <button
                      type="button"
                      onClick={handleDownloadAll}
                      disabled={isDownloading || tracklist.readyCount === 0}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#94B8B3] border border-[#94B8B3] rounded hover:bg-[#94B8B3]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-[#94B8B3] border-t-transparent rounded-full animate-spin" />
                          {downloadProgress
                            ? `${downloadProgress.current}/${downloadProgress.total} downloading...`
                            : 'Preparing...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download All ({tracklist.readyCount})
                        </>
                      )}
                    </button>

                    {/* Inline error for download/tracklist operations */}
                    {tracklistError && tracklist && (
                      <p className="text-[11px] text-red-600">{tracklistError}</p>
                    )}
                  </>
                )}

                {/* Completion gate message */}
                {canComplete && !tracklist.allReady && tracklist.totalCount > 0 && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    All tracks must be ready to complete
                  </p>
                )}
              </div>
            ) : null}
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
                  disabled={isMasterCd && !masterCdCanComplete}
                  onClick={() =>
                    onAction('complete', isMasterCd
                      ? { completion_data: { tracklist_verified: true } }
                      : undefined
                    )
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs text-white font-medium rounded transition-colors',
                    isMasterCd && !masterCdCanComplete
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#94B8B3] hover:bg-[#7da39e]',
                  )}
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
