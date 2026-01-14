const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = path.join(__dirname, '../public/images/familie/mascot_logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public');

async function generateFavicons() {
  console.log('Generating favicons from mascot logo...');

  // Read the source image
  const image = sharp(SOURCE_IMAGE);

  // Generate different favicon sizes
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-96x96.png', size: 96 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const outputPath = path.join(OUTPUT_DIR, name);
    await image
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }

  // Generate ICO file (just copy the 32x32 as ico - browsers will handle it)
  // Note: For a proper multi-resolution ICO, you'd need a dedicated ICO library
  // But for most modern browsers, a 32x32 PNG works fine as favicon.ico
  await image
    .clone()
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'favicon.ico'));
  console.log('Generated: favicon.ico (32x32)');

  console.log('\nDone! Favicon files generated successfully.');
}

generateFavicons().catch(console.error);
