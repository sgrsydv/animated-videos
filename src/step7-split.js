import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ROWS, COLS } from './config.js';
import { writeManifest, relativeOutput } from './manifest.js';

export async function splitSpriteSheet(inputPath, rows = ROWS, cols = COLS) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not determine dimensions for ${inputPath}`);
  }

  const spriteWidth = Math.floor(metadata.width / cols);
  const spriteHeight = Math.floor(metadata.height / rows);
  const sprites = [];

  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const buffer = await image
        .clone()
        .extract({
          left: col * spriteWidth,
          top: row * spriteHeight,
          width: spriteWidth,
          height: spriteHeight,
        })
        .extend({
          bottom: spriteHeight % 2 === 0 ? 0 : 1,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();

      sprites.push({ index: count, buffer });
      count++;
    }
  }

  return sprites;
}

export async function splitAllSheets(manifest, paths) {
  const allHaveFrames = manifest.segments.every((s) => s.framePath);
  if (allHaveFrames) {
    console.log('[step 7] Frames already split, skipping.');
    return manifest;
  }

  console.log('[step 7] Splitting spritesheets into frames...');
  fs.mkdirSync(paths.frames, { recursive: true });

  for (const segment of manifest.segments) {
    const framePath = path.join(
      paths.frames,
      `frame_${String(segment.index).padStart(4, '0')}.png`
    );

    if (fs.existsSync(framePath)) {
      segment.framePath = relativeOutput(paths, framePath);
      continue;
    }

    const sheetPath = path.join(paths.jobDir, segment.sheetPath);
    const sprites = await splitSpriteSheet(sheetPath);
    const sprite = sprites[segment.cellIndex];

    if (!sprite) {
      throw new Error(
        `No sprite at cell ${segment.cellIndex} in sheet ${segment.sheetPath}`
      );
    }

    fs.writeFileSync(framePath, sprite.buffer);
    segment.framePath = relativeOutput(paths, framePath);
  }

  writeManifest(paths, manifest);
  console.log(`[step 7] Saved ${manifest.segments.length} frames.`);
  return manifest;
}
