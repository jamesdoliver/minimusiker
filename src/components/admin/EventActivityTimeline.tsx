'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventActivity, EventActivityType } from '@/lib/types/airtable';
import { toast } from 'sonner';

interface EventActivityTimelineProps {
  eventId: string;
  schoolName?: string;
  compact?: boolean;
}

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
  event_deleted: { icon: '🗑️', color: 'text-red-600', bgColor: 'bg-red-100' },
  phone_call: { icon: '📞', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  email_discussion: { icon: '✉️', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  audio_uploaded: { icon: '🎤', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  email_sent: { icon: '📧', color: 'text-green-600', bgColor: 'bg-green-100' },
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
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatActorName(email: string, actorType: string): string {
  if (actorType === 'system') return 'System';
  if (email.includes('@')) {
    const namePart = email.split('@')[0];
    return namePart
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return email;
}

export default function EventActivityTimeline({ eventId, schoolName, compact }: EventActivityTimelineProps) {
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Manual entry state
  const [manualEntryType, setManualEntryType] = useState<'phone_call' | 'email_discussion' | null>(null);
  const [manualDescription, setManualDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        if (!response.ok) throw new Error('Failed to fetch activities');

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

  const handleSubmitManualEntry = async () => {
    if (!manualEntryType || !manualDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/activity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            activityType: manualEntryType,
            description: schoolName
              ? `${manualEntryType === 'phone_call' ? 'Call' : 'Email'} '${schoolName}': ${manualDescription.trim()}`
              : manualDescription.trim(),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create entry');
      }

      toast.success(manualEntryType === 'phone_call' ? 'Call logged' : 'Email logged');
      setManualEntryType(null);
      setManualDescription('');
      // Refresh the timeline
      setOffset(0);
      fetchActivities(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
      {/* Manual entry buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setManualEntryType(manualEntryType === 'phone_call' ? null : 'phone_call')}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            manualEntryType === 'phone_call'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📞 + Call
        </button>
        <button
          onClick={() => setManualEntryType(manualEntryType === 'email_discussion' ? null : 'email_discussion')}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
            manualEntryType === 'email_discussion'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✉️ + Email
        </button>
      </div>

      {/* Manual entry form */}
      {manualEntryType && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="text-xs font-medium text-blue-800 block mb-1">
            {manualEntryType === 'phone_call' ? 'Call notes' : 'Email notes'}
          </label>
          <textarea
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            rows={2}
            className="w-full text-xs border border-blue-300 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="What was discussed..."
            autoFocus
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSubmitManualEntry}
              disabled={isSubmitting || !manualDescription.trim()}
              className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setManualEntryType(null); setManualDescription(''); }}
              className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scrollable timeline */}
      <div className={`overflow-y-auto flex-1 ${compact ? 'max-h-[320px]' : 'max-h-[400px]'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-[#5a8a82]"></div>
            <span className="ml-2 text-xs text-gray-500">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-red-600 py-4 text-center">{error}</div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500">
            No activity recorded yet
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity) => {
              const config = ACTIVITY_CONFIG[activity.activityType] || {
                icon: '📝',
                color: 'text-gray-600',
                bgColor: 'bg-gray-100',
              };

              return (
                <div key={activity.id} className="flex gap-2 py-2 border-b border-gray-50 last:border-0">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center text-xs`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 leading-tight">{activity.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500">
                        {formatActorName(activity.actorEmail, activity.actorType)}
                      </span>
                      <span className="text-gray-300 text-[10px]">·</span>
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                      {activity.actorType === 'teacher' && (
                        <span className="text-[10px] bg-teal-100 text-teal-700 px-1 rounded">
                          Teacher
                        </span>
                      )}
                      {activity.actorType === 'system' && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-1.5 text-xs font-medium text-[#5a8a82] hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
