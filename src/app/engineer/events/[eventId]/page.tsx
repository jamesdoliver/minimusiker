'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { EngineerEventDetail, EngineerClassView, AudioFileWithUrl } from '@/lib/types/engineer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ClassUploadState {
  isUploading: boolean;
  uploadType: 'preview' | 'final' | null;
  progress: number;
  error: string | null;
}

export default function EngineerEventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = decodeURIComponent(params.eventId as string);

  const [event, setEvent] = useState<EngineerEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, ClassUploadState>>({});
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  useEffect(() => {
    fetchEventDetail();
    fetchPublishStatus();
  }, [eventId]);

  const fetchPublishStatus = async () => {
    try {
      const response = await fetch(`/api/engineer/events/${encodeURIComponent(eventId)}/publish`);
      if (response.ok) {
        const data = await response.json();
        setIsPublished(data.published);
      }
    } catch (err) {
      console.error('Error fetching publish status:', err);
    }
  };

  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const response = await fetch(`/api/engineer/events/${encodeURIComponent(eventId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !isPublished }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsPublished(data.published);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update publish status');
      }
    } catch (err) {
      console.error('Error toggling publish:', err);
      alert('Failed to update publish status');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const fetchEventDetail = async () => {
    try {
      const response = await fetch(`/api/engineer/events/${encodeURIComponent(eventId)}`);

      if (response.status === 401) {
        router.push('/engineer-login');
        return;
      }

      if (response.status === 403) {
        setError('You are not assigned to this event');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }

      const data = await response.json();
      setEvent(data.event);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadFile = async (file: AudioFileWithUrl) => {
    if (!file.signedUrl) {
      alert('File URL not available');
      return;
    }

    // Open in new tab to download
    window.open(file.signedUrl, '_blank');
  };

  const handleDownloadAllZip = async (classId?: string) => {
    setIsDownloadingZip(true);
    try {
      const url = classId
        ? `/api/engineer/events/${encodeURIComponent(eventId)}/download-zip?classId=${encodeURIComponent(classId)}`
        : `/api/engineer/events/${encodeURIComponent(eventId)}/download-zip`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to generate ZIP file');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = classId
        ? `${event?.schoolName}_${classId}_raw_audio.zip`
        : `${event?.schoolName}_all_raw_audio.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download ZIP file');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleUploadMixed = async (
    classId: string,
    type: 'preview' | 'final',
    file: File
  ) => {
    setUploadStates((prev) => ({
      ...prev,
      [classId]: { isUploading: true, uploadType: type, progress: 0, error: null },
    }));

    try {
      // Step 1: Get presigned URL
      const urlResponse = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/upload-mixed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            filename: file.name,
            type,
            contentType: file.type || 'audio/mpeg',
          }),
        }
      );

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, r2Key } = await urlResponse.json();

      // Step 2: Upload to R2
      setUploadStates((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], progress: 30 },
      }));

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setUploadStates((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], progress: 70 },
      }));

      // Step 3: Confirm upload
      const confirmResponse = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/upload-mixed`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            r2Key,
            filename: file.name,
            type,
            fileSizeBytes: file.size,
          }),
        }
      );

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      setUploadStates((prev) => ({
        ...prev,
        [classId]: { isUploading: false, uploadType: null, progress: 100, error: null },
      }));

      // Refresh event data
      await fetchEventDetail();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStates((prev) => ({
        ...prev,
        [classId]: {
          isUploading: false,
          uploadType: null,
          progress: 0,
          error: err instanceof Error ? err.message : 'Upload failed',
        },
      }));
    }
  };

  const handleFileSelect = (
    classId: string,
    type: 'preview' | 'final',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadMixed(classId, type, file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600">{error}</p>
          </div>
          <Link
            href="/engineer"
            className="text-purple-600 hover:text-purple-700 inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/engineer"
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{event.schoolName}</h1>
              <p className="text-sm text-gray-500">{formatDate(event.eventDate)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Event overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-gray-500">Event Type</p>
              <p className="font-medium capitalize">{event.eventType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Classes</p>
              <p className="font-medium">{event.classes.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{event.mixingStatus.replace('-', ' ')}</p>
            </div>
          </div>

          {/* Publish Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Publish Audio Preview</p>
                <p className="text-xs text-gray-500">
                  {isPublished
                    ? 'Parents can see the 10-second audio preview'
                    : 'Audio preview is hidden from parents'}
                </p>
              </div>
              <button
                onClick={handleTogglePublish}
                disabled={isTogglingPublish || event.classes.every(c => !c.finalFile)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPublished ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={event.classes.every(c => !c.finalFile) ? 'Upload final audio first' : undefined}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublished ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isPublished && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Live
                </span>
                <span className="text-xs text-gray-500">Audio preview is visible to parents</span>
              </div>
            )}
            {event.classes.every(c => !c.finalFile) && (
              <p className="mt-2 text-xs text-amber-600">
                Upload at least one final audio file before publishing
              </p>
            )}
          </div>

          {/* Download all button */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => handleDownloadAllZip()}
              disabled={isDownloadingZip}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDownloadingZip ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating ZIP...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download All Raw Files (ZIP)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Classes */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Classes</h2>
        <div className="space-y-6">
          {event.classes.map((classView) => (
            <ClassCard
              key={classView.classId}
              classView={classView}
              uploadState={uploadStates[classView.classId]}
              onDownloadFile={handleDownloadFile}
              onDownloadZip={() => handleDownloadAllZip(classView.classId)}
              onFileSelect={(type, e) => handleFileSelect(classView.classId, type, e)}
              isDownloadingZip={isDownloadingZip}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

interface ClassCardProps {
  classView: EngineerClassView;
  uploadState?: ClassUploadState;
  onDownloadFile: (file: AudioFileWithUrl) => void;
  onDownloadZip: () => void;
  onFileSelect: (type: 'preview' | 'final', e: React.ChangeEvent<HTMLInputElement>) => void;
  isDownloadingZip: boolean;
}

function ClassCard({
  classView,
  uploadState,
  onDownloadFile,
  onDownloadZip,
  onFileSelect,
  isDownloadingZip,
}: ClassCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Class header */}
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">{classView.className}</h3>
        <div className="flex gap-2">
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              classView.previewFile
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            Preview {classView.previewFile ? '✓' : ''}
          </span>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              classView.finalFile
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            Final {classView.finalFile ? '✓' : ''}
          </span>
        </div>
      </div>

      {/* Raw files section */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            Raw Files ({classView.rawFiles.length})
          </h4>
          {classView.rawFiles.length > 0 && (
            <button
              onClick={onDownloadZip}
              disabled={isDownloadingZip}
              className="text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
            >
              Download All (ZIP)
            </button>
          )}
        </div>

        {classView.rawFiles.length === 0 ? (
          <p className="text-sm text-gray-500">No raw files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {classView.rawFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400"
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
                      {formatFileSize(file.fileSizeBytes)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onDownloadFile(file)}
                  disabled={!file.signedUrl}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload section */}
      <div className="px-6 py-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Upload Mixed Audio</h4>

        {uploadState?.error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{uploadState.error}</p>
          </div>
        )}

        {uploadState?.isUploading && (
          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="animate-spin h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-purple-700">
                Uploading {uploadState.uploadType}...
              </p>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Preview upload */}
          <div>
            <label
              className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                classView.previewFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onFileSelect('preview', e)}
                disabled={uploadState?.isUploading}
              />
              <svg
                className={`w-6 h-6 mx-auto mb-2 ${
                  classView.previewFile ? 'text-green-500' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {classView.previewFile ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                )}
              </svg>
              <p className="text-sm font-medium text-gray-900">Preview</p>
              {classView.previewFile ? (
                <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Click to upload</p>
              )}
            </label>
          </div>

          {/* Final upload */}
          <div>
            <label
              className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                classView.finalFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onFileSelect('final', e)}
                disabled={uploadState?.isUploading}
              />
              <svg
                className={`w-6 h-6 mx-auto mb-2 ${
                  classView.finalFile ? 'text-green-500' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {classView.finalFile ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                )}
              </svg>
              <p className="text-sm font-medium text-gray-900">Final</p>
              {classView.finalFile ? (
                <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Click to upload</p>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
