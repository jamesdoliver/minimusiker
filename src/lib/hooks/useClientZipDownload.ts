'use client';

import { useState, useRef, useCallback } from 'react';
import { Zip, ZipPassThrough } from 'fflate';

export interface ZipDownloadFile {
  url: string;
  filename: string;
  path: string;
  fileSizeBytes: number;
}

export interface ZipDownloadState {
  status: 'idle' | 'downloading' | 'complete' | 'error' | 'cancelled';
  currentFileIndex: number;
  totalFiles: number;
  currentFilename: string;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

const initialState: ZipDownloadState = {
  status: 'idle',
  currentFileIndex: 0,
  totalFiles: 0,
  currentFilename: '',
  bytesDownloaded: 0,
  totalBytes: 0,
};

export function useClientZipDownload() {
  const [state, setState] = useState<ZipDownloadState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const startDownload = useCallback(
    async (files: ZipDownloadFile[], zipFilename: string) => {
      cancelledRef.current = false;
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      const totalBytes = files.reduce((sum, f) => sum + f.fileSizeBytes, 0);

      setState({
        status: 'downloading',
        currentFileIndex: 0,
        totalFiles: files.length,
        currentFilename: files[0]?.filename || '',
        bytesDownloaded: 0,
        totalBytes,
      });

      try {
        // Collect all ZIP output chunks
        const zipChunks: Uint8Array[] = [];
        let zipSize = 0;

        const zip = new Zip((err, chunk, final) => {
          if (err) throw err;
          if (chunk) {
            zipChunks.push(chunk);
            zipSize += chunk.length;
          }
        });

        let bytesDownloaded = 0;

        for (let i = 0; i < files.length; i++) {
          if (cancelledRef.current) {
            zip.terminate();
            setState((prev) => ({ ...prev, status: 'cancelled' }));
            return;
          }

          const file = files[i];

          setState((prev) => ({
            ...prev,
            currentFileIndex: i,
            currentFilename: file.filename,
          }));

          try {
            const response = await fetch(file.url, { signal });

            if (!response.ok) {
              console.warn(
                `Failed to download ${file.filename} (${response.status}), skipping`
              );
              continue;
            }

            // Use ZipPassThrough (no compression) since audio is already compressed
            const zipEntry = new ZipPassThrough(file.path);
            zip.add(zipEntry);

            const reader = response.body?.getReader();
            if (!reader) {
              console.warn(`No readable body for ${file.filename}, skipping`);
              zipEntry.push(new Uint8Array(0), true);
              continue;
            }

            // Stream chunks from fetch response into the ZIP entry
            while (true) {
              if (cancelledRef.current) {
                reader.cancel();
                zip.terminate();
                setState((prev) => ({ ...prev, status: 'cancelled' }));
                return;
              }

              const { done, value } = await reader.read();

              if (done) {
                zipEntry.push(new Uint8Array(0), true);
                break;
              }

              if (value) {
                zipEntry.push(value);
                bytesDownloaded += value.length;
                setState((prev) => ({
                  ...prev,
                  bytesDownloaded,
                }));
              }
            }
          } catch (fileErr) {
            if (cancelledRef.current || signal.aborted) {
              setState((prev) => ({ ...prev, status: 'cancelled' }));
              return;
            }
            console.warn(
              `Error downloading ${file.filename}, skipping:`,
              fileErr
            );
            continue;
          }
        }

        // Finalize the ZIP
        zip.end();

        if (cancelledRef.current) {
          setState((prev) => ({ ...prev, status: 'cancelled' }));
          return;
        }

        // Combine ZIP chunks and trigger browser download
        const blob = new Blob(zipChunks as BlobPart[], { type: 'application/zip' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        setState((prev) => ({ ...prev, status: 'complete' }));
      } catch (err) {
        if (cancelledRef.current || (err instanceof DOMException && err.name === 'AbortError')) {
          setState((prev) => ({ ...prev, status: 'cancelled' }));
          return;
        }

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Download failed',
        }));
      }
    },
    []
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, startDownload, cancel, reset };
}
