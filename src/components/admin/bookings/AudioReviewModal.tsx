'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioStatusData } from '@/lib/types/audio-status';
import { toast } from 'sonner';

interface AudioReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  schoolName: string;
}

interface SchulsongStatusData {
  hasSchulsong: boolean;
  schulsongFile?: {
    audioFileId: string;
    filename: string;
    approvalStatus: 'pending' | 'approved' | 'rejected';
    rejectionComment?: string;
    teacherApprovedAt?: string;
    audioUrl?: string;
  };
  releasedAt?: string;
}

export default function AudioReviewModal({
  isOpen,
  onClose,
  eventId,
  schoolName,
}: AudioReviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [audioStatus, setAudioStatus] = useState<AudioStatusData | null>(null);

  // Schulsong state
  const [schulsongStatus, setSchulsongStatus] = useState<SchulsongStatusData | null>(null);
  const [schulsongSaving, setSchulsongSaving] = useState(false);
  const [schulsongRejectComment, setSchulsongRejectComment] = useState('');
  const [showSchulsongRejectInput, setShowSchulsongRejectInput] = useState(false);

  // Release confirmation state
  const [confirmRelease, setConfirmRelease] = useState<{
    mode: 'scheduled' | 'instant';
    teacherCount: number;
    parentCount: number;
  } | null>(null);
  const [fetchingCounts, setFetchingCounts] = useState(false);

  // Audio visibility toggle state
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  // Replace audio state
  const [replacingAudioId, setReplacingAudioId] = useState<string | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const schulsongReplaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAudioStatus();
      fetchSchulsongStatus();
    }
  }, [isOpen, eventId]);

  const fetchAudioStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/audio-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch audio status');
      }
      const data = await response.json();
      setAudioStatus(data.data);
    } catch (error) {
      console.error('Error fetching audio status:', error);
      toast.error('Failed to load audio status');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchulsongStatus = async () => {
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/schulsong-status`);
      if (!response.ok) return;
      const data = await response.json();
      setSchulsongStatus(data);
    } catch (error) {
      console.error('Error fetching schulsong status:', error);
    }
  };

  const handleSchulsongApprove = async (mode: 'scheduled' | 'instant' = 'scheduled') => {
    try {
      setSchulsongSaving(true);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/approve-schulsong`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve schulsong');
      }
      const result = await response.json();
      if (mode === 'instant') {
        toast.success('Schulsong sofort freigegeben! E-Mail wird versendet.');
      } else {
        const releaseDate = new Date(result.releasedAt);
        const formatted = releaseDate.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        toast.success(`Schulsong freigegeben! Veröffentlichung: ${formatted} um 07:00`);
      }
      await fetchSchulsongStatus();
    } catch (error) {
      console.error('Error approving schulsong:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve schulsong');
    } finally {
      setSchulsongSaving(false);
    }
  };

  const handleSchulsongReject = async () => {
    try {
      setSchulsongSaving(true);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/approve-schulsong`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: schulsongRejectComment || undefined }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject schulsong');
      }
      toast.success('Schulsong rejected');
      setShowSchulsongRejectInput(false);
      setSchulsongRejectComment('');
      await fetchSchulsongStatus();
    } catch (error) {
      console.error('Error rejecting schulsong:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reject schulsong');
    } finally {
      setSchulsongSaving(false);
    }
  };

  const handleReleaseClick = async (mode: 'scheduled' | 'instant') => {
    try {
      setFetchingCounts(true);
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/schulsong-recipients`);
      if (!response.ok) {
        throw new Error('Failed to fetch recipient counts');
      }
      const result = await response.json();
      setConfirmRelease({
        mode,
        teacherCount: result.data.teacherCount,
        parentCount: result.data.parentCount,
      });
    } catch (error) {
      console.error('Error fetching recipient counts:', error);
      toast.error('Empfänger konnten nicht geladen werden');
    } finally {
      setFetchingCounts(false);
    }
  };

  const handleConfirmRelease = () => {
    if (!confirmRelease) return;
    handleSchulsongApprove(confirmRelease.mode);
    setConfirmRelease(null);
  };

  const handleCancelRelease = () => {
    setConfirmRelease(null);
  };

  const handleToggleAudioVisibility = async () => {
    if (!audioStatus || isTogglingVisibility) return;
    const newHidden = !audioStatus.audioHidden;
    setIsTogglingVisibility(true);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/toggle-audio-visibility`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: newHidden }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle');
      }
      setAudioStatus(prev => prev ? { ...prev, audioHidden: newHidden } : null);
      toast.success(newHidden ? 'Audio für Eltern ausgeblendet' : 'Audio für Eltern sichtbar');
    } catch (error) {
      console.error('Error toggling audio visibility:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle audio visibility');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleReplaceAudio = async (audioFileId: string, file: File) => {
    setReplacingAudioId(audioFileId);
    setReplaceProgress('Uploading...');
    try {
      // Step 1: Get presigned upload URL
      const presignRes = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/replace-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioFileId,
            filename: file.name,
            contentType: file.type || 'audio/mpeg',
          }),
        }
      );
      if (!presignRes.ok) {
        const data = await presignRes.json();
        throw new Error(data.error || 'Failed to get upload URL');
      }
      const { uploadUrl, newR2Key } = await presignRes.json();

      // Step 2: Upload file directly to R2
      setReplaceProgress('Uploading file...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Confirm upload
      setReplaceProgress('Finalizing...');
      const confirmRes = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/replace-audio`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioFileId, newR2Key, filename: file.name }),
        }
      );
      if (!confirmRes.ok) {
        const data = await confirmRes.json();
        throw new Error(data.error || 'Failed to confirm replacement');
      }

      toast.success('Audio ersetzt');
      // Refresh data
      await Promise.all([fetchAudioStatus(), fetchSchulsongStatus()]);
    } catch (error) {
      console.error('Error replacing audio:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to replace audio');
    } finally {
      setReplacingAudioId(null);
      setReplaceProgress(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  const schulsongFile = schulsongStatus?.schulsongFile;
  const showSchulsongSection = schulsongStatus?.hasSchulsong && schulsongFile;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">View Audio</h2>
            <p className="text-sm text-gray-500">{schoolName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Audio Visibility Banner */}
        {audioStatus && (
          <div className={`px-6 py-3 flex items-center justify-between ${
            audioStatus.audioHidden ? 'bg-red-50 border-b border-red-200' : 'bg-green-50 border-b border-green-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${audioStatus.audioHidden ? 'bg-red-500' : 'bg-green-500'}`} />
              <span className={`text-sm font-medium ${audioStatus.audioHidden ? 'text-red-700' : 'text-green-700'}`}>
                {audioStatus.audioHidden ? 'Audio ist ausgeblendet (Eltern sehen nichts)' : 'Audio ist sichtbar für Eltern'}
              </span>
            </div>
            <button
              onClick={handleToggleAudioVisibility}
              disabled={isTogglingVisibility}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                audioStatus.audioHidden
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              {isTogglingVisibility ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : null}
              {audioStatus.audioHidden ? 'Einblenden' : 'Ausblenden'}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Schulsong Section (separate from regular tracks) */}
          {showSchulsongSection && (
            <div className="mb-6 border border-amber-200 rounded-lg p-4 bg-amber-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
                    Schulsong
                  </span>
                  <span className="text-sm text-gray-500">{schulsongFile.filename}</span>
                </div>
                {schulsongFile.approvalStatus === 'approved' && schulsongStatus.releasedAt && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    Release: {formatDate(schulsongStatus.releasedAt)}
                  </span>
                )}
                {schulsongFile.approvalStatus === 'approved' && !schulsongStatus.releasedAt && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Approved</span>
                )}
                {schulsongFile.approvalStatus === 'rejected' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Rejected</span>
                )}
                {schulsongFile.approvalStatus === 'pending' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">Pending</span>
                )}
              </div>

              {/* Teacher approval status */}
              <div className="mb-3 text-sm">
                {schulsongFile.teacherApprovedAt ? (
                  <span className="text-green-700">
                    Lehrer freigegeben am {formatDate(schulsongFile.teacherApprovedAt)}
                  </span>
                ) : (
                  <span className="text-gray-500">Warten auf Lehrer-Freigabe</span>
                )}
              </div>

              {/* Audio player + Replace */}
              {schulsongFile.audioUrl && (
                <div className="mb-3 space-y-2">
                  <audio controls className="w-full h-10" src={schulsongFile.audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                  <div className="flex items-center gap-2">
                    <input
                      ref={schulsongReplaceInputRef}
                      type="file"
                      accept="audio/mpeg,.mp3,.wav,audio/wav"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && schulsongFile.audioFileId) {
                          handleReplaceAudio(schulsongFile.audioFileId, file);
                        }
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => schulsongReplaceInputRef.current?.click()}
                      disabled={replacingAudioId === schulsongFile.audioFileId}
                      className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {replacingAudioId === schulsongFile.audioFileId ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-r-transparent" />
                          {replaceProgress}
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Ersetzen
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Rejection comment display */}
              {schulsongFile.approvalStatus === 'rejected' && schulsongFile.rejectionComment && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  Rejection reason: {schulsongFile.rejectionComment}
                </div>
              )}

              {/* Already released — show release info + option to undo */}
              {schulsongFile.approvalStatus === 'approved' && schulsongStatus.releasedAt && (
                <div className="space-y-3">
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    {new Date(schulsongStatus.releasedAt) <= new Date()
                      ? 'Sofort freigegeben'
                      : `Veröffentlichung: ${formatDate(schulsongStatus.releasedAt)}`}
                  </div>
                  <button
                    onClick={() => setShowSchulsongRejectInput(!showSchulsongRejectInput)}
                    disabled={schulsongSaving}
                    className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                  {showSchulsongRejectInput && (
                    <div>
                      <textarea
                        value={schulsongRejectComment}
                        onChange={(e) => setSchulsongRejectComment(e.target.value)}
                        placeholder="Grund für Ablehnung..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={2}
                      />
                      <button
                        onClick={handleSchulsongReject}
                        disabled={schulsongSaving}
                        className="mt-2 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {schulsongSaving ? 'Saving...' : 'Ablehnung bestätigen'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Release confirmation panel */}
              {confirmRelease && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    E-Mail-Empfänger
                  </div>
                  <p className="text-sm text-blue-900">
                    <span className="font-bold">{confirmRelease.teacherCount} Lehrer</span>
                    {' + '}
                    <span className="font-bold">{confirmRelease.parentCount} Eltern</span>
                    {' werden benachrichtigt'}
                  </p>
                  <p className="text-xs text-blue-700">
                    {confirmRelease.mode === 'instant'
                      ? 'Modus: Sofort freigeben'
                      : `Modus: Geplant um 07:00`}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleConfirmRelease}
                      disabled={schulsongSaving}
                      className="px-4 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {schulsongSaving ? 'Saving...' : 'Bestätigen'}
                    </button>
                    <button
                      onClick={handleCancelRelease}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              {/* Loading spinner while fetching recipient counts */}
              {fetchingCounts && !confirmRelease && (
                <div className="flex items-center gap-2 p-3 text-sm text-gray-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                  Empfänger werden geladen...
                </div>
              )}

              {/* Teacher approved, release already scheduled — show info + override options */}
              {schulsongFile.teacherApprovedAt && schulsongFile.approvalStatus !== 'approved' && !confirmRelease && !fetchingCounts && (
                <div className="space-y-3">
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                    Lehrer hat freigegeben — Release bereits geplant
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReleaseClick('instant')}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {schulsongSaving ? 'Saving...' : 'Sofort freigeben'}
                    </button>
                    <button
                      onClick={() => setShowSchulsongRejectInput(!showSchulsongRejectInput)}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      Ablehnen
                    </button>
                  </div>

                  {showSchulsongRejectInput && (
                    <div>
                      <textarea
                        value={schulsongRejectComment}
                        onChange={(e) => setSchulsongRejectComment(e.target.value)}
                        placeholder="Grund für Ablehnung..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={2}
                      />
                      <button
                        onClick={handleSchulsongReject}
                        disabled={schulsongSaving}
                        className="mt-2 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {schulsongSaving ? 'Saving...' : 'Ablehnung bestätigen'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher hasn't approved — admin override possible */}
              {!schulsongFile.teacherApprovedAt && schulsongFile.approvalStatus !== 'approved' && !confirmRelease && !fetchingCounts && (
                <div className="space-y-3">
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                    Lehrer hat noch nicht freigegeben — Admin-Override möglich
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReleaseClick('scheduled')}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      {schulsongSaving ? 'Saving...' : 'Override: Freigeben (7 Uhr)'}
                    </button>
                    <button
                      onClick={() => handleReleaseClick('instant')}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {schulsongSaving ? 'Saving...' : 'Override: Sofort freigeben'}
                    </button>
                    <button
                      onClick={() => setShowSchulsongRejectInput(!showSchulsongRejectInput)}
                      disabled={schulsongSaving}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      Ablehnen
                    </button>
                  </div>

                  {showSchulsongRejectInput && (
                    <div>
                      <textarea
                        value={schulsongRejectComment}
                        onChange={(e) => setSchulsongRejectComment(e.target.value)}
                        placeholder="Grund für Ablehnung..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={2}
                      />
                      <button
                        onClick={handleSchulsongReject}
                        disabled={schulsongSaving}
                        className="mt-2 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {schulsongSaving ? 'Saving...' : 'Ablehnung bestätigen'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-4 text-gray-600">Loading tracks...</p>
            </div>
          ) : !audioStatus || audioStatus.tracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No tracks available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{audioStatus.expectedSongCount}</div>
                    <div className="text-xs text-gray-500">Expected</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{audioStatus.mixMasterUploadedCount}</div>
                    <div className="text-xs text-gray-500">Final Uploaded</div>
                  </div>
                </div>
              </div>

              {/* Track List */}
              {audioStatus.tracks.map((track) => (
                <div
                  key={track.audioFileId || track.songId}
                  className={`border rounded-lg p-4 ${
                    track.hasFinalAudio ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-900">{track.songTitle}</h4>
                    <p className="text-sm text-gray-500">{track.className}</p>
                  </div>

                  {!track.hasFinalAudio ? (
                    <p className="text-sm text-gray-400">No final audio uploaded yet</p>
                  ) : track.finalAudioUrl ? (
                    <div className="space-y-2">
                      <audio controls className="w-full h-10" src={track.finalAudioUrl}>
                        Your browser does not support the audio element.
                      </audio>
                      {track.audioFileId && (
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'audio/mpeg,.mp3,.wav,audio/wav';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleReplaceAudio(track.audioFileId, file);
                            };
                            input.click();
                          }}
                          disabled={replacingAudioId === track.audioFileId}
                          className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {replacingAudioId === track.audioFileId ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-r-transparent" />
                              {replaceProgress}
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Ersetzen
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
