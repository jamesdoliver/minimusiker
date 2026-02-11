'use client';

import { useClientZipDownload, ZipDownloadFile } from '@/lib/hooks/useClientZipDownload';
import ZipDownloadModal from '@/components/engineer/ZipDownloadModal';

interface AudioSection {
  sectionId: string;
  sectionName: string;
  sectionType: 'class' | 'choir' | 'teacher_song' | 'group';
  tracks: {
    title: string;
    order: number;
    fileSizeBytes?: number;
    downloadUrl: string;
    filename: string;
  }[];
}

interface DownloadAllButtonProps {
  sections: AudioSection[];
  schoolName: string;
  totalSizeBytes: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export default function DownloadAllButton({ sections, schoolName, totalSizeBytes }: DownloadAllButtonProps) {
  const zipDownload = useClientZipDownload();

  const handleDownloadAll = () => {
    const files: ZipDownloadFile[] = [];

    for (const section of sections) {
      for (const track of section.tracks) {
        files.push({
          url: track.downloadUrl,
          filename: track.filename,
          path: `${section.sectionName}/${track.filename}`,
          fileSizeBytes: track.fileSizeBytes || 0,
        });
      }
    }

    if (files.length === 0) return;

    const zipFilename = `${schoolName} - Alle Aufnahmen.zip`;
    zipDownload.startDownload(files, zipFilename);
  };

  const isDownloading = zipDownload.state.status === 'downloading';

  return (
    <>
      <button
        onClick={handleDownloadAll}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Alle herunterladen
        {totalSizeBytes > 0 && (
          <span className="text-green-200 text-xs">({formatFileSize(totalSizeBytes)})</span>
        )}
      </button>

      <ZipDownloadModal
        state={zipDownload.state}
        onCancel={zipDownload.cancel}
        onClose={zipDownload.reset}
      />
    </>
  );
}
