'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventDetailTimeline from '@/components/admin/tasks/EventDetailTimeline';
import EventWelleBreakdown from '@/components/admin/tasks/EventWelleBreakdown';
import type { TaskWithEventDetails } from '@/lib/types/tasks';

// ---------------------------------------------------------------------------
// Types (match the API response shape from /api/admin/tasks/events/[eventId])
// ---------------------------------------------------------------------------

interface EventInfo {
  eventId: string;
  schoolName: string;
  eventDate: string;
}

interface WelleSummary {
  deadline: string;
  orderCount: number;
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
}

interface EventDetailData {
  event: EventInfo;
  tasks: TaskWithEventDetails[];
  welle1Summary: WelleSummary;
  welle2Summary: WelleSummary;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);

  const [data, setData] = useState<EventDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEventData() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/tasks/events/${eventId}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || `Failed to load event (${res.status})`
          );
        }

        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Failed to load event data');
        }

        setData(json.data);
      } catch (err) {
        console.error('Error fetching event detail:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventData();
  }, [eventId]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

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

  const { event, tasks, welle1Summary, welle2Summary } = data;

  // Compute progress
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;

  // Determine if event date is in the past
  const eventDateObj = new Date(event.eventDate);
  eventDateObj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = eventDateObj < today;
  const daysAway = Math.round(
    (eventDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1 — Event info bar                                         */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <BackLink />

        <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left — school name & event date */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {event.schoolName}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(event.eventDate, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    isPast
                      ? 'bg-gray-100 text-gray-600'
                      : daysAway <= 7
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700',
                  )}
                >
                  {isPast
                    ? `${Math.abs(daysAway)} day${Math.abs(daysAway) !== 1 ? 's' : ''} ago`
                    : daysAway === 0
                      ? 'Today'
                      : `${daysAway} day${daysAway !== 1 ? 's' : ''} away`}
                </span>
              </div>
            </div>

            {/* Right — progress */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Progress</p>
                <p className="text-lg font-semibold text-gray-900">
                  {completedCount}
                  <span className="text-gray-400">/{totalCount}</span>
                </p>
              </div>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#94B8B3] rounded-full transition-all"
                  style={{
                    width: totalCount > 0
                      ? `${Math.round((completedCount / totalCount) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 2 — Timeline                                               */}
      {/* ----------------------------------------------------------------- */}
      <EventDetailTimeline tasks={tasks} eventDate={event.eventDate} />

      {/* ----------------------------------------------------------------- */}
      {/* Section 3 — Welle Breakdown                                        */}
      {/* ----------------------------------------------------------------- */}
      <EventWelleBreakdown
        eventId={eventId}
        welle1Summary={welle1Summary}
        welle2Summary={welle2Summary}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BackLink — simple nav back to /admin/tasks
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/admin/tasks"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Tasks
    </Link>
  );
}
