import fs from 'fs';
import sharp from 'sharp';
import { openai } from './clients.js';
import {
  IMAGE_MODEL,
  THUMBNAIL_GEN_SIZE,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
} from './config.js';
import { readManifest, writeManifest, relativeOutput } from './manifest.js';

function buildThumbnailPrompt(topic, title) {
  return `Create ONE single bold YouTube thumbnail image in 16:9 aspect ratio.

Topic: ${topic}
Video title: ${title}

This is NOT a sprite sheet. This is ONE striking thumbnail image.

Drawing Style (Very Important):
- Must genuinely look like MS Paint for the first time
- White background
- Thick uneven black outlines
- Shaky hand-drawn lines
- Stick figures, crooked circles, flat colors only
- No gradients, shadows, textures, anime, or polished art

Composition:
- ONE bold focal subject related to the topic (large, centered or off-center for drama)
- 2-4 words of LARGE handwritten caption text (can use red, blue, or black)
- High contrast, lots of empty white space
- Designed to grab attention in a YouTube feed
- No grid, no multiple panels, no divider lines`;
}

export async function generateThumbnail(paths) {
  if (fs.existsSync(paths.thumbnail)) {
    console.log('[thumbnail] thumbnail.png already exists, skipping.');
    return paths.thumbnail;
  }

  const manifest = readManifest(paths);
  if (!manifest) {
    throw new Error('manifest.json not found for this job.');
  }

  let title = manifest.youtube?.title;
  if (!title && fs.existsSync(paths.metadata)) {
    title = JSON.parse(fs.readFileSync(paths.metadata, 'utf8')).title;
  }
  if (!title) {
    title = manifest.topic;
  }

  const topic = manifest.topic;
  const prompt = buildThumbnailPrompt(topic, title);

  console.log('[thumbnail] Generating thumbnail image...');

  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: THUMBNAIL_GEN_SIZE,
    n: 1,
  });

  const imageBase64 = response.data[0].b64_json;
  fs.writeFileSync(paths.thumbnailRaw, Buffer.from(imageBase64, 'base64'));

  await sharp(paths.thumbnailRaw)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
    .png()
    .toFile(paths.thumbnail);

  manifest.youtube = manifest.youtube ?? {};
  manifest.youtube.thumbnailPath = relativeOutput(paths, paths.thumbnail);
  writeManifest(paths, manifest);

  console.log(`[thumbnail] Saved ${paths.thumbnail} (${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT})`);
  return paths.thumbnail;
}
