#!/usr/bin/env node
// Fetches CC0 recordings from Freesound for every sound element.
//
//   FREESOUND_TOKEN=... node tools/fetch-freesound.mjs              all elements
//   FREESOUND_TOKEN=... node tools/fetch-freesound.mjs --only wind,owl
//   node tools/fetch-freesound.mjs --dry-run                        show the plan
//
// Get a token (free) at https://freesound.org/apiv2/apply. Only "Creative
// Commons 0" sounds are requested, so nothing needs attribution, but every
// file still gets a .credit.json and ends up in audio/CREDITS.md.
//
// Candidates go to audio-src/sfx-candidates/<element>/. The best one or two
// are also copied into audio-src/sfx/<element>/ so the game has something
// right away; listen to the candidates and swap in better ones by copying
// them over (keep the bed-/shot- prefix). Then run tools/build-audio.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, DURATION } from './sfx-sources.mjs';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = (opt('--only') || '').split(',').filter(Boolean);
const DRY = args.includes('--dry-run');
const TOKEN = process.env.FREESOUND_TOKEN;
const PER_QUERY = 4;
const KEEP = { bed: 1, shot: 3 }; // copied straight into the game per element

export function searchUrl(query, kind, token) {
  const [lo, hi] = DURATION[kind];
  const u = new URL('https://freesound.org/apiv2/search/text/');
  u.searchParams.set('query', query);
  u.searchParams.set('filter', `license:"Creative Commons 0" duration:[${lo} TO ${hi}]`);
  u.searchParams.set('sort', 'downloads_desc');
  u.searchParams.set('fields', 'id,name,username,license,duration,previews,url,avg_rating');
  u.searchParams.set('page_size', String(PER_QUERY));
  if (token) u.searchParams.set('token', token);
  return u.toString();
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url.replace(/token=[^&]+/, 'token=...')}`);
  return r.json();
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} downloading ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  const ids = Object.keys(SOURCES).filter(id => !only.length || only.includes(id));
  if (!DRY && !TOKEN) {
    console.error('Set FREESOUND_TOKEN (free from https://freesound.org/apiv2/apply), or use --dry-run.');
    process.exit(1);
  }
  for (const id of ids) {
    for (const kind of ['bed', 'shot']) {
      const queries = SOURCES[id][kind];
      if (!queries) continue;
      const seen = new Map();
      for (const q of queries) {
        if (DRY) { console.log(`${id} ${kind}: ${searchUrl(q, kind)}`); continue; }
        const res = await getJson(searchUrl(q, kind, TOKEN));
        for (const s of res.results || []) if (!seen.has(s.id) && s.license.includes('publicdomain/zero')) seen.set(s.id, s);
      }
      if (DRY) continue;
      const picks = [...seen.values()];
      console.log(`${id} ${kind}: ${picks.length} CC0 candidates`);
      let kept = 0;
      for (const s of picks) {
        const base = `${kind}-fs${s.id}`;
        const cand = path.join(GAME, 'audio-src', 'sfx-candidates', id, `${base}.mp3`);
        if (!fs.existsSync(cand)) await download(s.previews['preview-hq-mp3'], cand);
        const credit = { name: s.name, author: s.username, license: 'CC0 1.0', url: s.url || `https://freesound.org/s/${s.id}/` };
        fs.writeFileSync(cand.replace(/\.mp3$/, '.credit.json'), JSON.stringify(credit, null, 1));
        if (kept < KEEP[kind]) {
          const dest = path.join(GAME, 'audio-src', 'sfx', id, `${base}.mp3`);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(cand, dest);
          fs.writeFileSync(dest.replace(/\.mp3$/, '.credit.json'), JSON.stringify(credit, null, 1));
          kept++;
        }
      }
    }
  }
  if (!DRY) console.log('\nDone. Audition audio-src/sfx-candidates/, swap any you like into audio-src/sfx/, then run: node tools/build-audio.mjs');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
