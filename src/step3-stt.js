import fs from 'fs';
import { createReadStream } from 'fs';
import { elevenlabs } from './clients.js';
import { STT_MODEL } from './config.js';
import { writeManifest } from './manifest.js';

export async function transcribeAudio(manifest, paths) {
  if (fs.existsSync(paths.words)) {
    console.log('[step 3] Word timestamps already exist, skipping.');
    manifest.words = JSON.parse(fs.readFileSync(paths.words, 'utf8'));
    return manifest;
  }

  console.log('[step 3] Transcribing audio for word timestamps...');

  const result = await elevenlabs.speechToText.convert({
    file: createReadStream(paths.audio),
    modelId: STT_MODEL,
    timestampsGranularity: 'word',
  });

  const words = (result.words ?? []).filter(
    (w) => w.type === 'word' && w.text?.trim() && w.start != null && w.end != null
  );

  fs.writeFileSync(paths.words, JSON.stringify(words, null, 2));
  manifest.words = words;
  writeManifest(paths, manifest);

  console.log(`[step 3] Saved ${words.length} word timestamps.`);
  return manifest;
}
