'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { EngineerEventDetail, EngineerClassView, AudioFileWithUrl } from '@/lib/types/engineer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EngineerBatchUploadModal from '@/components/engineer/EngineerBatchUploadModal';
import { useClientZipDownload, ZipDownloadFile } from '@/lib/hooks/useClientZipDownload';
import ZipDownloadModal from '@/components/engineer/ZipDownloadModal';

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
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ClassUploadState {
  isUploading: boolean;
  uploadType: 'preview' | 'final-mp3' | 'final-wav' | null;
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
  const zipDownload = useClientZipDownload();
  const isDownloadingZip = zipDownload.state.status === 'downloading';
  const [downloadingProject, setDownloadingProject] = useState<string | null>(null);
  const [togglingSchulsong, setTogglingSchulsong] = useState<string | null>(null);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [deletingFile, setDeletingFile] = useState<AudioFileWithUrl | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleSchulsong = async (audioFileId: string, currentValue: boolean) => {
    setTogglingSchulsong(audioFileId);
    try {
      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/toggle-schulsong`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioFileRecordId: audioFileId,
            isSchulsong: !currentValue,
          }),
        }
      );

      if (response.ok) {
        await fetchEventDetail();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to toggle schulsong');
      }
    } catch (err) {
      console.error('Error toggling schulsong:', err);
      alert('Failed to toggle schulsong');
    } finally {
      setTogglingSchulsong(null);
    }
  };

  useEffect(() => {
    fetchEventDetail();
  }, [eventId]);

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
    try {
      const apiUrl = classId
        ? `/api/engineer/events/${encodeURIComponent(eventId)}/download-urls?classId=${encodeURIComponent(classId)}`
        : `/api/engineer/events/${encodeURIComponent(eventId)}/download-urls`;

      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to get download URLs');
      }

      const data = await response.json();
      const files: ZipDownloadFile[] = data.files;

      // Warn if total size is very large (> 2 GB)
      const TWO_GB = 2 * 1024 * 1024 * 1024;
      if (data.totalSizeBytes > TWO_GB) {
        const sizeGB = (data.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1);
        if (!confirm(`Total download size is ${sizeGB} GB. This may take a while. Continue?`)) {
          return;
        }
      }

      await zipDownload.startDownload(files, data.zipFilename);
    } catch (err) {
      console.error('Download error:', err);
      alert(err instanceof Error ? err.message : 'Failed to download ZIP file');
    }
  };

  const handleDownloadLogicProject = async (projectType: 'schulsong' | 'minimusiker') => {
    setDownloadingProject(projectType);
    try {
      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/download-logic-project?projectType=${projectType}`
      );
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      const data = await response.json();
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download Logic Pro project');
    } finally {
      setDownloadingProject(null);
    }
  };

  const handleUploadMixed = async (
    classId: string,
    type: 'preview' | 'final',
    file: File,
    format: 'mp3' | 'wav' = 'mp3',
    isSchulsong?: boolean
  ) => {
    const uploadType = type === 'preview' ? 'preview' : (`final-${format}` as 'final-mp3' | 'final-wav');
    setUploadStates((prev) => ({
      ...prev,
      [classId]: { isUploading: true, uploadType, progress: 0, error: null },
    }));

    const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';

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
            contentType: type === 'preview' ? (file.type || 'audio/mpeg') : contentType,
            format,
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
          'Content-Type': type === 'preview' ? (file.type || 'audio/mpeg') : contentType,
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
            isSchulsong: isSchulsong ?? undefined,
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
    format: 'mp3' | 'wav',
    e: React.ChangeEvent<HTMLInputElement>,
    isSchulsong?: boolean
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadMixed(classId, type, file, format, isSchulsong);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDeleteFile = async () => {
    if (!deletingFile) return;
    setIsDeletingFile(true);
    try {
      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/audio-files/${encodeURIComponent(deletingFile.id)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to delete file');
        return;
      }
      setDeletingFile(null);
      await fetchEventDetail();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete file');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/submit-for-review`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to submit for review');
        return;
      }
      await fetchEventDetail();
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit for review');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute progress for sticky footer
  const totalClasses = event ? event.classes.length + (event.schulsongClass ? 1 : 0) : 0;
  const classesWithFinals = event
    ? event.classes.filter(c => c.finalMp3File || c.finalWavFile).length +
      (event.schulsongClass && (event.schulsongClass.finalMp3File || event.schulsongClass.finalWavFile) ? 1 : 0)
    : 0;
  const showFooter = event && event.audioPipelineStage !== 'approved' && event.audioPipelineStage !== 'ready_for_review';
  const canSubmit = classesWithFinals > 0;

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
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${showFooter ? 'pb-28' : ''}`}>
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
              {(() => {
                const stage = event.audioPipelineStage;
                if (stage === 'approved') {
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Approved
                    </span>
                  );
                }
                if (stage === 'ready_for_review') {
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      In Review
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {event.mixingStatus === 'completed' ? 'Completed' : event.mixingStatus === 'in-progress' ? 'In Progress' : 'Pending'}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Logic Pro Project Downloads */}
          {event.logicProjects && event.logicProjects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Logic Pro Projects</h4>
              <div className="flex flex-wrap gap-3">
                {event.logicProjects.map((project) => (
                  <button
                    key={project.projectType}
                    onClick={() => handleDownloadLogicProject(project.projectType)}
                    disabled={downloadingProject === project.projectType}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {downloadingProject === project.projectType ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download {project.projectType === 'schulsong' ? 'Schulsong' : 'MiniMusiker'} Project
                        {project.fileSizeBytes && (
                          <span className="text-purple-200 text-xs">
                            ({formatFileSize(project.fileSizeBytes)})
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Download all raw files button (legacy fallback) + Batch Upload */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
            <button
              onClick={() => handleDownloadAllZip()}
              disabled={isDownloadingZip}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {isDownloadingZip ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Preparing...
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
            <button
              onClick={() => setShowBatchUpload(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Batch Upload Final WAVs
            </button>
          </div>
        </div>

        {/* Schulsong Section — shown for Micha when event has schulsong */}
        {event.schulsongClass && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              Schulsong
              <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-bold">
                S
              </span>
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Raw files for schulsong */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Raw Files ({event.schulsongClass.rawFiles.length})
                </h4>
                {event.schulsongClass.rawFiles.length === 0 ? (
                  <p className="text-sm text-gray-500">No raw files uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {event.schulsongClass.rawFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.fileSizeBytes)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(file)}
                          disabled={!file.signedUrl}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload section for schulsong (Final MP3 + Final WAV only, no preview) */}
              <div className="px-6 py-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Upload Schulsong</h4>

                {uploadStates[event.schulsongClass.classId]?.error && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{uploadStates[event.schulsongClass.classId].error}</p>
                  </div>
                )}

                {uploadStates[event.schulsongClass.classId]?.isUploading && (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="animate-spin h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-sm text-purple-700">
                        Uploading {uploadStates[event.schulsongClass.classId].uploadType === 'final-wav' ? 'Final WAV' : 'Final MP3'}...
                      </p>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadStates[event.schulsongClass.classId].progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Final MP3 */}
                  <div>
                    <label
                      className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                        event.schulsongClass.finalMp3File
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <input
                        type="file"
                        accept="audio/mpeg,.mp3"
                        className="hidden"
                        onChange={(e) => handleFileSelect(event.schulsongClass!.classId, 'final', 'mp3', e, true)}
                        disabled={uploadStates[event.schulsongClass.classId]?.isUploading}
                      />
                      <svg
                        className={`w-6 h-6 mx-auto mb-2 ${event.schulsongClass.finalMp3File ? 'text-green-500' : 'text-gray-400'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        {event.schulsongClass.finalMp3File ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        )}
                      </svg>
                      <p className="text-sm font-medium text-gray-900">Final MP3</p>
                      {event.schulsongClass.finalMp3File ? (
                        <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">Click to upload</p>
                      )}
                    </label>
                    {event.schulsongClass.finalMp3File && event.audioPipelineStage !== 'approved' && (
                      <button
                        onClick={() => setDeletingFile(event.schulsongClass!.finalMp3File!)}
                        className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Final WAV */}
                  <div>
                    <label
                      className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                        event.schulsongClass.finalWavFile
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <input
                        type="file"
                        accept="audio/wav,.wav"
                        className="hidden"
                        onChange={(e) => handleFileSelect(event.schulsongClass!.classId, 'final', 'wav', e, true)}
                        disabled={uploadStates[event.schulsongClass.classId]?.isUploading}
                      />
                      <svg
                        className={`w-6 h-6 mx-auto mb-2 ${event.schulsongClass.finalWavFile ? 'text-green-500' : 'text-gray-400'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        {event.schulsongClass.finalWavFile ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        )}
                      </svg>
                      <p className="text-sm font-medium text-gray-900">Final WAV</p>
                      {event.schulsongClass.finalWavFile ? (
                        <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">Click to upload</p>
                      )}
                    </label>
                    {event.schulsongClass.finalWavFile && event.audioPipelineStage !== 'approved' && (
                      <button
                        onClick={() => setDeletingFile(event.schulsongClass!.finalWavFile!)}
                        className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Classes — shown for regular engineers (Jakob) or when no schulsong section */}
        {event.classes.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Classes</h2>
            <div className="space-y-6">
              {event.classes.map((classView) => (
                <ClassCard
                  key={classView.classId}
                  classView={classView}
                  uploadState={uploadStates[classView.classId]}
                  onDownloadFile={handleDownloadFile}
                  onDownloadZip={() => handleDownloadAllZip(classView.classId)}
                  onFileSelect={(type, format, e) => handleFileSelect(classView.classId, type, format, e)}
                  isDownloadingZip={isDownloadingZip}
                  eventIsSchulsong={event.isSchulsong}
                  onToggleSchulsong={handleToggleSchulsong}
                  togglingSchulsongId={togglingSchulsong}
                  onDeleteFile={setDeletingFile}
                  audioPipelineStage={event.audioPipelineStage}
                />
              ))}
            </div>
          </>
        )}
        {/* Batch Upload Modal */}
        <EngineerBatchUploadModal
          isOpen={showBatchUpload}
          onClose={() => setShowBatchUpload(false)}
          eventId={eventId}
          onUploadComplete={fetchEventDetail}
        />

        {/* ZIP Download Progress Modal */}
        <ZipDownloadModal
          state={zipDownload.state}
          onCancel={zipDownload.cancel}
          onClose={zipDownload.reset}
        />

        {/* Delete Confirmation Dialog */}
        {deletingFile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete File</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Are you sure you want to delete <span className="font-medium">{deletingFile.filename}</span>?
              </p>
              <p className="text-sm text-red-600 mb-6">
                This will permanently delete this file. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeletingFile(null)}
                  disabled={isDeletingFile}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteFile}
                  disabled={isDeletingFile}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeletingFile ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sticky Submit Footer */}
      {showFooter && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">
                {classesWithFinals} of {totalClasses} {totalClasses === 1 ? 'class has' : 'classes have'} final files
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2 max-w-xs">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: totalClasses > 0 ? `${(classesWithFinals / totalClasses) * 100}%` : '0%' }}
                />
              </div>
            </div>
            <button
              onClick={handleSubmitForReview}
              disabled={!canSubmit || isSubmitting}
              className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClassCardProps {
  classView: EngineerClassView;
  uploadState?: ClassUploadState;
  onDownloadFile: (file: AudioFileWithUrl) => void;
  onDownloadZip: () => void;
  onFileSelect: (type: 'preview' | 'final', format: 'mp3' | 'wav', e: React.ChangeEvent<HTMLInputElement>) => void;
  isDownloadingZip: boolean;
  eventIsSchulsong?: boolean;
  onToggleSchulsong: (audioFileId: string, currentValue: boolean) => void;
  togglingSchulsongId: string | null;
  onDeleteFile: (file: AudioFileWithUrl) => void;
  audioPipelineStage?: string;
}

function ClassCard({
  classView,
  uploadState,
  onDownloadFile,
  onDownloadZip,
  onFileSelect,
  isDownloadingZip,
  eventIsSchulsong,
  onToggleSchulsong,
  togglingSchulsongId,
  onDeleteFile,
  audioPipelineStage,
}: ClassCardProps) {
  const anyFinalFile = classView.finalMp3File || classView.finalWavFile;

  const uploadTypeLabel =
    uploadState?.uploadType === 'final-mp3' ? 'Final MP3' :
    uploadState?.uploadType === 'final-wav' ? 'Final WAV' :
    uploadState?.uploadType === 'preview' ? 'Preview' : '';

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
              classView.finalMp3File
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            MP3 {classView.finalMp3File ? '✓' : ''}
          </span>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              classView.finalWavFile
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            WAV {classView.finalWavFile ? '✓' : ''}
          </span>
          {(classView.finalMp3File?.isSchulsong || classView.finalWavFile?.isSchulsong) && (
            <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-bold">
              S
            </span>
          )}
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
                Uploading {uploadTypeLabel}...
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

        <div className="grid grid-cols-3 gap-4">
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
                onChange={(e) => onFileSelect('preview', 'mp3', e)}
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

          {/* Final MP3 upload */}
          <div>
            <label
              className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                classView.finalMp3File
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <input
                type="file"
                accept="audio/mpeg,.mp3"
                className="hidden"
                onChange={(e) => onFileSelect('final', 'mp3', e)}
                disabled={uploadState?.isUploading}
              />
              <svg
                className={`w-6 h-6 mx-auto mb-2 ${
                  classView.finalMp3File ? 'text-green-500' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {classView.finalMp3File ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                )}
              </svg>
              <p className="text-sm font-medium text-gray-900">Final MP3</p>
              {classView.finalMp3File ? (
                <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Click to upload</p>
              )}
            </label>
            {classView.finalMp3File && audioPipelineStage !== 'approved' && (
              <button
                onClick={() => onDeleteFile(classView.finalMp3File!)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>

          {/* Final WAV upload */}
          <div>
            <label
              className={`block p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                classView.finalWavFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <input
                type="file"
                accept="audio/wav,.wav"
                className="hidden"
                onChange={(e) => onFileSelect('final', 'wav', e)}
                disabled={uploadState?.isUploading}
              />
              <svg
                className={`w-6 h-6 mx-auto mb-2 ${
                  classView.finalWavFile ? 'text-green-500' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {classView.finalWavFile ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                )}
              </svg>
              <p className="text-sm font-medium text-gray-900">Final WAV</p>
              {classView.finalWavFile ? (
                <p className="text-xs text-green-600 mt-1">Uploaded - Click to replace</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Click to upload</p>
              )}
            </label>
            {classView.finalWavFile && audioPipelineStage !== 'approved' && (
              <button
                onClick={() => onDeleteFile(classView.finalWavFile!)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Schulsong toggle - only shown when event has schulsong enabled and any final file exists */}
        {eventIsSchulsong && anyFinalFile && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                S
              </span>
              <div>
                <p className="text-sm font-medium text-gray-700">Mark as Schulsong</p>
                <p className="text-xs text-gray-500">
                  {anyFinalFile.isSchulsong
                    ? 'This audio is the school song'
                    : 'Tag this final audio as the school song'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onToggleSchulsong(anyFinalFile.id, !!anyFinalFile.isSchulsong)}
              disabled={togglingSchulsongId === anyFinalFile.id}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                anyFinalFile.isSchulsong ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  anyFinalFile.isSchulsong ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
