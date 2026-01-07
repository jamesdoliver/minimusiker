'use client';

import { ProjectTabs } from './ProjectTabs';
import { ProjectCard } from './ProjectCard';
import type { TeacherEventView } from '@/lib/types/teacher';

type FilterType = 'all' | 'upcoming' | 'completed';

interface ProjectSectionProps {
  events: TeacherEventView[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  currentEventIndex: number;
  onPrevEvent: () => void;
  onNextEvent: () => void;
}

export function ProjectSection({
  events,
  activeFilter,
  onFilterChange,
  currentEventIndex,
  onPrevEvent,
  onNextEvent,
}: ProjectSectionProps) {
  const counts = {
    total: events.length,
    upcoming: events.filter(
      (e) => e.status === 'upcoming' || e.status === 'in-progress'
    ).length,
    completed: events.filter((e) => e.status === 'completed').length,
  };

  const filteredEvents =
    activeFilter === 'all'
      ? events
      : activeFilter === 'upcoming'
        ? events.filter((e) => e.status === 'upcoming' || e.status === 'in-progress')
        : events.filter((e) => e.status === 'completed');

  const currentEvent = filteredEvents[currentEventIndex];

  return (
    <section className="bg-white py-12">
      <div className="max-w-[1100px] mx-auto px-6">
        <ProjectTabs
          activeFilter={activeFilter}
          counts={counts}
          onChange={onFilterChange}
        />

        {/* Project Navigation (if multiple projects) */}
        {filteredEvents.length > 1 && (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onPrevEvent}
              disabled={currentEventIndex === 0}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Vorheriges
            </button>
            <span className="text-sm text-gray-500">
              {currentEventIndex + 1} von {filteredEvents.length}
            </span>
            <button
              onClick={onNextEvent}
              disabled={currentEventIndex === filteredEvents.length - 1}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Nächstes
              <svg
                className="w-4 h-4"
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
          </div>
        )}

        {/* Two-column layout: Project card left, empty state right */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Project Card */}
          <div>
            {currentEvent ? (
              <ProjectCard event={currentEvent} />
            ) : (
              <div className="bg-gray-50 rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">📅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {activeFilter === 'all'
                    ? 'Noch keine Events'
                    : activeFilter === 'upcoming'
                      ? 'Keine bevorstehenden Events'
                      : 'Keine abgeschlossenen Events'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {activeFilter === 'all'
                    ? 'Sobald Sie ein Event über SimplyBook buchen, erscheint es hier.'
                    : 'Wechseln Sie den Filter, um andere Events zu sehen.'}
                </p>
                {activeFilter !== 'all' && (
                  <button
                    onClick={() => onFilterChange('all')}
                    className="px-4 py-2 text-mm-accent border border-mm-accent rounded-lg hover:bg-mm-accent/5 transition-colors"
                  >
                    Alle Events anzeigen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Empty state / calendar placeholder */}
          <div className="hidden md:flex items-center justify-center text-gray-400 text-sm">
            {filteredEvents.length <= 1 && (
              <span>keine weiteren Projekttage</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProjectSection;
