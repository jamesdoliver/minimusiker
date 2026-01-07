'use client';

interface ContactSectionProps {
  supportEmail?: string;
  supportPhone?: string;
}

export function ContactSection({
  supportEmail = 'info@minimusiker.de',
  supportPhone = '+49 123 456789',
}: ContactSectionProps) {
  return (
    <section className="bg-mm-bg-muted py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Fragen zum Ablauf oder der Organisation?
            </h2>

            <p className="text-gray-600 leading-relaxed mb-6">
              Natürlich stehen wir dir in der Minimusiker Zentrale mit Rat und
              Tat zur Seite. Oft lassen sich konkrete Fragen am Telefon klären.
              Oder du schreibst uns eine Mail, wenn es nicht ganz so dringend
              ist. Meld dich einfach bei uns.
            </p>

            {/* Action links */}
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <a
                href={`mailto:${supportEmail}`}
                className="text-mm-accent hover:underline font-medium"
              >
                E-Mail schreiben
              </a>
              <a
                href={`tel:${supportPhone}`}
                className="text-mm-accent hover:underline font-medium"
              >
                Telefon
              </a>
            </div>
          </div>

          {/* Right: Decorative image */}
          <div className="hidden md:flex justify-end">
            <div className="w-64 h-64 bg-gray-300 rounded-lg flex items-center justify-center text-gray-500">
              {/* Placeholder for support person image */}
              <svg
                className="w-24 h-24"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
