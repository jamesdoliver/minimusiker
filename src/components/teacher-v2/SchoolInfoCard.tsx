'use client';

interface SchoolInfoCardProps {
  schoolName: string;
  address?: string;
  email: string;
  phone?: string;
  onEdit: () => void;
}

export function SchoolInfoCard({
  schoolName,
  address,
  email,
  phone,
  onEdit,
}: SchoolInfoCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 text-gray-900 shadow-lg">
      <div className="flex gap-6 items-center">
        {/* School Info */}
        <div className="flex-1">
          <h2 className="text-xl font-bold mb-4">{schoolName}</h2>

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            {address && <p>{address}</p>}
            <a
              href={`mailto:${email}`}
              className="text-mm-accent hover:underline block"
            >
              {email}
            </a>
            {phone && <p>{phone}</p>}
          </div>

          <button
            onClick={onEdit}
            className="text-mm-accent text-sm hover:underline"
          >
            Daten ändern
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchoolInfoCard;
