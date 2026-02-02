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
  // Event status and type fields
  eventStatus?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted';
  isPlus?: boolean;
  isKita?: boolean;
  isSchulsong?: boolean;
}

type EventStatus = 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventBadge from '@/components/admin/EventBadge';
import StatsPill from '@/components/admin/StatsPill';
// Shared modals for class/song management
import AddClassModal from '@/components/shared/class-management/AddClassModal';
import AddSongModal from '@/components/shared/class-management/AddSongModal';
import EditClassModal from '@/components/shared/class-management/EditClassModal';
import EditSongModal from '@/components/shared/class-management/EditSongModal';
import DeleteConfirmModal from '@/components/shared/class-management/DeleteConfirmModal';
import AddGroupModal from '@/components/shared/class-management/AddGroupModal';
import EditGroupModal from '@/components/shared/class-management/EditGroupModal';
import EventActivityTimeline from '@/components/admin/EventActivityTimeline';
import DateChangeModal from '@/components/admin/events/DateChangeModal';
import AddTeacherModal from '@/components/admin/AddTeacherModal';

// Group type for admin view
interface ClassGroup {
  groupId: string;
  groupName: string;
  memberClasses: Array<{ classId: string; className: string }>;
  songs: Array<{ id: string; title: string; artist?: string; notes?: string }>;
  songCount: number;
}

// Collection type for admin view (Choir and Teacher Song)
interface Collection {
  classId: string;
  className: string;
  classType: 'choir' | 'teacher_song';
  songs: Array<{ id: string; title: string; artist?: string; notes?: string }>;
  audioStatus: {
    hasRawAudio: boolean;
    hasPreview: boolean;
    hasFinal: boolean;
  };
}

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

// Add Collection Modal Component (for Choir and Teacher Song)
interface AddCollectionModalProps {
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddCollectionModal({ eventId, onClose, onSuccess }: AddCollectionModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'choir' | 'teacher_song'>('choir');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a collection name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create collection');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Collection</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">What is a collection?</p>
              <p className="text-sm text-blue-700 mt-1">
                Collections contain songs visible to all parents - regardless of their child&apos;s class.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'choir'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="choir"
                  checked={type === 'choir'}
                  onChange={() => setType('choir')}
                  className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Choir</p>
                  <p className="text-xs text-gray-500">Group choir songs</p>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'teacher_song'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="teacher_song"
                  checked={type === 'teacher_song'}
                  onChange={() => setType('teacher_song')}
                  className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Teacher Song</p>
                  <p className="text-xs text-gray-500">Teacher performances</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              placeholder={type === 'choir' ? 'e.g. School Choir, Grade 3+4 Choir' : 'e.g. Teacher Band, Farewell Song'}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                type === 'choir'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const _router = useRouter();
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

  // Group management state
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClassGroup | null>(null);

  // Collection management state (Choir and Teacher Song)
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showAddCollection, setShowAddCollection] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'class' | 'song' | 'group';
    id: string;
    name: string;
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  // Date change modal state
  const [showDateChangeModal, setShowDateChangeModal] = useState(false);

  // Event status and type state
  const [eventStatus, setEventStatus] = useState<EventStatus | undefined>(undefined);
  const [isPlus, setIsPlus] = useState(false);
  const [isKita, setIsKita] = useState(false);
  const [isSchulsong, setIsSchulsong] = useState(false);
  const [isMinimusikertag, setIsMinimusikertag] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingToggles, setIsUpdatingToggles] = useState<string | null>(null); // Track which toggle is updating

  // Refresh teacher state
  const [isRefreshingTeacher, setIsRefreshingTeacher] = useState(false);

  // Add teacher modal state
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);

  const eventId = params.eventId as string;

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
      fetchTeamStaff();
      fetchGroups();
      fetchCollections();
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
      // Set initial event status and type values
      if (data.data?.eventStatus) {
        setEventStatus(data.data.eventStatus);
      }
      setIsPlus(data.data?.isPlus || false);
      setIsKita(data.data?.isKita || false);
      setIsSchulsong(data.data?.isSchulsong || false);
      setIsMinimusikertag(data.data?.isMinimusikertag === true);
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

  const fetchGroups = async () => {
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/groups`);
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/collections`);
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
    }
  };

  // Collection management handlers
  const handleAddCollection = () => {
    setShowAddCollection(true);
  };

  const toggleCollectionExpanded = (classId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const handleAddSongToCollection = (classId: string) => {
    setSelectedClass({ id: classId, name: '', numChildren: 0 });
    setShowAddSong(true);
  };

  // Refresh teacher handler - syncs contact person to class main_teacher
  const handleRefreshTeacher = async () => {
    setIsRefreshingTeacher(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/refresh-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh teacher');
      }

      const data = await response.json();
      toast.success(data.message || 'Teacher information refreshed');
      // Re-fetch event detail to show updated teacher
      await fetchEventDetail();
    } catch (err) {
      console.error('Error refreshing teacher:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh teacher');
    } finally {
      setIsRefreshingTeacher(false);
    }
  };

  // Event status update handler
  const handleStatusChange = async (newStatus: EventStatus) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setEventStatus(newStatus);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Event type toggle handlers
  const handleToggleChange = async (
    field: 'is_plus' | 'is_kita' | 'is_schulsong' | 'is_minimusikertag',
    value: boolean
  ) => {
    setIsUpdatingToggles(field);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update setting');
      }

      // Update local state
      if (field === 'is_plus') {
        setIsPlus(value);
      } else if (field === 'is_kita') {
        setIsKita(value);
      } else if (field === 'is_schulsong') {
        setIsSchulsong(value);
      } else if (field === 'is_minimusikertag') {
        setIsMinimusikertag(value);
      }

      const labelMap = {
        is_plus: 'Minimusikertag PLUS',
        is_kita: 'Kita',
        is_schulsong: 'Schulsong',
        is_minimusikertag: 'Minimusikertag',
      };
      toast.success(`${labelMap[field]} ${value ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Error updating toggle:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setIsUpdatingToggles(null);
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

  // Group management handlers
  const handleAddGroup = () => {
    setShowAddGroup(true);
  };

  const handleEditGroup = (group: ClassGroup) => {
    setSelectedGroup(group);
    setShowEditGroup(true);
  };

  const handleDeleteGroup = (group: ClassGroup) => {
    setDeleteTarget({
      type: 'group',
      id: group.groupId,
      name: group.groupName,
    });
    setShowDeleteConfirm(true);
  };

  const handleAddSongToGroup = (groupId: string) => {
    // Reuse the song modal with group ID
    setSelectedClass({ id: groupId, name: '', numChildren: 0 });
    setShowAddSong(true);
  };

  // Toggle group expansion
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
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

  // Confirm delete (class, song, or group)
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      let endpoint: string;
      if (deleteTarget.type === 'class') {
        endpoint = `/api/admin/classes/${deleteTarget.id}`;
      } else if (deleteTarget.type === 'group') {
        endpoint = `/api/admin/groups/${deleteTarget.id}`;
      } else {
        endpoint = `/api/admin/songs/${deleteTarget.id}`;
      }

      const response = await fetch(endpoint, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      const typeLabel = deleteTarget.type === 'class' ? 'Class' : deleteTarget.type === 'group' ? 'Group' : 'Song';
      toast.success(`${typeLabel} deleted successfully`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);

      // Refetch appropriate data
      fetchEventDetail();
      if (deleteTarget.type === 'group') {
        fetchGroups();
      }
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
              <button
                onClick={() => setShowDateChangeModal(true)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 group"
                title="Click to change date"
              >
                <span>{formatDate(event.eventDate)}</span>
                <svg
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.schoolName}</h1>
            <div className="flex items-center gap-2">
              <p className="text-gray-600">
                {event.mainTeacher
                  ? `Teacher: ${event.mainTeacher}`
                  : event.contactPerson
                    ? `Contact: ${event.contactPerson}`
                    : 'No teacher assigned'}
              </p>
              {/* Show refresh button when mainTeacher is empty but contactPerson exists */}
              {!event.mainTeacher && event.contactPerson && (
                <button
                  onClick={handleRefreshTeacher}
                  disabled={isRefreshingTeacher}
                  className="p-1 text-gray-400 hover:text-[#5a8a82] transition-colors disabled:opacity-50"
                  title="Sync contact as teacher"
                >
                  {isRefreshingTeacher ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              )}
              {/* Add Teacher Button */}
              <button
                onClick={() => setShowAddTeacherModal(true)}
                className="ml-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                title="Add another teacher to this event"
              >
                + Add Teacher
              </button>
            </div>
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

        {/* Event Status & Type Section */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Dropdown */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Event Status</h3>
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    eventStatus === 'Confirmed'
                      ? 'bg-green-500'
                      : eventStatus === 'On Hold'
                      ? 'bg-red-500'
                      : eventStatus === 'Cancelled'
                      ? 'bg-gray-400'
                      : 'bg-gray-300'
                  }`}
                />
                <select
                  value={eventStatus || ''}
                  onChange={(e) => handleStatusChange(e.target.value as EventStatus)}
                  disabled={isUpdatingStatus}
                  className="block w-40 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent disabled:opacity-50"
                >
                  <option value="">No status</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                {isUpdatingStatus && <LoadingSpinner size="sm" />}
              </div>
            </div>

            {/* Event Type Toggles */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Event Type</h3>
              <div className="space-y-3">
                {/* Minimusikertag Toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isMinimusikertag}
                      onChange={(e) =>
                        handleToggleChange('is_minimusikertag', e.target.checked)
                      }
                      disabled={isUpdatingToggles === 'is_minimusikertag'}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-green-500 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform flex items-center justify-center">
                      <span className="text-[8px] font-bold" style={{ color: '#166534' }}>M</span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    Minimusikertag
                  </span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: '#86efac', color: '#166534' }}
                  >
                    M
                  </div>
                  {isUpdatingToggles === 'is_minimusikertag' && (
                    <LoadingSpinner size="sm" />
                  )}
                </label>

                {/* Minimusikertag PLUS Toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isPlus}
                      onChange={(e) =>
                        handleToggleChange('is_plus', e.target.checked)
                      }
                      disabled={isUpdatingToggles === 'is_plus'}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    Minimusikertag PLUS
                  </span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: '#93c5fd', color: '#1e40af' }}
                  >
                    {isPlus ? '+' : 'M'}
                  </div>
                  {isUpdatingToggles === 'is_plus' && (
                    <LoadingSpinner size="sm" />
                  )}
                </label>

                {/* Kita Toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isKita}
                      onChange={(e) => handleToggleChange('is_kita', e.target.checked)}
                      disabled={isUpdatingToggles === 'is_kita'}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-violet-500 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">Kita</span>
                  {isKita && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: '#c4b5fd', color: '#5b21b6' }}
                    >
                      K
                    </div>
                  )}
                  {isUpdatingToggles === 'is_kita' && <LoadingSpinner size="sm" />}
                </label>

                {/* Schulsong Toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSchulsong}
                      onChange={(e) => handleToggleChange('is_schulsong', e.target.checked)}
                      disabled={isUpdatingToggles === 'is_schulsong'}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">Schulsong</span>
                  {isSchulsong && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: '#fdba74', color: '#9a3412' }}
                    >
                      S
                    </div>
                  )}
                  {isUpdatingToggles === 'is_schulsong' && <LoadingSpinner size="sm" />}
                </label>
              </div>
            </div>
          </div>
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

      {/* Groups Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Gruppen
            {groups.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({groups.length} {groups.length === 1 ? 'Gruppe' : 'Gruppen'})
              </span>
            )}
          </h2>
          <button
            onClick={handleAddGroup}
            disabled={!event?.classes || event.classes.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={event?.classes && event.classes.length < 2 ? 'Need at least 2 classes to create a group' : ''}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Gruppe erstellen
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-8 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Gruppen</h3>
            <p className="text-gray-600 text-sm mb-4">
              Gruppen ermöglichen es mehreren Klassen, gemeinsame Lieder zu haben.
              <br />
              Sie benötigen mindestens 2 Klassen, um eine Gruppe zu erstellen.
            </p>
            {event?.classes && event.classes.length >= 2 && (
              <button
                onClick={handleAddGroup}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Erste Gruppe erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.groupId);
              const songs = group.songs || [];

              return (
                <div
                  key={group.groupId}
                  className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden group"
                >
                  {/* Group Header - Clickable to expand */}
                  <button
                    onClick={() => toggleGroupExpanded(group.groupId)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-purple-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Group Icon */}
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>

                      {/* Group Info */}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{group.groupName}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            Gruppe
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {group.memberClasses.map((c) => c.className).join(', ')} • {songs.length}{' '}
                          {songs.length === 1 ? 'Lied' : 'Lieder'}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Icon & Actions */}
                    <div className="flex items-center gap-2">
                      {/* Action buttons (visible on hover) */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditGroup(group);
                          }}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Gruppe bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Gruppe löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                    <div className="border-t border-purple-100 px-5 py-4 bg-purple-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Lieder</h4>
                        <button
                          onClick={() => handleAddSongToGroup(group.groupId)}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Lied hinzufügen
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
                          <p className="text-sm">Noch keine Lieder</p>
                          <button
                            onClick={() => handleAddSongToGroup(group.groupId)}
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                          >
                            Erstes Lied hinzufügen
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {songs.map((song: any) => (
                            <div
                              key={song.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg group hover:bg-gray-50 transition-colors"
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
                                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="Lied bearbeiten"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Lied löschen"
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

      {/* Collections Section (Choir and Teacher Song) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Sammlungen
            {collections.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({collections.length} {collections.length === 1 ? 'Sammlung' : 'Sammlungen'})
              </span>
            )}
          </h2>
          <button
            onClick={handleAddCollection}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Sammlung erstellen
          </button>
        </div>

        {collections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Sammlungen</h3>
            <p className="text-gray-600 text-sm mb-4">
              Erstellen Sie Chor- oder Lehrerlied-Sammlungen, die alle Eltern sehen können.
            </p>
            <button
              onClick={handleAddCollection}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Erste Sammlung erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {collections.map((collection) => {
              const isExpanded = expandedCollections.has(collection.classId);
              const songs = collection.songs || [];
              const isChoir = collection.classType === 'choir';

              return (
                <div
                  key={collection.classId}
                  className={`bg-white rounded-xl shadow-sm border ${
                    isChoir ? 'border-teal-200' : 'border-amber-200'
                  } overflow-hidden group`}
                >
                  {/* Collection Header - Clickable to expand */}
                  <button
                    onClick={() => toggleCollectionExpanded(collection.classId)}
                    className={`w-full px-5 py-4 flex items-center justify-between ${
                      isChoir ? 'hover:bg-teal-50/50' : 'hover:bg-amber-50/50'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Collection Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isChoir ? 'bg-teal-100' : 'bg-amber-100'
                        }`}
                      >
                        <svg
                          className={`w-4 h-4 ${isChoir ? 'text-teal-600' : 'text-amber-600'}`}
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
                      </div>

                      {/* Collection Info */}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{collection.className}</span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              isChoir
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isChoir ? 'Chor' : 'Lehrerlied'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {songs.length} {songs.length === 1 ? 'Lied' : 'Lieder'}
                          {collection.audioStatus?.hasPreview && (
                            <span className="ml-2 text-green-600">Audio bereit</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Icon */}
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
                  </button>

                  {/* Expanded Content - Songs List */}
                  {isExpanded && (
                    <div
                      className={`border-t px-5 py-4 ${
                        isChoir ? 'border-teal-100 bg-teal-50/30' : 'border-amber-100 bg-amber-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Lieder</h4>
                        <button
                          onClick={() => handleAddSongToCollection(collection.classId)}
                          className={`text-sm font-medium flex items-center gap-1 ${
                            isChoir
                              ? 'text-teal-600 hover:text-teal-700'
                              : 'text-amber-600 hover:text-amber-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Lied hinzufügen
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
                          <p className="text-sm">Noch keine Lieder</p>
                          <button
                            onClick={() => handleAddSongToCollection(collection.classId)}
                            className={`mt-2 text-sm ${
                              isChoir
                                ? 'text-teal-600 hover:text-teal-700'
                                : 'text-amber-600 hover:text-amber-700'
                            }`}
                          >
                            Erstes Lied hinzufügen
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {songs.map((song) => (
                            <div
                              key={song.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg group hover:bg-gray-50 transition-colors"
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
                                  className={`p-1.5 text-gray-400 rounded transition-colors ${
                                    isChoir
                                      ? 'hover:text-teal-600 hover:bg-teal-50'
                                      : 'hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                  title="Lied bearbeiten"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Lied löschen"
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

      {/* Activity Timeline */}
      <div className="mt-8">
        <EventActivityTimeline eventId={eventId} />
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
            fetchGroups(); // Also refetch groups for group songs
            fetchCollections(); // Also refetch collections for collection songs
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

      {showAddGroup && event?.classes && (
        <AddGroupModal
          eventId={eventId}
          availableClasses={event.classes.map((c: any) => ({
            classId: c.classId,
            className: c.className,
          }))}
          onClose={() => setShowAddGroup(false)}
          onSuccess={() => {
            setShowAddGroup(false);
            fetchGroups();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showEditGroup && selectedGroup && event?.classes && (
        <EditGroupModal
          group={selectedGroup}
          availableClasses={event.classes.map((c: any) => ({
            classId: c.classId,
            className: c.className,
          }))}
          onClose={() => {
            setShowEditGroup(false);
            setSelectedGroup(null);
          }}
          onSuccess={() => {
            setShowEditGroup(false);
            setSelectedGroup(null);
            fetchGroups();
          }}
          apiBasePath="/api/admin"
        />
      )}

      {showDeleteConfirm && deleteTarget && (
        <DeleteConfirmModal
          title={`Delete ${deleteTarget.type === 'class' ? 'Class' : deleteTarget.type === 'group' ? 'Group' : 'Song'}?`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.${
            deleteTarget.type === 'class'
              ? ' Note: You cannot delete a class that has songs or registered children.'
              : deleteTarget.type === 'group'
              ? ' Note: You cannot delete a group that has songs.'
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

      {/* Date Change Modal */}
      <DateChangeModal
        isOpen={showDateChangeModal}
        onClose={() => setShowDateChangeModal(false)}
        eventId={eventId}
        currentEventDate={event?.eventDate ? (() => {
          const date = new Date(event.eventDate);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        })() : ''}
        currentStaffId={event?.assignedStaffId || null}
        currentStaffName={event?.assignedStaffName || null}
        schoolName={event?.schoolName || ''}
        onSuccess={() => {
          fetchEventDetail();
        }}
      />

      {/* Add Teacher Modal */}
      {showAddTeacherModal && (
        <AddTeacherModal
          eventId={eventId}
          onClose={() => setShowAddTeacherModal(false)}
          onTeacherAdded={() => {
            setShowAddTeacherModal(false);
            toast.success('Teacher added successfully');
            fetchEventDetail();
          }}
        />
      )}

      {/* Add Collection Modal */}
      {showAddCollection && (
        <AddCollectionModal
          eventId={eventId}
          onClose={() => setShowAddCollection(false)}
          onSuccess={() => {
            setShowAddCollection(false);
            fetchCollections();
            toast.success('Collection created successfully');
          }}
        />
      )}
    </div>
  );
}
