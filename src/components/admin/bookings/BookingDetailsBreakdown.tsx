'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import ConfirmPrintablesModal from './ConfirmPrintablesModal';
import RefreshBookingModal from './RefreshBookingModal';
import OrderOverviewModal from './OrderOverviewModal';

interface BookingDetailsBreakdownProps {
  booking: BookingWithDetails;
}

export default function BookingDetailsBreakdown({ booking }: BookingDetailsBreakdownProps) {
  const [showPrintablesModal, setShowPrintablesModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshData, setRefreshData] = useState<{
    updates: Array<{ field: string; label: string; current: string; new: string }>;
    stillMissing: Array<{ field: string; label: string }>;
    hasUpdates: boolean;
  } | null>(null);
  const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Generate QR code on mount
  useEffect(() => {
    if (booking.shortUrl) {
      QRCode.toDataURL(`https://${booking.shortUrl}`, {
        width: 240, // 2x for retina display
        margin: 1,
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [booking.shortUrl]);

  // Download QR code as PNG
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qr-${booking.schoolName.replace(/[^a-zA-Z0-9]/g, '-')}-${booking.code}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (!booking.shortUrl) return;
    navigator.clipboard.writeText(`https://${booking.shortUrl}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
        // Refresh the page to show updated data
        window.location.reload();
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

  return (
    <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
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
          </div>

          {/* Event QR Code - below Contact Information */}
          {booking.shortUrl && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Event QR Code</h4>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col items-center">
                  {/* QR Code Image */}
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Event QR Code"
                      width={120}
                      height={120}
                      className="mb-3"
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] bg-gray-100 rounded flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  )}

                  {/* Link Display */}
                  <p className="text-xs font-mono text-gray-600 mb-3 text-center break-all">
                    {booking.shortUrl}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      {linkCopied ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadQr}
                      disabled={!qrDataUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Location</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Address</label>
              <p className="text-sm text-gray-900">{booking.address || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Postal Code</label>
              <p className="text-sm text-gray-900">{booking.postalCode || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Region</label>
              <p className="text-sm text-gray-900">{booking.region || '-'}</p>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Booking Details</h4>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Booking Code</label>
              <p className="text-sm font-mono text-gray-900">{booking.code}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Event Type</label>
              <p className="text-sm text-gray-900">{booking.eventName || 'MiniMusiker Day'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Time</label>
              <p className="text-sm text-gray-900">
                {booking.startTime && booking.endTime
                  ? `${booking.startTime} - ${booking.endTime}`
                  : booking.startTime || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Est. Children</label>
              <p className="text-sm text-gray-900">{booking.numberOfChildren || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Size Category</label>
              <p className="text-sm text-gray-900">{booking.costCategory || '-'}</p>
            </div>
            {/* Short URL for Parent Registration */}
            {booking.shortUrl && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Parent Registration Link</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-blue-600">{booking.shortUrl}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://${booking.shortUrl}`);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy link"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onClick={() => handleRefresh()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Booking Data
            </>
          )}
        </button>
        <button
          onClick={() => setShowPrintablesModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4A261] text-white rounded-lg hover:bg-[#E07B3A] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Confirm Printables
        </button>
        <button
          onClick={() => setShowOrdersModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Order Overview
        </button>
        <Link
          href={`/admin/events/${booking.code}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#94B8B3] text-white rounded-lg hover:bg-[#7da39e] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Event Details
        </Link>
      </div>

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
    </div>
  );
}
