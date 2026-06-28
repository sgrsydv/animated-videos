import fs, { copyFileSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import { openai, elevenlabs } from './clients.js';
import {
  TEXT_MODEL,
  SFX_VOLUME,
  SFX_MIN_DURATION,
  SFX_MAX_DURATION,
  SFX_PROMPT_INFLUENCE,
} from './config.js';
import { writeManifest, relativeOutput } from './manifest.js';

const BATCH_SIZE = 15;

function clampDuration(sec) {
  return Math.max(SFX_MIN_DURATION, Math.min(SFX_MAX_DURATION, sec));
}

function isStepComplete(manifest, paths) {
  const allHaveSfxField = manifest.segments.every((s) => 'sfx' in s);
  return allHaveSfxField && fs.existsSync(paths.mixedAudio);
}

async function selectSfxBatch(segments) {
  const segmentList = segments
    .map((s, i) => `${i + 1}. "${s.text}"`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You select sound effects for a narrated YouTube video.
For each narration segment, decide if a short diegetic sound effect would clearly add value.
Only pick segments where a literal sound makes sense (e.g. fire crackling, wolf growl, thunder rumble, wings flapping).
Most segments should have NO effect — return null for those.
When you do pick one, write a short literal sound-effect prompt (2-8 words) for an AI sound generator.
Do NOT add music, voice, or narration. Only environmental/object sounds.
Return JSON: { "prompts": [null, "crackling campfire", null, "distant thunder", ...] }
The array must have exactly one entry per segment, in order.`,
      },
      {
        role: 'user',
        content: `Select sound effects for these segments:\n\n${segmentList}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== segments.length) {
    throw new Error(
      `Expected ${segments.length} SFX prompts, got ${parsed.prompts?.length ?? 0}`
    );
  }
  return parsed.prompts;
}

async function selectSoundEffects(manifest) {
  const needsSelection = manifest.segments.some((s) => !('sfx' in s));
  if (!needsSelection) {
    return;
  }

  console.log('[step 5b] Selecting sound effects with LLM...');

  for (let i = 0; i < manifest.segments.length; i += BATCH_SIZE) {
    const batch = manifest.segments.slice(i, i + BATCH_SIZE);
    const prompts = await selectSfxBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      const seg = manifest.segments[i + j];
      const prompt = prompts[j];
      if (prompt) {
        seg.sfx = {
          prompt,
          startSec: seg.startSec,
          durationSec: clampDuration(seg.durationSec),
        };
      } else {
        seg.sfx = null;
      }
    }

    console.log(
      `[step 5b] Selected ${i + 1}-${Math.min(i + BATCH_SIZE, manifest.segments.length)}`
    );
  }
}

async function generateSfxFile(prompt, durationSec, outputPath) {
  const audioStream = await elevenlabs.textToSoundEffects.convert({
    text: prompt,
    durationSeconds: durationSec,
    promptInfluence: SFX_PROMPT_INFLUENCE,
    outputFormat: 'mp3_44100_128',
  });

  await pipeline(Readable.fromWeb(audioStream), fs.createWriteStream(outputPath));
}

async function generateSoundEffectFiles(manifest, paths) {
  const withEffects = manifest.segments.filter((s) => s.sfx?.prompt);
  if (!withEffects.length) {
    console.log('[step 5b] No sound effects selected.');
    return 0;
  }

  fs.mkdirSync(paths.sfx, { recursive: true });
  let generated = 0;

  for (const segment of withEffects) {
    const sfxPath = path.join(
      paths.sfx,
      `sfx_${String(segment.index).padStart(4, '0')}.mp3`
    );

    if (segment.sfx.path && fs.existsSync(path.join(paths.jobDir, segment.sfx.path))) {
      continue;
    }

    console.log(
      `[step 5b] Generating SFX for segment ${segment.index}: "${segment.sfx.prompt}"`
    );

    await generateSfxFile(segment.sfx.prompt, segment.sfx.durationSec, sfxPath);
    segment.sfx.path = relativeOutput(paths, sfxPath);
    generated++;
    writeManifest(paths, manifest);
  }

  return generated;
}

function mixAudio(paths, sfxEntries) {
  return new Promise((resolve, reject) => {
    if (!sfxEntries.length) {
      copyFileSync(paths.audio, paths.mixedAudio);
      resolve();
      return;
    }

    const cmd = ffmpeg().input(paths.audio);

    for (const entry of sfxEntries) {
      cmd.input(path.join(paths.jobDir, entry.path));
    }

    const filters = [];
    const mixInputs = ['[0:a]'];

    for (let i = 0; i < sfxEntries.length; i++) {
      const inputIdx = i + 1;
      const startMs = Math.round(sfxEntries[i].startSec * 1000);
      const label = `s${i}`;
      filters.push(
        `[${inputIdx}:a]volume=${SFX_VOLUME},adelay=${startMs}|${startMs}[${label}]`
      );
      mixInputs.push(`[${label}]`);
    }

    const inputCount = sfxEntries.length + 1;
    filters.push(
      `${mixInputs.join('')}amix=inputs=${inputCount}:normalize=0:duration=first[mix]`
    );
    filters.push('[mix]alimiter=limit=0.95[out]');

    cmd
      .complexFilter(filters.join(';'))
      .outputOptions(['-map', '[out]'])
      .output(paths.mixedAudio)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export async function addSoundEffects(manifest, paths) {
  if (isStepComplete(manifest, paths)) {
    console.log('[step 5b] Sound effects already processed, skipping.');
    return manifest;
  }

  await selectSoundEffects(manifest);
  writeManifest(paths, manifest);

  const generated = await generateSoundEffectFiles(manifest, paths);
  if (generated > 0) {
    console.log(`[step 5b] Generated ${generated} sound effect file(s).`);
  }

  const sfxEntries = manifest.segments
    .filter((s) => s.sfx?.path)
    .map((s) => ({
      path: s.sfx.path,
      startSec: s.sfx.startSec,
    }));

  if (!fs.existsSync(paths.mixedAudio)) {
    console.log(
      `[step 5b] Mixing ${sfxEntries.length} effect(s) under narration...`
    );
    await mixAudio(paths, sfxEntries);
    console.log('[step 5b] Mixed audio saved.');
  }

  writeManifest(paths, manifest);
  return manifest;
}

export function countSoundEffects(manifest) {
  return manifest.segments.filter((s) => s.sfx?.path).length;
}
