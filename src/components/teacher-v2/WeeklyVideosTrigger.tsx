'use client';

import { useState, useEffect } from 'react';
import { calculateVideoFolder, type WeekInfo } from '@/lib/utils/weekCalculator';
import WeeklyVideosPopup from './WeeklyVideosPopup';

interface WeeklyVideosTriggerProps {
  eventDate: string;
  eventId: string;
}

export default function WeeklyVideosTrigger({ eventDate, eventId }: WeeklyVideosTriggerProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);

  useEffect(() => {
    const info = calculateVideoFolder(eventDate);
    setWeekInfo(info);
  }, [eventDate]);

  if (!weekInfo) return null;

  // Generate display text for days remaining
  const getDaysText = () => {
    if (weekInfo.daysRemaining > 0) {
      return `Noch ${weekInfo.daysRemaining} ${weekInfo.daysRemaining === 1 ? 'Tag' : 'Tage'} bis zum Event`;
    }
    if (weekInfo.daysRemaining === 0) {
      return 'Heute ist der große Tag!';
    }
    const daysAgo = Math.abs(weekInfo.daysRemaining);
    return `Event war vor ${daysAgo} ${daysAgo === 1 ? 'Tag' : 'Tagen'}`;
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Video Thumbnail with Play Button */}
        <button
          onClick={() => setIsPopupOpen(true)}
          className="relative group w-full aspect-video bg-gray-100 rounded-xl overflow-hidden mb-4 hover:shadow-lg transition-all duration-200"
        >
          {/* Thumbnail Background - Gradient with week indicator */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a365d] to-[#2c5282] flex items-center justify-center">
            <div className="text-white/20 text-7xl font-bold">
              {weekInfo.weekNumber || (weekInfo.folder === 'EventDay' ? '!' : '✓')}
            </div>
          </div>

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <svg
                className="w-7 h-7 text-[#1a365d] ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Week Badge */}
          <div className="absolute top-3 left-3 px-3 py-1 bg-[#F4A261] text-white text-xs font-medium rounded-full shadow-sm">
            {weekInfo.label}
          </div>

          {/* Video icon indicator */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/50 rounded text-white/90 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Videos
          </div>
        </button>

        {/* "Wochenvideos" Button */}
        <button
          onClick={() => setIsPopupOpen(true)}
          className="px-6 py-2.5 bg-[#1a365d] text-white rounded-lg font-medium text-sm hover:bg-[#2c5282] transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Wochenvideos
        </button>

        {/* Days remaining text */}
        <p className="text-xs text-gray-500 mt-3">
          {getDaysText()}
        </p>
      </div>

      {/* Popup */}
      {isPopupOpen && (
        <WeeklyVideosPopup
          eventDate={eventDate}
          eventId={eventId}
          weekInfo={weekInfo}
          onClose={() => setIsPopupOpen(false)}
        />
      )}
    </>
  );
}
