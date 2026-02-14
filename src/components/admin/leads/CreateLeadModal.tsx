'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { LeadSource, EventTypeInterest } from '@/lib/types/airtable';

interface RegionOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  regions: RegionOption[];
  staffList: StaffOption[];
}

const LEAD_SOURCES: LeadSource[] = [
  'Inbound Call',
  'Outbound Call',
  'Website',
  'Referral',
  'Repeat Customer',
  'Event/Fair',
  'Other',
];

const EVENT_TYPES: EventTypeInterest[] = ['Minimusikertag', 'Plus', 'Kita', 'Schulsong'];

export default function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  regions,
  staffList,
}: CreateLeadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Contact Information
  const [schoolName, setSchoolName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Location
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('');

  // Lead Details
  const [estimatedChildren, setEstimatedChildren] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource | ''>('');
  const [eventTypeInterest, setEventTypeInterest] = useState<Set<EventTypeInterest>>(new Set());
  const [schulsongUpsell, setSchulsongUpsell] = useState(false);
  const [scsFunded, setScsFunded] = useState(false);
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Estimated Date
  const [dateMode, setDateMode] = useState<'specific' | 'month'>('specific');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [estimatedMonth, setEstimatedMonth] = useState('');

  // Initial Notes
  const [initialNotes, setInitialNotes] = useState('');

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSchoolName('');
      setContactPerson('');
      setContactEmail('');
      setContactPhone('');
      setAddress('');
      setPostalCode('');
      setCity('');
      setSelectedRegionId('');
      setEstimatedChildren('');
      setLeadSource('');
      setEventTypeInterest(new Set());
      setSchulsongUpsell(false);
      setScsFunded(false);
      setAssignedStaffId('');
      setDateMode('specific');
      setEstimatedDate('');
      setEstimatedMonth('');
      setInitialNotes('');
      setErrors({});
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isSubmitting, onClose]);

  const toggleEventType = (type: EventTypeInterest) => {
    setEventTypeInterest(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!schoolName.trim()) {
      newErrors.schoolName = 'School name is required';
    }
    if (!contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }
    if (!contactEmail.trim() && !contactPhone.trim()) {
      newErrors.contact = 'At least one of email or phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        schoolName: schoolName.trim(),
        contactPerson: contactPerson.trim(),
      };

      if (contactEmail.trim()) payload.contactEmail = contactEmail.trim();
      if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
      if (address.trim()) payload.address = address.trim();
      if (postalCode.trim()) payload.postalCode = postalCode.trim();
      if (city.trim()) payload.city = city.trim();
      if (selectedRegionId) payload.regionId = selectedRegionId;
      if (estimatedChildren) payload.estimatedChildren = parseInt(estimatedChildren, 10);
      if (leadSource) payload.leadSource = leadSource;
      if (eventTypeInterest.size > 0) payload.eventTypeInterest = Array.from(eventTypeInterest);
      if (schulsongUpsell) payload.schulsongUpsell = true;
      if (scsFunded) payload.scsFunded = true;
      if (assignedStaffId) payload.assignedStaffId = assignedStaffId;
      if (initialNotes.trim()) payload.initialNotes = initialNotes.trim();

      if (dateMode === 'specific' && estimatedDate) {
        payload.estimatedDate = estimatedDate;
      } else if (dateMode === 'month' && estimatedMonth) {
        payload.estimatedMonth = estimatedMonth;
      }

      const response = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create lead');
      }

      toast.success('Lead created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 id="create-lead-modal-title" className="text-lg font-semibold text-gray-900">
              Create Lead
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Add a new lead to the pipeline</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Contact Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School / Institution Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.schoolName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter school name"
                />
                {errors.schoolName && <p className="text-sm text-red-500 mt-1">{errors.schoolName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactPerson ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter contact name"
                />
                {errors.contactPerson && <p className="text-sm text-red-500 mt-1">{errors.contactPerson}</p>}
              </div>

              {errors.contact && (
                <p className="text-sm text-red-500 -mt-2">{errors.contact}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contact@school.de"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Location
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="City"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a region...</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lead Details Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Lead Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Children</label>
                <input
                  type="number"
                  value={estimatedChildren}
                  onChange={(e) => setEstimatedChildren(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 120"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value as LeadSource | '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select source...</option>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type Interest</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleEventType(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        eventTypeInterest.has(type)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle switches */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={schulsongUpsell}
                      onChange={(e) => setSchulsongUpsell(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${schulsongUpsell ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${schulsongUpsell ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">Schulsong Upsell</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={scsFunded}
                      onChange={(e) => setScsFunded(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${scsFunded ? 'bg-green-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${scsFunded ? 'translate-x-4' : ''}`} />
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">SCS Funded</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Staff</label>
                <select
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select staff member...</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>

              {/* Estimated Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Event Date</label>
                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateMode"
                      checked={dateMode === 'specific'}
                      onChange={() => setDateMode('specific')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-600">Specific Date</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateMode"
                      checked={dateMode === 'month'}
                      onChange={() => setDateMode('month')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-600">Month Only</span>
                  </label>
                </div>
                {dateMode === 'specific' ? (
                  <input
                    type="date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <input
                    type="month"
                    value={estimatedMonth}
                    onChange={(e) => setEstimatedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Initial Notes Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Initial Notes
            </h3>
            <textarea
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Notes from the first call or contact..."
            />
            <p className="text-xs text-gray-400 mt-1">This will be saved as Call 1 notes</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Lead'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
