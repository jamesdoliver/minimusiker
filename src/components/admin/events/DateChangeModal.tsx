'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import StaffCalendarView from './StaffCalendarView';
import StaffSelectorSidebar, { StaffMemberWithRegions } from './StaffSelectorSidebar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface DateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  currentEventDate: string; // YYYY-MM-DD format
  currentStaffId: string | null;
  currentStaffName: string | null;
  schoolName: string;
  onSuccess: () => void;
}

interface Booking {
  date: string;
  schoolName: string;
  eventId: string;
}

export default function DateChangeModal({
  isOpen,
  onClose,
  eventId,
  currentEventDate,
  currentStaffId,
  currentStaffName,
  schoolName,
  onSuccess,
}: DateChangeModalProps) {
  // Staff list state
  const [staff, setStaff] = useState<StaffMemberWithRegions[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);

  // Selected staff for viewing calendar
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(currentStaffId);

  // Bookings for the selected staff
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Selected new date
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch staff list on mount
  useEffect(() => {
    if (isOpen) {
      fetchStaff();
    }
  }, [isOpen]);

  // Fetch bookings when selected staff changes
  useEffect(() => {
    if (isOpen && selectedStaffId) {
      fetchBookings(selectedStaffId);
    } else {
      setBookings([]);
    }
  }, [isOpen, selectedStaffId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStaffId(currentStaffId);
      setSelectedDate(null);
      setShowConfirmDialog(false);
    }
  }, [isOpen, currentStaffId]);

  const fetchStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const response = await fetch('/api/admin/staff');
      if (!response.ok) throw new Error('Failed to fetch staff');
      const data = await response.json();
      setStaff(data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const fetchBookings = async (staffId: string) => {
    setIsLoadingBookings(true);
    try {
      // Get 3 months of data (current month ± 1)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const startStr = formatDateStr(startDate);
      const endStr = formatDateStr(endDate);

      const response = await fetch(
        `/api/admin/staff/bookings?staffId=${encodeURIComponent(staffId)}&startDate=${startStr}&endDate=${endStr}`
      );
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load staff bookings');
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const formatDateStr = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowConfirmDialog(true);
  };

  const handleBlockedDateClick = (date: string, bookingSchoolName: string) => {
    const staffName = staff.find((s) => s.id === selectedStaffId)?.name || 'This staff member';
    toast.error(`${staffName} already has a booking on this date`, {
      description: bookingSchoolName,
    });
  };

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedDate(null); // Reset selected date when changing staff
  };

  const handleConfirm = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const isStaffChanging = selectedStaffId !== currentStaffId;

      // Build request body
      const body: Record<string, unknown> = {
        event_date: selectedDate,
      };

      // Include staff change if different
      if (isStaffChanging && selectedStaffId) {
        body.assigned_staff = selectedStaffId;
      }

      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update event');
      }

      const data = await response.json();

      // Build success message
      let message = 'Event date updated';
      if (isStaffChanging) {
        const newStaffName = staff.find((s) => s.id === selectedStaffId)?.name || 'new staff';
        message = `Event moved to ${formatDisplayDate(selectedDate)} and reassigned to ${newStaffName}`;
      } else {
        message = `Event moved to ${formatDisplayDate(selectedDate)}`;
      }

      // Show SimplyBook sync status
      if (data.simplybookSynced) {
        toast.success(message, {
          description: '✓ SimplyBook calendar updated',
        });
      } else if (data.simplybookSynced === false) {
        // Airtable updated but SimplyBook sync failed
        toast.warning(message, {
          description: '⚠ SimplyBook was not updated - please update manually',
          duration: 6000,
        });
      } else {
        // No SimplyBook ID linked (older booking or no sync configured)
        toast.success(message);
      }
      setShowConfirmDialog(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setSelectedDate(null);
  };

  if (!isOpen) return null;

  const isStaffChanging = selectedStaffId !== currentStaffId;
  const selectedStaffName = staff.find((s) => s.id === selectedStaffId)?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Change Event Date</h2>
            <p className="text-sm text-gray-500 mt-0.5">{schoolName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex gap-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Calendar */}
          <div className="flex-1">
            {isLoadingBookings ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <StaffCalendarView
                bookings={bookings}
                currentEventDate={currentEventDate}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onBlockedDateClick={handleBlockedDateClick}
              />
            )}
          </div>

          {/* Staff Sidebar */}
          <StaffSelectorSidebar
            staff={staff}
            selectedStaffId={selectedStaffId}
            currentStaffId={currentStaffId}
            onSelectStaff={handleStaffSelect}
            isLoading={isLoadingStaff}
          />
        </div>

        {/* Footer with current selection info */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedStaffId ? (
                <span>
                  Viewing calendar for: <strong>{selectedStaffName}</strong>
                  {isStaffChanging && currentStaffName && (
                    <span className="text-orange-600 ml-2">
                      (currently assigned to {currentStaffName})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">Select a staff member to view their availability</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedDate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={handleCancelConfirm} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Date Change
            </h3>

            <div className="space-y-3 mb-6">
              <p className="text-gray-600">
                Move event from{' '}
                <strong>{formatDisplayDate(currentEventDate)}</strong>
                {' '}to{' '}
                <strong>{formatDisplayDate(selectedDate)}</strong>?
              </p>

              {isStaffChanging && selectedStaffName && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Staff change:</strong> This will also reassign the event from{' '}
                    <strong>{currentStaffName || 'unassigned'}</strong> to{' '}
                    <strong>{selectedStaffName}</strong>.
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    An email notification will be sent to {selectedStaffName}.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelConfirm}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
