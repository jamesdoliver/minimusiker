'use client';

import { useState, useEffect } from 'react';
import { RepresentativeContactModal } from './RepresentativeContactModal';
import type { MinimusikanRepresentative } from '@/lib/types/airtable';

export function MinimusikanRepresentativeCard() {
  const [representative, setRepresentative] = useState<MinimusikanRepresentative | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  useEffect(() => {
    const fetchRepresentative = async () => {
      try {
        const response = await fetch('/api/teacher/representative');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Fehler beim Laden der Kontaktperson');
        }

        setRepresentative(data.representative);
      } catch (err) {
        console.error('Error fetching representative:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kontaktperson');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepresentative();
  }, []);

  return (
    <>
      <section className="rounded-lg shadow-md p-8" style={{ backgroundColor: '#FFF9C4' }}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Am Minimusikertag komme ICH zu euch!
        </h2>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="animate-spin h-8 w-8 text-pink-600"
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

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Representative Display */}
        {!isLoading && !error && representative && (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              {representative.profilePhotoUrl ? (
                <img
                  src={representative.profilePhotoUrl}
                  alt={representative.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-pink-600 flex items-center justify-center border-4 border-white shadow-md">
                  <span className="text-white text-3xl font-bold">
                    {representative.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Bio and Contact */}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{representative.name}</h3>
              <p className="text-gray-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                {representative.bio}
              </p>
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg
                  hover:bg-pink-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Kontakt zu {representative.name.split(' ')[0]}
              </button>
            </div>
          </div>
        )}

        {/* Fallback for no representative */}
        {!isLoading && !error && !representative && (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-24 h-24 rounded-full bg-pink-600 flex items-center justify-center mb-4 border-4 border-white shadow-md">
              <span className="text-white text-3xl font-bold">M</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Minimusiker Team</h3>
            <p className="text-gray-700 text-sm max-w-md">
              Wir freuen uns darauf, Sie bei Ihrem Minimusikertag zu besuchen! Bei Fragen können Sie
              sich jederzeit an uns wenden.
            </p>
          </div>
        )}
      </section>

      {/* Contact Modal */}
      {representative && (
        <RepresentativeContactModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          name={representative.name}
          email={representative.email}
          phone={representative.phone}
        />
      )}
    </>
  );
}

export default MinimusikanRepresentativeCard;
