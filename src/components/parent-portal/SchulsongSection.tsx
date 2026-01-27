'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const SchulsongWaveformPlayer = dynamic(
  () => import('./SchulsongWaveformPlayer'),
  { ssr: false }
);

interface SchulsongSectionProps {
  eventId: string;
}

interface SchulsongStatus {
  isSchulsong: boolean;
  hasAudio?: boolean;
  audioUrl?: string;
  downloadUrl?: string;
}

export default function SchulsongSection({ eventId }: SchulsongSectionProps) {
  const t = useTranslations('schulsong');
  const [status, setStatus] = useState<SchulsongStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setIsLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `/api/parent/schulsong-status?eventId=${encodeURIComponent(eventId)}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStatus(data);
          }
        }
      } catch (err) {
        console.error('Error fetching schulsong status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [eventId]);

  // Don't render anything while loading or if not a schulsong event
  if (isLoading || !status?.isSchulsong) {
    return null;
  }

  return (
    <section
      className="relative py-12 md:py-16 bg-cover bg-center"
      style={{
        backgroundImage: `url('/images/schulesong/Wallpaper UnserSchulsong.png')`,
      }}
    >
      {/* Semi-transparent overlay for readability */}
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/images/schulesong/Logo UnserSchulsong.png"
              alt="Unser Schulsong"
              width={280}
              height={100}
              className="drop-shadow-lg"
              priority={false}
            />
          </div>

          {/* Content area */}
          <div className="w-full max-w-2xl">
            {status.hasAudio && status.audioUrl ? (
              /* Audio ready — show waveform player */
              <SchulsongWaveformPlayer
                audioUrl={status.audioUrl}
                downloadUrl={status.downloadUrl}
              />
            ) : (
              /* No audio yet — show coming soon message */
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-800">
                  {t('comingSoon')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
