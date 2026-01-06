import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface UploadResult {
  success: boolean;
  key: string;
  url?: string;
  error?: string;
}

interface FileMetadata {
  contentType: string;
  contentLength: number;
  lastModified?: Date;
}

class R2Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2 configuration is incomplete. Please check environment variables.');
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    this.bucketName = bucketName;
  }

  /**
   * Upload a recording file to R2 (LEGACY - for backward compatibility)
   * For new implementations, use uploadRecordingWithClassId
   */
  async uploadRecording(
    eventId: string,
    file: Buffer,
    type: 'preview' | 'full',
    contentType: string = 'audio/mpeg',
    className?: string
  ): Promise<UploadResult> {
    // Generate class-specific path if className provided
    let key: string;
    if (className) {
      const classSlug = className
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      key = `events/${eventId}/${classSlug}/${type}.mp3`;
    } else {
      key = `events/${eventId}/${type}.mp3`;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        // Add basic metadata
        Metadata: {
          eventId: eventId,
          type: type,
          ...(className && { className: className }),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key: key,
      };
    } catch (error) {
      console.error('Error uploading to R2:', error);
      return {
        success: false,
        key: key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Upload a recording file to R2 with class_id (recommended for new implementations)
   * Stores class_id in both the path and object metadata for reliable tracking
   */
  async uploadRecordingWithClassId(
    eventId: string,
    classId: string,
    file: Buffer,
    type: 'preview' | 'full',
    contentType: string = 'audio/mpeg',
    additionalMetadata?: Record<string, string>
  ): Promise<UploadResult> {
    // Use class_id directly in path
    const key = `events/${eventId}/${classId}/${type}.mp3`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        // Store class_id and other metadata in R2 object metadata
        Metadata: {
          eventId: eventId,
          classId: classId,
          type: type,
          uploadDate: new Date().toISOString(),
          ...additionalMetadata,
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key: key,
      };
    } catch (error) {
      console.error('Error uploading to R2:', error);
      return {
        success: false,
        key: key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Generate a signed URL for accessing a file
   */
  async generateSignedUrl(key: string, expiresIn: number = 1800): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
    return signedUrl;
  }

  /**
   * Get a signed URL for preview audio (30-minute expiry)
   */
  async getPreviewUrl(eventId: string, className?: string): Promise<string> {
    let key: string;
    if (className) {
      const classSlug = className
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      key = `events/${eventId}/${classSlug}/preview.mp3`;
    } else {
      key = `events/${eventId}/preview.mp3`;
    }
    // 30 minutes in seconds
    return this.generateSignedUrl(key, 1800);
  }

  /**
   * Get a signed URL for full recording (24-hour expiry)
   */
  async getFullRecordingUrl(eventId: string, className?: string): Promise<string> {
    let key: string;
    if (className) {
      const classSlug = className
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      key = `events/${eventId}/${classSlug}/full.mp3`;
    } else {
      key = `events/${eventId}/full.mp3`;
    }
    // 24 hours in seconds
    return this.generateSignedUrl(key, 86400);
  }

  /**
   * Get a signed URL for preview audio using class_id (30-minute expiry)
   * Recommended for new implementations
   */
  async getPreviewUrlByClassId(eventId: string, classId: string): Promise<string> {
    const key = `events/${eventId}/${classId}/preview.mp3`;
    // 30 minutes in seconds
    return this.generateSignedUrl(key, 1800);
  }

  /**
   * Get a signed URL for full recording using class_id (24-hour expiry)
   * Recommended for new implementations
   */
  async getFullRecordingUrlByClassId(eventId: string, classId: string): Promise<string> {
    const key = `events/${eventId}/${classId}/full.mp3`;
    // 24 hours in seconds
    return this.generateSignedUrl(key, 86400);
  }

  /**
   * Get recording URL with fallback support for both class_id and className paths
   * Tries class_id path first, falls back to className slug path for backward compatibility
   */
  async getRecordingUrlWithFallback(
    eventId: string,
    type: 'preview' | 'full',
    classId?: string,
    className?: string
  ): Promise<string | null> {
    // Try class_id path first (new format)
    if (classId) {
      const classIdKey = `events/${eventId}/${classId}/${type}.mp3`;
      if (await this.fileExists(classIdKey)) {
        const expiresIn = type === 'preview' ? 1800 : 86400;
        return this.generateSignedUrl(classIdKey, expiresIn);
      }
    }

    // Fall back to className slug path (legacy format)
    if (className) {
      const classSlug = className
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      const classNameKey = `events/${eventId}/${classSlug}/${type}.mp3`;
      if (await this.fileExists(classNameKey)) {
        const expiresIn = type === 'preview' ? 1800 : 86400;
        return this.generateSignedUrl(classNameKey, expiresIn);
      }
    }

    // Fall back to event-level recording (no class)
    const eventKey = `events/${eventId}/${type}.mp3`;
    if (await this.fileExists(eventKey)) {
      const expiresIn = type === 'preview' ? 1800 : 86400;
      return this.generateSignedUrl(eventKey, expiresIn);
    }

    return null;
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting from R2:', error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        lastModified: response.LastModified,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * Check if a file exists in R2
   */
  async fileExists(key: string): Promise<boolean> {
    const metadata = await this.getFileMetadata(key);
    return metadata !== null;
  }

  /**
   * Upload raw audio file for a class
   * Raw audio files are stored in recordings/{eventId}/{classId}/raw/
   * Each raw file gets a unique timestamp-based name
   */
  async uploadRawAudio(
    eventId: string,
    classId: string,
    file: Buffer,
    originalFilename: string,
    contentType: string = 'audio/mpeg',
    uploadedBy?: string
  ): Promise<UploadResult> {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .substring(0, 50);
    const key = `recordings/${eventId}/${classId}/raw/${timestamp}_${sanitizedFilename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        Metadata: {
          eventId: eventId,
          classId: classId,
          type: 'raw',
          originalFilename: originalFilename,
          uploadDate: new Date().toISOString(),
          ...(uploadedBy && { uploadedBy: uploadedBy }),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key: key,
      };
    } catch (error) {
      console.error('Error uploading raw audio to R2:', error);
      return {
        success: false,
        key: key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Generate a presigned URL for uploading raw audio
   * This allows direct browser-to-R2 uploads
   */
  async generateRawAudioUploadUrl(
    eventId: string,
    classId: string,
    filename: string,
    contentType: string = 'audio/mpeg'
  ): Promise<{ uploadUrl: string; key: string }> {
    const timestamp = Date.now();
    const sanitizedFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .substring(0, 50);
    const key = `recordings/${eventId}/${classId}/raw/${timestamp}_${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Get signed URL for a raw audio file
   */
  async getRawAudioUrl(key: string): Promise<string> {
    return this.generateSignedUrl(key, 3600); // 1 hour expiry
  }

  /**
   * Get a file as a Buffer (for streaming/ZIP creation)
   */
  async getFileBuffer(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error getting file buffer:', error);
      return null;
    }
  }

  /**
   * Generate upload URL for mixed audio (preview or final)
   */
  async generateMixedAudioUploadUrl(
    eventId: string,
    classId: string,
    type: 'preview' | 'final',
    contentType: string = 'audio/mpeg'
  ): Promise<{ uploadUrl: string; key: string }> {
    // Mixed audio goes to recordings/{eventId}/{classId}/{type}.mp3
    const key = `recordings/${eventId}/${classId}/${type}.mp3`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Get signed URL for mixed audio (preview or final)
   */
  async getMixedAudioUrl(
    eventId: string,
    classId: string,
    type: 'preview' | 'final'
  ): Promise<string | null> {
    const key = `recordings/${eventId}/${classId}/${type}.mp3`;

    if (await this.fileExists(key)) {
      const expiresIn = type === 'preview' ? 1800 : 86400; // 30 min for preview, 24h for final
      return this.generateSignedUrl(key, expiresIn);
    }

    return null;
  }

  // ========================================
  // Song-Level Audio Methods
  // ========================================

  /**
   * Generate presigned URL for uploading raw audio for a specific song
   * Path: recordings/{eventId}/{classId}/{songId}/raw/{timestamp}_{filename}
   */
  async generateSongRawUploadUrl(
    eventId: string,
    classId: string,
    songId: string,
    filename: string,
    contentType: string = 'audio/mpeg'
  ): Promise<{ uploadUrl: string; key: string }> {
    const timestamp = Date.now();
    const sanitizedFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .substring(0, 50);
    const key = `recordings/${eventId}/${classId}/${songId}/raw/${timestamp}_${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Generate presigned URL for uploading final audio for a specific song
   * Path: recordings/{eventId}/{classId}/{songId}/final/final_{timestamp}.{ext}
   */
  async generateSongFinalUploadUrl(
    eventId: string,
    classId: string,
    songId: string,
    filename: string,
    contentType: string = 'audio/mpeg'
  ): Promise<{ uploadUrl: string; key: string }> {
    const timestamp = Date.now();
    const ext = filename.split('.').pop()?.toLowerCase() || 'mp3';
    const key = `recordings/${eventId}/${classId}/${songId}/final/final_${timestamp}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Get signed URL for a song's raw or final audio file
   */
  async getSongAudioUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.generateSignedUrl(key, expiresIn);
  }

  /**
   * Upload file to temporary location (for batch uploads before confirmation)
   * Path: temp/{uploadId}/{filename}
   */
  async uploadToTemp(
    uploadId: string,
    filename: string,
    buffer: Buffer,
    contentType: string = 'audio/mpeg'
  ): Promise<{ success: boolean; key: string; error?: string }> {
    const key = `temp/${uploadId}/${filename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          uploadId: uploadId,
          originalFilename: filename,
          uploadDate: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key: key,
      };
    } catch (error) {
      console.error('Error uploading to temp:', error);
      return {
        success: false,
        key: key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Move file from temporary location to final location
   * Used after batch upload confirmation
   */
  async moveFile(fromKey: string, toKey: string): Promise<boolean> {
    try {
      // Get the file from temp location
      const buffer = await this.getFileBuffer(fromKey);
      if (!buffer) {
        console.error('Could not retrieve file from temp location:', fromKey);
        return false;
      }

      // Upload to final location
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: toKey,
        Body: buffer,
      });

      await this.client.send(command);

      // Delete from temp location
      await this.deleteFile(fromKey);

      return true;
    } catch (error) {
      console.error('Error moving file:', error);
      return false;
    }
  }

  // ========================================
  // School Logo Methods
  // ========================================

  /**
   * Generate presigned URL for uploading a school logo
   * Logos are stored at logos/{einrichtungId}/logo.{ext}
   */
  async generateLogoUploadUrl(
    einrichtungId: string,
    filename: string,
    contentType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    // Extract extension from filename
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const key = `logos/${einrichtungId}/logo.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 }); // 1 hour

    return {
      uploadUrl,
      key,
    };
  }

  /**
   * Get a signed URL for a school logo (1 hour expiry)
   * Returns null if logo doesn't exist
   */
  async getLogoUrl(einrichtungId: string): Promise<string | null> {
    // Check common image extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];

    for (const ext of extensions) {
      const key = `logos/${einrichtungId}/logo.${ext}`;
      if (await this.fileExists(key)) {
        return this.generateSignedUrl(key, 3600); // 1 hour expiry
      }
    }

    return null;
  }

  /**
   * Get logo URL by R2 key (when key is known)
   */
  async getLogoUrlByKey(key: string): Promise<string | null> {
    if (await this.fileExists(key)) {
      return this.generateSignedUrl(key, 3600); // 1 hour expiry
    }
    return null;
  }

  /**
   * Delete a school logo from R2
   */
  async deleteLogo(einrichtungId: string): Promise<boolean> {
    // Try to delete all possible logo extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    let deleted = false;

    for (const ext of extensions) {
      const key = `logos/${einrichtungId}/logo.${ext}`;
      if (await this.fileExists(key)) {
        const result = await this.deleteFile(key);
        if (result) deleted = true;
      }
    }

    return deleted;
  }
}

// Export singleton instance
let r2ServiceInstance: R2Service | null = null;

export function getR2Service(): R2Service {
  if (!r2ServiceInstance) {
    r2ServiceInstance = new R2Service();
  }
  return r2ServiceInstance;
}

export default R2Service;
