'use client';

import { useState, useEffect } from 'react';
import { TipAccordionItem } from './TipAccordionItem';
import type { PreparationTip } from '@/lib/types/preparation-tips';

export function PreparationTipsSection() {
  const [tips, setTips] = useState<PreparationTip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const response = await fetch('/api/teacher/tips');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Fehler beim Laden der Tipps');
        }

        setTips(data.tips || []);
      } catch (err) {
        console.error('Error fetching tips:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Tipps');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTips();
  }, []);

  return (
    <section className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tipps für die Vorbereitung</h2>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-pink-600"
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

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && tips.length === 0 && (
        <p className="text-gray-500 text-center py-12">Keine Tipps verfügbar</p>
      )}

      {/* Tips List */}
      {!isLoading && !error && tips.length > 0 && (
        <div className="space-y-3">
          {tips.map((tip) => (
            <TipAccordionItem
              key={tip.id}
              title={tip.title}
              content={tip.content}
              iconName={tip.iconName}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default PreparationTipsSection;
