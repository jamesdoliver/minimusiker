'use client';

type FilterType = 'all' | 'upcoming' | 'completed';

interface ProjectTabsProps {
  activeFilter: FilterType;
  counts: {
    total: number;
    upcoming: number;
    completed: number;
  };
  onChange: (filter: FilterType) => void;
}

export function ProjectTabs({ activeFilter, counts, onChange }: ProjectTabsProps) {
  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Alle Projekte', count: counts.total },
    { key: 'upcoming', label: 'Bevorstehend', count: counts.upcoming },
    { key: 'completed', label: 'Abgeschlossen', count: counts.completed },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
            activeFilter === tab.key
              ? 'bg-mm-primary-dark text-white'
              : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}

export default ProjectTabs;
