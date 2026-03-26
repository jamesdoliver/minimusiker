'use client';

import Image from 'next/image';

interface LiederReihenfolgeSectionProps {
  tracklistFinalized: boolean;
  onOpenModal: () => void;
}

export default function LiederReihenfolgeSection({
  tracklistFinalized,
  onOpenModal,
}: LiederReihenfolgeSectionProps) {
  if (tracklistFinalized) {
    return (
      <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-5">
        <div className="flex items-center gap-4">
          {/* Green checkmark circle */}
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-800">Lieder-Reihenfolge</h3>
            <p className="text-sm text-green-700 mt-1">
              Die Reihenfolge wurde final festgelegt. Vielen Dank!
            </p>
          </div>

          <button
            onClick={onOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium text-sm flex-shrink-0"
          >
            Reihenfolge ansehen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Lieder-Reihenfolge</h3>
          <p className="text-sm text-gray-600 mt-2">
            {`F\u00FCr die Audioprodukte wie CD oder den Lautsprecher kannst du hier eine gew\u00FCnschte Reihenfolge der Titel festlegen. Eine finale Best\u00E4tigung brauchen wir nach dem Minimusikertag, denn anhand dieser Reihenfolge drucken wir Booklets.`}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Die Reihenfolge der Titel muss nicht mit der Reihenfolge der Aufnahme am Tag vor Ort übereinstimmen.
          </p>

          <button
            onClick={onOpenModal}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium text-sm"
          >
            Jetzt festlegen
          </button>
        </div>

        <div className="hidden md:block flex-shrink-0">
          <Image
            src="/images/booklet_asset.png"
            alt="CD-Booklet Beispiel"
            width={120}
            height={120}
          />
        </div>
      </div>
    </div>
  );
}
