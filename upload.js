import fs from 'fs';
import { resumeJob } from './src/job.js';
import { readManifest, writeManifest } from './src/manifest.js';
import { YT_TOKEN, YT_CHANNEL_ID, YT_DEFAULT_LANGUAGE } from './src/config.js';
import { getAuthClient, getAuthenticatedChannel, uploadVideo, setThumbnail } from './src/youtube.js';

function printUsage() {
  console.log('Usage: node upload.js <jobId> [--force] [--reauth]');
  console.log('  --force    Re-upload even if this job was already uploaded');
  console.log('  --reauth   Forget the cached YouTube login so you can pick a different channel');
  console.log('Example: node upload.js 20260628-153951-why-nature-never-built-a-dragon-2271 --force --reauth');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const jobId = args.find((a) => !a.startsWith('--'));
  if (!jobId) {
    printUsage();
    process.exit(1);
  }
  return { jobId, force: flags.has('--force'), reauth: flags.has('--reauth') };
}

async function run() {
  const { jobId, force, reauth } = parseArgs();
  const job = resumeJob(jobId);
  const { paths } = job;

  if (reauth && fs.existsSync(YT_TOKEN)) {
    fs.rmSync(YT_TOKEN);
    console.log('[youtube] Cleared cached login. You will re-authorize and can pick a channel.');
  }

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

  if (manifest.youtube?.videoId && !force) {
    const url = manifest.youtube.url ?? `https://youtu.be/${manifest.youtube.videoId}`;
    console.log(`\nVideo already uploaded: ${url}`);
    console.log('Use --force to upload again (e.g. after deleting it on YouTube).\n');
    return;
  }

  if (manifest.youtube?.videoId && force) {
    console.log(`[upload] --force set; re-uploading (previous video: ${manifest.youtube.videoId}).`);
  }

  const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));

  console.log(`\nUploading job: ${jobId}`);
  console.log(`  Title: ${metadata.title}`);
  console.log(`  Video: ${paths.final}`);
  console.log(`  Thumbnail: ${paths.thumbnail}\n`);

  const auth = await getAuthClient();

  const channel = await getAuthenticatedChannel(auth);
  console.log(`\n[youtube] Authenticated channel: "${channel.title}" (${channel.id})`);

  if (YT_CHANNEL_ID) {
    if (channel.id !== YT_CHANNEL_ID) {
      throw new Error(
        `Channel mismatch. Authenticated as "${channel.title}" (${channel.id}), ` +
          `but YT_CHANNEL_ID expects ${YT_CHANNEL_ID}.\n` +
          'Nothing was uploaded. Re-run with --reauth to pick the correct channel:\n' +
          `  node upload.js ${jobId} --reauth${force ? ' --force' : ''}`
      );
    }
    console.log(`  Verified against YT_CHANNEL_ID. Proceeding.\n`);
  } else {
    console.log('  If this is the wrong channel, delete youtube-token.json and re-run to re-authorize.\n');
  }

  const now = new Date();
  const recordingDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
  ).toISOString();

  const videoId = await uploadVideo(auth, {
    videoPath: paths.final,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    categoryId: metadata.categoryId,
    privacyStatus: metadata.privacyStatus,
    defaultLanguage: YT_DEFAULT_LANGUAGE,
    defaultAudioLanguage: YT_DEFAULT_LANGUAGE,
    recordingDate,
  });

  await setThumbnail(auth, videoId, paths.thumbnail);

  const url = `https://youtu.be/${videoId}`;

  manifest.youtube = {
    ...manifest.youtube,
    ...metadata,
    videoId,
    url,
    channelId: channel.id,
    channelTitle: channel.title,
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
