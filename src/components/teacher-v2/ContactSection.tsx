'use client';

interface ContactSectionProps {
  supportEmail?: string;
  supportPhone?: string;
}

export function ContactSection({
  supportEmail = 'info@minimusiker.de',
  supportPhone = '0251 3966054',
}: ContactSectionProps) {
  return (
    <section className="bg-mm-bg-muted py-6 md:py-8">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 items-center">
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
          <div className="hidden md:flex justify-start items-center">
            <img
              src="/images/teacher_portal_resources/Teacher-portal_Lars_telefon.png"
              alt="Minimusiker Support"
              className="w-[28rem] h-[20rem] object-cover object-bottom"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
