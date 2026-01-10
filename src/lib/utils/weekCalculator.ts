/**
 * Week Calculator for Teacher Portal Videos
 *
 * Determines which video folder to show based on days until event.
 */

export type VideoFolder =
  | 'Week8'
  | 'Week7'
  | 'Week6'
  | 'Week5'
  | 'Week4'
  | 'Week3'
  | 'Week2'
  | 'Week1'
  | 'EventDay'
  | 'OneWeekAfter';

export interface WeekInfo {
  folder: VideoFolder;
  daysRemaining: number;
  weekNumber: number | null; // 1-8 for weeks, null for EventDay/OneWeekAfter
  label: string; // German display label
}

/**
 * Calculate which video folder to show based on event date.
 *
 * Week mapping:
 * - 56+ days = Week8
 * - 49-55 days = Week7
 * - 42-48 days = Week6
 * - 35-41 days = Week5
 * - 28-34 days = Week4
 * - 21-27 days = Week3
 * - 14-20 days = Week2
 * - 1-13 days = Week1
 * - 0 days = EventDay
 * - <0 days = OneWeekAfter
 */
export function calculateVideoFolder(eventDate: string): WeekInfo {
  const event = new Date(eventDate);
  const today = new Date();

  // Reset times to midnight for accurate day calculation
  event.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = event.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // After event day
  if (diffDays < 0) {
    return {
      folder: 'OneWeekAfter',
      daysRemaining: diffDays,
      weekNumber: null,
      label: 'Nach dem Event',
    };
  }

  // Event day
  if (diffDays === 0) {
    return {
      folder: 'EventDay',
      daysRemaining: 0,
      weekNumber: null,
      label: 'Eventtag',
    };
  }

  // Calculate week number (1-8)
  // 1-6 days = Week1, 7-13 = Week1, 14-20 = Week2, etc.
  // Week1 covers days 1-13 (up to 2 weeks before)
  // Week2 covers days 14-20
  // etc.
  let weekNumber: number;

  if (diffDays <= 13) {
    weekNumber = 1;
  } else if (diffDays <= 20) {
    weekNumber = 2;
  } else if (diffDays <= 27) {
    weekNumber = 3;
  } else if (diffDays <= 34) {
    weekNumber = 4;
  } else if (diffDays <= 41) {
    weekNumber = 5;
  } else if (diffDays <= 48) {
    weekNumber = 6;
  } else if (diffDays <= 55) {
    weekNumber = 7;
  } else {
    weekNumber = 8;
  }

  return {
    folder: `Week${weekNumber}` as VideoFolder,
    daysRemaining: diffDays,
    weekNumber,
    label: `Woche ${weekNumber}`,
  };
}

/**
 * Get all valid video folders in order (for admin/debug purposes)
 */
export function getAllVideoFolders(): VideoFolder[] {
  return [
    'Week8',
    'Week7',
    'Week6',
    'Week5',
    'Week4',
    'Week3',
    'Week2',
    'Week1',
    'EventDay',
    'OneWeekAfter',
  ];
}

/**
 * Get passed weeks (weeks chronologically before current in preparation timeline).
 * These are weeks the teacher has already gone through.
 *
 * Examples:
 * - Current=Week3 → Passed=[Week4, Week5, Week6, Week7, Week8]
 * - Current=Week1 → Passed=[Week2, Week3, Week4, Week5, Week6, Week7, Week8]
 * - Current=EventDay → Passed=[Week1, Week2, ..., Week8]
 * - Current=OneWeekAfter → Passed=[EventDay, Week1, Week2, ..., Week8]
 * - Current=Week8 → Passed=[] (no previous weeks)
 */
export function getPassedWeeks(currentFolder: VideoFolder): VideoFolder[] {
  const timeline: VideoFolder[] = [
    'Week8',
    'Week7',
    'Week6',
    'Week5',
    'Week4',
    'Week3',
    'Week2',
    'Week1',
    'EventDay',
    'OneWeekAfter',
  ];

  const currentIndex = timeline.indexOf(currentFolder);
  if (currentIndex <= 0) return []; // Week8 has no passed weeks

  // Return weeks before current (already passed in timeline)
  return timeline.slice(0, currentIndex);
}

/**
 * Get German label for a video folder
 */
export function getFolderLabel(folder: VideoFolder): string {
  if (folder.startsWith('Week')) {
    const weekNum = folder.replace('Week', '');
    return `Woche ${weekNum}`;
  }
  if (folder === 'EventDay') {
    return 'Eventtag';
  }
  if (folder === 'OneWeekAfter') {
    return 'Nach dem Event';
  }
  return folder;
}
