import fs from 'fs';
import path from 'path';
import { JOBS_ROOT, buildPaths } from './config.js';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function generateJobId(topic) {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${timestamp()}-${slugify(topic)}-${rand}`;
}

export function createJob(topic) {
  const id = generateJobId(topic);
  const dir = path.join(JOBS_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  return { id, dir, paths: buildPaths(dir) };
}

export function resumeJob(id) {
  const dir = path.join(JOBS_ROOT, id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Job "${id}" not found in ${JOBS_ROOT}`);
  }
  return { id, dir, paths: buildPaths(dir) };
}

export function listJobs() {
  if (!fs.existsSync(JOBS_ROOT)) {
    return [];
  }
  return fs
    .readdirSync(JOBS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
