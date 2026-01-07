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
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-white">
          Am Minimusikertag komme ICH zu euch!
        </h2>

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

        {/* Representative Display */}
        {!isLoading && representative && (
          <div className="flex flex-col md:flex-row items-center gap-8 max-w-3xl mx-auto">
            {/* Circular photo */}
            <div className="flex-shrink-0">
              {representative.profilePhotoUrl ? (
                <img
                  src={representative.profilePhotoUrl}
                  alt={representative.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center border-4 border-white">
                  <span className="text-white text-4xl font-bold">
                    {representative.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Bio text */}
            <div className="text-center md:text-left">
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
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-4 border-4 border-white">
              <span className="text-white text-4xl font-bold">M</span>
            </div>
            <p className="text-white/90 text-sm max-w-md">
              Wir freuen uns darauf, Sie bei Ihrem Minimusikertag zu besuchen!
              Bei Fragen können Sie sich jederzeit an uns wenden.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default MusicianIntroSection;
