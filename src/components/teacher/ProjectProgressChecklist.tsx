'use client';

import type { TeacherEventView } from '@/lib/types/teacher';

export interface ProjectProgressChecklistProps {
  progress: TeacherEventView['progress'];
}

type ItemStatus = 'complete' | 'in-progress' | 'incomplete';

interface ChecklistItem {
  label: string;
  status: ItemStatus;
}

export function ProjectProgressChecklist({ progress }: ProjectProgressChecklistProps) {
  if (!progress) {
    return null;
  }

  const {
    classesCount,
    expectedClasses,
    songsCount,
    expectedSongs,
    hasLogo,
  } = progress;

  // Determine status for each item
  const items: ChecklistItem[] = [];

  // Classes progress
  if (expectedClasses !== undefined && expectedClasses > 0) {
    const classesStatus: ItemStatus =
      classesCount >= expectedClasses
        ? 'complete'
        : classesCount > 0
          ? 'in-progress'
          : 'incomplete';

    items.push({
      label: `${classesCount} von ${expectedClasses} Gruppen/Klassen angelegt`,
      status: classesStatus,
    });
  } else if (classesCount > 0) {
    // No expected count, just show what we have
    items.push({
      label: `${classesCount} Gruppen/Klassen angelegt`,
      status: 'complete',
    });
  }

  // Songs progress
  if (expectedSongs !== undefined && expectedSongs > 0) {
    const songsStatus: ItemStatus =
      songsCount >= expectedSongs
        ? 'complete'
        : songsCount > 0
          ? 'in-progress'
          : 'incomplete';

    items.push({
      label: `${songsCount} von ${expectedSongs} Liedern festgelegt`,
      status: songsStatus,
    });
  } else if (songsCount > 0) {
    // No expected count, just show what we have
    items.push({
      label: `${songsCount} Lieder festgelegt`,
      status: 'complete',
    });
  }

  // Logo upload
  items.push({
    label: hasLogo ? 'Logo hochgeladen' : 'Logo noch nicht hochgeladen',
    status: hasLogo ? 'complete' : 'incomplete',
  });

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          {/* Status Icon */}
          {item.status === 'complete' && (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {item.status === 'in-progress' && (
            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          )}

          {item.status === 'incomplete' && (
            <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Label */}
          <span
            className={`text-sm ${
              item.status === 'complete'
                ? 'text-white font-medium'
                : item.status === 'in-progress'
                  ? 'text-white/90'
                  : 'text-white/70'
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default ProjectProgressChecklist;
