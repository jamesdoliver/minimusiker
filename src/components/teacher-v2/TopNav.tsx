'use client';

interface TopNavProps {
  teacherName: string;
  schoolName: string;
  onLogout: () => void;
}

export function TopNav({ teacherName, schoolName, onLogout }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-[1100px] mx-auto px-6 py-3 flex justify-between items-center">
        {/* Left: Login area indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="font-medium">Login-Bereich</span>
          <span className="hidden sm:inline text-gray-400">|</span>
          <span className="hidden sm:inline">
            {teacherName} - {schoolName}
          </span>
        </div>

        {/* Right: Logout button */}
        <button
          onClick={onLogout}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}

export default TopNav;
