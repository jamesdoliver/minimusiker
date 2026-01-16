'use client';

import { useState, useEffect } from 'react';

export interface EditSchoolInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress?: string;
  currentPhone?: string;
  bookingId?: string; // Airtable record ID of the specific booking to update
  onSuccess: () => void; // Refresh parent data
}

export function EditSchoolInfoModal({
  isOpen,
  onClose,
  currentAddress = '',
  currentPhone = '',
  bookingId,
  onSuccess,
}: EditSchoolInfoModalProps) {
  const [address, setAddress] = useState(currentAddress);
  const [phone, setPhone] = useState(currentPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => {
    setAddress(currentAddress);
    setPhone(currentPhone);
  }, [currentAddress, currentPhone]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!address || address.length < 10) {
      setError('Die Adresse muss mindestens 10 Zeichen lang sein');
      return;
    }

    if (phone) {
      // German phone format validation
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        setError('Ungültiges Telefonnummer-Format');
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/teacher/school/info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address.trim(),
          phone: phone.trim() || undefined,
          bookingId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern der Daten');
      }

      // Success!
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Schuldaten bearbeiten</h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Address Field */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse *
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent
                disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Straße, Hausnummer, PLZ, Ort"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Mindestens 10 Zeichen</p>
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent
                disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="+49 123 456789"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg
                hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg
                hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditSchoolInfoModal;
