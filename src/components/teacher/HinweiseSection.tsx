'use client';

export interface HinweiseSectionProps {
  classesWithoutSongs: string[];
  tracklistFinalized: boolean;
  isSchulsong: boolean;
  schulsongApproved: boolean;
}

interface HinweisRow {
  key: string;
  complete: boolean;
  pendingText: React.ReactNode;
  completeText: string;
}

export function HinweiseSection({
  classesWithoutSongs,
  tracklistFinalized,
  isSchulsong,
  schulsongApproved,
}: HinweiseSectionProps) {
  const rows: HinweisRow[] = [
    {
      key: 'classes',
      complete: classesWithoutSongs.length === 0,
      pendingText: (
        <>
          Folgende Klassen haben noch keine Lieder:{' '}
          <span className="font-medium">{classesWithoutSongs.join(', ')}</span>
        </>
      ),
      completeText: 'Alle Klassen haben Lieder',
    },
    {
      key: 'tracklist',
      complete: tracklistFinalized,
      pendingText: 'Die Lieder-Reihenfolge wurde noch nicht final festgelegt',
      completeText: 'Die Lieder-Reihenfolge wurde bereits final festgelegt',
    },
  ];

  if (isSchulsong) {
    rows.push({
      key: 'schulsong',
      complete: schulsongApproved,
      pendingText: 'Euer Schulsong wartet auf Freigabe',
      completeText: 'Euer Schulsong wurde freigegeben',
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Hinweise</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start gap-3">
            {row.complete ? (
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            )}

            <span
              className={`text-sm ${
                row.complete ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {row.complete ? row.completeText : row.pendingText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HinweiseSection;
