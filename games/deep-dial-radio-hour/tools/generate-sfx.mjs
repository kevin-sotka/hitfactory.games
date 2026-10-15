#!/usr/bin/env node
// Generates the sounds nobody has recorded (hover scooters, a ghost on the
// radio, a synth busker) with ElevenLabs sound effects.
//
//   ELEVENLABS_API_KEY=... node tools/generate-sfx.mjs
//   ELEVENLABS_API_KEY=... node tools/generate-sfx.mjs --only scooter --takes 3
//   node tools/generate-sfx.mjs --dry-run
//
// Each prompt is rendered --takes times (default 2) into audio-src/sfx/<element>/.
// Check your ElevenLabs plan allows commercial use of generated sound.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';
import { SOURCES } from './sfx-sources.mjs';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv();
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = (opt('--only') || '').split(',').filter(Boolean);
const takes = Number(opt('--takes')) || 2;
const DRY = args.includes('--dry-run');
const KEY = process.env.ELEVENLABS_API_KEY;

export function jobs() {
  const out = [];
  for (const [id, src] of Object.entries(SOURCES)) {
    if (!src.ai || (only.length && !only.includes(id))) continue;
    src.ai.forEach(([prompt, seconds], p) => {
      // Long prompts loop as a bed; short ones fire as moments.
      const kind = seconds >= 15 ? 'bed' : 'shot';
      for (let t = 0; t < takes; t++) out.push({ id, prompt, seconds, file: path.join(GAME, 'audio-src', 'sfx', id, `${kind}-ai${p}${t}.mp3`) });
    });
  }
  return out;
}

async function main() {
  const list = jobs();
  const todo = list.filter(j => !fs.existsSync(j.file));
  console.log(`${todo.length} sounds to generate, ${todo.reduce((n, j) => n + Math.min(22, j.seconds), 0)} seconds of audio.`);
  if (DRY) { for (const j of todo) console.log(`${j.id}: ${j.seconds}s "${j.prompt}" -> ${path.relative(GAME, j.file)}`); return; }
  if (!KEY) { console.error('Set ELEVENLABS_API_KEY, or use --dry-run.'); process.exit(1); }
  for (const j of list) {
    if (fs.existsSync(j.file)) { console.log(`have ${path.relative(GAME, j.file)}`); continue; }
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: j.prompt, duration_seconds: Math.min(22, j.seconds), prompt_influence: 0.45 }),
    });
    if (!r.ok) throw new Error(`${j.id}: ${r.status} ${await r.text()}`);
    fs.mkdirSync(path.dirname(j.file), { recursive: true });
    fs.writeFileSync(j.file, Buffer.from(await r.arrayBuffer()));
    fs.writeFileSync(j.file.replace(/\.mp3$/, '.credit.json'), JSON.stringify({ name: j.prompt, author: 'ElevenLabs sound generation', license: 'Generated', note: 'AI generated' }, null, 1));
    console.log(`made ${path.relative(GAME, j.file)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
