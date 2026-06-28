import fs from 'fs';
import { resumeJob } from './src/job.js';
import { readManifest, writeManifest } from './src/manifest.js';
import { getAuthClient, uploadVideo, setThumbnail } from './src/youtube.js';

function printUsage() {
  console.log('Usage: node upload.js <jobId>');
  console.log('Example: node upload.js 20260628-153951-why-nature-never-built-a-dragon-2271');
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

  if (!fs.existsSync(paths.final)) {
    throw new Error(`final.mp4 not found. Run the video pipeline first for job ${jobId}.`);
  }

  if (!fs.existsSync(paths.metadata)) {
    throw new Error(
      `metadata.json not found. Run: node thumbnail.js ${jobId}`
    );
  }

  if (!fs.existsSync(paths.thumbnail)) {
    throw new Error(
      `thumbnail.png not found. Run: node thumbnail.js ${jobId}`
    );
  }

  const manifest = readManifest(paths);
  if (!manifest) {
    throw new Error('manifest.json not found for this job.');
  }

  if (manifest.youtube?.videoId) {
    const url = manifest.youtube.url ?? `https://youtu.be/${manifest.youtube.videoId}`;
    console.log(`\nVideo already uploaded: ${url}\n`);
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));

  console.log(`\nUploading job: ${jobId}`);
  console.log(`  Title: ${metadata.title}`);
  console.log(`  Video: ${paths.final}`);
  console.log(`  Thumbnail: ${paths.thumbnail}\n`);

  const auth = await getAuthClient();

  const videoId = await uploadVideo(auth, {
    videoPath: paths.final,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    categoryId: metadata.categoryId,
    privacyStatus: metadata.privacyStatus,
  });

  await setThumbnail(auth, videoId, paths.thumbnail);

  const url = `https://youtu.be/${videoId}`;

  manifest.youtube = {
    ...manifest.youtube,
    ...metadata,
    videoId,
    url,
    uploadedAt: new Date().toISOString(),
  };
  writeManifest(paths, manifest);

  console.log('\nUpload complete!');
  console.log(`  URL: ${url}`);
  console.log(`  Saved to manifest.youtube\n`);
}

run().catch((err) => {
  console.error('\nUpload failed:', err.message);
  process.exit(1);
});
