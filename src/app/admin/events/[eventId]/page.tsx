'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { SchoolEventDetail, TeamStaffMember } from '@/lib/types/airtable';

// Extended type that includes booking info from API fallback
interface EventDetailWithBooking extends SchoolEventDetail {
  bookingInfo?: {
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    postalCode?: string;
    region?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    costCategory?: string;
  };
}
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventBadge from '@/components/admin/EventBadge';
import StatsPill from '@/components/admin/StatsPill';

function formatDate(dateString: string): string {
  if (!dateString) return 'No date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetailWithBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff assignment state
  const [teamStaff, setTeamStaff] = useState<TeamStaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const eventId = params.eventId as string;

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
      fetchTeamStaff();
    }
  }, [eventId]);

  const fetchEventDetail = async () => {
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error('Failed to fetch event details');
      }
      const data = await response.json();
      setEvent(data.data);
      // Set initial selected staff if event has assigned staff
      if (data.data?.assignedStaffId) {
        setSelectedStaffId(data.data.assignedStaffId);
      }
    } catch (err) {
      console.error('Error fetching event detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamStaff = async () => {
    try {
      const response = await fetch('/api/staff/team');
      if (response.ok) {
        const data = await response.json();
        setTeamStaff(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching team staff:', err);
    }
  };

  const handleAssignStaff = async (staffId: string) => {
    setIsAssigning(true);
    setAssignError(null);

    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/assign-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign staff');
      }

      const data = await response.json();
      setSelectedStaffId(staffId);

      // Update event with new staff info
      if (data.data) {
        setEvent(prev => prev ? {
          ...prev,
          assignedStaffId: data.data.assignedStaffId,
          assignedStaffName: data.data.assignedStaffName,
        } : null);
      }

      // Show success toast
      const staffName = teamStaff.find(s => s.id === staffId)?.name;
      if (staffId) {
        toast.success('Staff assigned', {
          description: `${staffName} is now managing this event`,
        });
      } else {
        toast.success('Staff unassigned', {
          description: 'No staff is assigned to this event',
        });
      }
    } catch (err) {
      console.error('Error assigning staff:', err);
      setAssignError(err instanceof Error ? err.message : 'Failed to assign staff');
      toast.error('Failed to assign staff', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div>
        <Link
          href="/admin/bookings"
          className="text-[#5a8a82] hover:text-[#4a7a72] flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bookings
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error || 'Event not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back Navigation */}
      <Link
        href="/admin/bookings"
        className="text-[#5a8a82] hover:text-[#4a7a72] flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Bookings
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          {/* Left: Event Info */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <EventBadge type={event.eventType} size="md" />
              <span className="text-gray-500">{formatDate(event.eventDate)}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.schoolName}</h1>
            <p className="text-gray-600">
              {event.mainTeacher ? `Teacher: ${event.mainTeacher}` : 'No teacher assigned'}
            </p>
          </div>

          {/* Right: Stats */}
          <div className="flex gap-3">
            <StatsPill icon="classes" value={event.classCount} label="Classes" />
            <StatsPill icon="children" value={event.totalChildren} label="Children" />
            <StatsPill icon="parents" value={event.totalParents} label="Parents" />
          </div>
        </div>

        {/* Staff Assignment Section */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Staff Assignment</h3>
              <p className="text-xs text-gray-500">
                Assign a team member to manage this event
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedStaffId}
                onChange={(e) => handleAssignStaff(e.target.value)}
                disabled={isAssigning}
                className="block w-56 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No staff assigned</option>
                {teamStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
              {isAssigning && (
                <LoadingSpinner size="sm" />
              )}
            </div>
          </div>
          {assignError && (
            <p className="mt-2 text-sm text-red-600">{assignError}</p>
          )}
        </div>

        {/* Registration Progress */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Overall Registration</span>
            <span className="text-sm font-semibold text-[#5a8a82]">
              {event.overallRegistrationRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#94B8B3] h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(event.overallRegistrationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Booking Info Section - shown when no classes exist */}
      {event.bookingInfo && event.classes.length === 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Information</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact</h3>
                <div className="space-y-2">
                  {event.bookingInfo.contactEmail && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Email</span>
                      <p className="text-sm">
                        <a href={`mailto:${event.bookingInfo.contactEmail}`} className="text-blue-600 hover:underline">
                          {event.bookingInfo.contactEmail}
                        </a>
                      </p>
                    </div>
                  )}
                  {event.bookingInfo.contactPhone && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Phone</span>
                      <p className="text-sm">
                        <a href={`tel:${event.bookingInfo.contactPhone}`} className="text-blue-600 hover:underline">
                          {event.bookingInfo.contactPhone}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Location</h3>
                <div className="space-y-2">
                  {event.bookingInfo.address && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Address</span>
                      <p className="text-sm text-gray-900">{event.bookingInfo.address}</p>
                    </div>
                  )}
                  {(event.bookingInfo.postalCode || event.bookingInfo.region) && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Region</span>
                      <p className="text-sm text-gray-900">
                        {[event.bookingInfo.postalCode, event.bookingInfo.region].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Event Details</h3>
                <div className="space-y-2">
                  {(event.bookingInfo.startTime || event.bookingInfo.endTime) && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Time</span>
                      <p className="text-sm text-gray-900">
                        {event.bookingInfo.startTime}{event.bookingInfo.endTime ? ` - ${event.bookingInfo.endTime}` : ''}
                      </p>
                    </div>
                  )}
                  {event.bookingInfo.status && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Status</span>
                      <p className="text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          event.bookingInfo.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          event.bookingInfo.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {event.bookingInfo.status.charAt(0).toUpperCase() + event.bookingInfo.status.slice(1)}
                        </span>
                      </p>
                    </div>
                  )}
                  {event.bookingInfo.costCategory && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Size</span>
                      <p className="text-sm text-gray-900">{event.bookingInfo.costCategory}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Classes Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Classes</h2>

        {event.classes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-3xl mb-3">📚</div>
            <p className="text-gray-600">No classes have been added to this event yet.</p>
            <p className="text-sm text-gray-500 mt-2">Classes will appear here once the teacher adds them.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Children
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {event.classes.map((cls) => (
                  <tr key={cls.classId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{cls.className}</div>
                      <div className="text-xs text-gray-400 font-mono">{cls.classId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {cls.mainTeacher || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {cls.totalChildren}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cls.registeredParents === 0
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {cls.registeredParents} {cls.registeredParents === 1 ? 'parent' : 'parents'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              cls.registrationRate >= 75
                                ? 'bg-green-500'
                                : cls.registrationRate >= 50
                                ? 'bg-[#94B8B3]'
                                : cls.registrationRate >= 25
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(cls.registrationRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-10">{cls.registrationRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
