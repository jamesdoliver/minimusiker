import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#f8f7f4] border-t border-gray-200 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-700">Minimusiker</p>
            <p className="text-xs text-gray-400">powered by Guesstimate Nexus</p>
            <p className="mt-2 font-medium text-gray-600">Polytope Management Group</p>
            <p>Guesstimate Loftyard Studios</p>
            <p>Willdenowstraße 4, 13353 Berlin</p>
            <p className="mt-2">
              <a
                href="mailto:support@minimusiker.de"
                className="hover:text-pink-600 transition-colors"
              >
                support@minimusiker.de
              </a>
            </p>
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link
              href="/datenschutz"
              className="hover:text-pink-600 transition-colors"
            >
              Datenschutz
            </Link>
            <span>|</span>
            <Link
              href="/agb"
              className="hover:text-pink-600 transition-colors"
            >
              AGB
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
