'use client';

import type { MinimusikanRepresentative } from '@/lib/types/airtable';

interface MusicianIntroSectionProps {
  representative: MinimusikanRepresentative | null;
  isLoading: boolean;
  onContactClick: () => void;
}

export function MusicianIntroSection({
  representative,
  isLoading,
  onContactClick,
}: MusicianIntroSectionProps) {
  return (
    <section className="bg-mm-accent text-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="animate-spin h-8 w-8 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {/* Representative Display - 2-column grid with photo centered vertically */}
        {!isLoading && representative && (
          <div className="grid md:grid-cols-[auto_1fr] gap-8 max-w-3xl mx-auto items-center">
            {/* Left: Circular photo - vertically centered */}
            <div className="flex justify-center">
              {representative.profilePhotoUrl ? (
                <img
                  src={representative.profilePhotoUrl}
                  alt={representative.name}
                  className="w-48 h-48 rounded-full object-cover border-4 border-white"
                />
              ) : (
                <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center border-4 border-white">
                  <span className="text-white text-5xl font-bold">
                    {representative.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Heading + Bio + Contact */}
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                Am Minimusikertag komme ICH zu euch!
              </h2>
              <p className="text-white/90 leading-relaxed mb-4 whitespace-pre-wrap">
                {representative.bio}
              </p>
              <button
                onClick={onContactClick}
                className="text-white underline hover:no-underline text-sm"
              >
                Kontakt zu {representative.name.split(' ')[0]}
              </button>
            </div>
          </div>
        )}

        {/* Fallback for no representative */}
        {!isLoading && !representative && (
          <div className="grid md:grid-cols-[auto_1fr] gap-8 max-w-3xl mx-auto items-center">
            {/* Left: Placeholder photo */}
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center border-4 border-white">
                <span className="text-white text-5xl font-bold">M</span>
              </div>
            </div>

            {/* Right: Heading + Fallback text */}
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                Am Minimusikertag komme ICH zu euch!
              </h2>
              <p className="text-white/90 leading-relaxed">
                Wir freuen uns darauf, Sie bei Ihrem Minimusikertag zu besuchen!
                Bei Fragen können Sie sich jederzeit an uns wenden.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default MusicianIntroSection;
