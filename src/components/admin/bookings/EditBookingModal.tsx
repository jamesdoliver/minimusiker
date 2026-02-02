'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';

// Secondary contact interface
interface SecondaryContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

// Region interface for dropdown
interface Region {
  id: string;
  name: string;
}

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingWithDetails;
  onSuccess: () => void;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditBookingModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: EditBookingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Form state - Contact Information
  const [contactName, setContactName] = useState(booking.contactPerson || '');
  const [contactEmail, setContactEmail] = useState(booking.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(booking.phone || '');

  // Form state - Location
  const [address, setAddress] = useState(booking.address || '');
  const [postalCode, setPostalCode] = useState(booking.postalCode || '');
  const [city, setCity] = useState(booking.city || '');
  const [selectedRegionId, setSelectedRegionId] = useState(booking.regionId || '');

  // Form state - Secondary Contacts
  const [secondaryContacts, setSecondaryContacts] = useState<SecondaryContact[]>(
    booking.secondaryContacts || []
  );

  // Regions for dropdown
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactName(booking.contactPerson || '');
      setContactEmail(booking.contactEmail || '');
      setContactPhone(booking.phone || '');
      setAddress(booking.address || '');
      setPostalCode(booking.postalCode || '');
      setCity(booking.city || '');
      setSelectedRegionId(booking.regionId || '');
      setSecondaryContacts(booking.secondaryContacts || []);
      setErrors({});
    }
  }, [isOpen, booking]);

  // Fetch regions on mount
  useEffect(() => {
    if (isOpen && regions.length === 0) {
      fetchRegions();
    }
  }, [isOpen]);

  const fetchRegions = async () => {
    setIsLoadingRegions(true);
    try {
      const response = await fetch('/api/admin/regions');
      if (!response.ok) throw new Error('Failed to fetch regions');
      const data = await response.json();
      setRegions(data.regions || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
      toast.error('Failed to load regions');
    } finally {
      setIsLoadingRegions(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isSaving) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isSaving, onClose]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Contact name is required
    if (!contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    // Validate email format if provided
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
      newErrors.contactEmail = 'Invalid email format';
    }

    // Validate secondary contact emails
    secondaryContacts.forEach((contact, index) => {
      if (contact.email && !EMAIL_REGEX.test(contact.email)) {
        newErrors[`secondaryEmail_${index}`] = 'Invalid email format';
      }
      if (!contact.name.trim()) {
        newErrors[`secondaryName_${index}`] = 'Name is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_contact_name: contactName,
          school_contact_email: contactEmail,
          school_phone: contactPhone,
          school_address: address,
          school_postal_code: postalCode,
          city: city,
          region: selectedRegionId || undefined,
          secondary_contacts: secondaryContacts.length > 0 ? secondaryContacts : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update booking');
      }

      // Show appropriate toast based on SimplyBook sync status
      if (data.airtableUpdated && data.simplybookUpdated) {
        toast.success('Booking updated successfully', {
          description: 'Changes synced to Airtable and SimplyBook',
        });
      } else if (data.airtableUpdated && !data.simplybookUpdated) {
        toast.warning('Booking partially updated', {
          description: data.simplybookError || 'SimplyBook sync failed',
          duration: 6000,
        });
      } else {
        toast.info(data.message);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update booking');
    } finally {
      setIsSaving(false);
    }
  };

  // Add secondary contact
  const addSecondaryContact = () => {
    setSecondaryContacts([...secondaryContacts, { name: '', email: '', phone: '', role: '' }]);
  };

  // Remove secondary contact
  const removeSecondaryContact = (index: number) => {
    setSecondaryContacts(secondaryContacts.filter((_, i) => i !== index));
    // Clear any errors for this contact
    const newErrors = { ...errors };
    delete newErrors[`secondaryName_${index}`];
    delete newErrors[`secondaryEmail_${index}`];
    setErrors(newErrors);
  };

  // Update secondary contact
  const updateSecondaryContact = (
    index: number,
    field: keyof SecondaryContact,
    value: string
  ) => {
    const updated = [...secondaryContacts];
    updated[index] = { ...updated[index], [field]: value };
    setSecondaryContacts(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-booking-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 id="edit-booking-modal-title" className="text-lg font-semibold text-gray-900">
              Edit Booking
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{booking.schoolName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Contact Information
            </h3>
            <div className="space-y-4">
              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter contact name"
                />
                {errors.contactName && (
                  <p className="text-sm text-red-500 mt-1">{errors.contactName}</p>
                )}
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="contact@school.de"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500 mt-1">{errors.contactEmail}</p>
                )}
              </div>

              {/* Contact Phone */}
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

          {/* Location Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Location
            </h3>
            <div className="space-y-4">
              {/* Address */}
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

              {/* Postal Code and City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
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

              {/* Region Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  disabled={isLoadingRegions}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-wait"
                >
                  <option value="">Select a region...</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
                {isLoadingRegions && (
                  <p className="text-xs text-gray-500 mt-1">Loading regions...</p>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Contacts Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Secondary Contacts
              </h3>
              <button
                type="button"
                onClick={addSecondaryContact}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Contact
              </button>
            </div>

            {secondaryContacts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No secondary contacts added</p>
            ) : (
              <div className="space-y-4">
                {secondaryContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeSecondaryContact(index)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      aria-label="Remove contact"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateSecondaryContact(index, 'name', e.target.value)}
                          className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            errors[`secondaryName_${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Name"
                        />
                        {errors[`secondaryName_${index}`] && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {errors[`secondaryName_${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                        <input
                          type="text"
                          value={contact.role || ''}
                          onChange={(e) => updateSecondaryContact(index, 'role', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Secretary"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={contact.email || ''}
                          onChange={(e) => updateSecondaryContact(index, 'email', e.target.value)}
                          className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            errors[`secondaryEmail_${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="email@school.de"
                        />
                        {errors[`secondaryEmail_${index}`] && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {errors[`secondaryEmail_${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={contact.phone || ''}
                          onChange={(e) => updateSecondaryContact(index, 'phone', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
