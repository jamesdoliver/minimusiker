import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="mt-2 text-3xl font-semibold text-gray-900">
            Event Not Found
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            The event link you're looking for doesn't exist or has expired.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <p className="text-sm text-gray-500">
            If you received this link via email, please check that you've copied the complete URL.
          </p>

          <div className="flex flex-col space-y-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              Go to Homepage
            </Link>

            <a
              href="mailto:support@minimusiker.com"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Error Code: INVALID_ACCESS_TOKEN
          </p>
        </div>
      </div>
    </div>
  );
}