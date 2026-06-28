import fs from 'fs';
import { openai } from './clients.js';
import { TEXT_MODEL } from './config.js';
import { scriptStyle } from '../script-style.js';
import { writeManifest } from './manifest.js';

export async function generateScript(manifest, paths) {
  if (fs.existsSync(paths.script)) {
    console.log('[step 1] Script already exists, skipping.');
    manifest.script = fs.readFileSync(paths.script, 'utf8');
    return manifest;
  }

  console.log(`[step 1] Generating script (~${manifest.targetWords} words)...`);

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a world-class YouTube scriptwriter who writes wildly engaging, binge-worthy narration that keeps viewers watching to the very last second. Match the tone, pacing, and style of this reference script:

${scriptStyle}

Engagement rules (follow all of them):
- Open with an irresistible HOOK in the first 1-2 sentences: a shocking fact, bold claim, vivid image, or provocative question. NO slow throat-clearing intros, no "In this video", no "Have you ever wondered".
- Immediately tease the payoff so viewers feel they MUST keep watching to find out the answer — then keep that question alive with open loops ("but here's where it gets strange...", "and that's not even the weird part").
- Write in punchy, varied sentences. Mix short, hard-hitting lines with longer flowing ones to control rhythm. Avoid monotony.
- Use concrete, sensory, surprising details and real specifics (numbers, names, comparisons) instead of vague generalities. Make abstract ideas vivid and visual.
- Build momentum: each idea should escalate curiosity or stakes, leading naturally into the next. Use mini cliffhangers between sections.
- Talk directly to the viewer ("you"), be confident and energetic, and cut every boring or filler sentence. Every line must earn its place.
- End with a punchy, satisfying payoff that pays off the opening hook — no limp "thanks for watching" outro.

Write approximately ${manifest.targetWords} words for the given topic.
Output only the spoken narration text — no timestamps, titles, stage directions, section labels, or markdown.`,
      },
      {
        role: 'user',
        content: `Topic: ${manifest.topic}`,
      },
    ],
  });

  const script = response.choices[0].message.content.trim();
  fs.writeFileSync(paths.script, script);
  manifest.script = script;
  writeManifest(paths, manifest);

  console.log(`[step 1] Script saved (${script.split(/\s+/).length} words).`);
  return manifest;
}
