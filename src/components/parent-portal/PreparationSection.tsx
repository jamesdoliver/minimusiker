'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PreparationSectionProps {
  className?: string;
}

interface Resource {
  pdfUrl: string;
  displayTitle: string;
}

export default function PreparationSection({ className = '' }: PreparationSectionProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResource();
  }, []);

  const fetchResource = async () => {
    try {
      const response = await fetch('/api/teacher/resources');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.resources) {
          // Find resource5 in the resources array
          const resource5 = data.resources.find(
            (r: { resourceKey: string }) => r.resourceKey === 'resource5'
          );
          if (resource5) {
            setResource({
              pdfUrl: resource5.pdfUrl,
              displayTitle: resource5.displayTitle,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching preparation resource:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (resource?.pdfUrl) {
      window.open(resource.pdfUrl, '_blank');
    }
  };

  return (
    <section className={`bg-[#F5D547] py-12 md:py-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Text */}
          <div>
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Bereite dein Kind auf den großen Tag vor!
            </h2>
            <p className="text-base md:text-lg text-gray-800 leading-relaxed">
              Mit kleinen Tipps und Tricks zum Singen, kannst du dein Kind in der Vorbereitung auch Zuhause unterstützen. Lade dir gratis unser Material herunter und übt gemeinsam. Das macht nicht nur Spaß, sondern hilft auch gut gegen Lampenfieber!
            </p>
          </div>

          {/* Right Column - Image and Download Button (centered) */}
          <div className="flex flex-col items-center">
            {/* Document Image - Full visible */}
            <div className="relative w-64 h-80 mb-6 rounded-lg overflow-hidden shadow-lg bg-white">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
                </div>
              ) : (
                <Image
                  src="/images/familie_portal/singen_zuhause_thumb.png"
                  alt={resource?.displayTitle || 'Singen mit Kindern'}
                  fill
                  className="object-contain"
                />
              )}
            </div>

            {/* Download Button - centered below image */}
            <button
              onClick={handleDownload}
              disabled={!resource?.pdfUrl || isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#E91E63] hover:bg-[#C2185B] text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              PDF downloaden
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
