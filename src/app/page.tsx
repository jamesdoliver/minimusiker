'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#f8faf9] via-white to-[#e8f0ee] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#94B8B3]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#d4a574]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#94B8B3]/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16">
        {/* Logo & Header */}
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-grandstander)] text-5xl md:text-6xl font-bold text-[#5a8a82] mb-3">
            MiniMusiker
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Musik erleben. Erinnerungen bewahren.
          </p>
        </div>

        {/* Hero Card — Familie (primary) */}
        <div className="w-full max-w-lg">
          {/* Familie Portal */}
          <Link
            href="/familie-login"
            className="group relative block bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-[#d4a574]/10 border border-[#d4a574]/20 hover:shadow-2xl hover:shadow-[#d4a574]/20 hover:border-[#d4a574]/40 transition-all duration-500 hover:-translate-y-1"
          >
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#d4a574]/20 to-transparent rounded-tr-3xl rounded-bl-[80px]" />

            <div className="relative">
              {/* Icon */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#d4a574] to-[#c49464] flex items-center justify-center mb-6 shadow-lg shadow-[#d4a574]/30 group-hover:scale-105 transition-transform duration-500">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>

              {/* Content */}
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-[#c49464] transition-colors">
                Familie
              </h2>
              <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6">
                Elternbereich für Aufnahmen und Shop. Entdecken Sie die musikalischen Erinnerungen Ihres Kindes.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-[#c49464] font-semibold">
                <span>Zum Portal</span>
                <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer hint */}
        <p className="mt-12 text-sm text-gray-400 text-center">
          Eltern: Prüfen Sie Ihre E-Mail für Ihren persönlichen Zugangslink
        </p>

        {/* Discreet secondary portal links */}
        <nav className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <Link href="/paedagogen-login" className="hover:text-[#5a8a82] transition-colors">
            Pädagogen
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/staff-login" className="hover:text-[#5a8a82] transition-colors">
            Mitarbeiter
          </Link>
        </nav>
      </div>
    </main>
  );
}
