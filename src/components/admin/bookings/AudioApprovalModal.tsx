'use client';

import { useState, useEffect, useRef } from 'react';
import { AudioStatusData, TrackApprovalInfo, ApprovalStatus } from '@/lib/types/audio-status';
import { toast } from 'sonner';

interface AudioApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  schoolName: string;
  onApprovalComplete?: () => void;
}

export default function AudioApprovalModal({
  isOpen,
  onClose,
  eventId,
  schoolName,
  onApprovalComplete,
}: AudioApprovalModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatusData | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, { status: ApprovalStatus; comment?: string }>>(
    new Map()
  );
  const [rejectionComments, setRejectionComments] = useState<Map<string, string>>(new Map());
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (isOpen) {
      fetchAudioStatus();
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

      // Initialize pending approvals from current status
      const initialApprovals = new Map<string, { status: ApprovalStatus; comment?: string }>();
      data.data.tracks.forEach((track: TrackApprovalInfo) => {
        if (track.audioFileId) {
          initialApprovals.set(track.audioFileId, {
            status: track.approvalStatus,
            comment: track.rejectionComment,
          });
        }
      });
      setPendingApprovals(initialApprovals);
    } catch (error) {
      console.error('Error fetching audio status:', error);
      toast.error('Failed to load audio status');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalChange = (audioFileId: string, status: ApprovalStatus) => {
    setPendingApprovals(new Map(pendingApprovals.set(audioFileId, { status })));
    if (status === 'rejected') {
      setShowRejectInput(audioFileId);
    } else {
      setShowRejectInput(null);
    }
  };

  const handleRejectComment = (audioFileId: string, comment: string) => {
    setRejectionComments(new Map(rejectionComments.set(audioFileId, comment)));
    const approval = pendingApprovals.get(audioFileId) || { status: 'rejected' as ApprovalStatus };
    setPendingApprovals(new Map(pendingApprovals.set(audioFileId, { ...approval, comment })));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Build track approvals array - only include changed tracks
      const trackApprovals = Array.from(pendingApprovals.entries())
        .filter(([audioFileId, approval]) => {
          const originalTrack = audioStatus?.tracks.find(t => t.audioFileId === audioFileId);
          return originalTrack && approval.status !== originalTrack.approvalStatus;
        })
        .map(([audioFileId, approval]) => ({
          audioFileId,
          status: approval.status as 'approved' | 'rejected',
          comment: approval.comment,
        }));

      if (trackApprovals.length === 0) {
        toast.info('No changes to save');
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/approve-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackApprovals }),
      });

      if (!response.ok) {
        throw new Error('Failed to save approvals');
      }

      const result = await response.json();

      if (result.allTracksApproved) {
        toast.success('All tracks approved!');
      } else {
        toast.success(`Saved ${trackApprovals.length} approval(s)`);
      }

      if (onApprovalComplete) {
        onApprovalComplete();
      }

      // Refresh the status
      await fetchAudioStatus();
    } catch (error) {
      console.error('Error saving approvals:', error);
      toast.error('Failed to save approvals');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">Pending</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Audio Approval</h2>
            <p className="text-sm text-gray-500">{schoolName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={saving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-4 text-gray-600">Loading tracks...</p>
            </div>
          ) : !audioStatus || audioStatus.tracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No tracks available for approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{audioStatus.expectedSongCount}</div>
                    <div className="text-xs text-gray-500">Expected</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{audioStatus.mixMasterUploadedCount}</div>
                    <div className="text-xs text-gray-500">Final Uploaded</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {audioStatus.tracks.filter(t => pendingApprovals.get(t.audioFileId)?.status === 'approved').length}
                    </div>
                    <div className="text-xs text-gray-500">Approved</div>
                  </div>
                </div>
              </div>

              {/* Track List */}
              {audioStatus.tracks.map((track) => {
                const currentApproval = pendingApprovals.get(track.audioFileId);
                const currentStatus = currentApproval?.status || track.approvalStatus;

                return (
                  <div
                    key={track.audioFileId || track.songId}
                    className={`border rounded-lg p-4 ${
                      track.hasFinalAudio ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{track.songTitle}</h4>
                          {track.isSchulsong && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                              Schulsong
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{track.className}</p>
                      </div>
                      {getStatusBadge(currentStatus)}
                    </div>

                    {!track.hasFinalAudio ? (
                      <p className="text-sm text-gray-400">No final audio uploaded yet</p>
                    ) : (
                      <>
                        {/* Audio Player */}
                        {track.finalAudioUrl && (
                          <div className="mb-3">
                            <audio
                              ref={(el) => {
                                if (el) audioRefs.current.set(track.audioFileId, el);
                              }}
                              controls
                              className="w-full h-10"
                              src={track.finalAudioUrl}
                            >
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}

                        {/* Approval Actions */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleApprovalChange(track.audioFileId, 'approved')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              currentStatus === 'approved'
                                ? 'bg-green-600 text-white'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprovalChange(track.audioFileId, 'rejected')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              currentStatus === 'rejected'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            Reject
                          </button>
                        </div>

                        {/* Rejection Comment */}
                        {(showRejectInput === track.audioFileId || currentStatus === 'rejected') && (
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">Rejection reason:</label>
                            <textarea
                              value={rejectionComments.get(track.audioFileId) || currentApproval?.comment || ''}
                              onChange={(e) => handleRejectComment(track.audioFileId, e.target.value)}
                              placeholder="Enter reason for rejection..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                              rows={2}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
