'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMultipartUpload } from '@/lib/hooks/useMultipartUpload';

type ProjectType = 'schulsong' | 'minimusiker';

interface ProjectStatus {
  status: 'pending' | 'uploaded';
  filename?: string;
  fileSizeBytes?: number;
  uploadedAt?: string;
}

type UploadState = 'pending' | 'uploading' | 'uploaded' | 'error';

interface CardState {
  uploadState: UploadState;
  progress: number;
  filename?: string;
  fileSizeBytes?: number;
  uploadedAt?: string;
  error?: string;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export default function LogicProjectUploadSection({ eventId }: { eventId: string }) {
  const [cards, setCards] = useState<Record<ProjectType, CardState>>({
    schulsong: { uploadState: 'pending', progress: 0 },
    minimusiker: { uploadState: 'pending', progress: 0 },
  });

  const { upload: ssUpload, abort: ssAbort } = useMultipartUpload();
  const { upload: mmUpload, abort: mmAbort } = useMultipartUpload();

  const uploaders: Record<ProjectType, { upload: typeof ssUpload; abort: typeof ssAbort }> = {
    schulsong: { upload: ssUpload, abort: ssAbort },
    minimusiker: { upload: mmUpload, abort: mmAbort },
  };

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(eventId)}/logic-projects`
      );
      if (!response.ok) return;

      const data = await response.json();
      const projects = data.projects as Record<ProjectType, ProjectStatus>;

      setCards((prev) => {
        const next = { ...prev };
        for (const type of ['schulsong', 'minimusiker'] as ProjectType[]) {
          const p = projects[type];
          // Don't override if currently uploading
          if (prev[type].uploadState === 'uploading') continue;
          if (p.status === 'uploaded') {
            next[type] = {
              uploadState: 'uploaded',
              progress: 100,
              filename: p.filename,
              fileSizeBytes: p.fileSizeBytes,
              uploadedAt: p.uploadedAt,
            };
          } else {
            next[type] = { uploadState: 'pending', progress: 0 };
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Error fetching logic project status:', err);
    }
  }, [eventId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpload = async (projectType: ProjectType, file: File) => {
    // Validate
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setCards((prev) => ({
        ...prev,
        [projectType]: { uploadState: 'error', progress: 0, error: 'Only .zip files are allowed' },
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setCards((prev) => ({
        ...prev,
        [projectType]: { uploadState: 'error', progress: 0, error: 'File exceeds 2GB limit' },
      }));
      return;
    }

    setCards((prev) => ({
      ...prev,
      [projectType]: { uploadState: 'uploading', progress: 0, filename: file.name },
    }));

    const { upload: doUpload } = uploaders[projectType];
    const baseUrl = `/api/staff/events/${encodeURIComponent(eventId)}/upload-logic-project/multipart`;

    try {
      await doUpload({
        file,
        initiateUrl: baseUrl,
        completeUrl: baseUrl,
        abortUrl: baseUrl,
        initiateBody: {
          projectType,
          filename: file.name,
          fileSizeBytes: file.size,
        },
        completeBodyExtra: {
          projectType,
          filename: file.name,
          fileSizeBytes: file.size,
        },
        onProgress: (pct) => {
          setCards((prev) => ({
            ...prev,
            [projectType]: { ...prev[projectType], progress: pct },
          }));
        },
      });

      setCards((prev) => ({
        ...prev,
        [projectType]: {
          uploadState: 'uploaded',
          progress: 100,
          filename: file.name,
          fileSizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        },
      }));

      // Refresh to pick up bothUploaded state
      fetchStatus();
    } catch (err) {
      // Don't show error if user cancelled
      if (err instanceof Error && err.message === 'Upload aborted') {
        setCards((prev) => ({
          ...prev,
          [projectType]: { uploadState: 'pending', progress: 0 },
        }));
        return;
      }

      console.error(`Upload error (${projectType}):`, err);
      setCards((prev) => ({
        ...prev,
        [projectType]: {
          uploadState: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Upload failed',
        },
      }));
    }
  };

  const handleCancel = (projectType: ProjectType) => {
    uploaders[projectType].abort();
  };

  const handleDelete = async (projectType: ProjectType) => {
    if (!confirm('Delete this project? You can re-upload afterwards.')) return;

    try {
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(eventId)}/upload-logic-project`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectType }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete');
      }

      setCards((prev) => ({
        ...prev,
        [projectType]: { uploadState: 'pending', progress: 0 },
      }));
    } catch (err) {
      console.error(`Delete error (${projectType}):`, err);
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleDrop = (projectType: ProjectType, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(projectType, file);
  };

  const handleFileSelect = (projectType: ProjectType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(projectType, file);
    e.target.value = '';
  };

  const renderCard = (projectType: ProjectType, label: string) => {
    const card = cards[projectType];

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="text-sm text-gray-500">.zip file, up to 2GB</p>
        </div>

        <div className="px-5 py-5">
          {/* Pending state — drop zone */}
          {card.uploadState === 'pending' && (
            <label
              className="block"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(projectType, e)}
            >
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFileSelect(projectType, e)}
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#5a8a82] hover:bg-[#94B8B3]/5 transition-colors">
                <svg
                  className="w-10 h-10 mx-auto mb-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1">.zip files only</p>
              </div>
            </label>
          )}

          {/* Uploading state — progress bar + cancel */}
          {card.uploadState === 'uploading' && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <svg
                  className="animate-spin h-5 w-5 text-[#5a8a82] flex-shrink-0"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Uploading {card.filename}...
                  </p>
                  <p className="text-xs text-gray-500">{card.progress}%</p>
                </div>
                <button
                  onClick={() => handleCancel(projectType)}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-[#5a8a82] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Uploaded state — success + delete */}
          {card.uploadState === 'uploaded' && (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-green-500 flex-shrink-0"
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {card.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(card.fileSizeBytes)}
                    {card.uploadedAt && ` · ${formatDate(card.uploadedAt)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(projectType)}
                className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Delete and re-upload"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Error state */}
          {card.uploadState === 'error' && (
            <div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-3">
                <p className="text-sm text-red-600">{card.error}</p>
              </div>
              <label
                className="block"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(projectType, e)}
              >
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => handleFileSelect(projectType, e)}
                />
                <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#5a8a82] hover:bg-[#94B8B3]/5 transition-colors">
                  <p className="text-sm font-medium text-gray-700">Try again — drag & drop or click</p>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Logic Pro Project Upload
        <span className="ml-2 text-sm font-normal text-gray-500">
          (Upload 2 ZIP files per event)
        </span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderCard('schulsong', 'Schulsong Logic Project')}
        {renderCard('minimusiker', 'MiniMusiker Tracks Logic Project')}
      </div>
    </div>
  );
}
