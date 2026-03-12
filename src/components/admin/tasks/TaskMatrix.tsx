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
import MasterCdModal from './MasterCdModal';

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
    data?: Record<string, unknown>,
  ) => void;
}

interface PopoverState {
  cell: TaskMatrixCellType;
  templateId: string;
  eventId: string;
  anchorRect: DOMRect;
}

interface ModalState {
  cell: TaskMatrixCellType;
  templateId: string;
  eventId: string;
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
        </div>
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
  const [modal, setModal] = useState<ModalState | null>(null);

  // Handle cell click — open modal for Master CD, popover for others
  const handleCellClick = useCallback(
    (
      cell: TaskMatrixCellType,
      templateId: string,
      eventId: string,
      anchorEl: HTMLElement,
    ) => {
      if (templateId === 'audio_master_cd') {
        setModal({ cell, templateId, eventId });
      } else {
        const rect = anchorEl.getBoundingClientRect();
        setPopover({ cell, templateId, eventId, anchorRect: rect });
      }
    },
    [],
  );

  // Handle popover action
  const handlePopoverAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (!popover) return;
      onTaskAction?.(action, popover.eventId, popover.templateId, popover.cell.taskId, data);
      setPopover(null);
    },
    [popover, onTaskAction],
  );

  // Handle modal action
  const handleModalAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (!modal) return;
      onTaskAction?.(action, modal.eventId, modal.templateId, modal.cell.taskId, data);
    },
    [modal, onTaskAction],
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
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 min-w-[180px] border-r border-gray-200">
                Event
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
                  colSpan={1 + TASK_TIMELINE_ORDER.length}
                  className="px-6 py-12 text-center text-sm text-gray-500"
                >
                  No events found
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                return (
                  <tr
                    key={row.eventId}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Sticky event info */}
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10 group-hover:bg-gray-50 min-w-[180px] border-r border-gray-200">
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

      {/* Master CD Modal */}
      {modal && (
        <MasterCdModal
          cell={modal.cell}
          templateId={modal.templateId}
          eventId={modal.eventId}
          onClose={() => setModal(null)}
          onAction={handleModalAction}
        />
      )}
    </div>
  );
}
