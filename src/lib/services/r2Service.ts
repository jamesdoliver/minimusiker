import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ========================================
// Path Constants for New R2 Structure
// ========================================

/**
 * New R2 bucket structure (minimusiker-assets):
 *
 * minimusiker-assets/
 * ├── templates/                              # Base templates (uploaded once by admin)
 * │   ├── flyer1-template.pdf
 * │   ├── flyer1-back-template.pdf           # NEW: Flyer back templates
 * │   ├── flyer2-template.pdf
 * │   ├── flyer2-back-template.pdf
 * │   ├── flyer3-template.pdf
 * │   ├── flyer3-back-template.pdf
 * │   ├── button-template.pdf
 * │   ├── tshirt-print-template.pdf
 * │   ├── hoodie-print-template.pdf
 * │   ├── minicard-template.pdf
 * │   ├── cd-jacket-template.pdf
 * │   ├── mock-tshirt-template.pdf
 * │   └── mock-hoodie-template.pdf
 * │
 * ├── fonts/                                  # NEW: Custom fonts for printables
 * │   ├── Fredoka-SemiBold.ttf               # For flyers, button, minicard, CD jacket
 * │   └── SpringwoodDisplay.otf              # For T-shirt & Hoodie
 * │
 * └── events/
 *     └── {event_id}/
 *         ├── logo/
 *         │   └── logo.png
 *         ├── printables/
 *         │   ├── logo/
 *         │   │   └── logo.png
 *         │   ├── flyers/
 *         │   │   ├── flyer1.pdf
 *         │   │   ├── flyer2.pdf
 *         │   │   └── flyer3.pdf
 *         │   ├── button.pdf
 *         │   ├── tshirt-print.pdf
 *         │   ├── hoodie-print.pdf
 *         │   ├── minicards/
 *         │   │   └── minicard.pdf
 *         │   └── cd-jacket/
 *         │       └── cd-jacket.pdf
 *         ├── mockups/
 *         │   ├── mock-tshirt.pdf
 *         │   └── mock-hoodie.pdf
 *         └── classes/
 *             └── {class_id}/
 *                 ├── raw/
 *                 └── final/
 */

export const R2_PATHS = {
  // Template paths
  TEMPLATES: 'templates',

  // Font paths
  FONTS: 'fonts',

  // Event-level paths
  EVENTS: 'events',

  // Sub-paths within an event
  EVENT_LOGO: (eventId: string) => `events/${eventId}/logo`,
  EVENT_PRINTABLES: (eventId: string) => `events/${eventId}/printables`,
  EVENT_PRINTABLES_LOGO: (eventId: string) => `events/${eventId}/printables/logo`,
  EVENT_PRINTABLES_FLYERS: (eventId: string) => `events/${eventId}/printables/flyers`,
  EVENT_PRINTABLES_MINICARDS: (eventId: string) => `events/${eventId}/printables/minicards`,
  EVENT_PRINTABLES_CD_JACKET: (eventId: string) => `events/${eventId}/printables/cd-jacket`,
  EVENT_MOCKUPS: (eventId: string) => `events/${eventId}/mockups`,
  EVENT_CLASSES: (eventId: string) => `events/${eventId}/classes`,

  // Class-level paths
  CLASS_RAW: (eventId: string, classId: string) => `events/${eventId}/classes/${classId}/raw`,
  CLASS_FINAL: (eventId: string, classId: string) => `events/${eventId}/classes/${classId}/final`,
} as const;

// Printable types that can be generated
export type PrintableType =
  | 'flyer1' | 'flyer1-back'
  | 'flyer2' | 'flyer2-back'
  | 'flyer3' | 'flyer3-back'
  | 'button'
  | 'tshirt-print' | 'hoodie-print'
  | 'minicard' | 'cd-jacket';

// Mockup types that can be generated
export type MockupType = 'mock-tshirt' | 'mock-hoodie';

// All template types (printables + mockups)
export type TemplateType = PrintableType | MockupType;

// Font types for custom fonts
export type FontName = 'fredoka' | 'springwood-display';

// Font filenames mapping
export const FONT_FILENAMES: Record<FontName, string> = {
  'fredoka': 'Fredoka-SemiBold.ttf',
  'springwood-display': 'SpringwoodDisplay.otf',
};

// Template filenames mapping
export const TEMPLATE_FILENAMES: Record<TemplateType, string> = {
  'flyer1': 'flyer1-template.pdf',
  'flyer1-back': 'flyer1-back-template.pdf',
  'flyer2': 'flyer2-template.pdf',
  'flyer2-back': 'flyer2-back-template.pdf',
  'flyer3': 'flyer3-template.pdf',
  'flyer3-back': 'flyer3-back-template.pdf',
  'button': 'button-template.pdf',
  'tshirt-print': 'tshirt-print-template.pdf',
  'hoodie-print': 'hoodie-print-template.pdf',
  'minicard': 'minicard-template.pdf',
  'cd-jacket': 'cd-jacket-template.pdf',
  'mock-tshirt': 'mock-tshirt-template.pdf',
  'mock-hoodie': 'mock-hoodie-template.pdf',
};

// Generated printable filenames (output)
export const PRINTABLE_FILENAMES: Record<PrintableType, string> = {
  'flyer1': 'flyer1.pdf',
  'flyer1-back': 'flyer1-back.pdf',
  'flyer2': 'flyer2.pdf',
  'flyer2-back': 'flyer2-back.pdf',
  'flyer3': 'flyer3.pdf',
  'flyer3-back': 'flyer3-back.pdf',
  'button': 'button.pdf',
  'tshirt-print': 'tshirt-print.pdf',
  'hoodie-print': 'hoodie-print.pdf',
  'minicard': 'minicard.pdf',
  'cd-jacket': 'cd-jacket.pdf',
};

// Generated mockup filenames (output)
export const MOCKUP_FILENAMES: Record<MockupType, string> = {
  'mock-tshirt': 'mock-tshirt.pdf',
  'mock-hoodie': 'mock-hoodie.pdf',
};

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
  private assetsBucketName: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2 configuration is incomplete. Please check environment variables.');
    }

    // Assets bucket is required for printables - no silent fallback
    const assetsBucketName = process.env.R2_ASSETS_BUCKET_NAME;
    if (!assetsBucketName) {
      throw new Error(
        'R2_ASSETS_BUCKET_NAME environment variable is not set. ' +
        'This is required for printables generation. ' +
        'Expected bucket: minimusiker-assets'
      );
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
    this.assetsBucketName = assetsBucketName;
  }

  /**
   * Get the assets bucket name (minimusiker-assets)
   * Used for templates, printables, mockups, and event structure
   */
  getAssetsBucketName(): string {
    return this.assetsBucketName;
  }

  /**
   * Health check for the assets bucket - verifies bucket access, templates, and fonts
   * Used before printable generation to provide clear error messages
   */
  async checkAssetsHealth(): Promise<{
    healthy: boolean;
    bucketAccessible: boolean;
    bucketName: string;
    templatesFound: string[];
    templatesMissing: string[];
    fontsFound: string[];
    fontsMissing: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const templatesFound: string[] = [];
    const templatesMissing: string[] = [];
    const fontsFound: string[] = [];
    const fontsMissing: string[] = [];
    let bucketAccessible = false;

    // Check bucket accessibility by attempting to list (or head) a known path
    try {
      // Try to check if templates folder exists by checking for any template
      const testTemplateKey = `${R2_PATHS.TEMPLATES}/${TEMPLATE_FILENAMES['flyer1']}`;
      const command = new HeadObjectCommand({
        Bucket: this.assetsBucketName,
        Key: testTemplateKey,
      });
      await this.client.send(command);
      bucketAccessible = true;
    } catch (error: unknown) {
      // If it's a 404, the bucket is accessible but the file doesn't exist
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
        bucketAccessible = true;
      } else if (error && typeof error === 'object' && '$metadata' in error) {
        // AWS SDK error with metadata - check status code
        const awsError = error as { $metadata?: { httpStatusCode?: number } };
        if (awsError.$metadata?.httpStatusCode === 404) {
          bucketAccessible = true;
        } else {
          bucketAccessible = false;
          errors.push(`Bucket access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        bucketAccessible = false;
        errors.push(`Bucket access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check all templates
    // Note: Clothing templates (tshirt-print, hoodie-print) are optional - we can generate blank PDFs
    const requiredTemplateTypes: TemplateType[] = [
      'flyer1', 'flyer1-back',
      'flyer2', 'flyer2-back',
      'flyer3', 'flyer3-back',
      'button',
      'minicard', 'cd-jacket',
      'mock-tshirt', 'mock-hoodie',
    ];

    const optionalTemplateTypes: TemplateType[] = [
      'tshirt-print', 'hoodie-print',
    ];

    const allTemplateTypes: TemplateType[] = [...requiredTemplateTypes, ...optionalTemplateTypes];
    const requiredMissing: string[] = [];

    for (const templateType of allTemplateTypes) {
      const filename = TEMPLATE_FILENAMES[templateType];
      const key = `${R2_PATHS.TEMPLATES}/${filename}`;
      const exists = await this.fileExistsInAssetsBucket(key);
      if (exists) {
        templatesFound.push(templateType);
      } else {
        templatesMissing.push(templateType);
        // Only add to requiredMissing if it's a required template
        if (requiredTemplateTypes.includes(templateType)) {
          requiredMissing.push(templateType);
        }
      }
    }

    if (requiredMissing.length > 0) {
      errors.push(`Missing required templates: ${requiredMissing.join(', ')}`);
    }

    // Check all fonts
    const allFontNames: FontName[] = ['fredoka', 'springwood-display'];

    for (const fontName of allFontNames) {
      const filename = FONT_FILENAMES[fontName];
      const key = `${R2_PATHS.FONTS}/${filename}`;
      const exists = await this.fileExistsInAssetsBucket(key);
      if (exists) {
        fontsFound.push(fontName);
      } else {
        fontsMissing.push(fontName);
      }
    }

    if (fontsMissing.length > 0) {
      errors.push(`Missing fonts: ${fontsMissing.join(', ')}`);
    }

    // Health is based on required templates (clothing templates are optional)
    const healthy = bucketAccessible && requiredMissing.length === 0 && fontsMissing.length === 0;

    return {
      healthy,
      bucketAccessible,
      bucketName: this.assetsBucketName,
      templatesFound,
      templatesMissing,
      fontsFound,
      fontsMissing,
      errors,
    };
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
    contentType: string = 'audio/mpeg',
    format: 'mp3' | 'wav' = 'mp3'
  ): Promise<{ uploadUrl: string; key: string }> {
    // Mixed audio goes to recordings/{eventId}/{classId}/{type}.{ext}
    const extension = type === 'preview' ? 'mp3' : format;
    const key = `recordings/${eventId}/${classId}/${type}.${extension}`;

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
    type: 'preview' | 'final',
    format: 'mp3' | 'wav' = 'mp3'
  ): Promise<string | null> {
    const extension = type === 'preview' ? 'mp3' : format;
    const key = `recordings/${eventId}/${classId}/${type}.${extension}`;

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

  // ========================================
  // NEW: Event Structure & Asset Methods
  // (For minimusiker-assets bucket)
  // ========================================

  /**
   * Initialize the folder structure for a new event in the assets bucket.
   * This creates the event folder and copies the school logo if provided.
   *
   * Structure created:
   * events/{eventId}/
   *   ├── logo/logo.{ext}           (if logoSourceKey provided)
   *   └── printables/logo/logo.{ext} (copy for easy reference)
   *
   * Note: Other folders (printables/flyers, mockups, classes) are created
   * implicitly when files are uploaded to them.
   *
   * @param eventId - The event_id for the new event
   * @param logoSourceKey - Optional: R2 key of existing logo to copy (e.g., logos/{einrichtungId}/logo.png)
   * @returns Object with success status and created paths
   */
  async initializeEventStructure(
    eventId: string,
    logoSourceKey?: string
  ): Promise<{
    success: boolean;
    eventPath: string;
    logoPath?: string;
    printablesLogoPath?: string;
    error?: string;
  }> {
    const eventPath = `${R2_PATHS.EVENTS}/${eventId}`;

    try {
      // If a logo source is provided, copy it to the event folder
      if (logoSourceKey) {
        // Determine the extension from the source key
        const ext = logoSourceKey.split('.').pop()?.toLowerCase() || 'png';

        // Copy to event logo folder
        const logoPath = `${R2_PATHS.EVENT_LOGO(eventId)}/logo.${ext}`;
        const logoSuccess = await this.copyFileInAssetsBucket(logoSourceKey, logoPath);

        if (!logoSuccess) {
          console.warn(`Failed to copy logo to ${logoPath}, continuing without logo`);
        }

        // Also copy to printables/logo for easy reference during generation
        const printablesLogoPath = `${R2_PATHS.EVENT_PRINTABLES_LOGO(eventId)}/logo.${ext}`;
        const printablesLogoSuccess = await this.copyFileInAssetsBucket(logoSourceKey, printablesLogoPath);

        if (!printablesLogoSuccess) {
          console.warn(`Failed to copy logo to ${printablesLogoPath}`);
        }

        return {
          success: true,
          eventPath,
          logoPath: logoSuccess ? logoPath : undefined,
          printablesLogoPath: printablesLogoSuccess ? printablesLogoPath : undefined,
        };
      }

      // No logo to copy, just return success (folders created implicitly on upload)
      return {
        success: true,
        eventPath,
      };
    } catch (error) {
      console.error('Error initializing event structure:', error);
      return {
        success: false,
        eventPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create the audio folder structure for an event
   * Creates a .gitkeep file in events/{eventId}/classes/ to initialize the folder
   *
   * @param eventId - The event ID
   * @returns Object with success status and created path
   */
  async createAudioFolderStructure(eventId: string): Promise<{
    success: boolean;
    classesPath: string;
    error?: string;
  }> {
    const classesPath = `${R2_PATHS.EVENT_CLASSES(eventId)}/.gitkeep`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: classesPath,
        Body: Buffer.from('# Placeholder for audio files\n'),
        ContentType: 'text/plain',
        Metadata: {
          eventId,
          purpose: 'folder-structure-initialization',
          createdAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      console.log(`[R2Service] Created audio folder structure for event ${eventId}`);

      return {
        success: true,
        classesPath,
      };
    } catch (error) {
      console.error(`[R2Service] Error creating audio folder structure for event ${eventId}:`, error);
      return {
        success: false,
        classesPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Copy a file within the assets bucket
   * Used for copying logos to event folders
   */
  private async copyFileInAssetsBucket(sourceKey: string, destKey: string): Promise<boolean> {
    try {
      // First check if source exists
      const sourceExists = await this.fileExistsInAssetsBucket(sourceKey);
      if (!sourceExists) {
        console.error(`Source file does not exist: ${sourceKey}`);
        return false;
      }

      const command = new CopyObjectCommand({
        Bucket: this.assetsBucketName,
        CopySource: `${this.assetsBucketName}/${sourceKey}`,
        Key: destKey,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error(`Error copying file from ${sourceKey} to ${destKey}:`, error);
      return false;
    }
  }

  /**
   * Check if a file exists in the assets bucket
   */
  async fileExistsInAssetsBucket(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upload a logo directly to an event's folder (from buffer)
   * Used when uploading a new logo specifically for an event
   */
  async uploadEventLogo(
    eventId: string,
    buffer: Buffer,
    contentType: string,
    extension: string = 'png'
  ): Promise<UploadResult> {
    const logoPath = `${R2_PATHS.EVENT_LOGO(eventId)}/logo.${extension}`;
    const printablesLogoPath = `${R2_PATHS.EVENT_PRINTABLES_LOGO(eventId)}/logo.${extension}`;

    try {
      // Upload to event logo folder
      const logoCommand = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: logoPath,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          eventId,
          type: 'logo',
          uploadDate: new Date().toISOString(),
        },
      });
      await this.client.send(logoCommand);

      // Also upload to printables/logo
      const printablesLogoCommand = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: printablesLogoPath,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          eventId,
          type: 'logo',
          uploadDate: new Date().toISOString(),
        },
      });
      await this.client.send(printablesLogoCommand);

      return {
        success: true,
        key: logoPath,
      };
    } catch (error) {
      console.error('Error uploading event logo:', error);
      return {
        success: false,
        key: logoPath,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  // ========================================
  // Template Methods
  // ========================================

  /**
   * Upload a base template to the templates folder
   * Templates are stored at templates/{templateName}-template.pdf
   *
   * @param templateType - The type of template (e.g., 'flyer1', 'poster', 'mock-tshirt')
   * @param buffer - The PDF file buffer
   */
  async uploadTemplate(
    templateType: TemplateType,
    buffer: Buffer
  ): Promise<UploadResult> {
    const filename = TEMPLATE_FILENAMES[templateType];
    const key = `${R2_PATHS.TEMPLATES}/${filename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        Metadata: {
          templateType,
          uploadDate: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error(`Error uploading template ${templateType}:`, error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Get a template file as a Buffer
   * Used by printableService to fetch base templates for generation
   *
   * @param templateType - The type of template to fetch
   * @returns Buffer of the template PDF, or null if not found
   */
  async getTemplate(templateType: TemplateType): Promise<Buffer | null> {
    const filename = TEMPLATE_FILENAMES[templateType];
    const key = `${R2_PATHS.TEMPLATES}/${filename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.assetsBucketName,
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
      console.error(`Error fetching template ${templateType}:`, error);
      return null;
    }
  }

  /**
   * Check if a template exists
   */
  async templateExists(templateType: TemplateType): Promise<boolean> {
    const filename = TEMPLATE_FILENAMES[templateType];
    const key = `${R2_PATHS.TEMPLATES}/${filename}`;
    return this.fileExistsInAssetsBucket(key);
  }

  /**
   * Get a signed URL for a template file
   * Used by the browser to fetch templates for preview rendering
   *
   * @param templateType - The type of template to get URL for
   * @param expiresIn - URL expiry in seconds (default 30 minutes)
   * @returns Signed URL and template exists flag, or null URL if template doesn't exist
   */
  async getTemplateSignedUrl(
    templateType: TemplateType,
    expiresIn: number = 1800
  ): Promise<{ url: string | null; exists: boolean }> {
    const filename = TEMPLATE_FILENAMES[templateType];
    const key = `${R2_PATHS.TEMPLATES}/${filename}`;

    const exists = await this.fileExistsInAssetsBucket(key);
    if (!exists) {
      return { url: null, exists: false };
    }

    const url = await this.generateSignedUrlForAssetsBucket(key, expiresIn);
    return { url, exists: true };
  }

  /**
   * Get the status of all templates (which ones exist)
   * Useful for admin panel to show template upload status
   */
  async getTemplatesStatus(): Promise<Record<TemplateType, boolean>> {
    const allTypes: TemplateType[] = [
      'flyer1', 'flyer1-back',
      'flyer2', 'flyer2-back',
      'flyer3', 'flyer3-back',
      'button',
      'tshirt-print', 'hoodie-print',
      'minicard', 'cd-jacket',
      'mock-tshirt', 'mock-hoodie',
    ];

    const status: Record<string, boolean> = {};

    for (const type of allTypes) {
      status[type] = await this.templateExists(type);
    }

    return status as Record<TemplateType, boolean>;
  }

  // ========================================
  // Font Methods
  // ========================================

  /**
   * Get a custom font file as a Buffer
   * Used by printableService for embedding custom fonts
   *
   * @param fontName - The font name to fetch
   * @returns Buffer of the font file, or null if not found
   */
  async getFont(fontName: FontName): Promise<Buffer | null> {
    const filename = FONT_FILENAMES[fontName];
    const key = `${R2_PATHS.FONTS}/${filename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.assetsBucketName,
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
      console.error(`Error fetching font ${fontName}:`, error);
      return null;
    }
  }

  /**
   * Upload a custom font file
   *
   * @param fontName - The font name
   * @param buffer - The font file buffer
   */
  async uploadFont(fontName: FontName, buffer: Buffer): Promise<UploadResult> {
    const filename = FONT_FILENAMES[fontName];
    const key = `${R2_PATHS.FONTS}/${filename}`;

    // Determine content type based on extension
    const contentType = filename.endsWith('.otf')
      ? 'font/otf'
      : 'font/ttf';

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error(`Error uploading font ${fontName}:`, error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a font exists in R2
   */
  async fontExists(fontName: FontName): Promise<boolean> {
    const filename = FONT_FILENAMES[fontName];
    const key = `${R2_PATHS.FONTS}/${filename}`;
    return this.fileExistsInAssetsBucket(key);
  }

  // ========================================
  // Printable Methods
  // ========================================

  /**
   * Helper method to sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Upload a generated printable PDF to an event's printables folder
   * Includes retry logic with exponential backoff (3 retries: 1s, 2s, 4s)
   *
   * @param eventId - The event ID
   * @param printableType - The type of printable
   * @param buffer - The generated PDF buffer
   */
  async uploadPrintable(
    eventId: string,
    printableType: PrintableType,
    buffer: Buffer
  ): Promise<UploadResult> {
    // Determine the correct path based on printable type
    let key: string;

    if (printableType.startsWith('flyer')) {
      // Flyers go in the flyers subfolder
      key = `${R2_PATHS.EVENT_PRINTABLES_FLYERS(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else if (printableType === 'minicard') {
      // Minicards go in the minicards subfolder
      key = `${R2_PATHS.EVENT_PRINTABLES_MINICARDS(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else if (printableType === 'cd-jacket') {
      // CD jacket goes in the cd-jacket subfolder
      key = `${R2_PATHS.EVENT_PRINTABLES_CD_JACKET(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else {
      // button, tshirt-print, hoodie-print go directly in printables
      key = `${R2_PATHS.EVENT_PRINTABLES(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    }

    const maxRetries = 3;
    const baseDelayMs = 1000; // 1 second
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.assetsBucketName,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
          Metadata: {
            eventId,
            printableType,
            generatedAt: new Date().toISOString(),
          },
        });

        await this.client.send(command);

        if (attempt > 1) {
          console.log(`[R2Service] Upload succeeded on attempt ${attempt} for ${printableType}`);
        }

        return {
          success: true,
          key,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown upload error');
        console.warn(
          `[R2Service] Upload attempt ${attempt}/${maxRetries} failed for ${printableType}: ${lastError.message}`
        );

        // Don't sleep after the last attempt
        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.log(`[R2Service] Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
        }
      }
    }

    // All retries exhausted
    console.error(
      `[R2Service] All ${maxRetries} upload attempts failed for ${printableType} (event: ${eventId}): ${lastError?.message}`
    );

    return {
      success: false,
      key,
      error: `Upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    };
  }

  /**
   * Get a signed URL for a printable
   */
  async getPrintableUrl(
    eventId: string,
    printableType: PrintableType,
    expiresIn: number = 3600
  ): Promise<string | null> {
    let key: string;

    if (printableType.startsWith('flyer')) {
      key = `${R2_PATHS.EVENT_PRINTABLES_FLYERS(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else if (printableType === 'minicard') {
      key = `${R2_PATHS.EVENT_PRINTABLES_MINICARDS(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else if (printableType === 'cd-jacket') {
      key = `${R2_PATHS.EVENT_PRINTABLES_CD_JACKET(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    } else {
      // button, tshirt-print, hoodie-print go directly in printables
      key = `${R2_PATHS.EVENT_PRINTABLES(eventId)}/${PRINTABLE_FILENAMES[printableType]}`;
    }

    if (await this.fileExistsInAssetsBucket(key)) {
      return this.generateSignedUrlForAssetsBucket(key, expiresIn);
    }

    return null;
  }

  /**
   * Get all printable URLs for an event
   */
  async getAllPrintableUrls(
    eventId: string,
    expiresIn: number = 3600
  ): Promise<Record<PrintableType, string | null>> {
    const printableTypes: PrintableType[] = [
      'flyer1', 'flyer2', 'flyer3',
      'button',
      'tshirt-print', 'hoodie-print',
      'minicard', 'cd-jacket',
    ];

    const urls: Record<string, string | null> = {};

    for (const type of printableTypes) {
      urls[type] = await this.getPrintableUrl(eventId, type, expiresIn);
    }

    return urls as Record<PrintableType, string | null>;
  }

  /**
   * Get the path for a printable item
   * Used to determine where PDFs and skip placeholders are stored
   */
  private getPrintablePath(eventId: string, printableType: PrintableType): string {
    if (printableType.startsWith('flyer')) {
      return `${R2_PATHS.EVENT_PRINTABLES_FLYERS(eventId)}/`;
    } else if (printableType === 'minicard') {
      return `${R2_PATHS.EVENT_PRINTABLES_MINICARDS(eventId)}/`;
    } else if (printableType === 'cd-jacket') {
      return `${R2_PATHS.EVENT_PRINTABLES_CD_JACKET(eventId)}/`;
    }
    // button, tshirt-print, hoodie-print go directly in printables
    return `${R2_PATHS.EVENT_PRINTABLES(eventId)}/`;
  }

  /**
   * Get the full key for a printable PDF
   */
  private getPrintableKey(eventId: string, printableType: PrintableType): string {
    return `${this.getPrintablePath(eventId, printableType)}${PRINTABLE_FILENAMES[printableType]}`;
  }

  /**
   * Upload a placeholder JSON file for a skipped printable item
   * Used when admin skips an item during confirmation
   *
   * @param eventId - The event ID
   * @param printableType - The type of printable that was skipped
   */
  async uploadSkippedPlaceholder(
    eventId: string,
    printableType: PrintableType
  ): Promise<{ success: boolean; key: string; error?: string }> {
    // Get base filename without extension and add -skipped.json
    const baseFilename = PRINTABLE_FILENAMES[printableType].replace('.pdf', '');
    const key = `${this.getPrintablePath(eventId, printableType)}${baseFilename}-skipped.json`;

    const placeholder = {
      status: 'skipped',
      skippedAt: new Date().toISOString(),
      type: printableType,
    };

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: JSON.stringify(placeholder, null, 2),
        ContentType: 'application/json',
        Metadata: {
          eventId,
          printableType,
          status: 'skipped',
        },
      });

      await this.client.send(command);

      console.log(`[R2Service] Uploaded skipped placeholder for ${printableType} (event: ${eventId})`);

      return { success: true, key };
    } catch (error) {
      console.error(`[R2Service] Error uploading skipped placeholder for ${printableType}:`, error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the status of all printables for an event
   * Checks for existing PDFs and skipped placeholders
   *
   * @param eventId - The event ID
   * @returns Record mapping each printable type to its status
   */
  async getPrintablesStatus(
    eventId: string
  ): Promise<Record<PrintableType, 'confirmed' | 'skipped' | 'pending'>> {
    const allTypes: PrintableType[] = [
      'flyer1', 'flyer1-back',
      'flyer2', 'flyer2-back',
      'flyer3', 'flyer3-back',
      'button',
      'tshirt-print', 'hoodie-print',
      'minicard', 'cd-jacket',
    ];

    const status: Record<string, 'confirmed' | 'skipped' | 'pending'> = {};

    for (const printableType of allTypes) {
      // Check if PDF exists (confirmed)
      const pdfKey = this.getPrintableKey(eventId, printableType);
      const pdfExists = await this.fileExistsInAssetsBucket(pdfKey);

      if (pdfExists) {
        status[printableType] = 'confirmed';
        continue;
      }

      // Check if skipped placeholder exists
      const baseFilename = PRINTABLE_FILENAMES[printableType].replace('.pdf', '');
      const skippedKey = `${this.getPrintablePath(eventId, printableType)}${baseFilename}-skipped.json`;
      const skippedExists = await this.fileExistsInAssetsBucket(skippedKey);

      if (skippedExists) {
        status[printableType] = 'skipped';
        continue;
      }

      // Neither exists - pending
      status[printableType] = 'pending';
    }

    return status as Record<PrintableType, 'confirmed' | 'skipped' | 'pending'>;
  }

  /**
   * Delete a skipped placeholder file
   * Used when a previously-skipped item is confirmed
   */
  async deleteSkippedPlaceholder(
    eventId: string,
    printableType: PrintableType
  ): Promise<boolean> {
    const baseFilename = PRINTABLE_FILENAMES[printableType].replace('.pdf', '');
    const key = `${this.getPrintablePath(eventId, printableType)}${baseFilename}-skipped.json`;

    return this.deleteFileFromAssetsBucket(key);
  }

  // ========================================
  // Mockup Methods
  // ========================================

  /**
   * Upload a generated mockup PDF to an event's mockups folder
   *
   * @param eventId - The event ID
   * @param mockupType - The type of mockup (mock-tshirt or mock-hoodie)
   * @param buffer - The generated PDF buffer
   */
  async uploadMockup(
    eventId: string,
    mockupType: MockupType,
    buffer: Buffer
  ): Promise<UploadResult> {
    const key = `${R2_PATHS.EVENT_MOCKUPS(eventId)}/${MOCKUP_FILENAMES[mockupType]}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        Metadata: {
          eventId,
          mockupType,
          generatedAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error(`Error uploading mockup ${mockupType} for event ${eventId}:`, error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Get a signed URL for a mockup
   */
  async getMockupUrl(
    eventId: string,
    mockupType: MockupType,
    expiresIn: number = 3600
  ): Promise<string | null> {
    const key = `${R2_PATHS.EVENT_MOCKUPS(eventId)}/${MOCKUP_FILENAMES[mockupType]}`;

    if (await this.fileExistsInAssetsBucket(key)) {
      return this.generateSignedUrlForAssetsBucket(key, expiresIn);
    }

    return null;
  }

  /**
   * Get all mockup URLs for an event
   */
  async getAllMockupUrls(
    eventId: string,
    expiresIn: number = 3600
  ): Promise<Record<MockupType, string | null>> {
    const mockupTypes: MockupType[] = ['mock-tshirt', 'mock-hoodie'];

    const urls: Record<string, string | null> = {};

    for (const type of mockupTypes) {
      urls[type] = await this.getMockupUrl(eventId, type, expiresIn);
    }

    return urls as Record<MockupType, string | null>;
  }

  // ========================================
  // Class Audio Methods (New Structure)
  // ========================================

  /**
   * Upload raw audio for a class in the new event structure
   * Path: events/{eventId}/classes/{classId}/raw/{timestamp}_{filename}
   */
  async uploadClassRawAudio(
    eventId: string,
    classId: string,
    buffer: Buffer,
    originalFilename: string,
    contentType: string = 'audio/mpeg',
    uploadedBy?: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .substring(0, 50);
    const key = `${R2_PATHS.CLASS_RAW(eventId, classId)}/${timestamp}_${sanitizedFilename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          eventId,
          classId,
          type: 'raw',
          originalFilename,
          uploadDate: new Date().toISOString(),
          ...(uploadedBy && { uploadedBy }),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error('Error uploading class raw audio:', error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Upload final mixed audio for a class in the new event structure
   * Path: events/{eventId}/classes/{classId}/final/final.mp3
   */
  async uploadClassFinalAudio(
    eventId: string,
    classId: string,
    buffer: Buffer,
    contentType: string = 'audio/mpeg',
    uploadedBy?: string
  ): Promise<UploadResult> {
    const key = `${R2_PATHS.CLASS_FINAL(eventId, classId)}/final.mp3`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          eventId,
          classId,
          type: 'final',
          uploadDate: new Date().toISOString(),
          ...(uploadedBy && { uploadedBy }),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error('Error uploading class final audio:', error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Generate presigned URL for uploading raw audio to class folder
   */
  async generateClassRawAudioUploadUrl(
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
    const key = `${R2_PATHS.CLASS_RAW(eventId, classId)}/${timestamp}_${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.assetsBucketName,
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
   * Generate presigned URL for uploading final audio to class folder
   */
  async generateClassFinalAudioUploadUrl(
    eventId: string,
    classId: string,
    contentType: string = 'audio/mpeg'
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = `${R2_PATHS.CLASS_FINAL(eventId, classId)}/final.mp3`;

    const command = new PutObjectCommand({
      Bucket: this.assetsBucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      key,
    };
  }

  // ========================================
  // Helper Methods for Assets Bucket
  // ========================================

  /**
   * Upload a file to the assets bucket
   * Generic method for uploading any file to the assets bucket
   *
   * @param key - The R2 key (path) for the file
   * @param buffer - The file buffer
   * @param contentType - The MIME type of the file
   */
  async uploadToAssetsBucket(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          uploadDate: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      return {
        success: true,
        key,
      };
    } catch (error) {
      console.error('Error uploading to assets bucket:', error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Generate a signed URL for the assets bucket
   */
  async generateSignedUrlForAssetsBucket(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.assetsBucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete a file from the assets bucket
   */
  async deleteFileFromAssetsBucket(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting from assets bucket:', error);
      return false;
    }
  }

  /**
   * Get file buffer from assets bucket
   */
  async getFileBufferFromAssetsBucket(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.assetsBucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error getting file buffer from assets bucket:', error);
      return null;
    }
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
