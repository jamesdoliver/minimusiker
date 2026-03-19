'use client';

import { useState, useEffect } from 'react';

interface Track {
  fileId: string;
  className: string;
  classType: string;
  songTitle?: string;
  fileSizeBytes?: number;
  isSchulsong: boolean;
}

interface AudioDownloadResponse {
  allComplete: boolean;
  tracks: Track[];
}

interface AudioDownloadSectionProps {
  eventId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    // Schulsong last
    if (a.isSchulsong !== b.isSchulsong) {
      return a.isSchulsong ? 1 : -1;
    }
    // Then alphabetical by className
    return a.className.localeCompare(b.className, 'de');
  });
}

export default function AudioDownloadSection({ eventId }: AudioDownloadSectionProps) {
  const [loading, setLoading] = useState(true);
  const [allComplete, setAllComplete] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [zipDownloading, setZipDownloading] = useState(false);

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads`);
        const data: AudioDownloadResponse = await response.json();
        setAllComplete(data.allComplete);
        setTracks(sortTracks(data.tracks || []));
      } catch (err) {
        console.error('Error fetching audio downloads:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
  }, [eventId]);

  if (loading || !allComplete) {
    return null;
  }

  const handleDownloadTrack = (fileId: string) => {
    window.open(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(fileId)}`, '_blank');
  };

  const handleDownloadZip = () => {
    setZipDownloading(true);
    const zipWindow = window.open(`/api/teacher/events/${encodeURIComponent(eventId)}/audio-downloads/zip`, '_blank');
    // Reset zip downloading state after a delay since we can't track the download progress
    // of a window.open in another tab
    setTimeout(() => setZipDownloading(false), 5000);
    if (!zipWindow) {
      setZipDownloading(false);
    }
  };

  return (
    <div className="mb-8 bg-white rounded-xl border border-green-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Aufnahmen herunterladen</h2>
            <p className="text-sm text-gray-500">Alle Aufnahmen sind fertig und stehen zum Download bereit.</p>
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={zipDownloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {zipDownloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Wird erstellt...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Alle herunterladen (.zip)
            </>
          )}
        </button>
      </div>

      {/* Track List */}
      <div className="divide-y divide-gray-100">
        {tracks.map((track) => (
          <div key={track.fileId} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{track.className}</span>
                  {track.isSchulsong && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0">
                      Schulsong
                    </span>
                  )}
                </div>
                {track.songTitle && (
                  <p className="text-xs text-gray-500 truncate">{track.songTitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              {track.fileSizeBytes != null && (
                <span className="text-xs text-gray-400">{formatFileSize(track.fileSizeBytes)}</span>
              )}
              <button
                onClick={() => handleDownloadTrack(track.fileId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Herunterladen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
