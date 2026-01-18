'use client';

import { useState } from 'react';
import Image from 'next/image';

const VIDEO_ASSETS = {
  thumbnail: '/images/familie/1.png',
  source: 'https://pub-fb1a222fd3604798884aaca0f34f1acc.r2.dev/familie-login-videos/Eltern-Introvideo.mp4',
};

export default function VideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-lg">
        <video
          src={VIDEO_ASSETS.source}
          className="w-full h-full object-cover"
          controls
          autoPlay
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsPlaying(true)}
      className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="absolute inset-0 bg-gray-200">
        <Image
          src={VIDEO_ASSETS.thumbnail}
          alt="Video thumbnail"
          fill
          className="object-cover"
        />
      </div>

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg
            className="w-8 h-8 md:w-10 md:h-10 text-gray-700 ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-4 left-4 bg-sage-500/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
        Minimusiker
      </div>
    </button>
  );
}
