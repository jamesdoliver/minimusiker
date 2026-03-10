'use client';

import { useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import {
  TASK_TIMELINE_ORDER,
  getTimelineEntry,
  calculateDeadline,
  PREFIX_STYLES,
  type TaskTimelineEntry,
} from '@/lib/config/taskTimeline';
import type { TaskWithEventDetails, TaskCellStatus } from '@/lib/types/tasks';

// ---------------------------------------------------------------------------
// Status dot colours (reuses the matrix palette)
// ---------------------------------------------------------------------------

const STATUS_DOT_STYLES: Record<TaskCellStatus, string> = {
  green: 'bg-green-500',
  white: 'bg-white border-2 border-gray-300',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  grey: 'bg-gray-300',
  orange: 'bg-orange-400',
};

const STATUS_LABELS: Record<TaskCellStatus, string> = {
  green: 'Completed',
  white: 'Pending',
  yellow: 'Due soon',
  red: 'Overdue',
  grey: 'N/A',
  orange: 'Partial',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the cell status from a TaskWithEventDetails.
 * If there is no matching task record the cell is "grey" (not applicable).
 */
function deriveCellStatus(task: TaskWithEventDetails | undefined): TaskCellStatus {
  if (!task) return 'grey';
  if (task.status === 'completed') return 'green';
  if (task.status === 'cancelled' || task.status === 'skipped') return 'grey';
  if (task.status === 'partial') return 'orange';
  if (task.is_overdue) return 'red';
  if (task.days_until_due <= 3) return 'yellow';
  return 'white';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventDetailTimelineProps {
  tasks: TaskWithEventDetails[];
  eventDate: string;
}

export default function EventDetailTimeline({
  tasks,
  eventDate,
}: EventDetailTimelineProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Index tasks by template_id for fast lookup
  const taskByTemplateId = new Map<string, TaskWithEventDetails>();
  for (const task of tasks) {
    taskByTemplateId.set(task.template_id, task);
  }

  // Split tasks into pre-event and post-event groups
  const preEventEntries: TaskTimelineEntry[] = [];
  const postEventEntries: TaskTimelineEntry[] = [];
  for (const id of TASK_TIMELINE_ORDER) {
    const entry = getTimelineEntry(id);
    if (!entry) continue;
    if (entry.offset <= 0) {
      preEventEntries.push(entry);
    } else {
      postEventEntries.push(entry);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedTaskId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Task Timeline</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          All tasks relative to event day ({formatDate(eventDate, { month: 'short', day: 'numeric', year: 'numeric' })})
        </p>
      </div>

      {/* Horizontal scrollable timeline */}
      <div className="px-6 py-6 overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {/* Pre-event tasks */}
          {preEventEntries.map((entry) => {
            const task = taskByTemplateId.get(entry.id);
            const cellStatus = deriveCellStatus(task);
            return (
              <TimelineItem
                key={entry.id}
                entry={entry}
                task={task}
                cellStatus={cellStatus}
                eventDate={eventDate}
                isExpanded={expandedTaskId === entry.id}
                onToggle={() => toggleExpand(entry.id)}
              />
            );
          })}

          {/* Event Day marker */}
          <div className="flex flex-col items-center mx-2 flex-shrink-0">
            <div className="w-px h-6 bg-transparent" />
            <div className="w-10 h-10 rounded-full bg-[#94B8B3] flex items-center justify-center shadow-md ring-2 ring-[#94B8B3]/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="w-px h-3 bg-gray-300" />
            <span className="text-xs font-bold text-[#94B8B3] whitespace-nowrap mt-1">Event Day</span>
            <span className="text-[10px] text-gray-500 mt-0.5">
              {formatDate(eventDate, { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Post-event tasks */}
          {postEventEntries.map((entry) => {
            const task = taskByTemplateId.get(entry.id);
            const cellStatus = deriveCellStatus(task);
            return (
              <TimelineItem
                key={entry.id}
                entry={entry}
                task={task}
                cellStatus={cellStatus}
                eventDate={eventDate}
                isExpanded={expandedTaskId === entry.id}
                onToggle={() => toggleExpand(entry.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Expanded detail card (renders below the timeline) */}
      {expandedTaskId && (
        <ExpandedTaskCard
          entry={getTimelineEntry(expandedTaskId)!}
          task={taskByTemplateId.get(expandedTaskId)}
          eventDate={eventDate}
          onClose={() => setExpandedTaskId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineItem — a single node on the horizontal timeline
// ---------------------------------------------------------------------------

interface TimelineItemProps {
  entry: TaskTimelineEntry;
  task: TaskWithEventDetails | undefined;
  cellStatus: TaskCellStatus;
  eventDate: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function TimelineItem({
  entry,
  task,
  cellStatus,
  eventDate,
  isExpanded,
  onToggle,
}: TimelineItemProps) {
  const prefixStyle = PREFIX_STYLES[entry.prefix];
  const deadline = calculateDeadline(eventDate, entry.offset);

  return (
    <div className="flex flex-col items-center flex-shrink-0 w-28">
      {/* Offset label */}
      <span className="text-[10px] text-gray-400 font-medium mb-1">
        {entry.offset < 0 ? `${entry.offset}d` : entry.offset === 0 ? 'Day 0' : `+${entry.offset}d`}
      </span>

      {/* Status dot (clickable) */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center transition-all',
          STATUS_DOT_STYLES[cellStatus],
          isExpanded && 'ring-2 ring-offset-1 ring-blue-400 scale-110',
          'hover:scale-110 cursor-pointer',
        )}
        aria-label={`${entry.displayName} — ${STATUS_LABELS[cellStatus]}`}
      >
        {cellStatus === 'green' && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {cellStatus === 'red' && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Connecting line */}
      <div className="w-full h-px bg-gray-200 my-1.5" />

      {/* Task label */}
      <span
        className={cn('text-[11px] font-semibold text-center leading-tight', prefixStyle.text)}
      >
        {entry.name}
      </span>

      {/* Deadline */}
      <span className="text-[10px] text-gray-400 mt-0.5">
        {formatDate(deadline, { month: 'short', day: 'numeric' })}
      </span>

      {/* Status badge */}
      <div className="mt-1">
        {cellStatus === 'green' && task?.completed_at ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
            {formatDate(task.completed_at, { month: 'short', day: 'numeric' })}
          </span>
        ) : cellStatus === 'red' ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
            Overdue
          </span>
        ) : cellStatus === 'yellow' ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">
            Due soon
          </span>
        ) : cellStatus === 'grey' ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-400">
            N/A
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpandedTaskCard — shows full details + generic "Mark Complete" button
// ---------------------------------------------------------------------------

interface ExpandedTaskCardProps {
  entry: TaskTimelineEntry;
  task: TaskWithEventDetails | undefined;
  eventDate: string;
  onClose: () => void;
}

function ExpandedTaskCard({
  entry,
  task,
  eventDate,
  onClose,
}: ExpandedTaskCardProps) {
  const prefixStyle = PREFIX_STYLES[entry.prefix];
  const deadline = calculateDeadline(eventDate, entry.offset);
  const cellStatus = deriveCellStatus(task);
  const isCompleted = cellStatus === 'green';
  const canComplete = cellStatus !== 'green' && cellStatus !== 'grey';

  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const handleMarkComplete = async () => {
    if (!task) return;
    setIsCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completion_data: { confirmed: true } }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to complete task');
      }
      // Reload page to refresh data
      window.location.reload();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className={cn('text-base font-semibold', prefixStyle.text)}>
              {entry.displayName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Close details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Detail grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Deadline</span>
            <span className="font-medium text-gray-900">
              {formatDate(deadline, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Offset</span>
            <span className="font-medium text-gray-900">
              {entry.offset < 0 ? `${entry.offset} days` : `+${entry.offset} days`}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Completion Type</span>
            <span className="font-medium text-gray-900 capitalize">{entry.completion.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Status</span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                cellStatus === 'green' && 'bg-green-100 text-green-700',
                cellStatus === 'red' && 'bg-red-100 text-red-700',
                cellStatus === 'yellow' && 'bg-yellow-100 text-yellow-700',
                cellStatus === 'white' && 'bg-gray-100 text-gray-700',
                cellStatus === 'grey' && 'bg-gray-100 text-gray-400',
              )}
            >
              {STATUS_LABELS[cellStatus]}
            </span>
          </div>
        </div>

        {/* Completed info */}
        {isCompleted && task?.completed_at && (
          <div className="mt-3 text-sm text-gray-600">
            Completed on{' '}
            <span className="font-medium">
              {formatDate(task.completed_at, { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            {task.completed_by && (
              <>
                {' '}by <span className="font-medium">{task.completed_by}</span>
              </>
            )}
          </div>
        )}

        {/* Action */}
        {canComplete && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={isCompleting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors disabled:opacity-60"
            >
              {isCompleting ? 'Completing...' : 'Mark Complete'}
            </button>
            {completeError && (
              <span className="text-sm text-red-600">{completeError}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
