/**
 * Script to create placeholder PNG preview images
 *
 * Creates simple colored rectangles for each printable type
 * to be used as development placeholders until real previews are generated.
 *
 * Run with: node scripts/create-placeholder-previews.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Preview dimensions (2x PDF dimensions)
const PREVIEW_CONFIGS = {
  'flyer1': { width: 1190, height: 596, color: '#F5F5F5' },
  'flyer1-back': { width: 1190, height: 596, color: '#EFEFEF' },
  'flyer2': { width: 1190, height: 596, color: '#E8F5E9' },
  'flyer2-back': { width: 1190, height: 596, color: '#E0F2F1' },
  'flyer3': { width: 840, height: 1190, color: '#FFF3E0' },
  'flyer3-back': { width: 840, height: 1190, color: '#FBE9E7' },
  'button': { width: 284, height: 284, color: '#FCE4EC' },
  'minicard': { width: 1190, height: 596, color: '#E3F2FD' },
  'cd-jacket': { width: 680, height: 680, color: '#F3E5F5' },
};

/**
 * Create a minimal valid PNG file
 * This creates a very simple PNG with a solid color
 */
function createPNG(width, height, hexColor) {
  // Parse hex color
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (image header)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk (image data)
  // Create raw image data (filter byte + RGB for each pixel in each row)
  const rawRowSize = 1 + width * 3; // filter byte + RGB
  const rawData = Buffer.alloc(rawRowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawRowSize;
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  // Compress with zlib
  const compressedData = deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk (image end)
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeBuffer = Buffer.from(type);

  // Calculate CRC of type + data
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

async function main() {
  const outputDir = join(projectRoot, 'public/images/printable_previews');

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log('Created output directory:', outputDir);
  }

  for (const [type, config] of Object.entries(PREVIEW_CONFIGS)) {
    const { width, height, color } = config;

    console.log(`Creating ${type}-preview.png (${width}x${height}, ${color})...`);

    try {
      // Parse hex color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // PNG signature
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

      // IHDR chunk (image header)
      const ihdrData = Buffer.alloc(13);
      ihdrData.writeUInt32BE(width, 0);
      ihdrData.writeUInt32BE(height, 4);
      ihdrData[8] = 8; // bit depth
      ihdrData[9] = 2; // color type (RGB)
      ihdrData[10] = 0; // compression method
      ihdrData[11] = 0; // filter method
      ihdrData[12] = 0; // interlace method

      const ihdrChunk = createChunk('IHDR', ihdrData);

      // IDAT chunk (image data)
      const rawRowSize = 1 + width * 3;
      const rawData = Buffer.alloc(rawRowSize * height);

      for (let y = 0; y < height; y++) {
        const rowOffset = y * rawRowSize;
        rawData[rowOffset] = 0;
        for (let x = 0; x < width; x++) {
          const pixelOffset = rowOffset + 1 + x * 3;
          rawData[pixelOffset] = r;
          rawData[pixelOffset + 1] = g;
          rawData[pixelOffset + 2] = b;
        }
      }

      const compressedData = deflateSync(rawData, { level: 9 });
      const idatChunk = createChunk('IDAT', compressedData);

      // IEND chunk
      const iendChunk = createChunk('IEND', Buffer.alloc(0));

      const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);

      const outputPath = join(outputDir, `${type}-preview.png`);
      writeFileSync(outputPath, png);
      console.log(`  Created: ${outputPath}`);
    } catch (error) {
      console.error(`  Error creating ${type}:`, error);
    }
  }

  console.log('\nDone! Placeholder previews created.');
}

main().catch(console.error);
