'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventActivity, EventActivityType } from '@/lib/types/airtable';

interface EventActivityTimelineProps {
  eventId: string;
}

// Activity type icons and colors
const ACTIVITY_CONFIG: Record<
  EventActivityType,
  { icon: string; color: string; bgColor: string }
> = {
  event_created: { icon: '✨', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  date_changed: { icon: '📅', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  staff_assigned: { icon: '👤', color: 'text-green-600', bgColor: 'bg-green-100' },
  staff_unassigned: { icon: '👤', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  class_added: { icon: '📚', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  class_updated: { icon: '📚', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  class_deleted: { icon: '📚', color: 'text-red-600', bgColor: 'bg-red-100' },
  group_created: { icon: '👥', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  group_updated: { icon: '👥', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  group_deleted: { icon: '👥', color: 'text-red-600', bgColor: 'bg-red-100' },
  song_added: { icon: '🎵', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  song_updated: { icon: '🎵', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  song_deleted: { icon: '🎵', color: 'text-red-600', bgColor: 'bg-red-100' },
  tasks_generated: { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-100' },
  booking_status_changed: { icon: '📋', color: 'text-amber-600', bgColor: 'bg-amber-100' },
};

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatActorName(email: string, actorType: string): string {
  if (actorType === 'system') return 'System';

  // Try to extract a readable name from email
  if (email.includes('@')) {
    const namePart = email.split('@')[0];
    // Convert john.doe or john_doe to John Doe
    return namePart
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return email;
}

export default function EventActivityTimeline({ eventId }: EventActivityTimelineProps) {
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const LIMIT = 20;

  const fetchActivities = useCallback(
    async (currentOffset: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch(
          `/api/admin/events/${encodeURIComponent(eventId)}/activity?limit=${LIMIT}&offset=${currentOffset}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch activities');
        }

        const data = await response.json();

        if (data.success) {
          if (append) {
            setActivities((prev) => [...prev, ...data.data.activities]);
          } else {
            setActivities(data.data.activities);
          }
          setHasMore(data.data.hasMore);
          setOffset(currentOffset + data.data.activities.length);
        } else {
          throw new Error(data.error || 'Failed to fetch activities');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    fetchActivities(0);
  }, [fetchActivities]);

  const handleLoadMore = () => {
    fetchActivities(offset, true);
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-red-600 text-sm">Failed to load activity timeline: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📜</span>
          <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
          {activities.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {activities.length}
              {hasMore && '+'}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-[#5a8a82]"></div>
              <span className="ml-3 text-gray-500">Loading activities...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <span className="text-3xl mb-2 block">📭</span>
              No activity recorded yet
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activities.map((activity) => {
                const config = ACTIVITY_CONFIG[activity.activityType] || {
                  icon: '📝',
                  color: 'text-gray-600',
                  bgColor: 'bg-gray-100',
                };

                return (
                  <div
                    key={activity.id}
                    className="p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center text-sm`}
                      >
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatActorName(activity.actorEmail, activity.actorType)}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                          {activity.actorType === 'teacher' && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                                Teacher
                              </span>
                            </>
                          )}
                          {activity.actorType === 'system' && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                System
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <div className="p-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full py-2 px-4 text-sm font-medium text-[#5a8a82] hover:text-[#4a7a72] hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#5a8a82]"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load more activities
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
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
