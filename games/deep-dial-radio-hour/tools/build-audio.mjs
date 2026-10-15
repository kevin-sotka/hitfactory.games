#!/usr/bin/env node
// Turns raw recordings into the files the game plays, and writes audio/index.json.
//
//   node tools/build-audio.mjs                    convert audio-src/ into audio/
//   node tools/build-audio.mjs --zip booth.zip    unpack a recording booth export first
//   node tools/build-audio.mjs --check            just report what is covered
//
// audio-src/ (raw, not committed)            audio/ (shipped)
//   voice/<narrator>/<clip>.wav       ->       voice/<narrator>/<clip>.mp3
//   sfx/<element>/bed-*.wav|flac|mp3  ->       sfx/<element>/bed-*.mp3   looping ambience
//   sfx/<element>/shot-*.*            ->       sfx/<element>/shot-*.mp3  one-shots
//   music/<station>-ident.*           ->       music/<station>-ident.mp3
//   music/<station>-bed.*             ->       music/<station>-bed.mp3
//
// With ffmpeg on the PATH, voices are trimmed and levelled and everything is
// encoded to MP3. Without it, files the browser can already play are copied.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FULL_SCRIPT } from '../js/script.js';
import { STORIES, ENVIRONMENTS } from '../js/data.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const SRC = path.resolve(GAME, opt('--src', 'audio-src'));
const OUT = path.resolve(GAME, opt('--out', 'audio'));
const CHECK = args.includes('--check');
const PLAYABLE = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.webm', '.opus']);
const SOURCE = new Set([...PLAYABLE, '.flac', '.aif', '.aiff', '.aac']);
const hasFfmpeg = !args.includes('--no-ffmpeg') && spawnSync('ffmpeg', ['-version']).status === 0;

const walk = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])) : []);
const rel = (base, f) => path.relative(base, f).split(path.sep).join('/');

// ---------- unpack a booth export (a plain zip) ----------
export function unzip(buf, dest) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/') || name.includes('..')) continue;
    const lnlen = buf.readUInt16LE(local + 26), lxlen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lnlen + lxlen, local + 30 + lnlen + lxlen + csize);
    const out = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : null;
    if (!out) throw new Error(`${name}: unsupported compression ${method}`);
    const file = path.join(dest, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    names.push(name);
  }
  return names;
}

// ---------- convert ----------
function ffmpeg(input, output, kind) {
  const trim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse';
  const plans = {
    // Booth takes are already levelled and rendered voices are consistent, so only trim:
    // loudness normalising a one-word clip does more harm than good.
    voice: ['-af', trim, '-ac', '1', '-ar', '44100', '-b:a', '80k'],
    bed: ['-t', '75', '-ac', '2', '-ar', '44100', '-b:a', '112k'],
    shot: ['-ac', '2', '-ar', '44100', '-b:a', '112k'],
    music: ['-ac', '2', '-ar', '44100', '-b:a', '160k'],
  };
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, ...plans[kind], output]);
}

function kindOf(relPath) {
  if (relPath.startsWith('voice/') || relPath.startsWith('voice-ai/')) return 'voice';
  if (relPath.startsWith('music/')) return 'music';
  return /\/bed[^/]*$/.test(relPath) ? 'bed' : 'shot';
}

// Rendered voices (voice-ai/) fill in wherever there is no human take (voice/).
export function pickSources(files, srcDir) {
  const byTarget = new Map();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!SOURCE.has(ext)) continue;
    const r = rel(srcDir, f);
    if (r.startsWith('sfx-candidates/')) continue;
    const out = r.replace(/^voice-ai\//, 'voice/').replace(/\.[^.]+$/, '');
    const human = !r.startsWith('voice-ai/');
    const prev = byTarget.get(out);
    if (!prev || (human && !prev.human)) byTarget.set(out, { file: f, rel: r, out, human });
  }
  return [...byTarget.values()];
}

function convertAll() {
  let done = 0, skipped = 0;
  for (const { file: f, rel: r, out } of pickSources(walk(SRC), SRC)) {
    const ext = path.extname(f).toLowerCase();
    const kind = kindOf(r);
    const target = path.join(OUT, out + (hasFfmpeg ? '.mp3' : ext));
    if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(f).mtimeMs) { skipped++; continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (hasFfmpeg) ffmpeg(f, target, kind);
    else if (PLAYABLE.has(ext)) fs.copyFileSync(f, target);
    else { console.warn(`  skipped ${r}: needs ffmpeg to convert ${ext}`); continue; }
    done++;
  }
  return { done, skipped };
}

// ---------- index ----------
export function buildIndex(outDir) {
  const index = { voice: {}, sfx: {}, music: {} };
  const warnings = [];
  const script = new Map(FULL_SCRIPT().map(x => [x.clip, x]));
  const elements = new Set(ENVIRONMENTS.flatMap(e => e.layers.map(l => l.id)));
  const stations = new Set(STORIES.map(s => s.id));
  for (const f of walk(outDir).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (!PLAYABLE.has(ext)) continue;
    const r = rel(outDir, f);
    let m;
    if ((m = r.match(/^voice\/([a-z]+)\/(.+)\.[a-z0-9]+$/))) {
      const clip = `${m[1]}/${m[2]}`;
      if (!script.has(clip)) { warnings.push(`unknown voice clip ${r} (not in the script, maybe renamed)`); continue; }
      index.voice[clip] = r;
    } else if ((m = r.match(/^sfx\/([a-z]+)\/(bed|shot)[^/]*$/))) {
      if (!elements.has(m[1])) { warnings.push(`unknown sound element folder ${r}`); continue; }
      const e = (index.sfx[m[1]] ||= { bed: [], shot: [] });
      e[m[2]].push(r);
    } else if ((m = r.match(/^music\/([a-z]+)-(ident|bed)\.[a-z0-9]+$/))) {
      if (!stations.has(m[1])) { warnings.push(`unknown station in ${r}`); continue; }
      (index.music[m[1]] ||= {})[m[2]] = r;
    } else warnings.push(`ignored ${r}`);
  }
  return { index, warnings };
}

// Takes recorded against older wording are flagged so they can be redone.
function staleTakes() {
  const script = new Map(FULL_SCRIPT().map(x => [x.clip, x]));
  const stale = [];
  for (const f of [...walk(path.join(SRC, 'voice')), ...walk(path.join(SRC, 'voice-ai'))].filter(f => f.endsWith('takes.json'))) {
    const takes = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [clip, said] of Object.entries(takes)) {
      const now = script.get(clip);
      if (now && now.say !== said) stale.push(`${clip}: recorded "${said}", script now says "${now.say}"`);
    }
  }
  return stale;
}

function credits() {
  const lines = [];
  for (const f of walk(path.join(SRC, 'sfx')).filter(f => f.endsWith('.credit.json')).sort()) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    lines.push(`- ${rel(SRC, f).replace('.credit.json', '')}: "${c.name}" by ${c.author}, ${c.license}${c.url ? `, ${c.url}` : ''}${c.note ? ` (${c.note})` : ''}`);
  }
  return lines;
}

function report(index) {
  const script = FULL_SCRIPT();
  console.log('\nNarration (recorded / needed, by tier):');
  for (const s of STORIES) {
    const mine = script.filter(x => x.narrator === s.id);
    const tiers = [1, 2, 3].map(t => {
      const all = mine.filter(x => x.tier === t);
      return `${all.filter(x => index.voice[x.clip]).length}/${all.length}`;
    });
    const have = mine.filter(x => index.voice[x.clip]).length;
    console.log(`  ${s.station.padEnd(24)} ${String(Math.round((100 * have) / mine.length)).padStart(3)}%   tier 1 ${tiers[0]}   tier 2 ${tiers[1]}   tier 3 ${tiers[2]}`);
  }
  console.log('\nSound elements with recordings:');
  for (const env of ENVIRONMENTS) {
    const row = env.layers.map(l => {
      const e = index.sfx[l.id];
      return e ? `${l.id}(${e.bed.length}b ${e.shot.length}s)` : `${l.id}(synth)`;
    });
    console.log(`  ${env.short.padEnd(13)} ${row.join('  ')}`);
  }
  console.log('\nMusic:', Object.keys(index.music).length ? Object.entries(index.music).map(([k, v]) => `${k}: ${Object.keys(v).join('+')}`).join(', ') : 'none yet');
}

// ---------- main ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const zip = opt('--zip');
  if (zip) {
    const names = unzip(fs.readFileSync(zip), SRC);
    console.log(`Unpacked ${names.length} files from ${zip} into ${rel(GAME, SRC)}/`);
  }
  if (!CHECK) {
    if (!hasFfmpeg) console.log('ffmpeg not found: copying browser-ready files as they are (install ffmpeg for trimming, levelling and MP3).');
    const { done, skipped } = convertAll();
    console.log(`Converted ${done} file(s), ${skipped} already up to date.`);
  }
  const { index, warnings } = buildIndex(OUT);
  if (!CHECK) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
    const c = credits();
    if (c.length) fs.writeFileSync(path.join(OUT, 'CREDITS.md'), `# Sound credits\n\nRecordings used in Deep Dial Radio Hour.\n\n${c.join('\n')}\n`);
  }
  for (const w of warnings) console.warn('  warning: ' + w);
  for (const s of staleTakes()) console.warn('  stale take: ' + s);
  report(index);
  if (!CHECK) console.log(`\nWrote ${rel(GAME, path.join(OUT, 'index.json'))}`);
}
