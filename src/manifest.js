import fs from 'fs';
import path from 'path';

export function ensureJobDirs(paths) {
  for (const dir of [paths.jobDir, paths.sfx, paths.spritesheets, paths.frames]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readManifest(paths) {
  if (!fs.existsSync(paths.manifest)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
}

export function writeManifest(paths, manifest) {
  ensureJobDirs(paths);
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));
}

export function initManifest(paths, { jobId, topic, minutes, targetWords }) {
  const existing = readManifest(paths);
  if (existing) {
    return existing;
  }

  const manifest = {
    jobId,
    topic,
    minutes,
    targetWords,
    status: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    segments: [],
    sheets: [],
  };
  writeManifest(paths, manifest);
  return manifest;
}

export function relativeOutput(paths, filePath) {
  return path.relative(paths.jobDir, filePath).replace(/\\/g, '/');
}
