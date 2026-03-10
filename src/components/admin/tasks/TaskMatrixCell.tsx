'use client';

import { cn } from '@/lib/utils';
import type { TaskMatrixCell as TaskMatrixCellType } from '@/lib/types/tasks';

/** Tailwind classes for each cell status colour */
const CELL_STATUS_STYLES: Record<TaskMatrixCellType['cellStatus'], string> = {
  white: 'bg-white border border-gray-200',
  yellow: 'bg-yellow-100 border border-yellow-400',
  red: 'bg-red-100 border border-red-400',
  green: 'bg-green-100 border border-green-400',
  grey: 'bg-gray-100 border border-gray-300',
  orange: 'bg-orange-100 border border-orange-400',
};

interface TaskMatrixCellProps {
  cell: TaskMatrixCellType;
  templateId: string;
  onAction: (action: string, taskId: string, anchorEl: HTMLElement) => void;
}

export default function TaskMatrixCell({
  cell,
  templateId,
  onAction,
}: TaskMatrixCellProps) {
  return (
    <button
      type="button"
      onClick={(e) =>
        onAction('open_popover', cell.taskId || templateId, e.currentTarget)
      }
      className={cn(
        'w-10 h-10 rounded flex items-center justify-center transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 cursor-pointer',
        CELL_STATUS_STYLES[cell.cellStatus],
      )}
      aria-label={`Task ${templateId} — ${cell.cellStatus}`}
    >
      {cell.cellStatus === 'green' && (
        <svg
          className="w-4 h-4 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {cell.cellStatus === 'orange' && (
        <span className="text-orange-600 text-xs font-bold">~</span>
      )}
      {cell.cellStatus === 'grey' && cell.status === 'skipped' && (
        <span className="text-gray-400 text-xs font-bold">&mdash;</span>
      )}
    </button>
  );
}
