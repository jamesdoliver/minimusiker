'use client';

import { useState } from 'react';

type EventStatus = 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted' | 'Pending';

interface StatusCircleProps {
  status?: EventStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<EventStatus, { color: string; bgColor: string; label: string }> = {
  Confirmed: {
    color: '#22c55e', // green-500
    bgColor: '#dcfce7', // green-100
    label: 'Confirmed',
  },
  'On Hold': {
    color: '#ef4444', // red-500
    bgColor: '#fee2e2', // red-100
    label: 'On Hold',
  },
  Cancelled: {
    color: '#9ca3af', // gray-400
    bgColor: '#f3f4f6', // gray-100
    label: 'Cancelled',
  },
  Deleted: {
    color: '#6b7280', // gray-500
    bgColor: '#e5e7eb', // gray-200
    label: 'Deleted',
  },
  Pending: {
    color: '#eab308', // yellow-500
    bgColor: '#fef9c3', // yellow-100
    label: 'Pending',
  },
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function StatusCircle({ status, size = 'md' }: StatusCircleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Default to no status (grey circle) if status is undefined
  const config = status ? statusConfig[status] : {
    color: '#d1d5db', // gray-300
    bgColor: '#f9fafb', // gray-50
    label: 'No status',
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} rounded-full cursor-help transition-transform hover:scale-110`}
        style={{ backgroundColor: config.color }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="img"
        aria-label={config.label}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded shadow-lg border border-gray-200 whitespace-nowrap z-10"
        >
          {config.label}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
        </div>
      )}
    </div>
  );
}
