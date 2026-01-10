'use client';

import type { VideoFolder } from '@/lib/utils/weekCalculator';
import { getFolderLabel } from '@/lib/utils/weekCalculator';
import type { TeacherVideo } from '@/lib/types/teacher-videos';

interface WeekRowProps {
  folder: VideoFolder;
  videos: TeacherVideo[] | undefined;
  isLoading: boolean;
  onVideoClick: (index: number) => void;
}

export default function WeekRow({
  folder,
  videos,
  isLoading,
  onVideoClick,
}: WeekRowProps) {
  const label = getFolderLabel(folder);

  return (
    <div className="mb-6">
      <h5 className="text-sm font-medium text-gray-700 mb-3">{label}</h5>

      {isLoading ? (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-32 aspect-video bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : videos && videos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {videos.map((video, index) => (
            <button
              key={video.key}
              onClick={() => onVideoClick(index)}
              className="flex-shrink-0 w-32 group transition-all"
            >
              {/* Thumbnail */}
              <div className="aspect-video rounded-lg overflow-hidden mb-1.5 relative group-hover:ring-2 group-hover:ring-[#1a365d]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a365d]/90 to-[#2c5282]/90 flex items-center justify-center">
                  {video.isIntro ? (
                    <svg
                      className="w-5 h-5 text-white/70"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <span className="text-white/70 text-sm font-bold">
                      {video.order}
                    </span>
                  )}
                </div>

                {/* Intro badge */}
                {video.isIntro && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#F4A261] text-white text-[10px] font-medium rounded">
                    Intro
                  </div>
                )}

                {/* Hover play indicator */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow">
                      <svg
                        className="w-4 h-4 text-[#1a365d] ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title */}
              <p className="text-xs text-gray-600 truncate text-left px-0.5">
                {video.title}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Keine Videos verfügbar</p>
      )}
    </div>
  );
}
