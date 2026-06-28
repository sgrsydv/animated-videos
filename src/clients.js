import OpenAI from 'openai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY in environment');
}

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('Missing ELEVENLABS_API_KEY in environment');
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
