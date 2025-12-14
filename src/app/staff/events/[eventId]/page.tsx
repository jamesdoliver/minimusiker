'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SchoolEventDetail, EventClassDetail } from '@/lib/types/airtable';
import { AudioFile } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventBadge from '@/components/admin/EventBadge';
import StatsPill from '@/components/admin/StatsPill';

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface AudioFileWithUrl extends AudioFile {
  signedUrl?: string | null;
}

interface ClassUploadCardProps {
  cls: EventClassDetail;
  eventId: string;
  audioFiles: AudioFileWithUrl[];
  onUploadComplete: () => void;
}

function ClassUploadCard({ cls, eventId, audioFiles, onUploadComplete }: ClassUploadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const classAudioFiles = audioFiles.filter((f) => f.classId === cls.classId && f.type === 'raw');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i) / files.length) * 100));

        // Get presigned URL
        const presignResponse = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}/upload-raw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: cls.classId,
            filename: file.name,
            contentType: file.type || 'audio/mpeg',
          }),
        });

        if (!presignResponse.ok) {
          const data = await presignResponse.json();
          throw new Error(data.error || 'Failed to get upload URL');
        }

        const { uploadUrl, r2Key } = await presignResponse.json();

        // Upload file directly to R2
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'audio/mpeg',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        // Confirm upload and create record
        const confirmResponse = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}/upload-raw`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: cls.classId,
            r2Key,
            filename: file.name,
            fileSizeBytes: file.size,
          }),
        });

        if (!confirmResponse.ok) {
          const data = await confirmResponse.json();
          throw new Error(data.error || 'Failed to confirm upload');
        }

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
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
              {cls.totalChildren} children · {classAudioFiles.length} raw files uploaded
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {classAudioFiles.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              {classAudioFiles.length} files
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
          {/* Upload Section */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Raw Audio Files
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#5a8a82] transition-colors">
              {isUploading ? (
                <div>
                  <LoadingSpinner size="md" />
                  <p className="mt-2 text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-[#5a8a82] h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    Drop audio files here or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports MP3, WAV, M4A (max 500MB per file)
                  </p>
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ position: 'relative' }}
                  />
                </>
              )}
            </div>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
          </div>

          {/* Uploaded Files List */}
          {classAudioFiles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files</h4>
              <div className="space-y-2">
                {classAudioFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-[#5a8a82]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                        <p className="text-xs text-gray-500">
                          {file.fileSizeBytes ? formatFileSize(file.fileSizeBytes) : 'Unknown size'}
                          {' · '}
                          {new Date(file.uploadedAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    {file.signedUrl && (
                      <a
                        href={file.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5a8a82] hover:text-[#4a7a72] text-sm font-medium"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<SchoolEventDetail | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFileWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchAudioFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}/audio-files`);
      if (response.ok) {
        const data = await response.json();
        setAudioFiles(data.audioFiles || []);
      }
    } catch (err) {
      console.error('Error fetching audio files:', err);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
      fetchAudioFiles();
    }
  }, [eventId, fetchEventDetail, fetchAudioFiles]);

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

        {/* Audio Upload Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Raw Audio Upload
            <span className="ml-2 text-sm font-normal text-gray-500">
              (Upload recordings per class)
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
                <ClassUploadCard
                  key={cls.classId}
                  cls={cls}
                  eventId={event.eventId}
                  audioFiles={audioFiles}
                  onUploadComplete={fetchAudioFiles}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
