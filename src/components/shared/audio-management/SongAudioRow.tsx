'use client';

import { useState } from 'react';
import { SongWithAudio, AudioFile } from '@/lib/types/teacher';
import { toast } from 'sonner';

interface SongAudioRowProps {
  song: SongWithAudio;
  eventId: string;
  variant?: 'staff' | 'engineer';
  onUploadComplete?: () => void;
}

export default function SongAudioRow({
  song,
  eventId,
  variant = 'staff',
  onUploadComplete,
}: SongAudioRowProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac)$/i)) {
      toast.error('Invalid file type. Please upload MP3, WAV, or M4A/AAC files.');
      return;
    }

    // Validate file size (500MB max for raw, 50MB for final)
    const maxSize = variant === 'staff' ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size: ${variant === 'staff' ? '500MB' : '50MB'}`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Step 1: Get presigned URL
      const uploadType = variant === 'staff' ? 'raw' : 'final';
      const endpoint = variant === 'staff'
        ? `/api/staff/events/${eventId}/songs/${song.id}/upload-raw`
        : `/api/engineer/events/${eventId}/songs/${song.id}/upload-final`;

      const urlResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'audio/mpeg',
        }),
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, key } = await urlResponse.json();

      // Step 2: Upload file to R2 using presigned URL
      setUploadProgress(10);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 90) + 10;
          setUploadProgress(progress);
        }
      });

      await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');
        xhr.send(file);
      });

      setUploadProgress(95);

      // Step 3: Confirm upload with backend
      const confirmResponse = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2Key: key,
          filename: file.name,
          fileSizeBytes: file.size,
        }),
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || 'Failed to confirm upload');
      }

      setUploadProgress(100);
      toast.success(`${uploadType === 'raw' ? 'Raw' : 'Final'} audio uploaded successfully!`);

      // Call onUploadComplete callback
      if (onUploadComplete) {
        onUploadComplete();
      }

      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const audioFiles = variant === 'staff' ? song.rawAudioFiles : song.finalAudioFiles;
  const fileLabel = variant === 'staff' ? 'Raw Audio' : 'Final Audio';

  return (
    <div className="border-b border-gray-200 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{song.title}</h4>
          {song.artist && (
            <p className="text-sm text-gray-500 truncate">{song.artist}</p>
          )}
          {song.notes && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{song.notes}</p>
          )}

          {/* Existing Audio Files */}
          {audioFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">{fileLabel} Files:</p>
              {audioFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-2"
                >
                  <span className="flex-1 truncate" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {formatFileSize(file.fileSizeBytes)}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {formatDate(file.uploadedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No Files Message */}
          {audioFiles.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 italic">
              No {fileLabel.toLowerCase()} uploaded yet
            </p>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex flex-col items-end gap-2">
          <label
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer
              ${uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {uploading ? 'Uploading...' : `Upload ${fileLabel}`}
            <input
              type="file"
              className="hidden"
              accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>

          {/* Upload Progress */}
          {uploading && (
            <div className="w-full">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">
                {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
