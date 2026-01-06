'use client';

import { useState } from 'react';
import { SchoolLogoUploader } from './SchoolLogoUploader';
import { EditSchoolInfoModal } from './EditSchoolInfoModal';

export interface SchoolInfoCardProps {
  schoolName: string;
  address?: string;
  email: string;
  phone?: string;
  logoUrl?: string | null;
  onLogoChange?: (url: string) => void;
  onInfoUpdate?: () => void; // Callback after successful edit
}

export function SchoolInfoCard({
  schoolName,
  address,
  email,
  phone,
  logoUrl,
  onLogoChange,
  onInfoUpdate,
}: SchoolInfoCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    onInfoUpdate?.();
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Logo and School Name */}
        <div className="flex items-center gap-4 mb-6">
          <SchoolLogoUploader
            currentLogoUrl={logoUrl}
            schoolName={schoolName}
            onUploadSuccess={(url) => onLogoChange?.(url)}
          />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{schoolName}</h2>
            <button
              onClick={() => {
                /* Trigger logo uploader - handled by SchoolLogoUploader click */
              }}
              className="text-sm text-pink-600 hover:text-pink-700 transition-colors"
            >
              Logo ändern
            </button>
          </div>
        </div>

        {/* School Contact Information */}
        <div className="space-y-3 mb-6">
          {/* Address */}
          {address && (
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              <p className="text-gray-700 text-sm">{address}</p>
            </div>
          )}

          {/* Email */}
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <a
              href={`mailto:${email}`}
              className="text-gray-700 text-sm hover:text-pink-600 transition-colors"
            >
              {email}
            </a>
          </div>

          {/* Phone */}
          {phone && (
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <a
                href={`tel:${phone}`}
                className="text-gray-700 text-sm hover:text-pink-600 transition-colors"
              >
                {phone}
              </a>
            </div>
          )}
        </div>

        {/* Edit Data Button */}
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="w-full py-2 px-4 text-pink-600 border border-pink-600 rounded-lg
            hover:bg-pink-50 transition-colors text-sm font-medium"
        >
          Daten ändern
        </button>
      </div>

      {/* Edit Modal */}
      <EditSchoolInfoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentAddress={address}
        currentPhone={phone}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}

export default SchoolInfoCard;
