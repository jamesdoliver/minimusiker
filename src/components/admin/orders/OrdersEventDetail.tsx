'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import WelleColumn from './WelleColumn';
import type { WaveOrder } from './OrderCard';

// ---------------------------------------------------------------------------
// Types matching the API response from /api/admin/orders/events/[eventId]
// ---------------------------------------------------------------------------

interface WelleSummary {
  deadline: string;
  orderCount: number;
  itemSummary: Record<string, number>;
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
  orders: WaveOrder[];
}

interface EventOrdersData {
  eventRecordId: string;
  eventId: string;
  schoolName: string;
  eventDate: string;
  welle1: WelleSummary;
  welle2: WelleSummary;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrdersEventDetailProps {
  eventId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrdersEventDetail({ eventId }: OrdersEventDetailProps) {
  const [data, setData] = useState<EventOrdersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEventOrders() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/orders/events/${eventId}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.error || `Failed to load event orders (${res.status})`,
          );
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to load event orders');
        }

        setData(json.data);
      } catch (err) {
        console.error('Error fetching event orders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event orders');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventOrders();
  }, [eventId]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div>
        <BackLink />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <p className="text-red-600">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalOrders = data.welle1.orderCount + data.welle2.orderCount;

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Back link + event info header                                     */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <BackLink />

        <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left -- school name & event date */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {data.schoolName}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {formatDate(data.eventDate, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Right -- total order count */}
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Split-screen Welle columns                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WelleColumn
          title="Welle 1"
          orders={data.welle1.orders}
          accentColor="teal"
        />
        <WelleColumn
          title="Welle 2"
          orders={data.welle2.orders}
          accentColor="amber"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BackLink
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/admin/orders"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to Orders
    </Link>
  );
}
