'use client';

import { useEffect, useRef } from 'react';

interface FieldUpdate {
  field: string;
  label: string;
  current: string;
  new: string;
}

interface MissingField {
  field: string;
  label: string;
}

interface RefreshBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  isApplying: boolean;
  updates: FieldUpdate[];
  stillMissing: MissingField[];
  hasUpdates: boolean;
}

export default function RefreshBookingModal({
  isOpen,
  onClose,
  onApply,
  isApplying,
  updates,
  stillMissing,
  hasUpdates,
}: RefreshBookingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isApplying) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isApplying, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isApplying) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isApplying, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refresh-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="refresh-modal-title" className="text-lg font-semibold text-gray-900">Refresh Booking Data</h2>
          <button
            onClick={onClose}
            disabled={isApplying}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {hasUpdates ? (
            <>
              {/* Updates Section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 text-green-700 mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{updates.length} field{updates.length === 1 ? '' : 's'} will be updated:</span>
                </div>
                <div className="space-y-2">
                  {updates.map((update) => (
                    <div key={update.field} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700">{update.label}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-gray-500 line-through">{update.current || '(empty)'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-green-700 font-medium">{update.new}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 font-medium">Already up to date</p>
              <p className="text-gray-500 text-sm mt-1">No new data available from SimplyBook</p>
            </div>
          )}

          {/* Missing Fields Warning */}
          {stillMissing.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-sm">{stillMissing.length} field{stillMissing.length === 1 ? '' : 's'} still missing (not in SimplyBook):</span>
              </div>
              <ul className="text-sm text-amber-600 ml-7 list-disc">
                {stillMissing.map((field) => (
                  <li key={field.field}>{field.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {hasUpdates ? 'Cancel' : 'Close'}
          </button>
          {hasUpdates && (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Applying...
                </>
              ) : (
                'Apply Updates'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
