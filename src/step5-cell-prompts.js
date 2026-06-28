import { openai } from './clients.js';
import { TEXT_MODEL } from './config.js';
import { writeManifest } from './manifest.js';

const BATCH_SIZE = 15;

async function generatePromptBatch(segments) {
  const segmentList = segments
    .map((s, i) => `${i + 1}. "${s.text}"`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You write isolated storyboard cell prompts for a hand-drawn MS Paint style YouTube video.
For each narration segment, write ONE detailed prompt describing a single storyboard frame.
Each prompt must describe only what appears in that one cell — camera angle, composition, objects, symbols, stick figures, handwritten labels (max 1-4 words).
Vary perspectives: close-ups, wide shots, diagrams, object-only frames, silhouettes, POV shots.
Do NOT repeat the same composition across cells.
Return JSON: { "prompts": ["prompt for segment 1", "prompt for segment 2", ...] }`,
      },
      {
        role: 'user',
        content: `Write one isolated cell prompt for each segment:\n\n${segmentList}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== segments.length) {
    throw new Error(
      `Expected ${segments.length} prompts, got ${parsed.prompts?.length ?? 0}`
    );
  }
  return parsed.prompts;
}

export async function generateCellPrompts(manifest, paths) {
  if (manifest.segments?.length > 0 && manifest.segments[0].prompt) {
    console.log('[step 5] Cell prompts already exist, skipping.');
    return manifest;
  }

  console.log(`[step 5] Generating cell prompts for ${manifest.segments.length} segments...`);

  for (let i = 0; i < manifest.segments.length; i += BATCH_SIZE) {
    const batch = manifest.segments.slice(i, i + BATCH_SIZE);
    const prompts = await generatePromptBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      manifest.segments[i + j].prompt = prompts[j];
    }

    console.log(
      `[step 5] Prompts ${i + 1}-${Math.min(i + BATCH_SIZE, manifest.segments.length)} done.`
    );
  }

  writeManifest(paths, manifest);
  console.log('[step 5] All cell prompts saved to manifest.');
  return manifest;
}
