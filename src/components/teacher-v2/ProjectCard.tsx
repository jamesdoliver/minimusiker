'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TeacherEventView } from '@/lib/types/teacher';

interface ProjectCardProps {
  event: TeacherEventView;
}

export function ProjectCard({ event }: ProjectCardProps) {
  const { eventId, eventDate, progress } = event;
  const [showDateChangeModal, setShowDateChangeModal] = useState(false);

  const formattedDate = formatGermanDate(eventDate);
  const timeUntilEvent = progress?.daysUntilEvent
    ? formatTimeUntilEvent(progress.daysUntilEvent)
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Coral header with date */}
      <div className="bg-mm-accent text-white p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <span className="text-xl font-bold">{formattedDate}</span>
        <button
          onClick={() => setShowDateChangeModal(true)}
          className="text-white/70 text-xs hover:text-white hover:underline ml-auto"
        >
          Datum ändern
        </button>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {timeUntilEvent && (
            <span className="px-3 py-1 bg-mm-accent/10 text-mm-accent text-xs font-medium rounded-full">
              {timeUntilEvent}
            </span>
          )}
          {progress &&
            progress.totalChildrenExpected !== undefined &&
            progress.totalChildrenExpected > 0 && (
              <span className="px-3 py-1 bg-mm-accent/10 text-mm-accent text-xs font-medium rounded-full">
                {progress.registrationsCount} von {progress.totalChildrenExpected}{' '}
                Kindern registriert
              </span>
            )}
        </div>

        {/* Checklist */}
        {progress && (
          <div className="space-y-3 mb-4">
            <ChecklistItem
              status={
                progress.expectedClasses && progress.classesCount >= progress.expectedClasses
                  ? 'complete'
                  : 'incomplete'
              }
            >
              {progress.classesCount} von {progress.expectedClasses || 0} Gruppen/Klassen
              angelegt
            </ChecklistItem>
            <ChecklistItem
              status={
                progress.expectedSongs && progress.songsCount >= progress.expectedSongs
                  ? 'complete'
                  : 'incomplete'
              }
            >
              {progress.songsCount} von {progress.expectedSongs || 0} Liedern
              festgelegt
            </ChecklistItem>
          </div>
        )}

        {/* Link */}
        <button className="text-mm-accent text-sm hover:underline mb-4 block">
          Was ist noch zu tun?
        </button>

        {/* CTA Button */}
        <Link
          href={`/paedagogen/events/${eventId}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-mm-primary-dark text-white rounded-lg font-medium text-sm hover:bg-mm-primary-dark/90 transition-colors"
        >
          Zur Liederliste
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Date Change Contact Modal */}
      {showDateChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Datum ändern</h3>
            <p className="text-gray-600 mb-4">
              Um das Datum Ihres Events zu ändern, kontaktieren Sie uns bitte:
            </p>
            <a
              href="tel:02513966054"
              className="text-xl font-bold text-mm-accent hover:underline block mb-4"
            >
              0251 3966054
            </a>
            <button
              onClick={() => setShowDateChangeModal(false)}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChecklistItemProps {
  status: 'complete' | 'incomplete';
  children: React.ReactNode;
}

function ChecklistItem({ status, children }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-2">
      {status === 'complete' ? (
        <svg
          className="w-5 h-5 text-mm-success flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-mm-warning flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  );
}

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

function formatTimeUntilEvent(days: number): string {
  if (days < 0) {
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

export default ProjectCard;
