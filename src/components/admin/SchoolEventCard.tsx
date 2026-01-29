'use client';

import { useRouter } from 'next/navigation';
import { SchoolEventSummary } from '@/lib/types/airtable';
import EventBadge from './EventBadge';
import StatsPill from './StatsPill';

interface SchoolEventCardProps {
  event: SchoolEventSummary;
  basePath?: string;
}

function formatDate(dateString: string): string {
  if (!dateString) return 'No date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default function SchoolEventCard({ event, basePath = '/admin/events' }: SchoolEventCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`${basePath}/${encodeURIComponent(event.eventId)}`);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-[#94B8B3]/30 hover:-translate-y-0.5"
    >
      {/* Header row with badge and date */}
      <div className="flex items-center justify-between mb-4">
        <EventBadge type={event.eventType} />
        <span className="text-sm text-gray-500">{formatDate(event.eventDate)}</span>
      </div>

      {/* School name */}
      <h3 className="text-xl font-bold text-gray-900 mb-1">
        {event.schoolName || 'Unknown School'}
      </h3>

      {/* Teacher */}
      <p className="text-sm text-gray-600 mb-1">
        {event.mainTeacher
          ? `Teacher: ${event.mainTeacher}`
          : event.contactPerson
            ? `Contact: ${event.contactPerson}`
            : 'No teacher assigned'}
      </p>

      {/* Assigned Staff */}
      <p className="text-sm text-gray-600 mb-4">
        Assigned Staff: {event.assignedStaffName || <span className="text-gray-400">None</span>}
      </p>

      {/* Stats row */}
      <div className="flex gap-2 mb-4">
        <StatsPill icon="classes" value={event.classCount} label="Classes" />
        <StatsPill icon="children" value={event.totalChildren} label="Children" />
        <StatsPill icon="parents" value={event.totalParents} label="Parents" />
      </div>

      {/* View details link */}
      <div className="flex justify-end">
        <span className="text-sm font-medium text-[#5a8a82] hover:text-[#4a7a72] flex items-center gap-1">
          View Details
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
        </span>
      </div>
    </div>
  );
}
