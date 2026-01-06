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
// Shared modals for class/song management
import AddClassModal from '@/components/shared/class-management/AddClassModal';
import AddSongModal from '@/components/shared/class-management/AddSongModal';
import EditClassModal from '@/components/shared/class-management/EditClassModal';
import EditSongModal from '@/components/shared/class-management/EditSongModal';
import DeleteConfirmModal from '@/components/shared/class-management/DeleteConfirmModal';

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

  // Class/Song management state
  const [showAddClass, setShowAddClass] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showEditSong, setShowEditSong] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Selected items for editing/deleting
  const [selectedClass, setSelectedClass] = useState<{
    id: string;
    name: string;
    numChildren?: number;
  } | null>(null);

  const [selectedSong, setSelectedSong] = useState<{
    id: string;
    title: string;
    artist?: string;
    notes?: string;
  } | null>(null);

  // Track which classes are expanded to show songs
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'class' | 'song';
    id: string;
    name: string;
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

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

  // Class management handlers
  const handleAddClass = () => {
    setShowAddClass(true);
  };

  const handleEditClass = (cls: any) => {
    setSelectedClass({
      id: cls.classId,
      name: cls.className,
      numChildren: cls.totalChildren,
    });
    setShowEditClass(true);
  };

  const handleDeleteClass = (cls: any) => {
    setDeleteTarget({
      type: 'class',
      id: cls.classId,
      name: cls.className,
    });
    setShowDeleteConfirm(true);
  };

  // Song management handlers
  const handleAddSong = (classId: string) => {
    setSelectedClass({ id: classId, name: '', numChildren: 0 });
    setShowAddSong(true);
  };

  const handleEditSong = (song: any) => {
    setSelectedSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      notes: song.notes,
    });
    setShowEditSong(true);
  };

  const handleDeleteSong = (song: any) => {
    setDeleteTarget({
      type: 'song',
      id: song.id,
      name: song.title,
    });
    setShowDeleteConfirm(true);
  };

  // Toggle class expansion
  const toggleClassExpanded = (classId: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  // Confirm delete (class or song)
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === 'class'
          ? `/api/admin/classes/${deleteTarget.id}`
          : `/api/admin/songs/${deleteTarget.id}`;

      const response = await fetch(endpoint, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success(`${deleteTarget.type === 'class' ? 'Class' : 'Song'} deleted successfully`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      fetchEventDetail(); // Refetch to update UI
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Classes & Songs</h2>
          <button
            onClick={handleAddClass}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Class
          </button>
        </div>

        {event.classes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Yet</h3>
            <p className="text-gray-600 mb-4">
              Add a class to start managing songs for this event.
            </p>
            <button
              onClick={handleAddClass}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add First Class
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {event.classes.map((cls: any) => {
              const isExpanded = expandedClasses.has(cls.classId);
              const songs = cls.songs || [];

              return (
                <div
                  key={cls.classId}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group"
                >
                  {/* Class Header - Clickable to expand */}
                  <button
                    onClick={() => toggleClassExpanded(cls.classId)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Class Info */}
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{cls.className}</div>
                        <div className="text-sm text-gray-500">
                          {cls.totalChildren} children • {songs.length} {songs.length === 1 ? 'song' : 'songs'}
                        </div>
                      </div>

                      {/* Registration Progress */}
                      <div className="flex items-center gap-2 ml-auto mr-4">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              cls.registrationRate >= 75
                                ? 'bg-green-500'
                                : cls.registrationRate >= 50
                                ? 'bg-blue-500'
                                : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(cls.registrationRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-10">{cls.registrationRate}%</span>
                      </div>
                    </div>

                    {/* Expand/Collapse Icon & Actions */}
                    <div className="flex items-center gap-2">
                      {/* Action buttons (visible on hover) */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClass(cls);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit class"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(cls);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete class"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Content - Songs List */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Songs</h4>
                        <button
                          onClick={() => handleAddSong(cls.classId)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Song
                        </button>
                      </div>

                      {songs.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <svg
                            className="w-8 h-8 mx-auto mb-2 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                            />
                          </svg>
                          <p className="text-sm">No songs added yet</p>
                          <button
                            onClick={() => handleAddSong(cls.classId)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                          >
                            Add First Song
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {songs.map((song: any) => (
                            <div
                              key={song.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{song.title}</div>
                                {song.artist && (
                                  <div className="text-sm text-gray-500 truncate">{song.artist}</div>
                                )}
                                {song.notes && (
                                  <div className="text-xs text-gray-400 mt-1 truncate">{song.notes}</div>
                                )}
                              </div>

                              {/* Song actions */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditSong(song)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit song"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete song"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddClass && (
        <AddClassModal
          eventId={eventId}
          onClose={() => setShowAddClass(false)}
          onSuccess={() => {
            setShowAddClass(false);
            fetchEventDetail();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showEditClass && selectedClass && (
        <EditClassModal
          classId={selectedClass.id}
          className={selectedClass.name}
          numChildren={selectedClass.numChildren}
          onClose={() => {
            setShowEditClass(false);
            setSelectedClass(null);
          }}
          onSuccess={() => {
            setShowEditClass(false);
            setSelectedClass(null);
            fetchEventDetail();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showAddSong && selectedClass && (
        <AddSongModal
          classId={selectedClass.id}
          eventId={eventId}
          onClose={() => {
            setShowAddSong(false);
            setSelectedClass(null);
          }}
          onSuccess={() => {
            setShowAddSong(false);
            setSelectedClass(null);
            fetchEventDetail();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showEditSong && selectedSong && (
        <EditSongModal
          songId={selectedSong.id}
          title={selectedSong.title}
          artist={selectedSong.artist}
          notes={selectedSong.notes}
          onClose={() => {
            setShowEditSong(false);
            setSelectedSong(null);
          }}
          onSuccess={() => {
            setShowEditSong(false);
            setSelectedSong(null);
            fetchEventDetail();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showDeleteConfirm && deleteTarget && (
        <DeleteConfirmModal
          title={`Delete ${deleteTarget.type === 'class' ? 'Class' : 'Song'}?`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.${
            deleteTarget.type === 'class'
              ? ' Note: You cannot delete a class that has songs or registered children.'
              : ''
          }`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteTarget(null);
          }}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
