export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-[#f8f7f4] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-4xl font-bold text-gray-900 mb-8">Impressum</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          {/* Brand */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Minimusiker</h2>
            <p className="text-gray-500">powered by Guesstimate Nexus</p>
          </section>

          {/* Company */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Betreiber</h3>
            <p className="text-gray-600">Polytope Management Group</p>
          </section>

          {/* Address */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Anschrift</h3>
            <address className="text-gray-600 not-italic">
              Guesstimate Loftyard Studios<br />
              Willdenowstraße 4<br />
              13353 Berlin<br />
              Deutschland
            </address>
          </section>

          {/* Contact */}
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Kontakt</h3>
            <p className="text-gray-600">
              E-Mail:{' '}
              <a href="mailto:support@minimusiker.de" className="text-pink-600 hover:text-pink-700">
                support@minimusiker.de
              </a>
            </p>
          </section>

          {/* Legal Details - Placeholders */}
          <section className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Rechtliche Angaben</h3>
            <div className="text-gray-600 space-y-1">
              <p><span className="font-medium">Geschäftsführer:</span> [Name eintragen]</p>
              <p><span className="font-medium">Handelsregister:</span> [HRB-Nummer, Amtsgericht]</p>
              <p><span className="font-medium">USt-IdNr:</span> [DE123456789]</p>
            </div>
          </section>

          {/* Responsible for Content */}
          <section className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Verantwortlich für den Inhalt (gem. § 55 Abs. 2 RStV)
            </h3>
            <p className="text-gray-600">[Name und Anschrift des Verantwortlichen]</p>
          </section>

          {/* Disclaimer */}
          <section className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Haftungsausschluss</h3>
            <div className="text-gray-600 text-sm space-y-3">
              <p>
                <span className="font-medium">Haftung für Inhalte:</span> Die Inhalte unserer Seiten wurden mit größter
                Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch
                keine Gewähr übernehmen.
              </p>
              <p>
                <span className="font-medium">Haftung für Links:</span> Unser Angebot enthält Links zu externen
                Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten
                Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              </p>
            </div>
          </section>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <a
            href="/familie-login"
            className="text-pink-600 hover:text-pink-700 font-medium"
          >
            ← Zurück zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}
