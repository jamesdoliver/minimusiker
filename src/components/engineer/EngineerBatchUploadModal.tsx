'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { unzip } from 'fflate';

interface SongInfo {
  id: string;
  title: string;
  artist?: string;
  classId: string;
}

interface ClassInfo {
  classId: string;
  className: string;
}

interface EnrichedMatch {
  filename: string;
  songId: string | null;
  songTitle: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
  classId: string | null;
  className: string | null;
}

interface EngineerBatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onUploadComplete?: () => void;
}

type Step = 'upload' | 'extracting' | 'uploading-files' | 'review' | 'confirming';

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export default function EngineerBatchUploadModal({
  isOpen,
  onClose,
  eventId,
  onUploadComplete,
}: EngineerBatchUploadModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [editedMatches, setEditedMatches] = useState<Map<string, string>>(new Map());
  const [allSongs, setAllSongs] = useState<SongInfo[]>([]);
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; filename: string }>({ current: 0, total: 0, filename: '' });

  const extractedFilesRef = useRef<Map<string, Uint8Array>>(new Map());
  const uploadUrlsRef = useRef<Record<string, string>>({});
  const abortRef = useRef(false);

  // Build effective assignments: edited overrides or original match
  const effectiveAssignments = useMemo(() => {
    return matches.map((match) => {
      const songId = editedMatches.get(match.filename) || match.songId;
      const song = songId ? allSongs.find(s => s.id === songId) : null;
      return {
        filename: match.filename,
        songId,
        songTitle: song?.title || match.songTitle,
        classId: song?.classId || match.classId,
        className: song ? (allClasses.find(c => c.classId === song.classId)?.className || song.classId) : match.className,
        confidence: editedMatches.has(match.filename) ? ('high' as const) : match.confidence,
        score: match.score,
      };
    });
  }, [matches, editedMatches, allSongs, allClasses]);

  // Detect duplicate songId assignments
  const duplicateSongIds = useMemo(() => {
    const songIdCounts = new Map<string, number>();
    for (const a of effectiveAssignments) {
      if (a.songId) {
        songIdCounts.set(a.songId, (songIdCounts.get(a.songId) || 0) + 1);
      }
    }
    return new Set(
      Array.from(songIdCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
    );
  }, [effectiveAssignments]);

  const summary = useMemo(() => {
    const unmatched = effectiveAssignments.filter(a => !a.songId).length;
    const high = effectiveAssignments.filter(a => a.confidence === 'high' && a.songId).length;
    const medium = effectiveAssignments.filter(a => a.confidence === 'medium').length;
    const low = effectiveAssignments.filter(a => a.confidence === 'low').length;
    return {
      total: effectiveAssignments.length,
      high,
      medium,
      low,
      unmatched,
    };
  }, [effectiveAssignments]);

  const canConfirm = summary.unmatched === 0 && duplicateSongIds.size === 0;

  // Group songs by class for dropdown optgroups
  const songsByClass = useMemo(() => {
    const grouped = new Map<string, { className: string; songs: SongInfo[] }>();
    for (const cls of allClasses) {
      grouped.set(cls.classId, { className: cls.className, songs: [] });
    }
    for (const song of allSongs) {
      const group = grouped.get(song.classId);
      if (group) {
        group.songs.push(song);
      } else {
        grouped.set(song.classId, { className: song.classId, songs: [song] });
      }
    }
    return grouped;
  }, [allSongs, allClasses]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      abortRef.current = false;

      // Phase 1: Extract ZIP client-side
      setStep('extracting');
      const arrayBuffer = await file.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      const entries = await unzipAsync(zipData);

      const extracted = new Map<string, Uint8Array>();
      for (const [path, data] of Object.entries(entries)) {
        // Skip directories (empty data), __MACOSX, dotfiles, non-WAV
        if (data.length === 0) continue;
        if (path.includes('__MACOSX')) continue;
        if (path.startsWith('.')) continue;

        const filename = path.split('/').pop() || path;
        if (filename.startsWith('.')) continue;
        if (!filename.toLowerCase().endsWith('.wav')) continue;

        extracted.set(filename, data);
      }

      if (extracted.size === 0) {
        throw new Error('No WAV files found in ZIP. This feature only supports .wav files.');
      }

      extractedFilesRef.current = extracted;
      const filenames = Array.from(extracted.keys());

      // Phase 2: Get matches + presigned URLs from server
      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/upload-batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames }),
        }
      );

      if (!response.ok) {
        let message = `Upload failed (${response.status})`;
        try { const d = await response.json(); message = d.error || message; } catch {}
        throw new Error(message);
      }

      const result = await response.json();
      setUploadId(result.uploadId);
      setMatches(result.matches);
      setAllSongs(result.allSongs || []);
      setAllClasses(result.allClasses || []);
      uploadUrlsRef.current = result.uploadUrls || {};

      // Phase 3: Upload WAVs to R2 via presigned URLs
      setStep('uploading-files');
      const fileList = Array.from(extracted.entries());
      setUploadProgress({ current: 0, total: fileList.length, filename: '' });

      for (let i = 0; i < fileList.length; i++) {
        if (abortRef.current) {
          throw new Error('Upload cancelled');
        }

        const [filename, data] = fileList[i];
        const url = uploadUrlsRef.current[filename];
        if (!url) {
          throw new Error(`No upload URL for ${filename}`);
        }

        setUploadProgress({ current: i + 1, total: fileList.length, filename });

        let uploaded = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': 'audio/wav' },
              body: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
            });
            if (!res.ok) {
              throw new Error(`R2 upload failed (${res.status})`);
            }
            uploaded = true;
            break;
          } catch (err) {
            if (attempt === 0) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw new Error(`Failed to upload ${filename}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        }

        if (!uploaded) {
          throw new Error(`Failed to upload ${filename} after retries`);
        }

        // Free memory for this file
        extracted.delete(filename);
      }

      // Clear all extracted data
      extractedFilesRef.current = new Map();

      setStep('review');
      toast.success(`Extracted and uploaded ${result.matches.length} WAV file(s). Review matches below.`);
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      toast.error(message);
      extractedFilesRef.current = new Map();
      setStep('upload');
    }
  }, [eventId]);

  const handleMatchChange = (filename: string, songId: string) => {
    const next = new Map(editedMatches);
    if (songId === '') {
      next.delete(filename);
    } else {
      next.set(filename, songId);
    }
    setEditedMatches(next);
  };

  const handleConfirm = async () => {
    try {
      setStep('confirming');
      setError(null);

      const confirmed = effectiveAssignments.map(a => ({
        filename: a.filename,
        songId: a.songId,
      }));

      const response = await fetch(
        `/api/engineer/events/${encodeURIComponent(eventId)}/upload-batch`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, confirmedMatches: confirmed }),
        }
      );

      if (!response.ok) {
        let message = `Confirmation failed (${response.status})`;
        try { const d = await response.json(); message = d.error || message; } catch {}
        throw new Error(message);
      }

      const result = await response.json();
      toast.success(`Successfully uploaded ${result.count} final WAV file(s)!`);

      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          toast.warning(warning);
        }
      }

      onUploadComplete?.();
      handleClose();
    } catch (err) {
      console.error('Confirmation error:', err);
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      setError(message);
      toast.error(message);
      setStep('review');
    }
  };

  const handleClose = () => {
    abortRef.current = true;
    extractedFilesRef.current = new Map();
    uploadUrlsRef.current = {};
    setStep('upload');
    setUploadId(null);
    setMatches([]);
    setEditedMatches(new Map());
    setAllSongs([]);
    setAllClasses([]);
    setError(null);
    setUploadProgress({ current: 0, total: 0, filename: '' });
    onClose();
  };

  const getConfidenceBadge = (confidence: string) => {
    const badges: Record<string, string> = {
      high: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-orange-100 text-orange-800 border-orange-300',
      none: 'bg-red-100 text-red-800 border-red-300',
    };
    return badges[confidence] || badges.none;
  };

  const getConfidenceIcon = (confidence: string) => {
    if (confidence === 'high') return '\u2713';
    if (confidence === 'medium') return '\u26A0';
    if (confidence === 'low') return '?';
    return '\u2717';
  };

  const stepTitle = {
    'upload': 'Upload ZIP',
    'extracting': 'Extracting...',
    'uploading-files': 'Uploading Files...',
    'review': 'Review Matches',
    'confirming': 'Confirming...',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Batch Upload Final WAVs — {stepTitle[step]}
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
                Upload a ZIP containing your final WAV mixes. Files will be automatically matched to songs based on filename similarity.
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
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
                      <span className="font-medium text-purple-600 hover:text-purple-700">
                        Click to upload
                      </span>{' '}
                      or drag and drop
                    </div>
                    <p className="text-xs text-gray-500">
                      ZIP file containing final WAV mixes
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".zip,application/zip"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </div>
          )}

          {step === 'extracting' && (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Extracting WAV files from ZIP...</p>
            </div>
          )}

          {step === 'uploading-files' && (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">
                Uploading file {uploadProgress.current} of {uploadProgress.total}...
              </p>
              {uploadProgress.filename && (
                <p className="mt-1 text-xs text-gray-500 truncate max-w-md mx-auto">{uploadProgress.filename}</p>
              )}
              <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                />
              </div>
              <button
                onClick={() => { abortRef.current = true; }}
                className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

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

              {/* Duplicate warning */}
              {duplicateSongIds.size > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-sm text-amber-800">
                    Multiple files are assigned to the same song. Each song can only have one final WAV.
                  </p>
                </div>
              )}

              {/* Match List */}
              <div className="space-y-3">
                {effectiveAssignments.map((assignment, index) => {
                  const isDuplicate = assignment.songId ? duplicateSongIds.has(assignment.songId) : false;

                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 transition-colors ${
                        isDuplicate
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Confidence Badge */}
                        <div className="flex-shrink-0">
                          {isDuplicate ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 bg-amber-100 text-amber-800 border-amber-300">
                              !
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${getConfidenceBadge(assignment.confidence)}`}
                            >
                              {getConfidenceIcon(assignment.confidence)}
                            </span>
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate" title={assignment.filename}>
                            {assignment.filename}
                          </p>

                          {/* Resolved assignment display */}
                          {assignment.songId && assignment.className && (
                            <p className="text-sm text-gray-600 mt-1">
                              {assignment.className} — {assignment.songTitle}
                            </p>
                          )}

                          {/* Song Selection with class grouping */}
                          <div className="mt-2">
                            <label className="block text-xs text-gray-500 mb-1">
                              Assign to song:
                            </label>
                            <select
                              value={editedMatches.get(assignment.filename) || matches[index]?.songId || ''}
                              onChange={(e) => handleMatchChange(assignment.filename, e.target.value)}
                              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                isDuplicate ? 'border-amber-300' : 'border-gray-300'
                              }`}
                            >
                              <option value="">-- Select a song --</option>
                              {Array.from(songsByClass.entries()).map(([classId, group]) => (
                                <optgroup key={classId} label={`-- ${group.className} --`}>
                                  {group.songs.map((song) => (
                                    <option key={song.id} value={song.id}>
                                      {song.title}{song.artist ? ` - ${song.artist}` : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          {/* Auto-match suggestion */}
                          {matches[index]?.songTitle && matches[index]?.confidence !== 'none' && !editedMatches.has(assignment.filename) && (
                            <p className="text-xs text-gray-500 mt-1">
                              Auto-matched: <span className="font-medium">{matches[index].songTitle}</span>
                              {' '}({Math.round((1 - matches[index].score) * 100)}% confidence)
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
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Confirming {summary.total} file(s)...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                setStep('upload');
                setMatches([]);
                setEditedMatches(new Map());
                setUploadId(null);
                setError(null);
              }}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              &larr; Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                canConfirm
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {!canConfirm
                ? duplicateSongIds.size > 0
                  ? 'Resolve duplicates first'
                  : `${summary.unmatched} file(s) unmatched`
                : `Confirm Upload (${summary.total} files)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
