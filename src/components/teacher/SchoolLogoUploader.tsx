'use client';

import { useState, useRef, useCallback } from 'react';

interface SchoolLogoUploaderProps {
  currentLogoUrl?: string | null;
  schoolName: string;
  onUploadSuccess?: (logoUrl: string) => void;
  onUploadError?: (error: string) => void;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 500; // Minimum 500x500px

export function SchoolLogoUploader({
  currentLogoUrl,
  schoolName,
  onUploadSuccess,
  onUploadError,
}: SchoolLogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get school initials for placeholder
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

      // Reset state
      setError(null);
      setPreviewUrl(null);

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        const errorMsg = 'Nur PNG, JPG und WebP Bilder sind erlaubt';
        setError(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = 'Die Datei darf maximal 5MB groß sein';
        setError(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      // Validate dimensions
      const validDimensions = await validateDimensions(file);
      if (!validDimensions) {
        const errorMsg = `Das Bild muss mindestens ${MIN_DIMENSION}x${MIN_DIMENSION} Pixel groß sein`;
        setError(errorMsg);
        onUploadError?.(errorMsg);
        return;
      }

      // Show preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Start upload
      await uploadFile(file);
    },
    [onUploadError]
  );

  // Upload file to R2 via presigned URL
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL from our API
      setUploadProgress(10);
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
      setUploadProgress(30);

      // Step 2: Upload file directly to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Fehler beim Hochladen der Datei');
      }
      setUploadProgress(70);

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

      const { logoUrl } = await confirmResponse.json();
      setUploadProgress(100);

      // Success!
      onUploadSuccess?.(logoUrl);
      setPreviewUrl(null); // Clear preview, will use logoUrl now
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload fehlgeschlagen';
      setError(errorMsg);
      onUploadError?.(errorMsg);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setIsUploading(true);

    try {
      const response = await fetch('/api/teacher/school/logo', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Löschen des Logos');
      }

      onUploadSuccess?.(''); // Clear the logo URL in parent
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Löschen fehlgeschlagen';
      setError(errorMsg);
      onUploadError?.(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const displayUrl = previewUrl || currentLogoUrl;

  return (
    <div className="relative group">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Logo display / upload button */}
      <button
        onClick={handleClick}
        disabled={isUploading}
        className={`
          w-10 h-10 rounded-full overflow-hidden relative
          flex items-center justify-center
          transition-all duration-200
          ${isUploading ? 'cursor-wait' : 'cursor-pointer'}
          ${displayUrl ? 'bg-gray-100' : 'bg-pink-100'}
          hover:ring-2 hover:ring-pink-300 hover:ring-offset-2
          focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2
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
          // Show initials placeholder
          <span className="text-pink-600 font-semibold text-sm">
            {getInitials(schoolName)}
          </span>
        )}

        {/* Upload overlay on hover */}
        {!isUploading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
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

        {/* Upload progress indicator */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="w-6 h-6 relative">
              <svg
                className="animate-spin w-6 h-6 text-pink-600"
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
          </div>
        )}
      </button>

      {/* Delete button (appears on hover when logo exists) */}
      {displayUrl && !isUploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
          }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white
            opacity-0 group-hover:opacity-100 transition-opacity
            flex items-center justify-center text-xs
            hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
          title="Logo löschen"
        >
          ×
        </button>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="absolute top-full left-0 mt-2 z-10">
          <div className="bg-red-100 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 max-w-[200px]">
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Logo löschen?
            </h3>
            <p className="text-gray-600 mb-4">
              Möchten Sie das Schullogo wirklich löschen?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchoolLogoUploader;
