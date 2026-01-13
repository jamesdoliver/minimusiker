const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function checkBucket(bucket) {
  console.log('\n=== Checking bucket:', bucket, '===');

  try {
    // Check templates folder
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'templates/',
      MaxKeys: 100,
    });

    const response = await client.send(command);

    console.log('Templates in templates/ folder:');
    if (response.Contents && response.Contents.length > 0) {
      response.Contents.forEach(obj => {
        console.log('  - ' + obj.Key + ' (' + obj.Size + ' bytes)');
      });
    } else {
      console.log('  No templates found');
    }

    // Check all PDF files
    const allCommand = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 500,
    });
    const allResponse = await client.send(allCommand);

    console.log('\nAll PDF files:');
    if (allResponse.Contents) {
      const pdfs = allResponse.Contents.filter(obj => obj.Key.endsWith('.pdf'));
      if (pdfs.length > 0) {
        pdfs.slice(0, 20).forEach(obj => {
          console.log('  - ' + obj.Key);
        });
        if (pdfs.length > 20) {
          console.log('  ... and ' + (pdfs.length - 20) + ' more');
        }
      } else {
        console.log('  No PDF files found');
      }
    }
  } catch (error) {
    console.log('  Error:', error.message);
  }
}

async function main() {
  console.log('Endpoint:', process.env.R2_ENDPOINT);

  const buckets = [
    process.env.R2_BUCKET_NAME,
    'minimusiker-assets',
  ].filter(Boolean);

  for (const bucket of buckets) {
    await checkBucket(bucket);
  }

  console.log('\n=== Expected template filenames ===');
  console.log('  templates/tshirt-print-template.pdf');
  console.log('  templates/hoodie-print-template.pdf');
  console.log('  templates/flyer1-template.pdf');
  console.log('  templates/flyer2-template.pdf');
  console.log('  templates/flyer3-template.pdf');
  console.log('  templates/button-template.pdf');
  console.log('  templates/minicard-template.pdf');
  console.log('  templates/cd-jacket-template.pdf');
}

main();
