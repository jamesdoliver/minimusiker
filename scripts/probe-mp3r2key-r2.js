/**
 * For each of the 58 mp3R2Key offenders, HEAD the r2_key to see if it exists in R2.
 * Helps distinguish "needs backfill" from "orphaned Airtable record".
 */
const Airtable = require('airtable');
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';
const F = {
  type: 'fldOMmFN7BqHVAqfH',
  status: 'fldCAcEMu0IF1bWgz',
  r2_key: 'fldvzj75CspwfOfPX',
  mp3_r2_key: 'fldzADPZjKEZbfy2i',
  filename: 'fldOTWiFz8G1lE04c',
};
function f(rec, name, fid) { return rec.fields[name] ?? rec.fields[fid] ?? ''; }

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || 'minimusiker-assets';

async function head(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    throw e;
  }
}

async function listPrefix(prefix, max = 50) {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: max }));
  return (r.Contents || []).map(c => ({ key: c.Key, size: c.Size }));
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Endpoint: ${process.env.R2_ENDPOINT}`);
  console.log('');

  const recs = await base(AUDIO_FILES_TABLE).select({
    filterByFormula: `AND({type} = 'final', {status} = 'ready')`,
  }).all();

  const offenders = recs.filter(r => {
    const r2 = f(r, 'r2_key', F.r2_key);
    const mp3 = f(r, 'mp3_r2_key', F.mp3_r2_key);
    return !mp3 && r2.toLowerCase().endsWith('.wav');
  });

  console.log(`Total offenders: ${offenders.length}\n`);

  const exists = [];
  const missing = [];

  for (let i = 0; i < offenders.length; i++) {
    const r = offenders[i];
    const key = f(r, 'r2_key', F.r2_key);
    const ok = await head(key);
    if (ok) exists.push({ id: r.id, key });
    else missing.push({ id: r.id, key, filename: f(r, 'filename', F.filename) });
    if ((i + 1) % 10 === 0) console.log(`  ...checked ${i + 1}/${offenders.length}`);
  }

  console.log(`\n── RESULTS ──────────────────────────────────────────────────`);
  console.log(`R2 file exists (backfillable): ${exists.length}`);
  console.log(`R2 file missing (orphaned):    ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('Orphaned records (Airtable says ready but R2 has no file):');
    for (const m of missing.slice(0, 20)) {
      console.log(`  - ${m.id}  ${m.filename}`);
      console.log(`    ${m.key}`);
    }
    if (missing.length > 20) console.log(`  ...and ${missing.length - 20} more`);
  }

  if (exists.length > 0 && exists.length < 5) {
    console.log('\nBackfillable records:');
    for (const e of exists) console.log(`  - ${e.id}  ${e.key}`);
  }

  // Also probe a couple of different path shapes for one missing schulsong
  if (missing.length > 0) {
    const sample = missing.find(m => m.key.includes('/final.wav') && !m.key.match(/[a-z0-9]+\/final\.wav$/i));
    const probe = missing[0];
    console.log(`\n── PROBE: list R2 contents around one missing key ──────────`);
    const parts = probe.key.split('/');
    const prefix = parts.slice(0, -1).join('/') + '/';
    console.log(`Prefix: ${prefix}`);
    const list = await listPrefix(prefix);
    if (list.length === 0) {
      console.log('  (no objects under this prefix)');
      // walk up one level
      const parent = parts.slice(0, -2).join('/') + '/';
      console.log(`\nParent prefix: ${parent}`);
      const list2 = await listPrefix(parent, 30);
      if (list2.length === 0) console.log('  (no objects under parent either)');
      else for (const o of list2) console.log(`  ${o.key} (${o.size} bytes)`);
    } else {
      for (const o of list) console.log(`  ${o.key} (${o.size} bytes)`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
