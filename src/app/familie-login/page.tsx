'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// Asset URLs
const ASSETS = {
  mascot: '/images/familie/mascot_logo.png',
  videoThumbnail: '/images/familie/1.png', // Using first photo as thumbnail for now
  videoSource: 'https://pub-fb1a222fd3604798884aaca0f34f1acc.r2.dev/familie-login-videos/Eltern-Introvideo.mp4',
  photos: [
    '/images/familie/1.png',
    '/images/familie/2.png',
    '/images/familie/3.png',
  ],
};

function VideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-lg">
        <video
          src={ASSETS.videoSource}
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
        {ASSETS.videoThumbnail !== 'PLACEHOLDER_VIDEO_THUMBNAIL_URL' ? (
          <Image
            src={ASSETS.videoThumbnail}
            alt="Video thumbnail"
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-sage-200 to-sage-300 flex items-center justify-center">
            <span className="text-sage-600 text-sm">Video Thumbnail</span>
          </div>
        )}
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

function PhotoCollage() {
  const hasRealPhotos = ASSETS.photos.every(
    (url) => !url.startsWith('PLACEHOLDER')
  );

  if (!hasRealPhotos) {
    return (
      <div className="flex justify-center gap-4 max-w-3xl mx-auto">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`
              w-48 h-48 rounded-2xl bg-gradient-to-br from-sage-100 to-sage-200
              flex items-center justify-center
              ${i === 1 ? 'mt-6' : ''}
            `}
          >
            <span className="text-sage-500 text-xs">Photo {i + 1}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-4 max-w-3xl mx-auto flex-wrap">
      {ASSETS.photos.map((url, i) => (
        <div
          key={i}
          className={`
            relative w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-md
            ${i === 1 ? 'mt-6' : ''}
          `}
        >
          <Image src={url} alt={`Event photo ${i + 1}`} fill className="object-cover" />
        </div>
      ))}
    </div>
  );
}

export default function ParentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/parent-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessData(data.data);
        setTimeout(() => {
          router.push('/familie');
        }, 1500);
      } else {
        if (response.status === 404 && data.data?.shouldRegister) {
          const registrationUrl = `/register?email=${encodeURIComponent(data.data.email || email.trim().toLowerCase())}`;
          router.push(registrationUrl);
          return;
        }
        setError(data.error || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.');
    } finally {
      if (!successData) {
        setIsLoading(false);
      }
    }
  };

  // Success state
  if (successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-100 to-sage-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-sage-100 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-10 h-10 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {successData.message || `Willkommen zurück, ${successData.parent?.firstName}!`}
            </h2>

            {successData.school && (
              <p className="text-lg text-gray-600 mb-2">
                {successData.school.name}
              </p>
            )}

            {successData.event?.bookingDate && (
              <p className="text-md text-gray-500 mb-4">
                Veranstaltungsdatum: {new Date(successData.event.bookingDate).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <LoadingSpinner size="sm" />
              <span>Weiterleitung zu deinem Portal...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          {/* Hero Section */}
          <div className="flex items-start justify-between mb-8 md:mb-12">
            <div className="flex-1">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                Hier spielt die Musik!
              </h1>
              <p className="text-gray-600 text-lg max-w-xl">
                Liebes Elternteil! Mit der Registrierung deines Kindes erhältst du Zugriff auf die Aufnahmen vom Minimusikertag, weitere Produkte und kostenfreies Material.
              </p>
            </div>
            {/* Mascot */}
            <div className="hidden md:block w-32 lg:w-40 flex-shrink-0 ml-4">
              {ASSETS.mascot !== 'PLACEHOLDER_MASCOT_URL' ? (
                <Image
                  src={ASSETS.mascot}
                  alt="MiniMusiker Mascot"
                  width={160}
                  height={180}
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-full aspect-[4/5] bg-gradient-to-br from-sage-100 to-sage-200 rounded-2xl flex items-center justify-center">
                  <span className="text-sage-500 text-xs text-center">Mascot<br/>Image</span>
                </div>
              )}
            </div>
          </div>

          {/* Two Column Layout: Video + Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-16 md:mb-24">
            {/* Video Column */}
            <div>
              <VideoPlayer />
            </div>

            {/* Login Form Card */}
            <div className="bg-[#f0efec] rounded-2xl p-6 md:p-8 shadow-sm">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-[#6b8a85] mb-6">
                Registriere jetzt<br />
                dein Kind für einen<br />
                Minimusikertag
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#6b8a85] mb-2">
                    E-Mail Adresse
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="familie@minimusiker.de"
                    className="w-full px-4 py-3 border border-gray-200 bg-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-3 px-4 rounded-lg shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-button font-bold uppercase tracking-wide"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      Wird geprüft...
                    </span>
                  ) : (
                    'Absenden'
                  )}
                </button>
              </form>

              {/* Trust Indicators */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Sichere Anmeldung • Kein Passwort notwendig
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Probleme beim Einloggen?{' '}
                  <a
                    href="mailto:info@minimusiker.de?subject=Hilfe beim Einloggen"
                    className="text-pink-600 hover:text-pink-700 font-medium"
                  >
                    Kontaktiere uns
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Secondary Section */}
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              Gemeinsam Singen - Zusammen wachsen!
            </h2>

            <div className="mb-8">
              <PhotoCollage />
            </div>

            <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Bei einem Minimusikertag machen alle Kinder mit.<br />
              Denn das ist ja wohl klar - Singen tut richtig gut!<br />
              Wenn die Kinder ihre Lieblingslieder singen, klingt das<br />
              nach einer Menge Spaß und das kann man bald hören!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
