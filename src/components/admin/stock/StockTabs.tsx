'use client';

import { StockTab } from '@/lib/types/stock';

interface StockTabsProps {
  activeTab: StockTab;
  onTabChange: (tab: StockTab) => void;
}

const tabs: { id: StockTab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'orders', label: 'Orders' },
];

export default function StockTabs({ activeTab, onTabChange }: StockTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === tab.id
                  ? 'border-[#94B8B3] text-[#94B8B3]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
