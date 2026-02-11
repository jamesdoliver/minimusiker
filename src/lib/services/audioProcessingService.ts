import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, access, copyFile, chmod } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { getR2Service } from './r2Service';
import { getTeacherService } from './teacherService';

const execFileAsync = promisify(execFile);

// ffmpeg-static provides the path to a pre-compiled ffmpeg binary
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath: string | null = require('ffmpeg-static');

// Cache the usable ffmpeg path across invocations within the same function instance
let resolvedFfmpegPath: string | null = null;

async function getFfmpegPath(): Promise<string> {
  // Return cached path if already resolved and still executable
  if (resolvedFfmpegPath) {
    try {
      await access(resolvedFfmpegPath, fsConstants.X_OK);
      return resolvedFfmpegPath;
    } catch {
      resolvedFfmpegPath = null; // Stale, re-resolve
    }
  }

  if (!ffmpegPath) {
    throw new Error('ffmpeg-static returned null/undefined — binary not bundled in deployment');
  }

  // Try the original path first (works locally)
  try {
    await access(ffmpegPath, fsConstants.X_OK);
    resolvedFfmpegPath = ffmpegPath;
    return ffmpegPath;
  } catch {
    // Binary exists but isn't executable (Vercel strips permissions)
  }

  // Copy to /tmp and make executable
  const tmpFfmpeg = '/tmp/ffmpeg';
  await copyFile(ffmpegPath, tmpFfmpeg);
  await chmod(tmpFfmpeg, 0o755);
  resolvedFfmpegPath = tmpFfmpeg;
  return tmpFfmpeg;
}

/**
 * Process an uploaded audio file: encode WAV→MP3, generate 10-second preview snippet.
 *
 * Steps:
 * 1. Download source file from R2 to /tmp
 * 2. If WAV: encode to MP3 (192kbps) → upload to R2
 * 3. Generate 10-second preview with 1-second fade-out → upload to R2
 * 4. Update AudioFile record in Airtable with new keys and status
 * 5. Clean up /tmp files
 */
export async function processAudioFile(
  r2Key: string,
  eventId: string,
  classId: string,
  songId: string,
  displayName?: string
): Promise<{
  mp3Key: string;
  previewKey: string;
  durationSeconds: number;
}> {
  const r2 = getR2Service();
  const teacherService = getTeacherService();
  const timestamp = Date.now();

  // Temp file paths
  const tmpDir = '/tmp';
  const inputPath = path.join(tmpDir, `input_${timestamp}${path.extname(r2Key) || '.wav'}`);
  const mp3Path = path.join(tmpDir, `output_${timestamp}.mp3`);
  const previewPath = path.join(tmpDir, `preview_${timestamp}.mp3`);

  const filesToCleanup = [inputPath, mp3Path, previewPath];

  try {
    // 0. Verify ffmpeg is available before downloading anything
    const ffmpeg = await getFfmpegPath();

    // 1. Download source file from R2
    const buffer = await r2.getFileBuffer(r2Key);
    if (!buffer) {
      throw new Error(`Source file not found in R2: ${r2Key}`);
    }
    await writeFile(inputPath, buffer);

    // 2. Determine if we need WAV→MP3 encoding
    const isWav = r2Key.toLowerCase().endsWith('.wav');
    const sourceMp3Path = isWav ? mp3Path : inputPath;

    if (isWav) {
      // Encode WAV → MP3 at 192kbps
      await execFileAsync(ffmpeg, [
        '-i', inputPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        mp3Path,
      ], { timeout: 120000 });
    }

    // 3. Get duration from the MP3 (or source) using ffprobe-like approach
    //    We extract duration from ffmpeg stderr output
    const durationSeconds = await getAudioDuration(ffmpeg, sourceMp3Path);

    // 4. Generate 10-second preview with 1-second fade-out
    await execFileAsync(ffmpeg, [
      '-i', sourceMp3Path,
      '-t', '10',
      '-af', 'afade=t=out:st=9:d=1',
      '-b:a', '192k',
      '-y',
      previewPath,
    ], { timeout: 30000 });

    // 5. Upload MP3 to R2
    const mp3Filename = displayName ? `${displayName}.mp3` : 'final.mp3';
    const mp3Key = `recordings/${eventId}/${classId}/${songId}/final/${mp3Filename}`;
    const mp3Buffer = isWav
      ? await readFileAsBuffer(mp3Path)
      : buffer; // If already MP3, use original buffer

    // For non-WAV files, we still want to create the .mp3 key
    // If source is already MP3, we just copy it to the canonical path
    if (isWav) {
      await uploadBuffer(r2, mp3Key, await readFileAsBuffer(mp3Path), 'audio/mpeg');
    } else {
      // Source is already MP3 - upload to canonical path
      await uploadBuffer(r2, mp3Key, buffer, 'audio/mpeg');
    }

    // 6. Upload preview to R2
    const previewFilename = displayName ? `${displayName}.mp3` : 'preview.mp3';
    const previewKey = `recordings/${eventId}/${classId}/${songId}/preview/${previewFilename}`;
    await uploadBuffer(r2, previewKey, await readFileAsBuffer(previewPath), 'audio/mpeg');

    // 7. Update AudioFile record in Airtable
    //    Find the audio file by r2Key and update it
    const audioFiles = await teacherService.getAudioFilesBySongId(songId, 'final');
    const audioFile = audioFiles.find(af => af.r2Key === r2Key);
    if (audioFile) {
      await teacherService.updateAudioFile(audioFile.id, {
        status: 'ready',
        durationSeconds: Math.round(durationSeconds),
        mp3R2Key: mp3Key,
        previewR2Key: previewKey,
      });
    }

    return {
      mp3Key,
      previewKey,
      durationSeconds: Math.round(durationSeconds),
    };
  } finally {
    // 8. Clean up temp files
    for (const filePath of filesToCleanup) {
      try {
        await unlink(filePath);
      } catch {
        // File may not exist, ignore
      }
    }
  }
}

/**
 * Get audio duration in seconds using ffmpeg
 */
async function getAudioDuration(ffmpeg: string, filePath: string): Promise<number> {
  try {
    // ffmpeg writes info to stderr; use -f null to avoid output
    const { stderr } = await execFileAsync(ffmpeg, [
      '-i', filePath,
      '-f', 'null',
      '-',
    ], { timeout: 30000 }).catch(err => {
      // ffmpeg returns non-zero exit code but still provides duration in stderr
      return { stdout: '', stderr: err.stderr || '' };
    });

    // Parse duration from stderr: "Duration: HH:MM:SS.ms"
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Read a file into a Buffer
 */
async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  const { readFile } = await import('fs/promises');
  return readFile(filePath);
}

/**
 * Upload a buffer to R2 using PutObjectCommand through the R2 service
 */
async function uploadBuffer(
  r2: ReturnType<typeof getR2Service>,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  // Use the R2 service's internal upload mechanism
  // We use uploadToTemp as a pattern, but upload directly to the final key
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');

  // Access the S3 client and bucket through the service
  // Since R2Service doesn't expose a direct upload-by-key method for the recordings bucket,
  // we'll use a workaround: upload to temp, then move
  const tempKey = `temp/processing_${Date.now()}/${key.split('/').pop()}`;

  // Actually, let's just create a simple upload helper
  // The r2Service has uploadRawAudio which takes a buffer, but the key format is fixed.
  // We need to use a more generic approach.

  // We can use moveFile pattern: upload to temp first, then... no, let's be direct.
  // The simplest approach: use getFileBuffer's reverse - write directly.
  // R2Service doesn't have a generic uploadBuffer for the recordings bucket,
  // so we'll add a simple method call.

  // For now, use the temp upload + move approach
  const filename = key.split('/').pop() || 'file.mp3';
  const uploadId = `processing_${Date.now()}`;
  const result = await r2.uploadToTemp(uploadId, filename, buffer, contentType);
  if (!result.success) {
    throw new Error(`Failed to upload to temp: ${result.error}`);
  }
  // Move from temp to final destination
  const moved = await r2.moveFile(result.key, key);
  if (!moved) {
    throw new Error(`Failed to move file from ${result.key} to ${key}`);
  }
}
