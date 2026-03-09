'use client';

import { useCallback, useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import type { TaskMatrixRow, TaskMatrixCell as TaskMatrixCellType } from '@/lib/types/tasks';
import {
  TASK_TIMELINE,
  TASK_TIMELINE_ORDER,
  PREFIX_STYLES,
} from '@/lib/config/taskTimeline';
import TaskMatrixCell from './TaskMatrixCell';
import TaskMatrixPopover from './TaskMatrixPopover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskMatrixProps {
  rows: TaskMatrixRow[];
  isLoading: boolean;
  onTaskAction?: (
    action: string,
    eventId: string,
    templateId: string,
    taskId: string | null,
  ) => void;
}

interface PopoverState {
  cell: TaskMatrixCellType;
  templateId: string;
  eventId: string;
  anchorRect: DOMRect;
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {/* Event info cell */}
      <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10">
        <div className="space-y-1.5">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-2 w-24 bg-gray-100 rounded-full" />
        </div>
      </td>
      {/* Progress cell */}
      <td className="px-2 py-2 whitespace-nowrap sticky left-[180px] bg-white z-10 border-r border-gray-200">
        <div className="h-4 w-10 bg-gray-200 rounded mx-auto" />
      </td>
      {/* Task cells */}
      {TASK_TIMELINE_ORDER.map((id) => (
        <td key={id} className="px-1 py-2">
          <div className="w-10 h-10 bg-gray-100 rounded mx-auto" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskMatrix({
  rows,
  isLoading,
  onTaskAction,
}: TaskMatrixProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // Handle cell click — open popover
  const handleCellClick = useCallback(
    (
      cell: TaskMatrixCellType,
      templateId: string,
      eventId: string,
      anchorEl: HTMLElement,
    ) => {
      const rect = anchorEl.getBoundingClientRect();
      setPopover({ cell, templateId, eventId, anchorRect: rect });
    },
    [],
  );

  // Handle popover action
  const handlePopoverAction = useCallback(
    (action: string) => {
      if (!popover) return;
      onTaskAction?.(action, popover.eventId, popover.templateId, popover.cell.taskId);
      setPopover(null);
    },
    [popover, onTaskAction],
  );

  return (
    <div className="relative">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full border-collapse">
          {/* ---------------------------------------------------------------- */}
          {/* Header */}
          {/* ---------------------------------------------------------------- */}
          <thead>
            <tr className="bg-gray-50">
              {/* Sticky event-info column header */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 min-w-[180px]">
                Event
              </th>
              {/* Sticky progress column header */}
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[180px] bg-gray-50 z-20 border-r border-gray-200 min-w-[60px]">
                Done
              </th>
              {/* One column per task in the timeline */}
              {TASK_TIMELINE.map((entry) => {
                const style = PREFIX_STYLES[entry.prefix];
                return (
                  <th
                    key={entry.id}
                    className={cn(
                      'px-1 py-2 text-center text-[10px] leading-tight font-medium min-w-[52px]',
                      style.text,
                    )}
                  >
                    <div
                      className={cn(
                        'rounded px-1 py-1 border',
                        style.bg,
                      )}
                    >
                      <span className="block font-semibold truncate">
                        {entry.name}
                      </span>
                      <span className="block text-[9px] opacity-70">
                        {entry.offset >= 0 ? '+' : ''}
                        {entry.offset}d
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ---------------------------------------------------------------- */}
          {/* Body */}
          {/* ---------------------------------------------------------------- */}
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + TASK_TIMELINE_ORDER.length}
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  No events found
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const progressPct =
                  row.totalCount > 0
                    ? Math.round(
                        (row.completedCount / row.totalCount) * 100,
                      )
                    : 0;

                return (
                  <tr
                    key={row.eventId}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Sticky event info */}
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10 group-hover:bg-gray-50 min-w-[180px]">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                        {row.schoolName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(row.eventDate, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </td>

                    {/* Sticky progress */}
                    <td className="px-2 py-2 whitespace-nowrap sticky left-[180px] bg-white z-10 border-r border-gray-200 min-w-[60px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-gray-700">
                          {row.completedCount}/{row.totalCount}
                        </span>
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              progressPct === 100
                                ? 'bg-green-500'
                                : progressPct >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-gray-400',
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Task cells */}
                    {TASK_TIMELINE_ORDER.map((templateId) => {
                      const cell = row.cells[templateId];
                      if (!cell) {
                        // No data for this cell — render empty grey placeholder
                        return (
                          <td key={templateId} className="px-1 py-2">
                            <div className="w-10 h-10 rounded bg-gray-50 border border-gray-200 mx-auto" />
                          </td>
                        );
                      }
                      return (
                        <td key={templateId} className="px-1 py-2">
                          <div className="flex justify-center">
                            <TaskMatrixCell
                              cell={cell}
                              templateId={templateId}
                              onAction={(_action, _id, anchorEl) =>
                                handleCellClick(
                                  cell,
                                  templateId,
                                  row.eventId,
                                  anchorEl,
                                )
                              }
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Popover (rendered at root level for correct z-index stacking) */}
      {popover && (
        <TaskMatrixPopover
          cell={popover.cell}
          templateId={popover.templateId}
          eventId={popover.eventId}
          anchorRect={popover.anchorRect}
          onClose={() => setPopover(null)}
          onAction={handlePopoverAction}
        />
      )}
    </div>
  );
}
