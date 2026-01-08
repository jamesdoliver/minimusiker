'use client';

interface AudioComingSoonProps {
  /** School logo URL to display */
  schoolLogoUrl?: string;
  /** Message to display below the logo */
  message: string;
  /** Optional title above the logo */
  title?: string;
}

export default function AudioComingSoon({
  schoolLogoUrl,
  message,
  title = 'Audiovorschau',
}: AudioComingSoonProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Logo and Message */}
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          {/* School Logo */}
          {schoolLogoUrl ? (
            <div className="w-24 h-24 relative">
              <img
                src={schoolLogoUrl}
                alt="School logo"
                className="w-full h-full object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : (
            <div className="w-24 h-24 bg-sage-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-sage-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}

          {/* Message */}
          <div className="bg-sage-50 border border-sage-200 rounded-lg px-4 py-3 text-center max-w-sm">
            <p className="text-sm text-sage-800">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
