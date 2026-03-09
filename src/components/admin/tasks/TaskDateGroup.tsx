'use client';

import { cn } from '@/lib/utils';
import type { TaskWithEventDetails, TaskCellStatus } from '@/lib/types/tasks';
import { getTimelineEntry, PREFIX_STYLES } from '@/lib/config/taskTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDateGroupProps {
  date: string;
  tasks: TaskWithEventDetails[];
  onTaskAction: (action: string, task: TaskWithEventDetails) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a YYYY-MM-DD date string as a readable label with relative-day support */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  if (diffDays === 0) return `Today - ${formatted}`;
  if (diffDays === 1) return `Tomorrow - ${formatted}`;
  if (diffDays === -1) return `Yesterday - ${formatted}`;

  return formatted;
}

/** Derive a cell-style status colour for a task */
function getTaskCellStatus(task: TaskWithEventDetails): TaskCellStatus {
  if (task.status === 'completed') return 'green';
  if (task.is_overdue) return 'red';
  if (task.days_until_due <= 3) return 'yellow';
  return 'white';
}

/** Tailwind classes for the status dot */
const STATUS_DOT_STYLES: Record<TaskCellStatus, string> = {
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  white: 'bg-gray-300',
  grey: 'bg-gray-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDateGroup({
  date,
  tasks,
  onTaskAction,
}: TaskDateGroupProps) {
  const label = formatDateLabel(date);

  // Check if date is today/past for header styling
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateObj = new Date(date + 'T00:00:00');
  const isPast = dateObj < today;
  const isToday = dateObj.getTime() === today.getTime();

  return (
    <div className="mb-6">
      {/* Date header */}
      <div
        className={cn(
          'flex items-center gap-2 mb-2 px-1',
          isToday && 'text-blue-700',
          isPast && !isToday && 'text-gray-500',
        )}
      >
        <h3
          className={cn(
            'text-sm font-semibold',
            isToday && 'text-blue-700',
            isPast && !isToday && 'text-gray-500',
            !isPast && !isToday && 'text-gray-800',
          )}
        >
          {label}
        </h3>
        <span className="text-xs text-gray-400">
          ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {tasks.map((task) => {
          const cellStatus = getTaskCellStatus(task);
          const entry = getTimelineEntry(task.template_id);
          const prefixStyle = entry
            ? PREFIX_STYLES[entry.prefix]
            : null;

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskAction('open_detail', task)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors',
                'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1',
                cellStatus === 'red'
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-gray-200 bg-white',
              )}
            >
              {/* Status dot */}
              <span
                className={cn(
                  'flex-shrink-0 w-2.5 h-2.5 rounded-full',
                  STATUS_DOT_STYLES[cellStatus],
                )}
              />

              {/* Task name with prefix colouring */}
              <span
                className={cn(
                  'text-sm font-medium truncate',
                  prefixStyle ? prefixStyle.text : 'text-gray-800',
                )}
              >
                {entry ? entry.displayName : task.task_name}
              </span>

              {/* School name */}
              <span className="text-xs text-gray-500 truncate ml-auto flex-shrink-0 max-w-[200px]">
                {task.school_name}
              </span>

              {/* Overdue indicator */}
              {task.is_overdue && task.status !== 'completed' && (
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Overdue
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
