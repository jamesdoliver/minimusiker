'use client';

import { useState } from 'react';
import { Song } from '@/lib/types/teacher';
import { AutoMatchResult } from '@/lib/utils/autoMatch';
import { toast } from 'sonner';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  classId: string;
  songs: Song[];
  onUploadComplete?: () => void;
}

export default function BatchUploadModal({
  isOpen,
  onClose,
  eventId,
  classId,
  songs,
  onUploadComplete,
}: BatchUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'confirming'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [matches, setMatches] = useState<AutoMatchResult[]>([]);
  const [editedMatches, setEditedMatches] = useState<Map<string, string>>(new Map());

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `/api/staff/events/${eventId}/classes/${classId}/upload-batch`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadId(result.uploadId);
      setMatches(result.matches);
      setStep('review');

      toast.success(`Extracted ${result.matches.length} file(s). Review matches below.`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleMatchChange = (filename: string, songId: string) => {
    setEditedMatches(new Map(editedMatches.set(filename, songId)));
  };

  const handleConfirm = async () => {
    try {
      setStep('confirming');

      // Build confirmed matches array
      const confirmedMatches = matches.map((match) => ({
        filename: match.filename,
        songId: editedMatches.get(match.filename) || match.songId,
      }));

      // Validate all files are matched
      const unmatched = confirmedMatches.filter((m) => !m.songId);
      if (unmatched.length > 0) {
        toast.error('Please assign all files to a song before confirming');
        setStep('review');
        return;
      }

      const response = await fetch(
        `/api/staff/events/${eventId}/classes/${classId}/upload-batch`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            confirmedMatches,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Confirmation failed');
      }

      const result = await response.json();
      toast.success(`Successfully uploaded ${result.count} file(s)!`);

      if (onUploadComplete) {
        onUploadComplete();
      }

      handleClose();
    } catch (error) {
      console.error('Confirmation error:', error);
      toast.error(error instanceof Error ? error.message : 'Confirmation failed');
      setStep('review');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setUploadId(null);
    setMatches([]);
    setEditedMatches(new Map());
    onClose();
  };

  const getConfidenceBadge = (confidence: string) => {
    const badges = {
      high: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-orange-100 text-orange-800 border-orange-300',
      none: 'bg-red-100 text-red-800 border-red-300',
    };
    return badges[confidence as keyof typeof badges] || badges.none;
  };

  const getConfidenceIcon = (confidence: string) => {
    if (confidence === 'high') return '✓';
    if (confidence === 'medium') return '⚠';
    if (confidence === 'low') return '?';
    return '✗';
  };

  const summary = {
    total: matches.length,
    high: matches.filter((m) => m.confidence === 'high').length,
    medium: matches.filter((m) => m.confidence === 'medium').length,
    low: matches.filter((m) => m.confidence === 'low').length,
    unmatched: matches.filter((m) => m.confidence === 'none').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Batch Upload - {step === 'upload' ? 'Upload Files' : step === 'review' ? 'Review Matches' : 'Uploading...'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={step === 'confirming'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Upload a ZIP file containing audio files (MP3, WAV, M4A/AAC). Files will be automatically matched to songs based on filename similarity.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <label className="cursor-pointer">
                  <div className="space-y-2">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-gray-600">
                      <span className="font-medium text-blue-600 hover:text-blue-700">
                        Click to upload
                      </span>{' '}
                      or drag and drop
                    </div>
                    <p className="text-xs text-gray-500">
                      ZIP file containing MP3, WAV, or M4A/AAC files
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".zip,application/zip"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              </div>

              {uploading && (
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-600">Processing upload...</p>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Match Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
                    <div className="text-xs text-gray-500">Total Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.high}</div>
                    <div className="text-xs text-gray-500">High Match</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
                    <div className="text-xs text-gray-500">Medium Match</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{summary.low}</div>
                    <div className="text-xs text-gray-500">Low Match</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{summary.unmatched}</div>
                    <div className="text-xs text-gray-500">Unmatched</div>
                  </div>
                </div>
              </div>

              {/* Match List */}
              <div className="space-y-3">
                {matches.map((match, index) => {
                  const selectedSongId = editedMatches.get(match.filename) || match.songId;
                  const selectedSong = songs.find((s) => s.id === selectedSongId);

                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Confidence Badge */}
                        <div className="flex-shrink-0">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${getConfidenceBadge(match.confidence)}`}
                          >
                            {getConfidenceIcon(match.confidence)}
                          </span>
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate" title={match.filename}>
                            {match.filename}
                          </p>

                          {/* Song Selection */}
                          <div className="mt-2">
                            <label className="block text-xs text-gray-500 mb-1">
                              Assign to song:
                            </label>
                            <select
                              value={selectedSongId || ''}
                              onChange={(e) => handleMatchChange(match.filename, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Select a song --</option>
                              {songs.map((song) => (
                                <option key={song.id} value={song.id}>
                                  {song.title}{song.artist ? ` - ${song.artist}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Auto-match suggestion */}
                          {match.songTitle && match.confidence !== 'none' && (
                            <p className="text-xs text-gray-500 mt-1">
                              Auto-matched: <span className="font-medium">{match.songTitle}</span>
                              {' '}({Math.round((1 - match.score) * 100)}% confidence)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'confirming' && (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Uploading files...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={summary.unmatched > 0}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                summary.unmatched > 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {summary.unmatched > 0
                ? `${summary.unmatched} file(s) unmatched`
                : `Confirm Upload (${summary.total} files)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
