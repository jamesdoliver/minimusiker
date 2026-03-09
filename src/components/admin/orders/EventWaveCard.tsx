'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { EventWaveSummary } from '@/lib/services/orderWaveService';

interface EventWaveCardProps {
  event: EventWaveSummary;
}

function formatDate(dateString: string): string {
  if (!dateString) return 'No date';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function totalItems(itemSummary: Record<string, number>): number {
  return Object.values(itemSummary).reduce((sum, qty) => sum + qty, 0);
}

function getFulfillmentBadge(status: 'unfulfilled' | 'partial' | 'fulfilled') {
  switch (status) {
    case 'fulfilled':
      return { label: 'Fulfilled', className: 'bg-green-100 text-green-700' };
    case 'partial':
      return { label: 'Partial', className: 'bg-yellow-100 text-yellow-700' };
    case 'unfulfilled':
      return { label: 'Unfulfilled', className: 'bg-gray-100 text-gray-600' };
  }
}

function isDeadlinePast(deadline: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function EventWaveCard({ event }: EventWaveCardProps) {
  return (
    <Link
      href={`/admin/orders/${encodeURIComponent(event.eventRecordId)}`}
      className={cn(
        'block bg-white rounded-xl shadow-sm border border-gray-100',
        'transition-all duration-200',
        'hover:shadow-md hover:ring-2 hover:ring-[#94B8B3]/30 hover:-translate-y-0.5',
        'cursor-pointer'
      )}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight line-clamp-1">
            {event.schoolName || 'Unknown School'}
          </h3>
          <svg
            className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">{formatDate(event.eventDate)}</p>
      </div>

      {/* Wave Panels */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        {/* Welle 1 */}
        <WavePanel
          label="Welle 1"
          accentColor="teal"
          deadline={event.welle1.deadline}
          orderCount={event.welle1.orderCount}
          itemCount={totalItems(event.welle1.itemSummary)}
          fulfillmentStatus={event.welle1.fulfillmentStatus}
        />

        {/* Welle 2 */}
        <WavePanel
          label="Welle 2"
          accentColor="amber"
          deadline={event.welle2.deadline}
          orderCount={event.welle2.orderCount}
          itemCount={totalItems(event.welle2.itemSummary)}
          fulfillmentStatus={event.welle2.fulfillmentStatus}
        />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: WavePanel
// ---------------------------------------------------------------------------

interface WavePanelProps {
  label: string;
  accentColor: 'teal' | 'amber';
  deadline: string;
  orderCount: number;
  itemCount: number;
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
}

function WavePanel({
  label,
  accentColor,
  deadline,
  orderCount,
  itemCount,
  fulfillmentStatus,
}: WavePanelProps) {
  const badge = getFulfillmentBadge(fulfillmentStatus);
  const pastDeadline = isDeadlinePast(deadline);
  const hasOrders = orderCount > 0;

  return (
    <div className="px-4 py-3">
      {/* Wave label */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            accentColor === 'teal' ? 'bg-teal-500' : 'bg-amber-500'
          )}
        />
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            accentColor === 'teal' ? 'text-teal-700' : 'text-amber-700'
          )}
        >
          {label}
        </span>
      </div>

      {hasOrders ? (
        <>
          {/* Order + Item counts */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Orders</span>
              <span className="text-sm font-semibold text-gray-900">{orderCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Items</span>
              <span className="text-sm font-semibold text-gray-900">{itemCount}</span>
            </div>
          </div>

          {/* Fulfillment badge */}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              badge.className
            )}
          >
            {badge.label}
          </span>
        </>
      ) : (
        <p className="text-xs text-gray-400 italic">No orders</p>
      )}

      {/* Deadline */}
      {deadline && (
        <p
          className={cn(
            'text-xs mt-2',
            pastDeadline ? 'text-red-500 font-medium' : 'text-gray-400'
          )}
        >
          Deadline: {formatDate(deadline)}
        </p>
      )}
    </div>
  );
}
