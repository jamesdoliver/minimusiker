'use client';

import { useState } from 'react';
import { TaskWithEventDetails } from '@/lib/types/tasks';
import TaskTypeBadge from './TaskTypeBadge';
import DeadlineCountdown from './DeadlineCountdown';

interface TaskCardProps {
  task: TaskWithEventDetails;
  onComplete: (task: TaskWithEventDetails) => void;
}

export default function TaskCard({ task, onComplete }: TaskCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Determine border color based on urgency
  let borderColor = 'border-gray-200';
  if (task.is_overdue) {
    borderColor = 'border-red-400 border-2';
  } else if (task.days_until_due === 0) {
    borderColor = 'border-orange-400';
  } else if (task.days_until_due <= 3) {
    borderColor = 'border-yellow-400';
  }

  // Format event date
  const eventDate = new Date(task.event_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Handle download
  const handleDownload = async () => {
    if (!task.r2_download_url) return;

    setIsDownloading(true);
    try {
      // Open the signed URL in a new tab
      window.open(task.r2_download_url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Get completion type description
  const getCompletionDescription = () => {
    switch (task.completion_type) {
      case 'monetary':
        return 'Enter order cost + submit';
      case 'checkbox':
        return 'Confirm completion';
      case 'submit_only':
        return 'Click submit to complete';
      default:
        return '';
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border ${borderColor} overflow-hidden hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <TaskTypeBadge type={task.task_type} />
        <DeadlineCountdown
          daysUntilDue={task.days_until_due}
          isOverdue={task.is_overdue}
        />
      </div>

      {/* School & Event Info */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900">{task.school_name}</p>
        <p className="text-xs text-gray-500">{eventDate}</p>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {/* Task Name */}
        <h3 className="font-semibold text-gray-900">{task.task_name}</h3>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-gray-600">{task.description}</p>
        )}

        {/* Download Button (if R2 file exists) */}
        {task.r2_file_path && (
          <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="text-sm text-sage-800">
                {task.r2_file_path.split('/').pop()}
              </span>
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloading || !task.r2_download_url}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#94B8B3] text-white text-sm font-medium rounded hover:bg-[#7da39e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <span>Loading...</span>
              ) : (
                <>
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Completion Hint */}
        <p className="text-xs text-gray-500">
          <span className="font-medium">Completed by:</span>{' '}
          {getCompletionDescription()}
        </p>

        {/* IDs */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded font-mono">
            Event: {task.event_id.substring(0, 30)}...
          </span>
          {task.go_display_id && (
            <span className="px-2 py-1 bg-sage-100 text-sage-800 rounded font-mono">
              {task.go_display_id}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => onComplete(task)}
          className="flex items-center gap-2 px-4 py-2 bg-[#94B8B3] text-white font-medium rounded-lg hover:bg-[#7da39e] transition-colors"
        >
          Complete Task
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
