'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SchoolEventDetail, EventClassDetail } from '@/lib/types/airtable';
import { SongWithAudio, Song } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventBadge from '@/components/admin/EventBadge';
import StatsPill from '@/components/admin/StatsPill';
import SongAudioRow from '@/components/shared/audio-management/SongAudioRow';
import BatchUploadModal from '@/components/shared/audio-management/BatchUploadModal';

function formatDate(dateString: string): string {
  if (!dateString) return 'No date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

interface ClassSongUploadCardProps {
  cls: EventClassDetail;
  eventId: string;
  onRefresh: () => void;
}

function ClassSongUploadCard({ cls, eventId, onRefresh }: ClassSongUploadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [songs, setSongs] = useState<SongWithAudio[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const fetchSongs = useCallback(async () => {
    try {
      setIsLoadingSongs(true);
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(eventId)}/classes/${encodeURIComponent(cls.classId)}/songs`
      );

      if (response.ok) {
        const data = await response.json();
        setSongs(data.songs || []);
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setIsLoadingSongs(false);
    }
  }, [eventId, cls.classId]);

  useEffect(() => {
    if (isExpanded) {
      fetchSongs();
    }
  }, [isExpanded, fetchSongs]);

  const handleUploadComplete = () => {
    fetchSongs();
    onRefresh();
  };

  const totalRawFiles = songs.reduce((sum, song) => sum + song.rawAudioFiles.length, 0);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Class Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#94B8B3]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{cls.className}</h3>
              <p className="text-sm text-gray-500">
                {cls.totalChildren} children · {songs.length} songs · {totalRawFiles} raw files
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalRawFiles > 0 && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                {totalRawFiles} files
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-100 px-5 py-4">
            {/* Batch Upload Button */}
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={songs.length === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  songs.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                📦 Batch Upload (ZIP)
              </button>
            </div>

            {/* Songs List */}
            {isLoadingSongs ? (
              <div className="py-8 text-center">
                <LoadingSpinner size="md" />
                <p className="mt-2 text-sm text-gray-500">Loading songs...</p>
              </div>
            ) : songs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  No songs added to this class yet. Songs must be added by the teacher or admin.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Upload Raw Audio Per Song:
                </h4>
                {songs.map((song) => (
                  <SongAudioRow
                    key={song.id}
                    song={song}
                    eventId={eventId}
                    variant="staff"
                    onUploadComplete={handleUploadComplete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Upload Modal */}
      <BatchUploadModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        eventId={eventId}
        classId={cls.classId}
        songs={songs}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}

export default function StaffEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<SchoolEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const eventId = params.eventId as string;

  const fetchEventDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}`);

      if (response.status === 401) {
        router.push('/staff-login');
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error('Failed to fetch event details');
      }
      const data = await response.json();
      setEvent(data.data);
    } catch (err) {
      console.error('Error fetching event detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
    }
  }, [eventId, fetchEventDetail]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/staff"
            className="text-[#5a8a82] hover:text-[#4a7a72] flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Events
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">Error: {error || 'Event not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Navigation */}
        <Link
          href="/staff"
          className="text-[#5a8a82] hover:text-[#4a7a72] flex items-center gap-1 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Event Info */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <EventBadge type={event.eventType} size="md" />
                <span className="text-gray-500">{formatDate(event.eventDate)}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.schoolName}</h1>
              <p className="text-gray-600">
                {event.mainTeacher ? `Teacher: ${event.mainTeacher}` : 'No teacher assigned'}
              </p>
            </div>

            {/* Right: Stats */}
            <div className="flex gap-3">
              <StatsPill icon="classes" value={event.classCount} label="Classes" />
              <StatsPill icon="children" value={event.totalChildren} label="Children" />
              <StatsPill icon="parents" value={event.totalParents} label="Parents" />
            </div>
          </div>

          {/* Registration Progress */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Overall Registration</span>
              <span className="text-sm font-semibold text-[#5a8a82]">
                {event.overallRegistrationRate}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#94B8B3] h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(event.overallRegistrationRate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Classes Overview Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Classes Overview</h2>

          {event.classes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-3xl mb-3">📚</div>
              <p className="text-gray-600">No classes have been added to this event yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Children
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {event.classes.map((cls) => (
                    <tr key={cls.classId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{cls.className}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {cls.mainTeacher || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {cls.totalChildren}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            cls.registeredParents === 0
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {cls.registeredParents} {cls.registeredParents === 1 ? 'parent' : 'parents'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                cls.registrationRate >= 75
                                  ? 'bg-green-500'
                                  : cls.registrationRate >= 50
                                  ? 'bg-[#94B8B3]'
                                  : cls.registrationRate >= 25
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(cls.registrationRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-10">{cls.registrationRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Song-Level Audio Upload Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Raw Audio Upload
            <span className="ml-2 text-sm font-normal text-gray-500">
              (Upload recordings per song)
            </span>
          </h2>

          {event.classes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-3xl mb-3">🎵</div>
              <p className="text-gray-600">No classes available for audio upload.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {event.classes.map((cls) => (
                <ClassSongUploadCard
                  key={`${cls.classId}-${refreshKey}`}
                  cls={cls}
                  eventId={event.eventId}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
