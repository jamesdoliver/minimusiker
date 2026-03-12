'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TaskWithEventDetails, TaskMatrixCell as TaskMatrixCellType } from '@/lib/types/tasks';
import TaskDateGroup, { getTaskCellStatus } from './TaskDateGroup';
import TaskMatrixPopover from './TaskMatrixPopover';
import MasterCdModal from './MasterCdModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'week' | 'month';

interface PopoverState {
  task: TaskWithEventDetails;
  anchorRect: DOMRect;
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

export default function TaskDateView() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [tasksByDate, setTasksByDate] = useState<
    Record<string, TaskWithEventDetails[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [masterCdModal, setMasterCdModal] = useState<TaskWithEventDetails | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Handle task row click — open modal for Master CD, popover for others
  const handleTaskAction = useCallback(
    (action: string, task: TaskWithEventDetails, anchorEl?: HTMLElement) => {
      if (action === 'open_detail') {
        if (task.template_id === 'audio_master_cd') {
          setMasterCdModal(task);
        } else if (anchorEl) {
          const rect = anchorEl.getBoundingClientRect();
          setPopover({ task, anchorRect: rect });
        }
      }
    },
    [],
  );

  // Convert TaskWithEventDetails to TaskMatrixCell for the popover
  const popoverCell: TaskMatrixCellType | null = useMemo(() => {
    if (!popover) return null;
    const task = popover.task;
    return {
      taskId: task.id.startsWith('virtual_') ? null : task.id,
      templateId: task.template_id,
      status: task.status,
      cellStatus: getTaskCellStatus(task),
      deadline: task.deadline,
      daysUntilDue: task.days_until_due,
      completedAt: task.completed_at,
    };
  }, [popover]);

  // Convert masterCdModal task to TaskMatrixCell
  const masterCdModalCell: TaskMatrixCellType | null = useMemo(() => {
    if (!masterCdModal) return null;
    return {
      taskId: masterCdModal.id.startsWith('virtual_') ? null : masterCdModal.id,
      templateId: masterCdModal.template_id,
      status: masterCdModal.status,
      cellStatus: getTaskCellStatus(masterCdModal),
      deadline: masterCdModal.deadline,
      daysUntilDue: masterCdModal.days_until_due,
      completedAt: masterCdModal.completed_at,
    };
  }, [masterCdModal]);

  // Handle Master CD modal actions
  const handleMasterCdAction = useCallback(
    async (action: string, data?: Record<string, unknown>) => {
      if (!masterCdModal) return;
      const task = masterCdModal;
      const isVirtual = task.id.startsWith('virtual_');
      const taskId = isVirtual ? null : task.id;
      const eventId = task.event_id;
      const templateId = task.template_id;

      setActionError(null);

      try {
        if (action === 'complete') {
          const completionData = (data?.completion_data as Record<string, unknown>) || {};
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ completion_data: completionData }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, completion_data: completionData }),
            });
          }
        } else if (action === 'skip') {
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'skipped' }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, status: 'skipped' }),
            });
          }
        } else if (action === 'partial') {
          const notes = (data?.notes as string) || '';
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'partial', completion_data: { notes } }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, status: 'partial', completion_data: { notes } }),
            });
          }
        } else if (action === 'revert') {
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'pending' }),
            });
          }
        }
        setMasterCdModal(null);
        await fetchTasks();
      } catch (err) {
        console.error('Error performing task action:', err);
        setActionError(
          err instanceof Error ? err.message : 'Failed to perform task action',
        );
      }
    },
    [masterCdModal, fetchTasks],
  );

  // Handle popover actions
  const handlePopoverAction = useCallback(
    async (action: string, data?: Record<string, unknown>) => {
      if (!popover) return;
      const task = popover.task;
      const isVirtual = task.id.startsWith('virtual_');
      const taskId = isVirtual ? null : task.id;
      const eventId = task.event_id;
      const templateId = task.template_id;

      setPopover(null);
      setActionError(null);

      try {
        if (action === 'complete') {
          const completionData = (data?.completion_data as Record<string, unknown>) || {};
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ completion_data: completionData }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, completion_data: completionData }),
            });
          }
        } else if (action === 'skip') {
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'skipped' }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, status: 'skipped' }),
            });
          }
        } else if (action === 'partial') {
          const notes = (data?.notes as string) || '';
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'partial', completion_data: { notes } }),
            });
          } else {
            await fetch('/api/admin/tasks/matrix/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ eventId, templateId, status: 'partial', completion_data: { notes } }),
            });
          }
        } else if (action === 'revert') {
          if (taskId) {
            await fetch(`/api/admin/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: 'pending' }),
            });
          }
        }
        await fetchTasks();
      } catch (err) {
        console.error('Error performing task action:', err);
        setActionError(
          err instanceof Error ? err.message : 'Failed to perform task action',
        );
      }
    },
    [popover, fetchTasks],
  );

  // Total task count for the period
  const totalTasks = useMemo(
    () => Object.values(tasksByDate).reduce((sum, arr) => sum + arr.length, 0),
    [tasksByDate],
  );

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-red-600">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-600 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Popover (rendered at root level for correct z-index stacking) */}
      {popover && popoverCell && (
        <TaskMatrixPopover
          cell={popoverCell}
          templateId={popover.task.template_id}
          eventId={popover.task.event_id}
          anchorRect={popover.anchorRect}
          onClose={() => setPopover(null)}
          onAction={handlePopoverAction}
        />
      )}

      {/* Master CD Modal */}
      {masterCdModal && masterCdModalCell && (
        <MasterCdModal
          cell={masterCdModalCell}
          templateId={masterCdModal.template_id}
          eventId={masterCdModal.event_id}
          onClose={() => setMasterCdModal(null)}
          onAction={handleMasterCdAction}
        />
      )}
    </div>
  );
}
