#!/usr/bin/env node
// Voices the five narrators with ElevenLabs.
//
//   node tools/render-voices.mjs --cast             pick a voice per accent from the voice library
//   node tools/render-voices.mjs --tier 1           render each station's home story first
//   node tools/render-voices.mjs                    render everything still missing
//   node tools/render-voices.mjs --dry-run          count clips and characters, spend nothing
//   options: --narrator docks   --limit 20   --redo
//
// Needs ELEVENLABS_API_KEY (environment, or .env in this folder). Renders go
// to audio-src/voice-ai/<narrator>/<clip>.mp3; human takes from the booth in
// audio-src/voice/ always win over these. Then run tools/build-audio.mjs.
//
// Every piece is rendered with the words that surround it in the finished line
// (ElevenLabs' previous_text and next_text), so stitched lines keep their flow.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';
import { STORIES, ENVIRONMENTS } from '../js/data.js';
import { scriptFor, splitTemplate } from '../js/script.js';

loadEnv();
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOICES_FILE = path.join(GAME, 'tools', 'voices.json');
const OUT = path.join(GAME, 'audio-src', 'voice-ai');
const API = 'https://api.elevenlabs.io/v1';
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = 'eleven_multilingual_v2';

// Who we are looking for in the voice library, and a stock voice if nothing fits.
export const CASTING = {
  prairie: { search: 'cowboy', accent: 'american', gender: 'male', age: 'old', fallback: 'pqHfZKP75CvOlQylNhV4', settings: { stability: 0.42, style: 0.4, speed: 0.95 } },
  campground: { search: 'australian', accent: 'australian', gender: 'female', fallback: 'IKne3meq5aSn9XLyUdCD', settings: { stability: 0.38, style: 0.45, speed: 1.03 } },
  docks: { search: 'irish storyteller', accent: 'irish', gender: 'male', age: 'old', fallback: 'JBFqnCBsd6RMkjVDRZzb', settings: { stability: 0.4, style: 0.45, speed: 0.97 } },
  market: { search: 'noir detective', accent: 'british', gender: 'male', age: 'middle_aged', fallback: 'JBFqnCBsd6RMkjVDRZzb', settings: { stability: 0.55, style: 0.25, speed: 0.98 } },
  trench: { search: 'scottish', accent: 'scottish', gender: 'female', fallback: 'Xb7hH8MSUJpSbSDYk0k2', settings: { stability: 0.42, style: 0.4, speed: 1.0 } },
};

// How the voice should say things the captions write compactly.
const SAY = [
  [/\bKDRY\b/g, 'K. D. R. Y.'], [/\b540\b/g, 'five forty'], [/\b710\b/g, 'seven ten'], [/\b880\b/g, 'eight eighty'],
  [/\b1050\b/g, 'ten fifty'], [/\b1290\b/g, 'twelve ninety'], [/\b4:15\b/g, 'four fifteen'], [/\bFM\b/g, 'F.M.'],
];
export const ttsText = s => SAY.reduce((t, [re, w]) => t.replace(re, w), s);

// Stand-ins for the other slots when giving a piece its surrounding words.
function sampleValues(narrator) {
  const story = STORIES.find(s => s.id === narrator);
  const env = ENVIRONMENTS.find(e => e.id === narrator).vocab;
  const c = story.cast;
  const article = p => (/^[aeiou]/i.test(p) ? 'an ' : 'a ') + p;
  return {
    hero: c.hero[0].intro, 'hero.short': c.hero[0].short,
    side: c.side[0].intro, 'side.short': c.side[0].short,
    villain: c.villain[0].intro, 'villain.short': c.villain[0].short,
    thing: c.thing[0], aThing: article(c.thing[0]),
    exclaim: story.pools.exclaim[0], food: story.pools.food[0], num: story.pools.num[0],
    ...env,
  };
}

// Lead-ins for names and places recorded on their own.
const FRAMES = {
  hero: ['And there, of all people, was', ', looking puzzled.'],
  side: ['And there, of all people, was', ', looking puzzled.'],
  villain: ['And there, of all people, was', ', looking puzzled.'],
  intro: ['Our story concerns', '. Now, listen closely.'],
  thing: ['Everybody wanted the', ', and nobody would say why.'],
  aThing: ['All anyone wanted was', ', and nobody would say why.'],
  place: ['It all began at', ', on a night like this one.'], landmark: ['They met again near', ', just after dark.'],
  sound: ['Somewhere behind them came', ', and then silence.'], weather: ['The night came in with', ', and the lamps went low.'],
  critter: ['Just then,', 'wandered past and stared.'], smell: ['The air smelled of', ', as it always did.'],
  light: ['They waited under', ', saying nothing.'],
  exclaim: ['', '! That was trouble.'], food: ['All that was left was', ', which was not encouraging.'], num: ['It went on for', 'hours, give or take.'],
};

// The text to render for a script item, with the words either side of it.
export function renderRequest(item) {
  if (item.template) {
    const story = STORIES.find(s => s.id === item.narrator);
    const values = sampleValues(item.narrator);
    let before = '', after = '', seen = false;
    for (const p of splitTemplate(item.template, story)) {
      const text = p.type === 'slot' ? values[p.key] : p.text;
      if (p.type === 'text' && p.n === item.n) { seen = true; continue; }
      if (seen) after += text; else before += text;
    }
    return { text: ttsText(item.say), previous_text: ttsText(before.trim()), next_text: ttsText(after.trim()) };
  }
  const frame = FRAMES[item.intro ? 'intro' : item.slot] || ['', ''];
  return { text: ttsText(item.say), previous_text: frame[0], next_text: frame[1] };
}

async function api(pathname, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + pathname, { ...init, headers: { 'xi-api-key': KEY, 'content-type': 'application/json', ...(init.headers || {}) } });
    if (r.status === 429 && attempt < 6) { await new Promise(ok => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
    if (!r.ok) throw new Error(`${init.method || 'GET'} ${pathname}: ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r;
  }
}

async function cast() {
  const chosen = fs.existsSync(VOICES_FILE) ? JSON.parse(fs.readFileSync(VOICES_FILE, 'utf8')) : {};
  for (const [id, want] of Object.entries(CASTING)) {
    if (chosen[id] && !args.includes('--redo')) { console.log(`${id}: keeping ${chosen[id].name}`); continue; }
    const q = new URLSearchParams({ page_size: '10', language: 'en', accent: want.accent, gender: want.gender, sort: 'usage_character_count_1y', search: want.search });
    if (want.age) q.set('age', want.age);
    let pick = null;
    try {
      const res = await (await api(`/shared-voices?${q}`)).json();
      const list = res.voices || [];
      console.log(`\n${id} (${want.accent}, ${want.search}):`);
      for (const v of list.slice(0, 5)) console.log(`  ${v.name} [${v.voice_id}] ${v.descriptive || ''} ${v.use_case || ''} ${v.preview_url || ''}`);
      pick = list[0];
    } catch (e) { console.warn(`  library search failed: ${e.message}`); }
    if (pick) {
      // A library voice has to be added to the account before it can speak.
      try {
        const added = await (await api(`/voices/add/${pick.public_owner_id}/${pick.voice_id}`, { method: 'POST', body: JSON.stringify({ new_name: `Deep Dial ${STORIES.find(s => s.id === id).narrator}` }) })).json();
        chosen[id] = { voice_id: added.voice_id, name: pick.name, from: 'library', preview_url: pick.preview_url };
      } catch (e) {
        console.warn(`  could not add ${pick.name}: ${e.message}`);
        pick = null;
      }
    }
    if (!pick) chosen[id] = { voice_id: want.fallback, name: 'stock voice', from: 'premade' };
    console.log(`  -> ${chosen[id].name}`);
  }
  fs.writeFileSync(VOICES_FILE, JSON.stringify(chosen, null, 1) + '\n');
  console.log(`\nSaved ${path.relative(GAME, VOICES_FILE)}. Change any voice_id there to recast, then render.`);
}

async function render() {
  const voices = fs.existsSync(VOICES_FILE) ? JSON.parse(fs.readFileSync(VOICES_FILE, 'utf8')) : {};
  const tier = Number(opt('--tier')) || 3;
  const only = opt('--narrator');
  const limit = Number(opt('--limit')) || Infinity;
  const redo = args.includes('--redo');
  const jobs = [];
  for (const s of STORIES) {
    if (only && s.id !== only) continue;
    for (const item of scriptFor(s.id)) {
      if (item.tier > tier) continue;
      const file = path.join(OUT, `${item.clip}.mp3`);
      if (!redo && fs.existsSync(file)) continue;
      jobs.push({ item, file });
    }
  }
  const todo = jobs.slice(0, limit);
  const chars = todo.reduce((n, j) => n + renderRequest(j.item).text.length, 0);
  console.log(`${todo.length} clips to render, ${chars} characters.`);
  if (args.includes('--dry-run')) {
    for (const j of todo.slice(0, 6)) console.log(' ', j.item.clip, JSON.stringify(renderRequest(j.item)));
    return;
  }
  if (!KEY) { console.error('Set ELEVENLABS_API_KEY (environment or .env), or use --dry-run.'); process.exit(1); }
  for (const s of STORIES) if (!voices[s.id] && (!only || s.id === only)) { console.error(`No voice for ${s.id}: run --cast first.`); process.exit(1); }
  let done = 0;
  const said = {};
  const worker = async () => {
    while (todo.length) {
      const { item, file } = todo.shift();
      const v = voices[item.narrator];
      const settings = { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, ...CASTING[item.narrator].settings, ...(v.settings || {}) };
      const body = { ...renderRequest(item), model_id: MODEL, voice_settings: settings };
      const r = await api(`/text-to-speech/${v.voice_id}?output_format=mp3_44100_128`, { method: 'POST', body: JSON.stringify(body) });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      (said[item.narrator] ||= {})[item.clip] = item.say;
      if (++done % 25 === 0) console.log(`  ${done} rendered`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  for (const [n, map] of Object.entries(said)) {
    const f = path.join(OUT, n, 'takes.json');
    const old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    fs.writeFileSync(f, JSON.stringify({ ...old, ...map }, null, 1));
  }
  console.log(`Rendered ${done} clips. Now run: node tools/build-audio.mjs`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (args.includes('--cast') ? cast() : render()).catch(e => { console.error(e.message); process.exit(1); });
}
