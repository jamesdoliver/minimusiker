'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import type { TaskMatrixCell } from '@/lib/types/tasks';
import { getTimelineEntry, PREFIX_STYLES } from '@/lib/config/taskTimeline';
import type { MasterCdData, MasterCdTrack } from '@/lib/services/masterCdService';
import { useClientZipDownload, ZipDownloadFile } from '@/lib/hooks/useClientZipDownload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MasterCdModalProps {
  cell: TaskMatrixCell;
  templateId: string;
  eventId: string; // Airtable record ID (recXXX)
  onClose: () => void;
  onAction: (action: string, data?: Record<string, unknown>) => void;
}

interface EditableTrack extends MasterCdTrack {
  classId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function trackStatusBadge(status: string) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Ready
      </span>
    );
  }
  if (status === 'processing' || status === 'pending') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">
        <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Missing
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MasterCdModal({
  cell,
  templateId,
  eventId,
  onClose,
  onAction,
}: MasterCdModalProps) {
  // Data state
  const [tracklist, setTracklist] = useState<MasterCdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable tracks (local working copy)
  const [editTracks, setEditTracks] = useState<EditableTrack[]>([]);
  const [removedSongIds, setRemovedSongIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  // Save/download state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { state: zipState, startDownload: startZipDownload, cancel: cancelZipDownload } = useClientZipDownload();

  // Finalization status
  const [tracklistFinalizedAt, setTracklistFinalizedAt] = useState<string | null>(null);

  // Notes for partial completion
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState('');

  // Display event_id (e.g. "gs-frankenberg-2025-03-15") resolved from tracklist
  const displayEventId = tracklist?.eventId ?? null;

  const entry = getTimelineEntry(templateId);
  const prefixStyle = entry ? PREFIX_STYLES[entry.prefix] : null;

  // Status flags
  const isCompleted = cell.cellStatus === 'green';
  const isSkipped = cell.status === 'skipped';
  const isPartial = cell.status === 'partial';
  const canComplete = !['green', 'grey', 'orange'].includes(cell.cellStatus);
  const canRevert = isCompleted || isSkipped || isPartial;

  // Completion gating: all tracks ready, or empty tracklist
  const readyCount = editTracks.filter((t) => t.status === 'ready').length;
  const allReady = editTracks.length > 0 ? readyCount === editTracks.length : true;

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Fetch tracklist
  const fetchTracklist = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tasks/tracklist?eventId=${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch tracklist');

      const data: MasterCdData = json.data;
      setTracklist(data);

      // Initialize editable tracks with classId from className lookup
      // We need classId for the album-order save API. Fetch album tracks data.
      const albumRes = await fetch(`/api/admin/events/${data.eventId}/album-order`, {
        credentials: 'include',
      });
      let classIdMap = new Map<string, string>();
      if (albumRes.ok) {
        const albumJson = await albumRes.json();
        if (albumJson.success && albumJson.tracks) {
          for (const at of albumJson.tracks) {
            classIdMap.set(at.songId, at.classId);
          }
        }
      }

      setEditTracks(
        data.tracks.map((t) => ({
          ...t,
          classId: classIdMap.get(t.songId) ?? '',
        }))
      );
      setRemovedSongIds([]);
      setIsDirty(false);

      // Fetch event's tracklist finalization status
      try {
        const eventRes = await fetch(`/api/admin/events/${data.eventId}`, {
          credentials: 'include',
        });
        if (eventRes.ok) {
          const eventJson = await eventRes.json();
          setTracklistFinalizedAt(eventJson.event?.tracklist_finalized_at || null);
        }
      } catch {
        // Non-critical — banner just won't show
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracklist');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTracklist();
  }, [fetchTracklist]);

  // --- Edit operations ---

  const moveTrack = (index: number, direction: -1 | 1) => {
    if (editTracks[index]?.songId === '__schulsong__') return; // Can't move schulsong
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editTracks.length) return;
    if (editTracks[newIndex]?.songId === '__schulsong__') return; // Can't swap with schulsong
    const updated = [...editTracks];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    // Renumber
    updated.forEach((t, i) => { t.trackNumber = i + 1; });
    setEditTracks(updated);
    setIsDirty(true);
  };

  const startEditTitle = (songId: string, currentTitle: string) => {
    setEditingTitleId(songId);
    setEditingTitleValue(currentTitle);
  };

  const confirmEditTitle = () => {
    if (!editingTitleId) return;
    const trimmed = editingTitleValue.trim();
    if (!trimmed) {
      // Cancel if empty
      setEditingTitleId(null);
      return;
    }
    setEditTracks((prev) =>
      prev.map((t) =>
        t.songId === editingTitleId ? { ...t, title: trimmed } : t
      )
    );
    setIsDirty(true);
    setEditingTitleId(null);
  };

  const cancelEditTitle = () => {
    setEditingTitleId(null);
  };

  const removeTrack = (songId: string) => {
    if (songId === '__schulsong__') return; // Can't remove schulsong
    setEditTracks((prev) => {
      const filtered = prev.filter((t) => t.songId !== songId);
      // Renumber
      filtered.forEach((t, i) => { t.trackNumber = i + 1; });
      return filtered;
    });
    setRemovedSongIds((prev) => [...prev, songId]);
    setIsDirty(true);
  };

  // --- Save ---

  const handleSave = async () => {
    if (!displayEventId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const tracks = editTracks.map((t) => ({
        songId: t.songId,
        albumOrder: t.trackNumber,
        title: t.title,
        classId: t.classId,
      }));

      const res = await fetch(`/api/admin/events/${displayEventId}/album-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tracks,
          removedSongIds: removedSongIds.length > 0 ? removedSongIds : undefined,
        }),
      });

      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');

      // Refetch to get fresh data
      await fetchTracklist();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Download ---

  const handleDownloadAll = async () => {
    if (isDirty) {
      setSaveError('Save changes before downloading');
      return;
    }

    try {
      const res = await fetch(`/api/admin/tasks/download?eventId=${eventId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to get download URLs');

      const tracks: Array<{ trackNumber: number; filename: string; url: string }> = json.data.tracks;
      if (!tracks || tracks.length === 0) {
        throw new Error('No tracks available for download');
      }

      const files: ZipDownloadFile[] = tracks.map((track) => ({
        url: track.url,
        filename: track.filename,
        path: track.filename,
        fileSizeBytes: 0,
      }));

      const zipName = `Master CD - ${tracklist?.schoolName || 'Album'}.zip`;
      await startZipDownload(files, zipName);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div
            className={cn(
              'px-6 py-4 border-b rounded-t-lg flex items-center justify-between',
              prefixStyle ? prefixStyle.bg : 'bg-gray-50 border-gray-200',
            )}
          >
            <div>
              <h2
                className={cn(
                  'text-lg font-semibold',
                  prefixStyle ? prefixStyle.text : 'text-gray-700',
                )}
              >
                {entry?.displayName || templateId}
                {tracklist?.schoolName ? ` — ${tracklist.schoolName}` : ''}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>
                  {cell.deadline
                    ? formatDate(cell.deadline, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No deadline'}
                </span>
                <span>&middot;</span>
                {isCompleted ? (
                  <span className="text-green-600 font-medium">Completed</span>
                ) : isSkipped ? (
                  <span className="text-gray-500 font-medium">Skipped</span>
                ) : isPartial ? (
                  <span className="text-orange-600 font-medium">Partially complete</span>
                ) : cell.daysUntilDue < 0 ? (
                  <span className="text-red-600 font-medium">{Math.abs(cell.daysUntilDue)}d overdue</span>
                ) : cell.daysUntilDue === 0 ? (
                  <span className="text-orange-600 font-medium">Due today</span>
                ) : (
                  <span className="text-gray-600 font-medium">{cell.daysUntilDue}d remaining</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : error && !tracklist ? (
              <div className="py-6 text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={fetchTracklist}
                  className="mt-2 text-sm text-red-700 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Track readiness */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 font-medium">Tracks</span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      allReady ? 'text-green-600' : 'text-amber-600',
                    )}
                  >
                    {readyCount}/{editTracks.length} ready
                  </span>
                </div>

                {/* Teacher finalization status */}
                {tracklistFinalizedAt ? (
                  <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-2.5">
                    <p className="text-xs text-green-700 font-medium">
                      Lieder-Reihenfolge vom Lehrer bestätigt am{' '}
                      {new Date(tracklistFinalizedAt).toLocaleDateString('de-DE', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <p className="text-xs text-amber-700 font-medium">
                      Lieder-Reihenfolge noch nicht vom Lehrer bestätigt
                    </p>
                  </div>
                )}

                {editTracks.length === 0 && removedSongIds.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No tracks configured</p>
                ) : editTracks.length === 0 && removedSongIds.length > 0 ? (
                  <p className="text-sm text-amber-600 py-4 text-center">All tracks removed. Save to confirm.</p>
                ) : (
                  /* Tracklist table */
                  <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left border-b border-gray-200">
                          <th className="px-2 py-2 text-xs text-gray-500 font-medium w-16"></th>
                          <th className="px-2 py-2 text-xs text-gray-500 font-medium w-8">#</th>
                          <th className="px-3 py-2 text-xs text-gray-500 font-medium">Title</th>
                          <th className="px-3 py-2 text-xs text-gray-500 font-medium">Class</th>
                          <th className="px-2 py-2 text-xs text-gray-500 font-medium text-right w-14">Dur</th>
                          <th className="px-2 py-2 text-xs text-gray-500 font-medium text-center w-20">Status</th>
                          <th className="px-2 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {editTracks.map((track, index) => (
                          <tr key={track.songId} className={
                            track.songId === '__schulsong__'
                              ? 'bg-amber-50 border-l-2 border-l-amber-400 group'
                              : 'hover:bg-gray-50 group'
                          }>
                            {/* Up/Down arrows */}
                            <td className="px-2 py-1.5">
                              {track.songId !== '__schulsong__' && (
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveTrack(index, -1)}
                                  className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 disabled:invisible transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  disabled={index === editTracks.length - 1}
                                  onClick={() => moveTrack(index, 1)}
                                  className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 disabled:invisible transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                              )}
                            </td>

                            {/* Track number */}
                            <td className="px-2 py-1.5 font-mono text-gray-400 text-sm">
                              {track.trackNumber}
                            </td>

                            {/* Title (click-to-edit) */}
                            <td className="px-3 py-1.5">
                              {editingTitleId === track.songId ? (
                                <input
                                  type="text"
                                  value={editingTitleValue}
                                  onChange={(e) => setEditingTitleValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmEditTitle();
                                    if (e.key === 'Escape') cancelEditTitle();
                                  }}
                                  onBlur={confirmEditTitle}
                                  autoFocus
                                  className="w-full text-sm border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditTitle(track.songId, track.title)}
                                  className="text-left text-sm font-medium text-gray-900 hover:text-blue-600 group/title flex items-center gap-1 w-full"
                                >
                                  <span className="truncate">{track.title}</span>
                                  <svg
                                    className="w-3 h-3 text-gray-300 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              )}
                            </td>

                            {/* Class */}
                            <td className="px-3 py-1.5 text-sm text-gray-500">
                              {track.className}
                            </td>

                            {/* Duration */}
                            <td className="px-2 py-1.5 text-sm text-gray-400 text-right font-mono">
                              {track.durationSeconds
                                ? formatDuration(track.durationSeconds)
                                : '\u2014'}
                            </td>

                            {/* Status */}
                            <td className="px-2 py-1.5 text-center">
                              {trackStatusBadge(track.status)}
                            </td>

                            {/* Remove */}
                            <td className="px-2 py-1.5">
                              {track.songId !== '__schulsong__' && (
                              <button
                                type="button"
                                onClick={() => removeTrack(track.songId)}
                                className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove from album"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Save/Download row */}
                {(editTracks.length > 0 || isDirty) && (
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                      )}
                    </div>

                    {editTracks.length > 0 && (
                      <div className="flex items-center gap-2">
                        {zipState.status === 'downloading' ? (
                          <>
                            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              Downloading {zipState.currentFileIndex + 1}/{zipState.totalFiles}...
                            </span>
                            <button type="button" onClick={cancelZipDownload} className="text-xs text-gray-500 hover:text-red-600">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={handleDownloadAll}
                              disabled={readyCount === 0 || isDirty}
                              title={isDirty ? 'Save changes before downloading' : readyCount === 0 ? 'No tracks ready' : undefined}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#94B8B3] border border-[#94B8B3] rounded hover:bg-[#94B8B3]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              {zipState.status === 'complete' ? 'Download Again' :
                               zipState.status === 'error' ? 'Retry' :
                               `Download ZIP (${readyCount})`}
                            </button>
                            {isDirty && (
                              <p className="absolute right-0 top-full mt-1 text-[10px] text-amber-600 whitespace-nowrap">
                                Save changes first
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Errors */}
                {saveError && (
                  <p className="mt-2 text-xs text-red-600">{saveError}</p>
                )}

                {/* Completion gate */}
                {canComplete && !allReady && editTracks.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600 font-medium">
                    All tracks must be ready to complete
                  </p>
                )}

                {/* Notes input for partial completion */}
                {showNotesInput && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                    <label className="block text-xs font-medium text-gray-600">
                      Notes (required for partial)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Describe what was done and what remains..."
                      rows={3}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none"
                    />
                    <button
                      type="button"
                      disabled={!notes.trim()}
                      onClick={() => {
                        onAction('partial', { notes: notes.trim() });
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 text-xs text-white font-medium rounded bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm Partial
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!isLoading && tracklist && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/admin/tasks/${eventId}`}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  View event
                </Link>

                <div className="flex items-center gap-1.5">
                  {canRevert && (
                    <button
                      type="button"
                      onClick={() => {
                        onAction('revert');
                        onClose();
                      }}
                      className="px-2.5 py-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium rounded hover:bg-amber-50 transition-colors"
                    >
                      Revert
                    </button>
                  )}
                  {canComplete && !showNotesInput && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onAction('skip');
                          onClose();
                        }}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNotesInput(true)}
                        className="px-2.5 py-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium rounded hover:bg-orange-50 transition-colors"
                      >
                        Partial
                      </button>
                      <button
                        type="button"
                        disabled={!allReady}
                        onClick={() => {
                          onAction('complete', { completion_data: { tracklist_verified: true } });
                          onClose();
                        }}
                        className={cn(
                          'px-3 py-1.5 text-xs text-white font-medium rounded transition-colors',
                          !allReady
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-[#94B8B3] hover:bg-[#7da39e]',
                        )}
                      >
                        Complete
                      </button>
                    </>
                  )}
                  {!canComplete && !canRevert && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium rounded hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
