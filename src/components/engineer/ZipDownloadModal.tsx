'use client';

import { ZipDownloadState } from '@/lib/hooks/useClientZipDownload';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ZipDownloadModalProps {
  state: ZipDownloadState;
  onCancel: () => void;
  onClose: () => void;
}

export default function ZipDownloadModal({ state, onCancel, onClose }: ZipDownloadModalProps) {
  if (state.status === 'idle') return null;

  const percentage =
    state.totalBytes > 0
      ? Math.round((state.bytesDownloaded / state.totalBytes) * 100)
      : 0;

  const isActive = state.status === 'downloading';
  const isDone = state.status === 'complete';
  const isError = state.status === 'error';
  const isCancelled = state.status === 'cancelled';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDone
                ? 'bg-green-100'
                : isError || isCancelled
                  ? 'bg-red-100'
                  : 'bg-purple-100'
            }`}
          >
            {isDone ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : isError || isCancelled ? (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {isDone
              ? 'Download Complete'
              : isError
                ? 'Download Failed'
                : isCancelled
                  ? 'Download Cancelled'
                  : 'Downloading Files'}
          </h3>
        </div>

        {/* Progress */}
        {isActive && (
          <>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>
                  File {state.currentFileIndex + 1} of {state.totalFiles}
                </span>
                <span>{percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 truncate mb-1">
              {state.currentFilename}
            </p>
            <p className="text-xs text-gray-400">
              {formatFileSize(state.bytesDownloaded)} / {formatFileSize(state.totalBytes)}
            </p>
          </>
        )}

        {/* Done message */}
        {isDone && (
          <p className="text-sm text-gray-600">
            Successfully downloaded {state.totalFiles} file{state.totalFiles !== 1 ? 's' : ''} ({formatFileSize(state.bytesDownloaded)})
          </p>
        )}

        {/* Error message */}
        {isError && (
          <p className="text-sm text-red-600">
            {state.error || 'An unexpected error occurred during download.'}
          </p>
        )}

        {/* Cancelled message */}
        {isCancelled && (
          <p className="text-sm text-gray-600">Download was cancelled.</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          {isActive && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
          {(isDone || isError || isCancelled) && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
