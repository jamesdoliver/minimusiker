'use client';

export function SupportContactCard() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'info@minimusiker.de';
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+49 40 22 86 42 02';

  return (
    <section className="rounded-lg shadow-md p-8" style={{ backgroundColor: '#FFF9C4' }}>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Content */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Fragen zum Ablauf oder der Organisation?
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed mb-6">
            Die Minimusiker Zentrale steht Ihnen bei allen Fragen rund um den Minimusikertag zur
            Verfügung. Wir helfen Ihnen gerne bei der Planung, Organisation und Durchführung Ihres
            Projekts.
          </p>

          {/* Contact Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Email Link */}
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg
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
              E-Mail schreiben
            </a>

            {/* Phone Link */}
            <a
              href={`tel:${supportPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-pink-600 border-2 border-pink-600 rounded-lg
                hover:bg-pink-50 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Telefon
            </a>
          </div>

          {/* Contact Details Display */}
          <div className="mt-4 pt-4 border-t border-yellow-300">
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>{supportEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>{supportPhone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Decorative Icon/Illustration */}
        <div className="hidden lg:flex items-center justify-center w-32 h-32 flex-shrink-0">
          <div className="w-full h-full rounded-full bg-pink-100 flex items-center justify-center">
            <svg className="w-16 h-16 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SupportContactCard;
