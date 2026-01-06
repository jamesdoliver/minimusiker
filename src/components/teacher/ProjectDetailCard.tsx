'use client';

import Link from 'next/link';
import { ProjectProgressChecklist } from './ProjectProgressChecklist';
import type { TeacherEventView } from '@/lib/types/teacher';

export interface ProjectDetailCardProps {
  event: TeacherEventView;
}

export function ProjectDetailCard({ event }: ProjectDetailCardProps) {
  const { eventId, eventDate, eventType, progress } = event;

  // Format date in German (e.g., "13. Februar 2026")
  const formattedDate = formatGermanDate(eventDate);

  // Calculate time until event
  const timeUntilEvent = progress?.daysUntilEvent
    ? formatTimeUntilEvent(progress.daysUntilEvent)
    : null;

  return (
    <div
      className="rounded-lg shadow-md p-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
      }}
    >
      {/* Event Type Badge */}
      <div className="absolute top-4 right-4">
        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
          {eventType}
        </span>
      </div>

      {/* Event Date with Calendar Icon */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">{formattedDate}</h3>
          {timeUntilEvent && (
            <p className="text-white/80 text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {timeUntilEvent}
            </p>
          )}
        </div>
      </div>

      {/* Progress Checklist */}
      {progress && (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <ProjectProgressChecklist progress={progress} />
        </div>
      )}

      {/* Registration Progress */}
      {progress && progress.totalChildrenExpected !== undefined && progress.totalChildrenExpected > 0 && (
        <div className="flex items-center gap-2 mb-6 text-white">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">
              {progress.registrationsCount} von {progress.totalChildrenExpected} Kindern registriert
            </p>
            <div className="mt-1 w-48 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    (progress.registrationsCount / progress.totalChildrenExpected) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Link
        href={`/teacher/events/${eventId}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-pink-600 rounded-lg
          hover:bg-pink-50 transition-colors font-medium text-sm shadow-md"
      >
        Zur Liederliste
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// Helper function to format date in German
function formatGermanDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day}. ${month} ${year}`;
}

// Helper function to format time until event
function formatTimeUntilEvent(days: number): string {
  if (days < 0) {
    // Event is in the past
    const absDays = Math.abs(days);
    if (absDays === 1) return 'vor 1 Tag';
    if (absDays < 7) return `vor ${absDays} Tagen`;
    const weeks = Math.floor(absDays / 7);
    if (weeks === 1) return 'vor 1 Woche';
    return `vor ${weeks} Wochen`;
  }

  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';

  if (days < 7) return `noch ${days} Tage`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'noch 1 Woche';
  return `noch ${weeks} Wochen`;
}

export default ProjectDetailCard;
