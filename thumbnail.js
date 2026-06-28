import fs from 'fs';
import { resumeJob } from './src/job.js';
import { readManifest } from './src/manifest.js';
import { generateMetadata } from './src/step-metadata.js';
import { generateThumbnail } from './src/step-thumbnail.js';

function printUsage() {
  console.log('Usage: node thumbnail.js <jobId>');
  console.log('Example: node thumbnail.js 20260628-153951-why-nature-never-built-a-dragon-2271');
}

function parseJobId() {
  const jobId = process.argv[2];
  if (!jobId) {
    printUsage();
    process.exit(1);
  }
  return jobId;
}

async function run() {
  const jobId = parseJobId();
  const job = resumeJob(jobId);
  const { paths } = job;

  if (!fs.existsSync(paths.script)) {
    throw new Error(`script.txt not found for job ${jobId}`);
  }

  if (!fs.existsSync(paths.final)) {
    console.warn(`[warn] final.mp4 not found yet — metadata/thumbnail will still be generated.`);
  }

  console.log(`\nGenerating thumbnail + metadata for job: ${jobId}\n`);

  const metadata = await generateMetadata(paths);
  await generateThumbnail(paths);

  const manifest = readManifest(paths);

  console.log('\nDone!');
  console.log(`  Title: ${metadata.title}`);
  console.log(`  Metadata: ${paths.metadata}`);
  console.log(`  Thumbnail: ${paths.thumbnail}`);
  if (manifest?.youtube?.thumbnailPath) {
    console.log(`  Manifest: manifest.youtube updated`);
  }
  console.log('');
}

run().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
