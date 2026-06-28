import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

function buildConcatFile(paths, segments) {
  const lines = [];
  const last = segments.length - 1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const framePath = path
      .resolve(paths.jobDir, seg.framePath)
      .replace(/\\/g, '/');

    // Each frame stays on screen until the next segment begins, so inter-segment
    // pauses (silence) are absorbed and the video stays in sync with the audio.
    // The first frame also covers any leading silence by starting from 0.
    const start = i === 0 ? 0 : seg.startSec;
    const end = i < last ? segments[i + 1].startSec : seg.endSec;
    const duration = end - start;

    lines.push(`file '${framePath}'`);
    lines.push(`duration ${duration.toFixed(3)}`);
  }

  // The concat demuxer needs the final file repeated; -shortest trims any
  // trailing video so the output length matches the audio exactly.
  const lastPath = path
    .resolve(paths.jobDir, segments[last].framePath)
    .replace(/\\/g, '/');
  lines.push(`file '${lastPath}'`);

  fs.writeFileSync(paths.concat, lines.join('\n'));
}

function renderVideo(paths) {
  const audioInput =
    fs.existsSync(paths.mixedAudio) && fs.statSync(paths.mixedAudio).size > 0
      ? paths.mixedAudio
      : paths.audio;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(paths.concat)
      .inputOptions(['-f concat', '-safe 0'])
      .input(audioInput)
      .videoFilters('scale=trunc(iw/2)*2:trunc(ih/2)*2')
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r 30',
        '-fps_mode cfr',
        '-c:a aac',
        '-shortest',
        '-movflags +faststart',
      ])
      .output(paths.final)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export async function renderFinalVideo(manifest, paths) {
  if (fs.existsSync(paths.final) && fs.statSync(paths.final).size > 0) {
    console.log('[step 8] Final video already exists, skipping.');
    return manifest;
  }

  const missingFrames = manifest.segments.filter((s) => !s.framePath);
  if (missingFrames.length) {
    throw new Error('Some segments are missing frame paths. Run step 7 first.');
  }

  console.log('[step 8] Building video with ffmpeg...');
  buildConcatFile(paths, manifest.segments);
  await renderVideo(paths);

  console.log(`[step 8] Final video saved to ${paths.final}`);
  return manifest;
}
