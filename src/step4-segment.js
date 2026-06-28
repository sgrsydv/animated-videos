import { MIN_WORDS, MAX_WORDS } from './config.js';
import { writeManifest } from './manifest.js';

function segmentWords(words) {
  const segments = [];
  let i = 0;

  while (i < words.length) {
    const maxEnd = Math.min(i + MAX_WORDS - 1, words.length - 1);
    const minEnd = Math.min(i + MIN_WORDS - 1, words.length - 1);

    let breakAt = maxEnd;
    for (let j = minEnd; j <= maxEnd; j++) {
      const endsSentence = /[.!?]["']?$/.test(words[j].text);
      const pauseAfter =
        j < words.length - 1 && words[j + 1].start - words[j].end > 0.35;

      if (endsSentence || pauseAfter) {
        breakAt = j;
        break;
      }
    }

    const chunk = words.slice(i, breakAt + 1);
    segments.push({
      index: segments.length,
      text: chunk.map((w) => w.text).join(' '),
      startSec: chunk[0].start,
      endSec: chunk[chunk.length - 1].end,
      durationSec: chunk[chunk.length - 1].end - chunk[0].start,
    });

    i = breakAt + 1;
  }

  return segments;
}

export async function buildSegments(manifest, paths) {
  if (manifest.segments?.length > 0 && manifest.segments[0].durationSec != null) {
    console.log(`[step 4] ${manifest.segments.length} segments already exist, skipping.`);
    return manifest;
  }

  const words = manifest.words ?? [];
  if (!words.length) {
    throw new Error('No word timestamps found. Run step 3 first.');
  }

  console.log('[step 4] Segmenting narration...');
  manifest.segments = segmentWords(words);
  writeManifest(paths, manifest);

  console.log(`[step 4] Created ${manifest.segments.length} segments.`);
  return manifest;
}
