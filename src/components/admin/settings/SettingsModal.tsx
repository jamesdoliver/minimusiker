'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import NotificationSettings from './NotificationSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsCategory = 'notifications' | 'users' | 'logs';

const categories: { id: SettingsCategory; name: string; icon: string; available: boolean }[] = [
  { id: 'notifications', name: 'Benachrichtigungen', icon: '🔔', available: true },
  { id: 'users', name: 'Benutzer', icon: '👥', available: false },
  { id: 'logs', name: 'Logs', icon: '📜', available: false },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Handle escape key to close modal
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Einstellungen</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Schließen"
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

          {/* Two-panel layout */}
          <div className="flex min-h-[500px]">
            {/* Left panel - Categories */}
            <div className="w-56 border-r border-gray-200 bg-gray-50 rounded-bl-xl">
              <nav className="p-4 space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    disabled={!category.available}
                    className={cn(
                      'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      category.id === 'notifications'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : category.available
                          ? 'text-gray-600 hover:bg-white hover:text-gray-900'
                          : 'text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <span className="mr-3 text-lg">{category.icon}</span>
                    <span>{category.name}</span>
                    {!category.available && (
                      <span className="ml-auto text-xs text-gray-400">Bald</span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right panel - Settings content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <NotificationSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
