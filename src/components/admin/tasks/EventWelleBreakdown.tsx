'use client';

import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types (match the API response shape)
// ---------------------------------------------------------------------------

interface WelleSummary {
  deadline: string;
  orderCount: number;
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
}

interface EventWelleBreakdownProps {
  eventId: string;
  welle1Summary: WelleSummary;
  welle2Summary: WelleSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FULFILLMENT_STYLES: Record<string, { label: string; className: string }> = {
  unfulfilled: {
    label: 'Unfulfilled',
    className: 'bg-gray-100 text-gray-600',
  },
  partial: {
    label: 'Partially fulfilled',
    className: 'bg-yellow-100 text-yellow-700',
  },
  fulfilled: {
    label: 'Fulfilled',
    className: 'bg-green-100 text-green-700',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventWelleBreakdown({
  eventId,
  welle1Summary,
  welle2Summary,
}: EventWelleBreakdownProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Welle Breakdown</h2>
          <p className="text-sm text-gray-500 mt-0.5">Shipment wave order summary</p>
        </div>
        <Link
          href={`/admin/orders/${eventId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          View in Orders
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        <WelleColumn label="Welle 1" summary={welle1Summary} accentColor="teal" />
        <WelleColumn label="Welle 2" summary={welle2Summary} accentColor="amber" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WelleColumn — one column for a single wave
// ---------------------------------------------------------------------------

interface WelleColumnProps {
  label: string;
  summary: WelleSummary;
  accentColor: 'teal' | 'amber';
}

const ACCENT_STYLES = {
  teal: {
    headerBg: 'bg-teal-50',
    headerText: 'text-teal-700',
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
  },
  amber: {
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
  },
};

function WelleColumn({ label, summary, accentColor }: WelleColumnProps) {
  const accent = ACCENT_STYLES[accentColor];
  const fulfillment = FULFILLMENT_STYLES[summary.fulfillmentStatus] || FULFILLMENT_STYLES.unfulfilled;

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div className={cn('px-6 py-3 flex items-center gap-2', accent.headerBg)}>
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', accent.iconBg)}>
          <svg className={cn('w-4 h-4', accent.iconText)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <span className={cn('text-sm font-semibold', accent.headerText)}>{label}</span>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 space-y-4 flex-1">
        {/* Deadline */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Deadline</span>
          <span className="text-sm font-medium text-gray-900">
            {summary.deadline
              ? formatDate(summary.deadline, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not set'}
          </span>
        </div>

        {/* Order count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Orders</span>
          <span className="text-sm font-medium text-gray-900">
            {summary.orderCount}
          </span>
        </div>

        {/* Fulfillment status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Fulfillment</span>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              fulfillment.className,
            )}
          >
            {fulfillment.label}
          </span>
        </div>
      </div>
    </div>
  );
}
