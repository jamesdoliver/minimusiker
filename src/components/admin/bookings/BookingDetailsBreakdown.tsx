'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import ConfirmPrintablesModal from './ConfirmPrintablesModal';
import RefreshBookingModal from './RefreshBookingModal';
import OrderOverviewModal from './OrderOverviewModal';
import EditBookingModal from './EditBookingModal';
import DeleteConfirmModal from '@/components/shared/class-management/DeleteConfirmModal';
import StatusLight from './StatusLight';
import AudioReviewModal from './AudioReviewModal';
import EventActivityTimeline from '@/components/admin/EventActivityTimeline';
import { AudioStatusData } from '@/lib/types/audio-status';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface BookingDetailsBreakdownProps {
  booking: BookingWithDetails;
  onEventDeleted?: (bookingId: string) => void;
  onNotesUpdate?: (bookingId: string, notes: string) => void;
  onRefresh?: () => void;
}

export default function BookingDetailsBreakdown({ booking, onEventDeleted, onNotesUpdate, onRefresh }: BookingDetailsBreakdownProps) {
  const [showPrintablesModal, setShowPrintablesModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [discountCopied, setDiscountCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshData, setRefreshData] = useState<{
    updates: Array<{ field: string; label: string; current: string; new: string }>;
    stillMissing: Array<{ field: string; label: string }>;
    hasUpdates: boolean;
  } | null>(null);
  const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatusData | null>(null);
  const [audioStatusLoading, setAudioStatusLoading] = useState(false);
  const [showAudioReviewModal, setShowAudioReviewModal] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [dealExpanded, setDealExpanded] = useState(true);

  // Admin notes state
  const [notesText, setNotesText] = useState(booking.adminNotes || '');
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync notes from prop when booking changes
  useEffect(() => {
    setNotesText(booking.adminNotes || '');
  }, [booking.adminNotes]);

  const handleNotesChange = useCallback((value: string) => {
    setNotesText(value);
    setNotesSaveStatus('idle');

    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    notesTimerRef.current = setTimeout(async () => {
      setNotesSaveStatus('saving');
      try {
        const res = await fetch(`/api/admin/events/${encodeURIComponent(booking.code)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_notes: value }),
        });
        if (res.ok) {
          setNotesSaveStatus('saved');
          onNotesUpdate?.(booking.id, value);
        } else {
          setNotesSaveStatus('idle');
          toast.error('Failed to save notes');
        }
      } catch {
        setNotesSaveStatus('idle');
        toast.error('Failed to save notes');
      }
    }, 1000);
  }, [booking.code, booking.id, onNotesUpdate]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
      }
    };
  }, []);

  // Fetch audio status on mount
  useEffect(() => {
    const fetchAudioStatus = async () => {
      setAudioStatusLoading(true);
      try {
        const response = await fetch(`/api/admin/events/${encodeURIComponent(booking.code)}/audio-status`);
        if (response.ok) {
          const data = await response.json();
          setAudioStatus(data.data);
        }
      } catch (error) {
        console.error('Error fetching audio status:', error);
      } finally {
        setAudioStatusLoading(false);
      }
    };

    fetchAudioStatus();
  }, [booking.code]);

  const handleToggleAudioVisibility = async () => {
    if (!audioStatus || isTogglingVisibility) return;
    const newHidden = !audioStatus.audioHidden;
    setIsTogglingVisibility(true);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(booking.code)}/toggle-audio-visibility`,
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

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (!booking.shortUrl) return;
    navigator.clipboard.writeText(`https://${booking.shortUrl}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Download QR code as PNG
  const handleDownloadQR = async () => {
    if (!booking.shortUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(`https://${booking.shortUrl}`, {
        width: 400,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-${booking.accessCode || 'event'}.png`;
      a.click();
    } catch {
      toast.error('Failed to generate QR code');
    }
  };

  // Copy discount code to clipboard
  const handleCopyDiscount = () => {
    if (!booking.discountCode) return;
    navigator.clipboard.writeText(booking.discountCode);
    setDiscountCopied(true);
    setTimeout(() => setDiscountCopied(false), 2000);
  };

  // Create event for bookings missing one
  const handleCreateEvent = async () => {
    setIsCreatingEvent(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/create-event`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.alreadyExisted ? 'Event already exists' : 'Event created successfully');
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Create event error:', error);
      toast.error('Failed to create event');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Refresh booking data from SimplyBook
  const handleRefresh = async (forceRefreshOverride?: boolean) => {
    const useForceRefresh = forceRefreshOverride ?? forceRefresh;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=true&forceRefresh=${useForceRefresh}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to fetch data: ${errorData.error || response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setRefreshData({
          updates: data.updates,
          stillMissing: data.stillMissing,
          hasUpdates: data.hasUpdates,
        });
        setShowRefreshModal(true);
      } else {
        alert(`Failed to fetch data: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect to SimplyBook');
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Apply refresh updates
  const handleApplyRefresh = async () => {
    setIsApplyingRefresh(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=false&forceRefresh=${forceRefresh}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to apply updates: ${errorData.error || response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setShowRefreshModal(false);
        setRefreshData(null);
        onRefresh?.();
      } else {
        alert(`Failed to apply updates: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to apply updates');
      console.error('Apply refresh error:', error);
    } finally {
      setIsApplyingRefresh(false);
    }
  };

  // Delete event handler
  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/events/${booking.code}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || 'Event deleted successfully');
        setIsDeleteModalOpen(false);
        onEventDeleted?.(booking.id);
      } else {
        toast.error(data.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Delete event error:', error);
      toast.error('Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  // Deal summary helpers
  const hasDeal = booking.dealBuilderEnabled && booking.dealConfig?.fee_breakdown;
  const feeBreakdown = booking.dealConfig?.fee_breakdown;

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  const dealTypeLabel = (type?: string) => {
    switch (type) {
      case 'mimu': return 'mimu';
      case 'mimu_scs': return 'mimuSCS';
      case 'schus': return 'schus';
      case 'schus_xl': return 'schusXL';
      default: return type || 'deal';
    }
  };

  const dealTypeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'mimu': return 'bg-blue-100 text-blue-800';
      case 'mimu_scs': return 'bg-purple-100 text-purple-800';
      case 'schus': return 'bg-green-100 text-green-800';
      case 'schus_xl': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
      {/* 3-Column Layout: Information | Notes | Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Information Column */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Information</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Contact Person</label>
              <p className="text-sm font-medium text-gray-900">{booking.contactPerson || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
              <p className="text-sm text-gray-900">
                {booking.contactEmail ? (
                  <a href={`mailto:${booking.contactEmail}`} className="text-blue-600 hover:underline">
                    {booking.contactEmail}
                  </a>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Phone</label>
              <p className="text-sm text-gray-900">
                {booking.phone ? (
                  <a href={`tel:${booking.phone}`} className="text-blue-600 hover:underline">
                    {booking.phone}
                  </a>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Address</label>
              <p className="text-sm text-gray-900">
                {booking.address || '-'}
                {(booking.postalCode || booking.city) && (
                  <>, {[booking.postalCode, booking.city].filter(Boolean).join(' ')}</>
                )}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Region & Team</label>
              <p className="text-sm text-gray-900">
                {[
                  booking.region,
                  booking.assignedStaffNames?.join(', ')
                ].filter(Boolean).join(' \u2014 ') || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Booking Code</label>
              <p className="text-sm font-mono text-gray-900">{booking.code}</p>
            </div>
            {booking.discountCode && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Discount Code</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-900">{booking.discountCode}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyDiscount(); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy discount code"
                  >
                    {discountCopied ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Time</label>
              <p className="text-sm text-gray-900">
                {booking.startTime && booking.endTime
                  ? `${booking.startTime} - ${booking.endTime}`
                  : booking.startTime || '-'}
              </p>
            </div>
            {booking.shortUrl && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Access Link</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <button
                    onClick={handleCopyLink}
                    className="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    title="Click to copy"
                  >
                    {linkCopied ? (
                      <span className="text-green-600 font-sans">Copied!</span>
                    ) : (
                      booking.shortUrl
                    )}
                  </button>
                  <button
                    onClick={handleDownloadQR}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    title="Download QR code"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    QR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Deal Summary + Notes */}
        <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>

          {/* Deal Summary — only when deal is configured */}
          {hasDeal && feeBreakdown && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Deal Summary</h4>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <button
                  onClick={() => setDealExpanded(!dealExpanded)}
                  className="w-full flex justify-between items-center text-left"
                >
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dealTypeBadgeStyle(booking.dealType)}`}>
                    #{dealTypeLabel(booking.dealType)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatEuro(feeBreakdown.total)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${dealExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {dealExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Grundgebühr</span>
                      <span>{formatEuro(feeBreakdown.base)}</span>
                    </div>
                    {feeBreakdown.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-gray-600">
                        <span>+ {item.label}</span>
                        <span>{formatEuro(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium text-gray-900 border-t border-gray-100 pt-1">
                      <span>Gesamt</span>
                      <span>{formatEuro(feeBreakdown.total)}</span>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      ({formatEuro(Math.round(feeBreakdown.total / 1.19))} netto)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Notes</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col flex-1">
            <textarea
              value={notesText}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[280px] flex-1"
              placeholder="Add notes about this booking..."
            />
            {notesSaveStatus !== 'idle' && (
              <p className={`text-xs mt-1 ${notesSaveStatus === 'saving' ? 'text-gray-400' : 'text-green-600'}`}>
                {notesSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
              </p>
            )}
          </div>
        </div>

        {/* Activity Log Column */}
        <div className="flex flex-col">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Activity Log</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1">
            <EventActivityTimeline
              eventId={booking.code}
              schoolName={booking.schoolName}
              compact
            />
          </div>
        </div>
      </div>

      {/* Audio Status Section */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Audio Status</h4>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {audioStatusLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading audio status...</span>
            </div>
          ) : audioStatus ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <StatusLight
                  label="Staff Upload"
                  isComplete={audioStatus.staffUploadComplete}
                />
                <StatusLight
                  label="Mix Master"
                  isComplete={audioStatus.mixMasterUploadComplete}
                />
                {/* Audio visibility toggle */}
                <button
                  onClick={handleToggleAudioVisibility}
                  disabled={isTogglingVisibility}
                  className="flex items-center gap-2 group"
                  title={audioStatus.audioHidden ? 'Audio ist ausgeblendet – klicken zum Einblenden' : 'Audio ist sichtbar – klicken zum Ausblenden'}
                >
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${
                    isTogglingVisibility ? 'opacity-50' : ''
                  } ${audioStatus.audioHidden ? 'bg-gray-300' : 'bg-green-500'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      audioStatus.audioHidden ? '' : 'translate-x-4'
                    }`} />
                  </div>
                  <span className={`text-xs font-medium ${audioStatus.audioHidden ? 'text-red-600' : 'text-green-700'}`}>
                    {audioStatus.audioHidden ? 'Ausgeblendet' : 'Sichtbar'}
                  </span>
                </button>
              </div>
              <button
                onClick={() => setShowAudioReviewModal(true)}
                disabled={!audioStatus || audioStatus.mixMasterUploadedCount === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  audioStatus && audioStatus.mixMasterUploadedCount > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                View Audio
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Unable to load audio status</p>
          )}
        </div>
      </div>

      {/* Compact Actions Row */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-1.5">
        {!booking.eventRecordId && (
          <button
            onClick={handleCreateEvent}
            disabled={isCreatingEvent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {isCreatingEvent ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Event
              </>
            )}
          </button>
        )}
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
        <button
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={() => handleRefresh()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
        <button
          onClick={() => setShowPrintablesModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#F4A261] text-white rounded-lg hover:bg-[#E07B3A] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Printables
        </button>
        <button
          onClick={() => setShowOrdersModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Orders
        </button>
        <Link
          href={`/admin/events/${booking.code}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#94B8B3] text-white rounded-lg hover:bg-[#7da39e] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Event
        </Link>
      </div>

      {/* Delete Event Confirmation Modal */}
      {isDeleteModalOpen && (
        <DeleteConfirmModal
          title="Delete Event"
          message={`Are you sure you want to delete the event for "${booking.schoolName}" on ${booking.bookingDate}? (Access code: ${booking.code}) This will mark the event and booking as deleted.`}
          onConfirm={handleDeleteEvent}
          onCancel={() => setIsDeleteModalOpen(false)}
          isDeleting={isDeleting}
        />
      )}

      {/* Confirm Printables Modal */}
      <ConfirmPrintablesModal
        isOpen={showPrintablesModal}
        onClose={() => setShowPrintablesModal(false)}
        booking={booking}
      />

      {/* Refresh Booking Data Modal */}
      {refreshData && (
        <RefreshBookingModal
          isOpen={showRefreshModal}
          onClose={() => {
            setShowRefreshModal(false);
            setRefreshData(null);
            setForceRefresh(false);
          }}
          onApply={handleApplyRefresh}
          isApplying={isApplyingRefresh}
          updates={refreshData.updates}
          stillMissing={refreshData.stillMissing}
          hasUpdates={refreshData.hasUpdates}
          forceRefresh={forceRefresh}
          onForceRefreshChange={(value) => {
            setForceRefresh(value);
            // Re-fetch preview with new forceRefresh value
            handleRefresh(value);
          }}
        />
      )}

      {/* Order Overview Modal */}
      <OrderOverviewModal
        isOpen={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        eventId={booking.code}
        schoolName={booking.schoolName}
        eventDate={booking.bookingDate}
      />

      {/* Edit Booking Modal */}
      <EditBookingModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        booking={booking}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* Audio Review Modal */}
      <AudioReviewModal
        isOpen={showAudioReviewModal}
        onClose={() => setShowAudioReviewModal(false)}
        eventId={booking.code}
        schoolName={booking.schoolName}
      />
    </div>
  );
}
