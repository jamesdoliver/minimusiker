'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#f8faf9] via-white to-[#e8f0ee] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#94B8B3]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#d4a574]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#94B8B3]/5 rounded-full blur-3xl" />
      </div>

      {/* Burger Menu Button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="fixed top-6 left-6 z-50 w-12 h-12 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-center gap-1.5 group"
        aria-label="Menü öffnen"
      >
        <span className={`w-5 h-0.5 bg-gray-600 rounded-full transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`w-5 h-0.5 bg-gray-600 rounded-full transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
        <span className={`w-5 h-0.5 bg-gray-600 rounded-full transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Slide-out Menu */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${menuOpen ? 'visible' : 'invisible'}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div
          className={`absolute left-0 top-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="pt-24 px-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
              Weitere Portale
            </p>

            <nav className="space-y-2">
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#94B8B3]/10 flex items-center justify-center group-hover:bg-[#94B8B3]/20 transition-colors">
                  <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Admin</h3>
                  <p className="text-sm text-gray-500">Verwaltung & Einstellungen</p>
                </div>
              </Link>

              <Link
                href="/staff-login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-100/50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Mitarbeiter</h3>
                  <p className="text-sm text-gray-500">Event-Übersicht & Details</p>
                </div>
              </Link>

              <Link
                href="/engineer-login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100/50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Tontechniker</h3>
                  <p className="text-sm text-gray-500">Audio-Bearbeitung & Upload</p>
                </div>
              </Link>
            </nav>
          </div>
        </div>
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

        {/* Hero Cards */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Pädagogen Portal */}
          <Link
            href="/paedagogen-login"
            className="group relative bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-[#94B8B3]/10 border border-[#94B8B3]/20 hover:shadow-2xl hover:shadow-[#94B8B3]/20 hover:border-[#94B8B3]/40 transition-all duration-500 hover:-translate-y-1"
          >
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#94B8B3]/20 to-transparent rounded-tr-3xl rounded-bl-[80px]" />

            <div className="relative">
              {/* Icon */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#94B8B3] to-[#7da39e] flex items-center justify-center mb-6 shadow-lg shadow-[#94B8B3]/30 group-hover:scale-105 transition-transform duration-500">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              {/* Content */}
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-[#5a8a82] transition-colors">
                Pädagogen
              </h2>
              <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6">
                Zugang für Lehrer und Erzieher. Verwalten Sie Ihre Buchungen und bereiten Sie Events vor.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-[#5a8a82] font-semibold">
                <span>Zum Portal</span>
                <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Familie Portal */}
          <Link
            href="/familie-login"
            className="group relative bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-[#d4a574]/10 border border-[#d4a574]/20 hover:shadow-2xl hover:shadow-[#d4a574]/20 hover:border-[#d4a574]/40 transition-all duration-500 hover:-translate-y-1"
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
      </div>
    </main>
  );
}
