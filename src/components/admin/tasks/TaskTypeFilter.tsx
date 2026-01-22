// src/components/admin/tasks/TaskTypeFilter.tsx

'use client';

import { TaskFilterTab, TASK_TYPE_CONFIG } from '@/lib/types/tasks';

interface TaskTypeFilterProps {
  value: TaskFilterTab;
  onChange: (value: TaskFilterTab) => void;
}

const FILTER_OPTIONS: { value: TaskFilterTab; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'paper_order', label: 'Paper Orders' },
  { value: 'clothing_order', label: 'Clothing Orders' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'cd_master', label: 'CD Master' },
  { value: 'cd_production', label: 'CD Production' },
];

export default function TaskTypeFilter({ value, onChange }: TaskTypeFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaskFilterTab)}
      className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none"
    >
      {FILTER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
