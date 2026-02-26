'use client';

import { useState, Fragment } from 'react';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import BookingDetailsBreakdown from './BookingDetailsBreakdown';
import StatusCircle from './StatusCircle';
import EventTypeCircles from './EventTypeCircles';
import { RegistrationProgress } from './RegistrationProgress';
import { ClassSongCount } from './ClassSongCount';

// Computed status type for styling
type ComputedStatus = 'confirmed' | 'completed' | 'onHold' | 'pending';

function AudioPipelineIndicator({ stage, eventDate }: { stage?: 'not_started' | 'staff_uploaded' | 'finals_submitted'; eventDate?: string }) {
  let isFuture = false;
  if (eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate + 'T00:00:00');
    eventDay.setHours(0, 0, 0, 0);
    isFuture = eventDay > today;
  }

  if (isFuture) {
    return <span title="Event hasn't happened yet" className="text-gray-400">&#x23F3;</span>;
  }
  if (!stage || stage === 'not_started') {
    return <span title="Staff audio not uploaded">&#x274C;</span>;
  }
  if (stage === 'staff_uploaded') {
    return <span title="Waiting for engineer finals">&#x2699;&#xFE0F;</span>;
  }
  if (stage === 'finals_submitted') {
    return <span title="Finals submitted">&#x2705;</span>;
  }
  return <span>—</span>;
}

interface BookingsTableProps {
  bookings: BookingWithDetails[];
  onEventDeleted?: (bookingId: string) => void;
  onNotesUpdate?: (bookingId: string, notes: string) => void;
  onRefresh?: () => void;
  getComputedStatus?: (booking: BookingWithDetails) => ComputedStatus;
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
        isOpen ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default function BookingsTable({ bookings, onEventDeleted, onNotesUpdate, onRefresh, getComputedStatus }: BookingsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (bookingId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
        <p className="text-gray-600">SimplyBook bookings will appear here once available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                School Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                C/S
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Audio
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking, index) => {
              const isExpanded = expandedRows.has(booking.id);
              const isEven = index % 2 === 0;
              // Apply reduced opacity for completed bookings
              const isCompleted = getComputedStatus?.(booking) === 'completed';

              return (
                <Fragment key={booking.id}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-100 transition-colors ${
                      isEven ? 'bg-white' : 'bg-gray-50'
                    } ${isExpanded ? 'bg-blue-50 hover:bg-blue-50' : ''} ${isCompleted ? 'opacity-60' : ''} ${booking.eventStatus === 'Pending' ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`}
                    onClick={() => toggleRow(booking.id)}
                  >
                    <td className="px-4 py-4">
                      <ChevronIcon isOpen={isExpanded} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        {booking.schoolName || 'Unknown School'}
                        {!booking.eventRecordId && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded">
                            No Event
                          </span>
                        )}
                      </div>
                      {booking.contactPerson && booking.schoolName === booking.contactPerson && (
                        <div className="text-xs text-amber-600">School name missing</div>
                      )}
                      <div className="text-xs text-gray-500">ID: {booking.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <RegistrationProgress
                        registered={booking.registrationCount || 0}
                        estimated={booking.numberOfChildren}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ClassSongCount
                        classCount={booking.classCount || 0}
                        songCount={booking.songCount || 0}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <AudioPipelineIndicator
                        stage={booking.audioPipelineStage}
                        eventDate={booking.bookingDate}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusCircle status={booking.eventStatus} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <EventTypeCircles
                        isPlus={booking.isPlus}
                        isKita={booking.isKita}
                        isSchulsong={booking.isSchulsong}
                        isMinimusikertag={booking.isMinimusikertag}
                        isStandardMerchOnly={booking.isStandardMerchOnly}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{formatDate(booking.bookingDate)}</div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{ maxHeight: isExpanded ? '1000px' : '0' }}
                        >
                          <BookingDetailsBreakdown booking={booking} onEventDeleted={onEventDeleted} onNotesUpdate={onNotesUpdate} onRefresh={onRefresh} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
