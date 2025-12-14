'use client';

export type EventStatus = 'all' | 'upcoming' | 'in-progress' | 'completed';

interface EventStatusTabsProps {
  activeTab: EventStatus;
  onTabChange: (tab: EventStatus) => void;
  counts: {
    all: number;
    upcoming: number;
    inProgress: number;
    completed: number;
  };
}

export default function EventStatusTabs({
  activeTab,
  onTabChange,
  counts,
}: EventStatusTabsProps) {
  const tabs: { id: EventStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'in-progress', label: 'In Progress', count: counts.inProgress },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-[#94B8B3] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {tab.label}
          <span
            className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.id
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
