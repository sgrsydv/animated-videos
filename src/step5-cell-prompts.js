import { openai } from './clients.js';
import { TEXT_MODEL } from './config.js';
import { writeManifest } from './manifest.js';

const BATCH_SIZE = 15;

async function generatePromptBatch(segments, prevPrompt) {
  const segmentList = segments
    .map((s, i) => `${i + 1}. "${s.text}"`)
    .join('\n');

  const continuityContext = prevPrompt
    ? `\n\nThe frame immediately BEFORE segment 1 was:\n"${prevPrompt}"\nYou may continue from it in segment 1 if it fits (see continuity rule).`
    : '';

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You write storyboard cell prompts for a hand-drawn MS Paint style YouTube video.
For each narration segment, write ONE detailed prompt describing a single storyboard frame.
Each prompt must describe camera angle, composition, scale, objects, symbols, stick figures, handwritten labels (max 1-4 words), and any background treatment.
Vary perspectives: close-ups, wide shots, diagrams, object-only frames, silhouettes, POV shots.
Do NOT repeat the same composition across cells.

Follow these variety rules across the set of frames:

1. SCALE — Vary how big the subject is. For SOME frames (roughly 1 in 4), make the main object/subject HUGE so it dominates or fills almost the entire frame (e.g. "extreme giant close-up of a dragon eye filling the whole frame", "enormous beetle taking up the entire cell, tiny human at the bottom for scale"). Other frames should be wide/distant with small subjects. Never keep the subject the same size in consecutive frames.

2. COLORFUL BACKGROUND — Most frames keep a plain white background. But for SOME frames (roughly 1 in 3), give the frame a COLORFUL background filled in with crude, newbie MS-Paint brush/fill strokes — messy uneven flat color, visible scribbly brush marks, patchy paint-bucket fills, streaky crayon-like coloring (e.g. "messy orange and red scribbled background for fire", "patchy blue paint-bucket sky with uneven brush strokes", "scribbled green ground filled in sloppily"). The coloring must look amateur and uneven, NOT smooth or polished. Keep the colored area inside the frame with a white margin around it so frames stay separated.

3. CONTINUITY — For SOME frames (roughly 1 in 4), instead of a brand-new composition, CONTINUE the previous frame's visual: keep the same subject/scene but modify it — zoom in on a detail, change the camera angle/perspective, or add extra layers, shapes, colors, arrows, or annotations on top of the previous visual. Describe it explicitly, e.g. "same campfire from the previous frame but zoomed in close on the flames, now with added orange scribbled glow", "the same dragon from before, pulled back to a wide shot with new mountains and a colored sky added behind it". Do NOT make every frame continuous — alternate continuity with fresh, unrelated compositions.${continuityContext}

Return JSON: { "prompts": ["prompt for segment 1", "prompt for segment 2", ...] }`,
      },
      {
        role: 'user',
        content: `Write one cell prompt for each segment, applying the scale, colorful-background, and continuity rules across the set:\n\n${segmentList}`,
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
    const prevPrompt = i > 0 ? manifest.segments[i - 1].prompt : null;
    const prompts = await generatePromptBatch(batch, prevPrompt);

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
