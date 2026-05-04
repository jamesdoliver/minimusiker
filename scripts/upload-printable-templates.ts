/**
 * Upload the compressed partial-blank PDF templates to R2.
 *
 * Source: public/printables/Flyers (MiniMusiker)/_compressed/<item>-partial.pdf
 * Destination: R2 key `templates/<item>-partial-template.pdf` in the assets bucket.
 *
 * One-time setup; subsequent phases (Flyer 2, Flyer 3, etc.) extend the UPLOADS array.
 *
 * Required env vars (same as src/lib/services/r2Service.ts):
 *   - R2_ENDPOINT
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_ASSETS_BUCKET_NAME
 *
 * Usage:
 *   npx ts-node scripts/upload-printable-templates.ts
 *
 * Pre-requisite: scripts/compress-printable-templates.sh has been run so the
 * compressed sources exist locally.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const COMPRESSED_DIR = path.join(
  REPO_ROOT,
  'public/printables/Flyers (MiniMusiker)/_compressed',
);

interface Upload {
  source: string;
  r2Key: string;
}

const UPLOADS: Upload[] = [
  {
    source: 'flyer1-partial.pdf',
    r2Key: 'templates/flyer1-partial-template.pdf',
  },
  {
    source: 'flyer2-partial.pdf',
    r2Key: 'templates/flyer2-partial-template.pdf',
  },
  {
    source: 'flyer3-partial.pdf',
    r2Key: 'templates/flyer3-partial-template.pdf',
  },
  {
    source: 'minicards-partial.pdf',
    r2Key: 'templates/minicards-partial-template.pdf',
  },
  {
    source: 'cd-booklet-partial.pdf',
    r2Key: 'templates/cd-booklet-partial-template.pdf',
  },
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

async function main(): Promise<void> {
  const endpoint = requireEnv('R2_ENDPOINT');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const bucket = requireEnv('R2_ASSETS_BUCKET_NAME');

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  for (const { source, r2Key } of UPLOADS) {
    const localPath = path.join(COMPRESSED_DIR, source);
    if (!fs.existsSync(localPath)) {
      throw new Error(
        `Source not found: ${localPath}\n` +
          'Run scripts/compress-printable-templates.sh first.',
      );
    }
    const body = fs.readFileSync(localPath);
    console.log(`Uploading ${source} (${body.length} bytes) → s3://${bucket}/${r2Key}`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
    console.log('  ok');
  }

  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
