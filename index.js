import { targetWordsFromMinutes } from './src/config.js';
import { createJob, resumeJob, listJobs } from './src/job.js';
import { ensureJobDirs, initManifest, readManifest, writeManifest } from './src/manifest.js';
import { generateScript } from './src/step1-script.js';
import { synthesizeAudio } from './src/step2-tts.js';
import { transcribeAudio } from './src/step3-stt.js';
import { buildSegments } from './src/step4-segment.js';
import { generateCellPrompts } from './src/step5-cell-prompts.js';
import { addSoundEffects, countSoundEffects } from './src/step5b-soundfx.js';
import { generateSpritesheets } from './src/step6-spritesheets.js';
import { splitAllSheets } from './src/step7-split.js';
import { renderFinalVideo } from './src/step8-render.js';

function printUsage() {
  console.log('Usage:');
  console.log('  node index.js "<topic>" <minutes>     Start a new job');
  console.log('  node index.js --resume <jobId>        Resume an existing job');
  console.log('  node index.js --list                  List all jobs');
  console.log('');
  console.log('Example: node index.js "Why nature never built a dragon" 8');
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    return { mode: 'list' };
  }

  if (args[0] === '--resume') {
    if (!args[1]) {
      console.error('Error: --resume requires a jobId.');
      printUsage();
      process.exit(1);
    }
    return { mode: 'resume', jobId: args[1] };
  }

  const topic = args[0];
  const minutesRaw = args[1];

  if (!topic || !minutesRaw) {
    printUsage();
    process.exit(1);
  }

  const minutes = Number(minutesRaw);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.error('Error: minutes must be a positive number.');
    printUsage();
    process.exit(1);
  }

  return { mode: 'new', topic, minutes, targetWords: targetWordsFromMinutes(minutes) };
}

async function runSteps(job, manifest) {
  const { paths } = job;

  manifest.status = 'running';
  writeManifest(paths, manifest);

  manifest = await generateScript(manifest, paths);
  manifest = await synthesizeAudio(manifest, paths);
  manifest = await transcribeAudio(manifest, paths);
  manifest = await buildSegments(manifest, paths);
  manifest = await generateCellPrompts(manifest, paths);
  manifest = await addSoundEffects(manifest, paths);
  manifest = await generateSpritesheets(manifest, paths);
  manifest = await splitAllSheets(manifest, paths);
  manifest = await renderFinalVideo(manifest, paths);

  manifest.status = 'complete';
  writeManifest(paths, manifest);

  const totalDuration = manifest.segments.reduce(
    (sum, s) => sum + s.durationSec,
    0
  );

  console.log('\nPipeline complete!');
  console.log(`  Job ID: ${job.id}`);
  console.log(`  Directory: ${job.dir}`);
  console.log(`  Segments: ${manifest.segments.length}`);
  console.log(`  Sound effects: ${countSoundEffects(manifest)}`);
  console.log(`  Spritesheets: ${Math.ceil(manifest.segments.length / 9)}`);
  console.log(`  Narration: ~${Math.round(totalDuration)}s`);
  console.log(`  Output: ${paths.final}\n`);
}

async function runPipeline() {
  const parsed = parseArgs();

  if (parsed.mode === 'list') {
    const jobs = listJobs();
    if (!jobs.length) {
      console.log('No jobs found.');
      return;
    }
    console.log('Jobs:');
    for (const id of jobs) {
      console.log(`  ${id}`);
    }
    return;
  }

  let job;
  let manifest;

  if (parsed.mode === 'resume') {
    job = resumeJob(parsed.jobId);
    manifest = readManifest(job.paths);
    if (!manifest) {
      throw new Error(`Job "${parsed.jobId}" has no manifest to resume.`);
    }
    console.log(`\nResuming job: ${job.id}`);
    console.log(`Topic: ${manifest.topic}`);
    console.log(`Target length: ${manifest.minutes} min (~${manifest.targetWords} words)\n`);
  } else {
    job = createJob(parsed.topic);
    ensureJobDirs(job.paths);
    manifest = initManifest(job.paths, {
      jobId: job.id,
      topic: parsed.topic,
      minutes: parsed.minutes,
      targetWords: parsed.targetWords,
    });
    console.log(`\nNew job: ${job.id}`);
    console.log(`Directory: ${job.dir}`);
    console.log(`Topic: ${parsed.topic}`);
    console.log(`Target length: ${parsed.minutes} min (~${parsed.targetWords} words)\n`);
  }

  await runSteps(job, manifest);
}

runPipeline().catch((err) => {
  console.error('\nPipeline failed:', err.message);
  process.exit(1);
});
