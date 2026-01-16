'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface HeroIntroSectionProps {
  className?: string;
}

const VIDEO_URL = 'https://pub-fb1a222fd3604798884aaca0f34f1acc.r2.dev/familie-portal-videos/parent-portal_loggedin.mp4';
const THUMBNAIL_URL = '/images/familie_portal/familie_portal_video_thumbnail.jpg';

export default function HeroIntroSection({ className = '' }: HeroIntroSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close modal on escape key
  useEffect(() => {
    if (!isModalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  // Pause video when modal closes
  const handleCloseModal = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <section className={`bg-white py-8 md:py-12 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Text and Mascot */}
            <div className="order-2 lg:order-1">
              <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Hier spielt die Musik
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Juhuuu! Dein Kind nimmt am Projekt der Minimusiker teil. Die Aufnahmen und mehr kannst du hier bestellen!
              </p>

              {/* Mascot Image - includes speech bubble, positioned towards center */}
              <div className="flex justify-center md:justify-end lg:justify-end">
                <div className="relative w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64">
                  <Image
                    src="/images/familie_portal/logo_with_text.png"
                    alt="Minimusiker Mascot"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Video Thumbnail (4:5 Instagram Portrait) */}
            <div className="order-1 lg:order-2 flex justify-center">
              <button
                onClick={() => setIsModalOpen(true)}
                className="relative w-full max-w-sm aspect-[4/5] rounded-2xl overflow-hidden shadow-xl group focus:outline-none focus:ring-4 focus:ring-sage-300 bg-gray-100"
              >
                {/* Thumbnail Image - Full visible, not cropped */}
                <Image
                  src={THUMBNAIL_URL}
                  alt="Video thumbnail"
                  fill
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                  priority
                />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-10 h-10 text-sage-600 ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="relative bg-black rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
              aria-label="Schließen"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Video Player - 4:5 Instagram Portrait */}
            <div className="aspect-[4/5]">
              <video
                ref={videoRef}
                src={VIDEO_URL}
                controls
                autoPlay
                className="w-full h-full object-contain"
                playsInline
              >
                Ihr Browser unterstützt keine Video-Wiedergabe.
              </video>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
