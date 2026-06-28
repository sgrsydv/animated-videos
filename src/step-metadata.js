import fs from 'fs';
import { openai } from './clients.js';
import { TEXT_MODEL, YT_CATEGORY_ID, YT_PRIVACY } from './config.js';
import { readManifest, writeManifest } from './manifest.js';
import { scriptStyle } from '../script-style.js';

export async function generateMetadata(paths) {
  if (fs.existsSync(paths.metadata)) {
    console.log('[metadata] metadata.json already exists, skipping.');
    const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));
    const manifest = readManifest(paths);
    if (manifest) {
      manifest.youtube = { ...manifest.youtube, ...metadata };
      writeManifest(paths, manifest);
    }
    return metadata;
  }

  const manifest = readManifest(paths);
  if (!manifest) {
    throw new Error('manifest.json not found for this job.');
  }

  const script = fs.readFileSync(paths.script, 'utf8');
  const topic = manifest.topic;

  console.log('[metadata] Generating title, description, and tags...');

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You write high-performing, CLICKBAIT YouTube metadata for educational curiosity-driven videos.
Match the tone and style of this reference script:

${scriptStyle}

Return JSON with:
- "title": an irresistible, clickbait YouTube title (STRICTLY max 100 characters, aim for 40-70). It MUST make people unable to NOT click. Use proven clickbait techniques:
    * Open a curiosity gap or tease a secret/surprise ("The REAL Reason...", "What Nobody Tells You About...", "...And Nobody Noticed").
    * Make a bold, surprising, or contrarian claim, or pose a burning question the video answers.
    * Use powerful emotional/curiosity words (Shocking, Insane, Impossible, Hidden, Secret, Never, Why, How) where natural.
    * Consider strategic CAPS on 1-2 key words and/or a number for punch. Do NOT use spammy ALL-CAPS, clickbait that lies, or excessive emojis/symbols.
    * Be punchy and front-load the hook. The title must stay truthful to the script — irresistible, never misleading.
- "description": 2-4 short paragraphs describing the video. Hook the reader in the first line. End with a soft call-to-action (subscribe, comment). Include relevant keywords naturally. No markdown headers.
- "tags": array of 8-15 relevant search tags (strings only).`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nScript:\n${script}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  if (!parsed.title || !parsed.description || !Array.isArray(parsed.tags)) {
    throw new Error('Invalid metadata response from OpenAI');
  }

  const metadata = {
    title: parsed.title.slice(0, 100),
    description: parsed.description,
    tags: parsed.tags.map(String),
    categoryId: YT_CATEGORY_ID,
    privacyStatus: YT_PRIVACY,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(paths.metadata, JSON.stringify(metadata, null, 2));

  manifest.youtube = { ...manifest.youtube, ...metadata };
  writeManifest(paths, manifest);

  console.log(`[metadata] Title: ${metadata.title}`);
  console.log(`[metadata] Saved to ${paths.metadata}`);
  return metadata;
}
