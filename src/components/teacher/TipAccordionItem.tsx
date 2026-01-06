'use client';

import { useState } from 'react';

export interface TipAccordionItemProps {
  title: string;
  content: string;
  iconName?: string;
  defaultExpanded?: boolean;
}

export function TipAccordionItem({
  title,
  content,
  iconName,
  defaultExpanded = false,
}: TipAccordionItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Title Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between
          hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {/* Optional Icon */}
          {iconName && (
            <span className="text-pink-600 text-xl" aria-hidden="true">
              {/* Could map iconName to actual icons here */}
              ✓
            </span>
          )}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
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

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-6 pb-4 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}

export default TipAccordionItem;
