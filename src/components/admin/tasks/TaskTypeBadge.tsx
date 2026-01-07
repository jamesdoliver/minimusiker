'use client';

import { TaskType, TASK_TYPE_CONFIG } from '@/lib/types/tasks';

interface TaskTypeBadgeProps {
  type: TaskType;
  size?: 'sm' | 'md';
}

export default function TaskTypeBadge({ type, size = 'md' }: TaskTypeBadgeProps) {
  const config = TASK_TYPE_CONFIG[type];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
