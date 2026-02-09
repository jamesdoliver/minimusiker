import { useRef, useCallback } from 'react';

interface UploadPart {
  PartNumber: number;
  ETag: string;
}

interface InitiateResponse {
  uploadId: string;
  r2Key: string;
  partUrls: Record<number, string>;
  totalParts: number;
  partSizeBytes: number;
}

interface UploadOptions {
  file: File;
  initiateUrl: string;
  completeUrl: string;
  abortUrl: string;
  initiateBody: Record<string, unknown>;
  completeBodyExtra: Record<string, unknown>;
  onProgress?: (pct: number) => void;
}

const MAX_CONCURRENCY = 3;
const MAX_RETRIES = 3;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useMultipartUpload() {
  const abortedRef = useRef(false);
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const uploadMetaRef = useRef<{ r2Key: string; uploadId: string } | null>(null);
  const abortUrlRef = useRef<string>('');

  const uploadPart = (
    url: string,
    blob: Blob,
    partNumber: number,
    onChunkProgress: (partNumber: number, loaded: number) => void
  ): Promise<UploadPart> => {
    return new Promise((resolve, reject) => {
      if (abortedRef.current) {
        reject(new Error('Upload aborted'));
        return;
      }

      const xhr = new XMLHttpRequest();
      activeXhrsRef.current.add(xhr);

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', 'application/zip');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onChunkProgress(partNumber, e.loaded);
        }
      };

      xhr.onload = () => {
        activeXhrsRef.current.delete(xhr);
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          if (!etag) {
            reject(new Error(`Part ${partNumber}: no ETag in response`));
            return;
          }
          resolve({ PartNumber: partNumber, ETag: etag });
        } else {
          reject(new Error(`Part ${partNumber} failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        activeXhrsRef.current.delete(xhr);
        reject(new Error(`Part ${partNumber}: network error`));
      };

      xhr.onabort = () => {
        activeXhrsRef.current.delete(xhr);
        reject(new Error('Upload aborted'));
      };

      xhr.send(blob);
    });
  };

  const uploadPartWithRetry = async (
    url: string,
    blob: Blob,
    partNumber: number,
    onChunkProgress: (partNumber: number, loaded: number) => void
  ): Promise<UploadPart> => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (abortedRef.current) throw new Error('Upload aborted');

      try {
        return await uploadPart(url, blob, partNumber, onChunkProgress);
      } catch (err) {
        if (abortedRef.current) throw err;

        if (attempt < MAX_RETRIES - 1) {
          const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.warn(
            `Part ${partNumber} attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
            err
          );
          await wait(delayMs);
        } else {
          throw err;
        }
      }
    }

    // Unreachable, but TypeScript needs it
    throw new Error(`Part ${partNumber} failed after ${MAX_RETRIES} attempts`);
  };

  const upload = useCallback(async (options: UploadOptions) => {
    const {
      file,
      initiateUrl,
      completeUrl,
      abortUrl,
      initiateBody,
      completeBodyExtra,
      onProgress,
    } = options;

    // Reset state
    abortedRef.current = false;
    activeXhrsRef.current.clear();
    uploadMetaRef.current = null;
    abortUrlRef.current = abortUrl;

    // Step 1: Initiate multipart upload
    const initiateResponse = await fetch(initiateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initiateBody),
    });

    if (!initiateResponse.ok) {
      const errData = await initiateResponse.json();
      throw new Error(errData.error || 'Failed to initiate multipart upload');
    }

    const initData: InitiateResponse = await initiateResponse.json();
    const { uploadId, r2Key, partUrls, totalParts, partSizeBytes } = initData;

    uploadMetaRef.current = { r2Key, uploadId };

    if (abortedRef.current) {
      // Abort was called during initiation
      await sendAbort(abortUrl, uploadId, r2Key);
      throw new Error('Upload aborted');
    }

    // Step 2: Upload parts with concurrency pool
    const completedParts: UploadPart[] = [];
    const partProgress: Record<number, number> = {};
    let completedBytes = 0;

    const updateProgress = () => {
      if (!onProgress) return;
      const inProgressBytes = Object.values(partProgress).reduce((a, b) => a + b, 0);
      const totalProgress = completedBytes + inProgressBytes;
      const pct = Math.min(99, Math.round((totalProgress / file.size) * 100));
      onProgress(pct);
    };

    const onChunkProgress = (partNumber: number, loaded: number) => {
      partProgress[partNumber] = loaded;
      updateProgress();
    };

    // Build a queue of part numbers
    const queue: number[] = [];
    for (let i = 1; i <= totalParts; i++) {
      queue.push(i);
    }

    let queueIdx = 0;
    const errors: Error[] = [];

    const worker = async () => {
      while (queueIdx < queue.length && errors.length === 0) {
        if (abortedRef.current) return;

        const partNumber = queue[queueIdx++];
        if (partNumber === undefined) return;

        const start = (partNumber - 1) * partSizeBytes;
        const end = Math.min(start + partSizeBytes, file.size);
        const blob = file.slice(start, end);
        const url = partUrls[partNumber];

        try {
          const part = await uploadPartWithRetry(url, blob, partNumber, onChunkProgress);
          completedParts.push(part);
          completedBytes += end - start;
          delete partProgress[partNumber];
          updateProgress();
        } catch (err) {
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    // Spawn concurrent workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENCY, totalParts); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    if (abortedRef.current) {
      await sendAbort(abortUrl, uploadId, r2Key);
      throw new Error('Upload aborted');
    }

    if (errors.length > 0) {
      await sendAbort(abortUrl, uploadId, r2Key);
      throw errors[0];
    }

    // Step 3: Complete multipart upload
    const completeResponse = await fetch(completeUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        r2Key,
        parts: completedParts,
        ...completeBodyExtra,
      }),
    });

    if (!completeResponse.ok) {
      const errData = await completeResponse.json();
      throw new Error(errData.error || 'Failed to complete multipart upload');
    }

    onProgress?.(100);

    return await completeResponse.json();
  }, []);

  const abort = useCallback(() => {
    abortedRef.current = true;

    // Abort all in-flight XHRs
    for (const xhr of activeXhrsRef.current) {
      xhr.abort();
    }
    activeXhrsRef.current.clear();

    // Send abort request to clean up R2 parts
    const meta = uploadMetaRef.current;
    const abortUrl = abortUrlRef.current;
    if (meta && abortUrl) {
      sendAbort(abortUrl, meta.uploadId, meta.r2Key);
    }
  }, []);

  return { upload, abort };
}

async function sendAbort(abortUrl: string, uploadId: string, r2Key: string): Promise<void> {
  try {
    await fetch(abortUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, r2Key }),
    });
  } catch (err) {
    console.error('Error sending abort request:', err);
  }
}
