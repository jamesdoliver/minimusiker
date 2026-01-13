import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to MiniMusiker
        </h1>
        <p className="text-center text-lg mb-12">
          School Music Event Management Platform
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Admin Portal */}
          <Link
            href="/admin"
            className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-[#94B8B3] hover:bg-[#94B8B3]/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#94B8B3]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Admin Portal
              </h2>
              <span className="ml-auto inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-[#5a8a82]">
                →
              </span>
            </div>
            <p className="m-0 text-sm text-gray-500">
              Manage events, upload recordings, and track orders.
            </p>
          </Link>

          {/* Parent Portal */}
          <Link
            href="/parent-login"
            className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-[#94B8B3] hover:bg-[#94B8B3]/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#94B8B3]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Parent Portal
              </h2>
              <span className="ml-auto inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-[#5a8a82]">
                →
              </span>
            </div>
            <p className="m-0 text-sm text-gray-500">
              Sign in to access your child's recordings and shop.
            </p>
          </Link>

          {/* Staff Portal */}
          <Link
            href="/staff-login"
            className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-[#94B8B3] hover:bg-[#94B8B3]/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#94B8B3]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Staff Portal
              </h2>
              <span className="ml-auto inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-[#5a8a82]">
                →
              </span>
            </div>
            <p className="m-0 text-sm text-gray-500">
              View your assigned events and event details.
            </p>
          </Link>

          {/* Engineer Portal */}
          <Link
            href="/engineer-login"
            className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-purple-400 hover:bg-purple-50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Engineer Portal
              </h2>
              <span className="ml-auto inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-purple-600">
                →
              </span>
            </div>
            <p className="m-0 text-sm text-gray-500">
              Download raw audio and upload mixed recordings.
            </p>
          </Link>

          {/* Teacher Portal */}
          <Link
            href="/paedagogen"
            className="group rounded-lg border border-gray-200 bg-white px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-400">
                Teacher Portal
              </h2>
              <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="m-0 text-sm text-gray-400">
              Access class materials and student progress.
            </p>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Parents: Check your email for your personalized access link
          </p>
        </div>
      </div>
    </main>
  );
}