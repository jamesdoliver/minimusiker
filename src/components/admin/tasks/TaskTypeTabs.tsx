'use client';

import { TaskFilterTab, TASK_FILTER_TABS } from '@/lib/types/tasks';

interface TaskTypeTabsProps {
  activeTab: TaskFilterTab;
  onTabChange: (tab: TaskFilterTab) => void;
  counts: Record<TaskFilterTab, number>;
}

export default function TaskTypeTabs({
  activeTab,
  onTabChange,
  counts,
}: TaskTypeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASK_FILTER_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.id] || 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#94B8B3] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
