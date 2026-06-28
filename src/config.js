import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const WPM = 150;
export const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
export const TTS_MODEL = 'eleven_multilingual_v2';
export const STT_MODEL = 'scribe_v1';
export const TEXT_MODEL = 'gpt-4o';
export const IMAGE_MODEL = 'gpt-image-2';
export const IMAGE_SIZE = '1536x1024';
export const ROWS = 3;
export const COLS = 3;
export const CELLS_PER_SHEET = ROWS * COLS;
export const MIN_WORDS = 2;
export const MAX_WORDS = 10;
export const FPS = 30;
export const SFX_VOLUME = 0.35;
export const SFX_MIN_DURATION = 0.5;
export const SFX_MAX_DURATION = 30;
export const SFX_PROMPT_INFLUENCE = 0.4;
export const THUMBNAIL_GEN_SIZE = '1536x1024';
export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;
export const YT_CATEGORY_ID = '27';
export const YT_PRIVACY = 'public';

export const OUTPUT_ROOT = path.join(ROOT, 'output');
export const JOBS_ROOT = path.join(OUTPUT_ROOT, 'jobs');
export const YT_CLIENT_SECRET = path.join(ROOT, 'client_secret.json');
export const YT_TOKEN = path.join(ROOT, 'youtube-token.json');

export function buildPaths(jobDir) {
  return {
    root: ROOT,
    jobDir,
    manifest: path.join(jobDir, 'manifest.json'),
    script: path.join(jobDir, 'script.txt'),
    audio: path.join(jobDir, 'audio.mp3'),
    mixedAudio: path.join(jobDir, 'mixed.mp3'),
    words: path.join(jobDir, 'words.json'),
    sfx: path.join(jobDir, 'sfx'),
    spritesheets: path.join(jobDir, 'spritesheets'),
    frames: path.join(jobDir, 'frames'),
    concat: path.join(jobDir, 'concat.txt'),
    final: path.join(jobDir, 'final.mp4'),
    thumbnail: path.join(jobDir, 'thumbnail.png'),
    thumbnailRaw: path.join(jobDir, 'thumbnail_raw.png'),
    metadata: path.join(jobDir, 'metadata.json'),
  };
}

export function targetWordsFromMinutes(minutes) {
  return Math.round(minutes * WPM);
}
