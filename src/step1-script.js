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
        content: `You write engaging YouTube narration scripts. Match the tone, pacing, and style of this reference script:

${scriptStyle}

Write approximately ${manifest.targetWords} words for the given topic.
Output only the spoken narration text — no timestamps, titles, stage directions, or markdown.`,
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
