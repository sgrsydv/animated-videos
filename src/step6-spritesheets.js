import fs from 'fs';
import path from 'path';
import { openai } from './clients.js';
import { CELLS_PER_SHEET, IMAGE_MODEL, IMAGE_SIZE } from './config.js';
import { prompt as masterPrompt } from '../generate-spritesheet-prompt.js';
import { writeManifest, relativeOutput } from './manifest.js';

function buildSheetPrompt(segments) {
  const cellDescriptions = segments
    .map((seg, i) => `Cell ${i + 1}: ${seg.prompt}`)
    .join('\n');

  const blankCells = CELLS_PER_SHEET - segments.length;
  const blankInstruction =
    blankCells > 0
      ? `\nCells ${segments.length + 1} through ${CELLS_PER_SHEET}: Leave completely blank white.`
      : '';

  return `${masterPrompt}

---

Now create the sprite sheet for these specific narration segments:

${cellDescriptions}
${blankInstruction}

REMINDER (most important rule): The 9 frames must be separated ONLY by empty white space. Do NOT draw any borders, boxes, grid lines, divider lines, or separator lines anywhere in the image.`;
}

export async function generateSpritesheets(manifest, paths) {
  const allHaveSheets = manifest.segments.every(
    (s) => s.sheetIndex != null && s.sheetPath
  );
  if (allHaveSheets) {
    console.log('[step 6] Spritesheets already generated, skipping.');
    return manifest;
  }

  if (!manifest.sheets) {
    manifest.sheets = [];
  }

  const totalSheets = Math.ceil(manifest.segments.length / CELLS_PER_SHEET);
  console.log(`[step 6] Generating ${totalSheets} spritesheet(s)...`);

  for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
    const sheetPath = path.join(paths.spritesheets, `sheet_${sheetIndex}.png`);

    if (fs.existsSync(sheetPath)) {
      console.log(`[step 6] sheet_${sheetIndex}.png exists, skipping generation.`);
      const start = sheetIndex * CELLS_PER_SHEET;
      const batch = manifest.segments.slice(start, start + CELLS_PER_SHEET);
      for (let cellIndex = 0; cellIndex < batch.length; cellIndex++) {
        const seg = manifest.segments[start + cellIndex];
        seg.sheetIndex = sheetIndex;
        seg.cellIndex = cellIndex;
        seg.sheetPath = relativeOutput(paths, sheetPath);
      }
      continue;
    }

    const start = sheetIndex * CELLS_PER_SHEET;
    const batch = manifest.segments.slice(start, start + CELLS_PER_SHEET);
    const fullPrompt = buildSheetPrompt(batch);

    console.log(
      `[step 6] Generating sheet ${sheetIndex + 1}/${totalSheets} (${batch.length} cells)...`
    );

    const response = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: fullPrompt,
      size: IMAGE_SIZE,
      n: 1,
    });

    const imageBase64 = response.data[0].b64_json;
    fs.writeFileSync(sheetPath, Buffer.from(imageBase64, 'base64'));

    for (let cellIndex = 0; cellIndex < batch.length; cellIndex++) {
      const seg = manifest.segments[start + cellIndex];
      seg.sheetIndex = sheetIndex;
      seg.cellIndex = cellIndex;
      seg.sheetPath = relativeOutput(paths, sheetPath);
    }

    manifest.sheets.push({
      index: sheetIndex,
      path: relativeOutput(paths, sheetPath),
      segmentCount: batch.length,
    });

    writeManifest(paths, manifest);
    console.log(`[step 6] Saved sheet_${sheetIndex}.png`);
  }

  writeManifest(paths, manifest);
  return manifest;
}
