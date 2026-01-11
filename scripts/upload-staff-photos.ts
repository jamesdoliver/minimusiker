/**
 * Upload Staff Photos to R2 and Update Airtable
 *
 * Usage: npx ts-node scripts/upload-staff-photos.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Airtable from 'airtable';
import * as dotenv from 'dotenv';

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

// Airtable Configuration
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY!,
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);
const PERSONEN_TABLE_ID = 'tblBNlrp1MRHOFwMz';
const STAFF_NAME_FIELD_ID = 'fldEBMBVfGSWpywKU';
const PROFILE_PHOTO_FIELD_ID = 'fldcSWJFKy1DW8pXA';

// Local photos directory
const PHOTOS_DIR = '/Users/jamesoliver/Documents/Guesstimate/Minimusiker/mm-staff-photos';

interface UploadResult {
  filename: string;
  staffName: string;
  r2Key: string;
  airtableRecordId?: string;
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

async function findAirtableRecord(staffName: string): Promise<string | null> {
  try {
    const records = await base(PERSONEN_TABLE_ID)
      .select({
        filterByFormula: `FIND(LOWER("${staffName}"), LOWER({${STAFF_NAME_FIELD_ID}}))`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      })
      .firstPage();

    if (records && records.length > 0) {
      return records[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error finding record for ${staffName}:`, error);
    return null;
  }
}

async function updateAirtableRecord(recordId: string, r2Key: string): Promise<void> {
  await base(PERSONEN_TABLE_ID).update(recordId, {
    [PROFILE_PHOTO_FIELD_ID]: r2Key,
  });
}

async function processPhoto(filename: string): Promise<UploadResult> {
  // Extract staff name from filename (before underscore)
  const staffName = filename.split('_')[0];
  const ext = path.extname(filename);
  const r2Key = `${R2_PREFIX}/${staffName.toLowerCase()}${ext}`;
  const filePath = path.join(PHOTOS_DIR, filename);

  const result: UploadResult = {
    filename,
    staffName,
    r2Key,
    success: false,
  };

  try {
    // 1. Upload to R2
    console.log(`  Uploading ${filename} to R2...`);
    await uploadToR2(filePath, r2Key);

    // 2. Find Airtable record
    console.log(`  Finding Airtable record for "${staffName}"...`);
    const recordId = await findAirtableRecord(staffName);

    if (!recordId) {
      result.error = `No Airtable record found for "${staffName}"`;
      console.log(`  ⚠️  ${result.error}`);
      result.success = true; // R2 upload succeeded
      return result;
    }

    result.airtableRecordId = recordId;

    // 3. Update Airtable
    console.log(`  Updating Airtable record ${recordId}...`);
    await updateAirtableRecord(recordId, r2Key);

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
  console.log('🚀 Starting staff photo upload...\n');
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

  const successful = results.filter((r) => r.success && r.airtableRecordId);
  const uploadedOnly = results.filter((r) => r.success && !r.airtableRecordId);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Fully processed: ${successful.length}`);
  if (uploadedOnly.length > 0) {
    console.log(`⚠️  Uploaded but no Airtable match: ${uploadedOnly.length}`);
    uploadedOnly.forEach((r) => console.log(`   - ${r.staffName}`));
  }
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach((r) => console.log(`   - ${r.filename}: ${r.error}`));
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
