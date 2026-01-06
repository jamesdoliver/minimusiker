'use client';

import { useState } from 'react';

export interface RepresentativeContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  email: string;
  phone?: string;
}

export function RepresentativeContactModal({
  isOpen,
  onClose,
  name,
  email,
  phone,
}: RepresentativeContactModalProps) {
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const handleCopy = async (text: string, field: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Kontakt zu {name}</h3>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">E-Mail</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900">
                {email}
              </div>
              <button
                onClick={() => handleCopy(email, 'email')}
                className="px-4 py-2 text-sm bg-pink-600 text-white rounded-lg
                  hover:bg-pink-700 transition-colors flex items-center gap-2"
              >
                {copiedField === 'email' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Kopiert
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Kopieren
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Phone */}
          {phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900">
                  {phone}
                </div>
                <button
                  onClick={() => handleCopy(phone, 'phone')}
                  className="px-4 py-2 text-sm bg-pink-600 text-white rounded-lg
                    hover:bg-pink-700 transition-colors flex items-center gap-2"
                >
                  {copiedField === 'phone' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Kopiert
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Kopieren
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg
              hover:bg-gray-50 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

export default RepresentativeContactModal;
