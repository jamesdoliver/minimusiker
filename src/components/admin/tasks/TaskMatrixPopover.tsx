'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import type { TaskMatrixCell } from '@/lib/types/tasks';
import { getTimelineEntry, PREFIX_STYLES } from '@/lib/config/taskTimeline';

interface TaskMatrixPopoverProps {
  cell: TaskMatrixCell;
  templateId: string;
  eventId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onAction: (action: string) => void;
}

export default function TaskMatrixPopover({
  cell,
  templateId,
  eventId,
  anchorRect,
  onClose,
  onAction,
}: TaskMatrixPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click-outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const entry = getTimelineEntry(templateId);
  const prefixStyle = entry ? PREFIX_STYLES[entry.prefix] : null;

  // Position below the anchor, centred horizontally
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 50,
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - 140),
  };

  // If popover would go off bottom of screen, show above instead
  if (anchorRect.bottom + 220 > window.innerHeight) {
    style.bottom = window.innerHeight - anchorRect.top + 8;
  } else {
    style.top = anchorRect.bottom + 8;
  }

  const isCompleted = cell.cellStatus === 'green';
  const canComplete =
    cell.cellStatus !== 'green' && cell.cellStatus !== 'grey';

  return (
    <div
      ref={popoverRef}
      style={style}
      className="w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-2.5 border-b',
          prefixStyle ? prefixStyle.bg : 'bg-gray-50 border-gray-200',
        )}
      >
        <p
          className={cn(
            'text-sm font-semibold',
            prefixStyle ? prefixStyle.text : 'text-gray-700',
          )}
        >
          {entry?.displayName || templateId}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Deadline */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Deadline</span>
          <span className="font-medium text-gray-900">
            {cell.deadline
              ? formatDate(cell.deadline, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A'}
          </span>
        </div>

        {/* Days until due */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Status</span>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Completed
            </span>
          ) : cell.cellStatus === 'grey' ? (
            <span className="text-xs text-gray-400 font-medium">
              Not applicable
            </span>
          ) : cell.daysUntilDue < 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {Math.abs(cell.daysUntilDue)}d overdue
            </span>
          ) : cell.daysUntilDue === 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              Due today
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {cell.daysUntilDue}d remaining
            </span>
          )}
        </div>

        {/* Completed At */}
        {cell.completedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Completed</span>
            <span className="text-gray-700">
              {formatDate(cell.completedAt, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
        <Link
          href={`/admin/tasks/${eventId}`}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          View event details
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium rounded hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          {canComplete && (
            <button
              type="button"
              onClick={() => onAction('complete')}
              className="px-3 py-1.5 text-xs text-white font-medium rounded bg-[#94B8B3] hover:bg-[#7da39e] transition-colors"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
