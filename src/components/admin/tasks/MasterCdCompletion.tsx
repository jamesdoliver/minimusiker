'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useClientZipDownload, ZipDownloadFile } from '@/lib/hooks/useClientZipDownload';

interface TrackInfo {
  songId: string;
  title: string;
  className: string;
  albumOrder: number;
  status: 'ready' | 'processing' | 'missing';
  r2Key: string;
  durationSeconds: number;
}

interface MasterCdData {
  eventId: string;
  schoolName: string;
  totalTracks: number;
  readyTracks: number;
  allReady: boolean;
  tracks: TrackInfo[];
}

interface MasterCdCompletionProps {
  taskId: string;
  eventId: string;
  onComplete: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MasterCdCompletion({
  taskId,
  eventId: _eventId,
  onComplete,
}: MasterCdCompletionProps) {
  const [tracklist, setTracklist] = useState<MasterCdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state: zipState, startDownload: startZipDownload, cancel: cancelZipDownload } = useClientZipDownload();

  const fetchTracklist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}/tracklist`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }
      const data = await response.json();
      if (data.success) {
        setTracklist(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch tracklist');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracklist');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTracklist();
  }, [fetchTracklist]);

  const handleDownloadAll = async () => {
    setError(null);

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get download URLs');
      }

      const tracks: Array<{ trackNumber: number; filename: string; url: string }> = data.data.tracks;
      if (!tracks || tracks.length === 0) {
        throw new Error('No tracks available for download');
      }

      // Build file list for ZIP download
      const files: ZipDownloadFile[] = tracks.map((track) => ({
        url: track.url,
        filename: track.filename,
        path: track.filename,
        fileSizeBytes: 0, // Unknown upfront — ZIP hook handles streaming
      }));

      const zipName = `Master CD - ${tracklist?.schoolName || 'Album'}.zip`;
      await startZipDownload(files, zipName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleMarkComplete = async () => {
    if (!tracklist?.allReady) return;

    setIsCompleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completion_data: { tracklist_verified: true },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to complete task (${response.status})`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to complete task');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsCompleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="h-6 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state (no data loaded)
  if (error && !tracklist) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Album Tracklist</h3>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium">Error loading tracklist</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={fetchTracklist}
              className="mt-3 text-sm text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tracklist) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Album Tracklist — {tracklist.schoolName}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {tracklist.totalTracks} tracks
              {' '}&middot;{' '}
              <span
                className={cn(
                  'font-medium',
                  tracklist.allReady ? 'text-green-600' : 'text-amber-600'
                )}
              >
                {tracklist.readyTracks}/{tracklist.totalTracks} ready
              </span>
            </p>
          </div>

          {/* Download All Button */}
          <div className="flex items-center gap-2">
            {zipState.status === 'downloading' ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>
                    {zipState.currentFileIndex + 1}/{zipState.totalFiles} — {zipState.currentFilename}
                  </span>
                </div>
                <button
                  onClick={cancelZipDownload}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleDownloadAll}
                disabled={tracklist.tracks.filter(t => t.status === 'ready').length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#94B8B3] text-white text-sm font-medium rounded-lg hover:bg-[#7da39e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>
                  {zipState.status === 'complete' ? 'Download Again' :
                   zipState.status === 'error' ? 'Retry Download' :
                   'Download All as ZIP'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Song Title
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Class
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 text-right">
                Duration
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32 text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tracklist.tracks.map((track) => (
              <tr
                key={track.songId}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Track Number */}
                <td className="px-6 py-3 text-sm font-mono text-gray-500">
                  {track.albumOrder}
                </td>

                {/* Song Title */}
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {track.title}
                </td>

                {/* Class */}
                <td className="px-6 py-3 text-sm text-gray-600">
                  {track.className}
                </td>

                {/* Duration */}
                <td className="px-6 py-3 text-sm text-gray-500 text-right font-mono">
                  {track.durationSeconds > 0
                    ? formatDuration(track.durationSeconds)
                    : '—'}
                </td>

                {/* Status */}
                <td className="px-6 py-3 text-center">
                  {track.status === 'ready' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg
                        className="w-3.5 h-3.5"
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
                      Ready
                    </span>
                  )}
                  {track.status === 'processing' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Processing
                    </span>
                  )}
                  {track.status === 'missing' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error banner (inline, when tracklist is loaded) */}
      {error && tracklist && (
        <div className="mx-6 my-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        {!tracklist.allReady && (
          <p className="text-sm text-amber-600 font-medium">
            All tracks must be ready before completing
          </p>
        )}
        {tracklist.allReady && (
          <p className="text-sm text-green-600 font-medium">
            All tracks ready — you can mark this complete
          </p>
        )}

        <button
          onClick={handleMarkComplete}
          disabled={!tracklist.allReady || isCompleting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            tracklist.allReady
              ? 'bg-[#94B8B3] text-white hover:bg-[#7da39e]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            isCompleting && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isCompleting ? (
            <span>Completing...</span>
          ) : (
            <>
              <span>Mark Complete</span>
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
