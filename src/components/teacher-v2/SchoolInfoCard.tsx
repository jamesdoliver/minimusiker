'use client';

import { useState, useRef, useCallback } from 'react';

interface SchoolInfoCardProps {
  schoolName: string;
  address?: string;
  email: string;
  phone?: string;
  logoUrl?: string;
  onEdit: () => void;
  onLogoUpload?: (url: string) => void;
  onLogoError?: (error: string) => void;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 500; // Minimum 500x500px

export function SchoolInfoCard({
  schoolName,
  address,
  email,
  phone,
  logoUrl,
  onEdit,
  onLogoUpload,
  onLogoError,
}: SchoolInfoCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate image dimensions
  const validateDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img.width >= MIN_DIMENSION && img.height >= MIN_DIMENSION);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setPreviewUrl(null);

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        const errorMsg = 'Nur PNG, JPG und WebP Bilder sind erlaubt';
        setError(errorMsg);
        onLogoError?.(errorMsg);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = 'Die Datei darf maximal 5MB groß sein';
        setError(errorMsg);
        onLogoError?.(errorMsg);
        return;
      }

      // Validate dimensions
      const validDimensions = await validateDimensions(file);
      if (!validDimensions) {
        const errorMsg = `Das Bild muss mindestens ${MIN_DIMENSION}x${MIN_DIMENSION} Pixel groß sein`;
        setError(errorMsg);
        onLogoError?.(errorMsg);
        return;
      }

      // Show preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Start upload
      await uploadFile(file);
    },
    [onLogoError]
  );

  // Upload file to R2 via presigned URL
  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      // Step 1: Get presigned URL
      const uploadUrlResponse = await fetch('/api/teacher/school/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const data = await uploadUrlResponse.json();
        throw new Error(data.error || 'Fehler beim Erstellen der Upload-URL');
      }

      const { uploadUrl, r2Key, einrichtungId } = await uploadUrlResponse.json();

      // Step 2: Upload file directly to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error('Fehler beim Hochladen der Datei');
      }

      // Step 3: Confirm upload and get final URL
      const confirmResponse = await fetch('/api/teacher/school/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key, einrichtungId }),
      });

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json();
        throw new Error(data.error || 'Fehler beim Speichern des Logos');
      }

      const { logoUrl: newLogoUrl } = await confirmResponse.json();

      // Success!
      onLogoUpload?.(newLogoUrl);
      setPreviewUrl(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload fehlgeschlagen';
      setError(errorMsg);
      onLogoError?.(errorMsg);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLogoClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const displayUrl = previewUrl || logoUrl;

  return (
    <div className="bg-white rounded-xl p-6 text-gray-900 shadow-lg">
      <div className="flex gap-6 items-center">
        {/* Left: School Info */}
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

        {/* Right: Logo Upload Circle */}
        <div className="flex-shrink-0 relative group">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {/* Logo circle button */}
          <button
            onClick={handleLogoClick}
            disabled={isUploading}
            className={`
              w-48 h-48 rounded-full overflow-hidden relative
              flex flex-col items-center justify-center
              transition-all duration-200
              ${isUploading ? 'cursor-wait' : 'cursor-pointer'}
              ${displayUrl
                ? 'bg-gray-100 border-4 border-gray-200'
                : 'bg-gray-50 border-2 border-dashed border-gray-300 hover:border-mm-accent hover:bg-gray-100'
              }
            `}
            title={displayUrl ? 'Logo ändern' : 'Logo hochladen'}
          >
            {displayUrl ? (
              // Show logo
              <img
                src={displayUrl}
                alt={`${schoolName} Logo`}
                className="w-full h-full object-cover"
              />
            ) : (
              // Show upload prompt
              <>
                <svg
                  className="w-10 h-10 text-gray-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-gray-500 text-sm text-center px-4">
                  Upload Schule Logo
                </span>
              </>
            )}

            {/* Edit overlay on hover (when logo exists) */}
            {displayUrl && !isUploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            )}

            {/* Upload progress spinner */}
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <svg
                  className="animate-spin w-10 h-10 text-mm-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-10 w-48">
              <div className="bg-red-100 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 text-center">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SchoolInfoCard;
