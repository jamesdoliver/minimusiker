'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { SchoolEventDetail, TeamStaffMember } from '@/lib/types/airtable';
import AlbumLayoutModal from '@/components/shared/AlbumLayoutModal';

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
  eventStatus?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted' | 'Pending';
  isPlus?: boolean;
  isKita?: boolean;
  isSchulsong?: boolean;
}

type EventStatus = 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted' | 'Pending';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventBadge from '@/components/admin/EventBadge';
import StatsPill from '@/components/admin/StatsPill';
// Shared modals for class/song management
import AddClassModal from '@/components/shared/class-management/AddClassModal';
import AddSongModal from '@/components/shared/class-management/AddSongModal';
import EditClassModal from '@/components/shared/class-management/EditClassModal';
import EditSongModal from '@/components/shared/class-management/EditSongModal';
import DeleteConfirmModal from '@/components/shared/class-management/DeleteConfirmModal';
import EditGroupModal from '@/components/shared/class-management/EditGroupModal';
import UnifiedAddModal from '@/components/shared/class-management/UnifiedAddModal';
import EventActivityTimeline from '@/components/admin/EventActivityTimeline';
import DateChangeModal from '@/components/admin/events/DateChangeModal';
import AddTeacherModal from '@/components/admin/AddTeacherModal';
import DealBuilder from '@/components/admin/DealBuilder';
import SchulClothingOrder from '@/components/shared/SchulClothingOrder';
import type { DealType, DealConfig } from '@/lib/types/airtable';

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
  const [showCreateChoir, setShowCreateChoir] = useState(false);
  const [showCreateTeacherSong, setShowCreateTeacherSong] = useState(false);

  // Collection management state (Choir and Teacher Song)
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Album layout modal state
  const [showAlbumLayoutModal, setShowAlbumLayoutModal] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'class' | 'song' | 'group';
    id: string;
    name: string;
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  // Move data confirmation dialog (for classes/groups with attached data)
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<'class' | 'group'>('class');
  const [pendingDeleteName, setPendingDeleteName] = useState<string>('');
  const [pendingData, setPendingData] = useState({ songCount: 0, registrationCount: 0, audioFileCount: 0 });

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

  // Deal Builder state
  const [dealBuilderEnabled, setDealBuilderEnabled] = useState(false);
  const [dealType, setDealType] = useState<DealType | null>(null);
  const [dealConfig, setDealConfig] = useState<DealConfig>({});
  const [estimatedChildren, setEstimatedChildren] = useState<number | undefined>(undefined);
  const [isUnder100, setIsUnder100] = useState(false);
  const [standardMerchOverride, setStandardMerchOverride] = useState<'auto' | 'force-standard' | 'force-personalized'>('auto');
  const [isUpdatingDeal, setIsUpdatingDeal] = useState(false);

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
      // Deal Builder state
      setDealBuilderEnabled(data.data?.dealBuilderEnabled || false);
      setDealType(data.data?.dealType || null);
      setDealConfig(data.data?.dealConfig || {});
      setEstimatedChildren(data.data?.estimatedChildren);
      setIsUnder100(data.data?.isUnder100 || false);
      setStandardMerchOverride(data.data?.standardMerchOverride || 'auto');
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

  // Derived filtered arrays for Chor and Lehrerlied sections
  const choirs = collections.filter(c => c.classType === 'choir');
  const teacherSongs = collections.filter(c => c.classType === 'teacher_song');

  // Collection management handlers
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
    field: 'is_kita' | 'is_schulsong',
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

      if (field === 'is_kita') {
        setIsKita(value);
      } else if (field === 'is_schulsong') {
        setIsSchulsong(value);
      }

      const labelMap = {
        is_kita: 'Kita',
        is_schulsong: 'Schulsong',
      };
      toast.success(`${labelMap[field]} ${value ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Error updating toggle:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setIsUpdatingToggles(null);
    }
  };

  // Tier switch handler (Off ←→ Minimusikertag ←→ PLUS)
  const currentTier: 'off' | 'minimusikertag' | 'plus' = isPlus ? 'plus' : isMinimusikertag ? 'minimusikertag' : 'off';
  const handleTierSwitch = async (newTier: 'off' | 'minimusikertag' | 'plus') => {
    if (newTier === currentTier) return;
    setIsUpdatingToggles('tier');
    const newIsPlus = newTier === 'plus';
    const newIsMinimusikertag = newTier === 'minimusikertag';
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_plus: newIsPlus,
          is_minimusikertag: newIsMinimusikertag,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update tier');
      }

      setIsPlus(newIsPlus);
      setIsMinimusikertag(newIsMinimusikertag);
      const tierLabels = { off: 'Off', minimusikertag: 'Minimusikertag', plus: 'PLUS' };
      toast.success(`Tier: ${tierLabels[newTier]}`);
    } catch (err) {
      console.error('Error updating tier:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update tier');
    } finally {
      setIsUpdatingToggles(null);
    }
  };

  // Deal Builder handlers
  const handleDealToggleEnabled = async (enabled: boolean) => {
    setIsUpdatingDeal(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_builder_enabled: enabled,
          ...(enabled && dealType ? { deal_type: dealType, deal_config: dealConfig } : {}),
        }),
      });
      if (!response.ok) throw new Error('Failed to toggle Deal Builder');
      setDealBuilderEnabled(enabled);
      // Re-fetch to sync boolean flags
      fetchEventDetail();
      toast.success(enabled ? 'Deal Builder enabled' : 'Deal Builder disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle Deal Builder');
    } finally {
      setIsUpdatingDeal(false);
    }
  };

  const handleDealUpdate = async (newDealType: DealType | null, newConfig: DealConfig) => {
    setIsUpdatingDeal(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_builder_enabled: true,
          deal_type: newDealType,
          deal_config: newConfig,
        }),
      });
      if (!response.ok) throw new Error('Failed to save deal');
      setDealType(newDealType);
      setDealConfig(newConfig);
      // Re-fetch to sync boolean flags
      fetchEventDetail();
      toast.success('Deal saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save deal');
    } finally {
      setIsUpdatingDeal(false);
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
      const data = await response.json();

      if (!response.ok) {
        // Handle DATA_ATTACHED error - show move confirmation dialog
        if (data.code === 'DATA_ATTACHED' && (deleteTarget.type === 'class' || deleteTarget.type === 'group')) {
          setPendingDeleteId(deleteTarget.id);
          setPendingDeleteType(deleteTarget.type);
          setPendingDeleteName(deleteTarget.name);
          setPendingData({
            songCount: data.songCount || 0,
            registrationCount: data.registrationCount || 0,
            audioFileCount: data.audioFileCount || 0,
          });
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
          setShowMoveDialog(true);
          return;
        }
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

  // Confirm move data to "Alle Kinder" and then delete
  const handleConfirmMoveAndDelete = async () => {
    if (!pendingDeleteId) return;

    setIsDeleting(true);
    try {
      const endpoint = pendingDeleteType === 'class'
        ? `/api/admin/classes/${pendingDeleteId}?confirmMove=true`
        : `/api/admin/groups/${pendingDeleteId}?confirmMove=true`;

      const response = await fetch(endpoint, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete');
      }

      const typeLabel = pendingDeleteType === 'class' ? 'Class' : 'Group';
      toast.success(`${typeLabel} deleted - data moved to "Alle Kinder"`);
      setShowMoveDialog(false);
      setPendingDeleteId(null);
      setPendingDeleteName('');

      // Refetch data
      fetchEventDetail();
      if (pendingDeleteType === 'group') {
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
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{event.schoolName}</h1>
              <Link
                href={`/admin/events/${params.eventId}/settings`}
                className="p-1 text-gray-400 hover:text-[#5a8a82] transition-colors"
                title="Event-Einstellungen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
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
                      : eventStatus === 'Pending'
                      ? 'bg-yellow-500'
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
                  <option value="Pending">Pending</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                {isUpdatingStatus && <LoadingSpinner size="sm" />}
              </div>
            </div>

            {/* Event Type Toggles */}
            <div className={dealBuilderEnabled ? 'opacity-50 pointer-events-none' : ''}>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Event Type {dealBuilderEnabled && <span className="text-xs text-gray-400">(controlled by Deal Builder)</span>}</h3>
              <div className="space-y-3">
                {/* Off ←→ Minimusikertag ←→ PLUS Segmented Control */}
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex rounded-lg p-0.5 ${isUpdatingToggles === 'tier' ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ backgroundColor: '#e5e7eb' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTierSwitch('off')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                      style={currentTier === 'off' ? {
                        backgroundColor: '#d1d5db',
                        color: '#374151',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      } : {
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                      }}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={currentTier === 'off' ? { backgroundColor: '#374151', color: '#d1d5db' } : { backgroundColor: '#d1d5db', color: '#6b7280' }}
                      >&mdash;</span>
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTierSwitch('minimusikertag')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                      style={currentTier === 'minimusikertag' ? {
                        backgroundColor: '#86efac',
                        color: '#166534',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      } : {
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                      }}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={currentTier === 'minimusikertag' ? { backgroundColor: '#166534', color: '#86efac' } : { backgroundColor: '#d1d5db', color: '#6b7280' }}
                      >M</span>
                      Minimusikertag
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTierSwitch('plus')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                      style={currentTier === 'plus' ? {
                        backgroundColor: '#93c5fd',
                        color: '#1e40af',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      } : {
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                      }}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={currentTier === 'plus' ? { backgroundColor: '#1e40af', color: '#93c5fd' } : { backgroundColor: '#d1d5db', color: '#6b7280' }}
                      >+</span>
                      PLUS
                    </button>
                  </div>
                  {isUpdatingToggles === 'tier' && <LoadingSpinner size="sm" />}
                </div>

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

            {/* Standard Merch Override */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Standard Merch Gate</h3>
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex rounded-lg p-0.5 ${isUpdatingToggles === 'standard_merch' ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{ backgroundColor: '#e5e7eb' }}
                >
                  {([
                    { value: 'auto' as const, label: 'Auto' },
                    { value: 'force-standard' as const, label: 'Standard Only' },
                    { value: 'force-personalized' as const, label: 'Personalized' },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isUpdatingToggles === 'standard_merch'}
                      onClick={async () => {
                        setIsUpdatingToggles('standard_merch');
                        try {
                          const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ standard_merch_override: option.value === 'auto' ? null : option.value }),
                          });
                          if (!response.ok) throw new Error('Failed to update');
                          setStandardMerchOverride(option.value);
                          toast.success(`Standard Merch: ${option.label}`);
                        } catch {
                          toast.error('Failed to update standard merch override');
                        } finally {
                          setIsUpdatingToggles(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={standardMerchOverride === option.value ? {
                        backgroundColor: '#d1d5db',
                        color: '#374151',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      } : {
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {isUpdatingToggles === 'standard_merch' && <LoadingSpinner size="sm" />}
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  (standardMerchOverride === 'force-standard' || (standardMerchOverride === 'auto' && isUnder100))
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {standardMerchOverride === 'auto'
                    ? (isUnder100 ? 'Standard only (<100 Kinder)' : 'Personalisiert erlaubt')
                    : standardMerchOverride === 'force-standard'
                    ? 'Override: Standard only'
                    : 'Override: Personalisiert'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {estimatedChildren !== undefined
                  ? `${estimatedChildren} geschätzte Kinder (Auto-Schwelle: <100 = Standard only)`
                  : 'Keine geschätzte Kinderzahl gesetzt'}
              </p>
            </div>

            {/* Deal Builder */}
            <div className="mt-4">
              <DealBuilder
                eventId={eventId}
                enabled={dealBuilderEnabled}
                dealType={dealType}
                dealConfig={dealConfig}
                estimatedChildren={estimatedChildren}
                onToggleEnabled={handleDealToggleEnabled}
                onUpdate={handleDealUpdate}
                isUpdating={isUpdatingDeal}
              />
            </div>

            {/* SCS Clothing Order (only for mimuSCS with shirts included) */}
            {dealType === 'mimu_scs' && dealConfig.scs_shirts_included !== false && (
              <div className="mt-4">
                <SchulClothingOrder
                  eventId={eventId}
                  apiBasePath="/api/admin/events"
                  maxQuantity={(estimatedChildren ?? 0) > 250 ? 500 : 250}
                />
              </div>
            )}
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Classes & Songs</h2>
            <button
              onClick={() => setShowAlbumLayoutModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Album-Reihenfolge für das gedruckte Album festlegen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Album-Reihenfolge
            </button>
          </div>
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

        {/* Missing songs warning */}
        {event.classes.length > 0 && event.classes.some((c: any) => (c.songs || []).length === 0) && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-yellow-800">
                Folgende Klassen haben noch keine Lieder:{' '}
                <span className="font-medium">
                  {event.classes.filter((c: any) => (c.songs || []).length === 0).map((c: any) => c.className).join(', ')}
                </span>
                {' '}&mdash; diese fehlen in der Album-Reihenfolge.
              </p>
            </div>
          </div>
        )}

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

      {/* Chor Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Chor
            {choirs.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({choirs.length} {choirs.length === 1 ? 'Chor' : 'Chöre'})
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowCreateChoir(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Chor erstellen
          </button>
        </div>

        {choirs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-teal-100 p-8 text-center">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Chöre</h3>
            <p className="text-gray-600 text-sm">
              Chöre sind für alle Eltern sichtbar, unabhängig von der Klasse.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {choirs.map((collection) => {
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

      {/* Lehrerlied Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Lehrerlied
            {teacherSongs.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({teacherSongs.length} {teacherSongs.length === 1 ? 'Lehrerlied' : 'Lehrerlieder'})
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowCreateTeacherSong(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Lehrerlied erstellen
          </button>
        </div>

        {teacherSongs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-8 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Lehrerlieder</h3>
            <p className="text-gray-600 text-sm">
              Lehrerlieder sind für alle Eltern sichtbar, unabhängig von der Klasse.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {teacherSongs.map((collection) => {
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

      {/* Unified Add Modal (Group, Choir, Teacher Song) */}
      {showAddGroup && event?.classes && (
        <UnifiedAddModal
          eventId={eventId}
          availableClasses={event.classes.map((c: any) => ({
            classId: c.classId,
            className: c.className,
          }))}
          onClose={() => setShowAddGroup(false)}
          onSuccess={() => {
            setShowAddGroup(false);
            fetchGroups();
            fetchCollections();
          }}
          apiBasePath="/api/admin"
          initialTab="group"
          hideTabBar
        />
      )}

      {showCreateChoir && event?.classes && (
        <UnifiedAddModal
          eventId={eventId}
          availableClasses={event.classes.map((c: any) => ({
            classId: c.classId,
            className: c.className,
          }))}
          onClose={() => setShowCreateChoir(false)}
          onSuccess={() => {
            setShowCreateChoir(false);
            fetchCollections();
          }}
          apiBasePath="/api/admin"
          initialTab="choir"
          hideTabBar
        />
      )}

      {showCreateTeacherSong && event?.classes && (
        <UnifiedAddModal
          eventId={eventId}
          availableClasses={event.classes.map((c: any) => ({
            classId: c.classId,
            className: c.className,
          }))}
          onClose={() => setShowCreateTeacherSong(false)}
          onSuccess={() => {
            setShowCreateTeacherSong(false);
            fetchCollections();
          }}
          apiBasePath="/api/admin"
          initialTab="teacher_song"
          hideTabBar
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
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteTarget(null);
          }}
          isDeleting={isDeleting}
        />
      )}

      {/* Move Data Confirmation Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Data Will Be Moved</h3>
            </div>

            <p className="text-gray-600 mb-4">
              <span className="font-medium">"{pendingDeleteName}"</span> has attached data:
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              {pendingData.songCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className="text-gray-700">{pendingData.songCount} {pendingData.songCount === 1 ? 'song' : 'songs'}</span>
                </div>
              )}
              {pendingData.registrationCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-700">{pendingData.registrationCount} {pendingData.registrationCount === 1 ? 'registration' : 'registrations'}</span>
                </div>
              )}
              {pendingData.audioFileCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span className="text-gray-700">{pendingData.audioFileCount} {pendingData.audioFileCount === 1 ? 'audio file' : 'audio files'}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This data will be moved to <span className="font-medium">"Alle Kinder"</span> before deleting the {pendingDeleteType}.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMoveDialog(false);
                  setPendingDeleteId(null);
                  setPendingDeleteName('');
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMoveAndDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Moving...
                  </>
                ) : (
                  'Move & Delete'
                )}
              </button>
            </div>
          </div>
        </div>
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

      {/* Album Layout Modal */}
      {showAlbumLayoutModal && (
        <AlbumLayoutModal
          eventId={eventId}
          apiBaseUrl={`/api/admin/events/${encodeURIComponent(eventId)}/album-order`}
          classesWithoutSongs={event?.classes.filter((c: any) => (c.songs || []).length === 0).map((c: any) => c.className)}
          onClose={() => setShowAlbumLayoutModal(false)}
          onSave={fetchEventDetail}
        />
      )}

    </div>
  );
}
