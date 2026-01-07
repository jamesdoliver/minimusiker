'use client';

import { TipAccordionItem } from './TipAccordionItem';
import type { PreparationTip } from '@/lib/types/preparation-tips';

interface TipsSectionProps {
  tips: PreparationTip[];
  isLoading: boolean;
}

export function TipsSection({ tips, isLoading }: TipsSectionProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Tipps für die Vorbereitung
        </h2>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left: Accordion */}
          <div>
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <svg
                  className="animate-spin h-8 w-8 text-mm-accent"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && tips.length === 0 && (
              <p className="text-gray-500 text-center py-12">
                Keine Tipps verfügbar
              </p>
            )}

            {/* Tips List */}
            {!isLoading && tips.length > 0 && (
              <div className="space-y-0">
                {tips.map((tip, index) => (
                  <TipAccordionItem
                    key={tip.id}
                    title={tip.title}
                    content={tip.content}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Decorative image */}
          <div className="hidden md:block">
            <div className="w-full max-w-sm ml-auto h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
              {/* Placeholder for tips illustration */}
              <svg
                className="w-24 h-24"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TipsSection;
