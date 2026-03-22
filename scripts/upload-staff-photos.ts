/**
 * Upload Staff Photos to R2
 *
 * Uploads photos from public/images/staff_photo/ to R2 under mm-staff-pictures/.
 * After uploading, manually update the profile_photo field in Airtable's Personen table.
 *
 * Usage:
 *   npx ts-node scripts/upload-staff-photos.ts --dry-run   # Check only, no changes
 *   npx ts-node scripts/upload-staff-photos.ts              # Actually upload
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

// R2 Configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET_NAME || 'minimusiker-assets';
const R2_PREFIX = 'mm-staff-pictures';

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');

// Local photos directory
const PHOTOS_DIR = path.join(__dirname, '..', 'public', 'images', 'staff_photo');

interface UploadResult {
  filename: string;
  staffName: string;
  r2Key: string;
  success: boolean;
  error?: string;
}

async function uploadToR2(filePath: string, key: string): Promise<void> {
  const fileContent = fs.readFileSync(filePath);
  const contentType = filePath.endsWith('.jpeg') || filePath.endsWith('.jpg')
    ? 'image/jpeg'
    : 'image/png';

  const command = new PutObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

async function processPhoto(filename: string): Promise<UploadResult> {
  // Extract staff name from filename (without extension)
  const parsed = path.parse(filename);
  const staffName = parsed.name;
  const ext = parsed.ext;
  const r2Key = `${R2_PREFIX}/${staffName.toLowerCase()}${ext}`;
  const filePath = path.join(PHOTOS_DIR, filename);

  const result: UploadResult = {
    filename,
    staffName,
    r2Key,
    success: false,
  };

  try {
    // 1. Verify file is readable
    const stats = fs.statSync(filePath);
    console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);

    console.log(`  R2 key: ${r2Key}`);

    if (DRY_RUN) {
      result.success = true;
      console.log(`  🔍 DRY RUN — would upload to R2`);
      return result;
    }

    // 2. Upload to R2
    console.log(`  Uploading ${filename} to R2...`);
    await uploadToR2(filePath, r2Key);

    result.success = true;
    console.log(`  ✅ Done`);
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ Error: ${result.error}`);
    return result;
  }
}

async function main() {
  console.log(`🚀 Starting staff photo ${DRY_RUN ? 'DRY RUN' : 'upload'}...\n`);
  console.log(`Source: ${PHOTOS_DIR}`);
  console.log(`Destination: R2 bucket "${ASSETS_BUCKET}" / ${R2_PREFIX}/\n`);

  // Get list of image files
  const files = fs.readdirSync(PHOTOS_DIR).filter((f) =>
    ['.jpg', '.jpeg', '.png'].includes(path.extname(f).toLowerCase())
  );

  console.log(`Found ${files.length} photos:\n`);

  const results: UploadResult[] = [];

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = await processPhoto(file);
    results.push(result);
    console.log('');
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('─'.repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Uploaded: ${successful.length}`);
  successful.forEach((r) => console.log(`   ${r.r2Key}`));
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach((r) => console.log(`   - ${r.filename}: ${r.error}`));
  }

  if (successful.length > 0) {
    console.log('\n📋 Update these Airtable profile_photo values:');
    successful.forEach((r) => console.log(`   ${r.staffName} → ${r.r2Key}`));
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
