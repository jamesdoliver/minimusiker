'use client';

interface ResourceCardProps {
  title: string;
  thumbnail: string;
  type: 'pdf' | 'video';
  href: string;
  isLoading?: boolean;
}

export function ResourceCard({ title, thumbnail, type, href, isLoading = false }: ResourceCardProps) {
  const isDisabled = href === '#' || isLoading;

  return (
    <div className="flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-3">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {type === 'pdf' ? (
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Button */}
      {isDisabled ? (
        <span
          className="px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg text-center cursor-not-allowed"
        >
          {isLoading ? 'Laden...' : (type === 'pdf' ? 'PDF downloaden' : 'Video ansehen')}
        </span>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-mm-accent text-white text-sm font-medium rounded-lg text-center hover:bg-mm-accent/90 transition-colors"
        >
          {type === 'pdf' ? 'PDF downloaden' : 'Video ansehen'}
        </a>
      )}
    </div>
  );
}

export default ResourceCard;
