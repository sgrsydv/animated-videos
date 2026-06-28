import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { elevenlabs } from './clients.js';
import { VOICE_ID, TTS_MODEL } from './config.js';
import { writeManifest } from './manifest.js';

export async function synthesizeAudio(manifest, paths) {
  if (fs.existsSync(paths.audio)) {
    console.log('[step 2] Audio already exists, skipping.');
    return manifest;
  }

  const text = manifest.script ?? fs.readFileSync(paths.script, 'utf8');
  console.log('[step 2] Synthesizing audio with ElevenLabs...');

  const audioStream = await elevenlabs.textToSpeech.convert(VOICE_ID, {
    text,
    modelId: TTS_MODEL,
    outputFormat: 'mp3_44100_128',
  });

  await pipeline(Readable.fromWeb(audioStream), fs.createWriteStream(paths.audio));

  writeManifest(paths, manifest);
  console.log('[step 2] Audio saved to output/audio.mp3');
  return manifest;
}
