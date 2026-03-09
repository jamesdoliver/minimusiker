'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TaskWithEventDetails } from '@/lib/types/tasks';
import TaskDateGroup from './TaskDateGroup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'week' | 'month';

interface TaskDateViewProps {
  onTaskAction?: (action: string, task: TaskWithEventDetails) => void;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Return Monday of the week containing `date` */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // Mon = 1
  d.setDate(d.getDate() + diff);
  return d;
}

/** Return Sunday of the week containing `date` */
function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Return the first day of the month containing `date` */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Return the last day of the month containing `date` */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Format a date as YYYY-MM-DD */
function toDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Short format: "Mar 10" */
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonGroup() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white"
          >
            <div className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDateView({ onTaskAction }: TaskDateViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [tasksByDate, setTasksByDate] = useState<
    Record<string, TaskWithEventDetails[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  // Compute the date range based on viewMode + currentDate
  const { dateFrom, dateTo } = useMemo(() => {
    if (viewMode === 'week') {
      return {
        dateFrom: toDateString(startOfWeek(currentDate)),
        dateTo: toDateString(endOfWeek(currentDate)),
      };
    }
    return {
      dateFrom: toDateString(startOfMonth(currentDate)),
      dateTo: toDateString(endOfMonth(currentDate)),
    };
  }, [viewMode, currentDate]);

  // Human-readable range label
  const rangeLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      const sameYear = start.getFullYear() === end.getFullYear();
      return `${shortDate(start)} - ${shortDate(end)}, ${end.getFullYear()}${
        !sameYear ? ` (${start.getFullYear()})` : ''
      }`;
    }
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewMode, currentDate]);

  // Fetch tasks when date range changes
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/tasks/by-date?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setTasksByDate(json.data?.tasksByDate ?? {});
    } catch (err) {
      console.error('TaskDateView fetch error:', err);
      setTasksByDate({});
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Sort date keys chronologically
  const sortedDates = useMemo(
    () => Object.keys(tasksByDate).sort(),
    [tasksByDate],
  );

  // Navigation handlers
  const goNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const goPrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  // Default handler that logs if no external handler provided
  const handleTaskAction = useCallback(
    (action: string, task: TaskWithEventDetails) => {
      onTaskAction?.(action, task);
    },
    [onTaskAction],
  );

  // Total task count for the period
  const totalTasks = useMemo(
    () => Object.values(tasksByDate).reduce((sum, arr) => sum + arr.length, 0),
    [tasksByDate],
  );

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Toolbar: view toggle, navigation, range label */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
          >
            This Month
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Previous"
          >
            <svg
              className="w-5 h-5"
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
          </button>

          <button
            type="button"
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            Today
          </button>

          <button
            type="button"
            onClick={goNext}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Next"
          >
            <svg
              className="w-5 h-5"
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
          </button>

          <span className="text-sm font-medium text-gray-800 ml-1">
            {rangeLabel}
          </span>

          {!isLoading && (
            <span className="text-xs text-gray-400 ml-2">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content area */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        <div>
          <SkeletonGroup />
          <SkeletonGroup />
          <SkeletonGroup />
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">(no tasks this period)</p>
        </div>
      ) : (
        <div>
          {sortedDates.map((dateKey) => (
            <TaskDateGroup
              key={dateKey}
              date={dateKey}
              tasks={tasksByDate[dateKey]}
              onTaskAction={handleTaskAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
