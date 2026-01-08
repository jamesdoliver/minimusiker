'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import ConfirmPrintablesModal from './ConfirmPrintablesModal';

interface BookingDetailsBreakdownProps {
  booking: BookingWithDetails;
}

export default function BookingDetailsBreakdown({ booking }: BookingDetailsBreakdownProps) {
  const [showPrintablesModal, setShowPrintablesModal] = useState(false);

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
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onClick={() => setShowPrintablesModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4A261] text-white rounded-lg hover:bg-[#E07B3A] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Confirm Printables
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
    </div>
  );
}
