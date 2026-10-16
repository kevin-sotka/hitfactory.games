// End to end with recordings: stand-in audio files are generated into a temp
// folder and served as audio/, so the recorded paths (stitched narration,
// sample ambiences, music idents, the recording booth) all run for real.
//   node tests/e2e-recordings.mjs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FULL_SCRIPT } from '../js/script.js';
import { encodeWav } from '../js/wav.js';
import { buildIndex } from '../tools/build-audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddrh-rec-'));

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return createRequire(path.join(globalRoot, '/'))('playwright');
  }
}

// ---------- stand-in audio ----------
const SR = 8000;
function tone(seconds, freq, { noise = 0, level = 0.3 } = {}) {
  const n = Math.round(seconds * SR), d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 80, (n - i) / 80);
    d[i] = env * level * (noise ? Math.random() * 2 - 1 : Math.sin((2 * Math.PI * freq * i) / SR));
  }
  return d;
}
function put(dir, rel, samples) {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, encodeWav(samples, SR));
}
function fixtures(name, { voices = () => false, sfx = {}, music = [] }) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const x of FULL_SCRIPT().filter(voices)) put(dir, `voice/${x.clip}.wav`, tone(0.05, 300));
  for (const [id, kinds] of Object.entries(sfx)) {
    for (let i = 0; i < (kinds.bed || 0); i++) put(dir, `sfx/${id}/bed-${i}.wav`, tone(6, 0, { noise: 1, level: 0.2 }));
    for (let i = 0; i < (kinds.shot || 0); i++) put(dir, `sfx/${id}/shot-${i}.wav`, tone(1.5, 440 + i * 110));
  }
  for (const id of music) { put(dir, `music/${id}-ident.wav`, tone(1, 660)); put(dir, `music/${id}-bed.wav`, tone(4, 220, { level: 0.2 })); }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(buildIndex(dir).index));
  return dir;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const servers = [];
function serve(audioDir) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = url.startsWith('/audio/') && audioDir ? path.join(audioDir, url.slice(7)) : path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => { servers.push(server); resolve(`http://127.0.0.1:${server.address().port}/`); });
  });
}

function fakeSpeech() {
  window.__DDRH_FAST = true;
  window.__spoken = [];
  const synth = {
    getVoices: () => [{ name: 'Aaron', lang: 'en-US', voiceURI: 'Aaron' }, { name: 'Moira', lang: 'en-IE', voiceURI: 'Moira' }],
    addEventListener() {},
    speak(u) { if (!u.text.trim()) return; window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 3); },
    cancel() {}, resume() {}, pause() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
}

let browser;
const errors = [];
async function open(base, query = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(fakeSpeech);
  await page.goto(base + query);
  await page.waitForFunction(() => window.__ddrh && window.__ddrh.state.indexReady && window.__ddrh.narrator.ready);
  // Count lines that went out as recordings.
  await page.evaluate(() => {
    window.__recorded = 0;
    const b = window.__ddrh.bank, speak = b.speak.bind(b);
    b.speak = (...a) => { window.__recorded++; return speak(...a); };
  });
  return page;
}
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 25 });

before(async () => {
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
});
after(async () => {
  await browser?.close();
  servers.forEach(s => s.close());
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('fully recorded: a whole broadcast plays from recordings, device voice never speaks', async () => {
  const base = await serve(fixtures('all', { voices: () => true }));
  const page = await open(base, '?seed=7');
  assert.equal(await page.evaluate(() => window.__ddrh.bank.size), FULL_SCRIPT().length);
  assert.match(await page.locator('#now-voice').textContent(), /performed in full/);
  await page.click('#play');
  await until(page, () => document.querySelector('#caption .word'));
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 60000);
  const h = await page.evaluate(() => window.__ddrh.engine.history);
  assert.deepEqual(h.map(x => x.beat), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.notEqual(h[9].storyId, h[0].storyId, 'drifted at halftime');
  assert.deepEqual(await page.evaluate(() => window.__spoken), [], 'no device speech at all');
  assert.ok(await page.evaluate(() => window.__recorded) >= 12, 'beats, drift and bridge all recorded');
  await page.close();
});

test('partly recorded: recorded takes are chosen first and the gaps fall back to the device voice', async () => {
  const base = await serve(fixtures('tier1', { voices: x => x.narrator === 'prairie' && x.tier === 1 }));
  const page = await open(base, '?seed=12');
  assert.match(await page.locator('#now-voice').textContent(), /performed \d+%, device voice fills the gaps/);
  await page.locator('#drift').uncheck({ force: true });
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 60000).catch(async e => {
    console.log(await page.evaluate(() => JSON.stringify({ h: window.__ddrh.engine.history, rec: window.__recorded, spoken: window.__spoken, st: window.__ddrh.state.playing, cap: document.getElementById('caption').textContent })));
    throw e;
  });
  // Tier 1 is every first take, the home cast and the home scene: the whole home story.
  assert.equal(await page.evaluate(() => window.__recorded), 10);
  assert.deepEqual(await page.evaluate(() => window.__spoken), []);
  // Switch to a station with nothing recorded: the device voice takes over.
  await page.click('#play');
  await page.click('.preset[data-id=market]');
  await until(page, () => window.__spoken.length > 0, null, 8000).catch(async e => {
    console.log('DEBUG', await page.evaluate(() => JSON.stringify({ st: window.__ddrh.state.station, playing: window.__ddrh.state.playing, eng: window.__ddrh.engine.playing, beat: window.__ddrh.engine.beat, sid: window.__ddrh.engine.storyId, cap: document.getElementById('caption').textContent, rec: window.__recorded })));
    throw e;
  });
  await page.close();
});

test('pause and resume work mid line on recordings too', async () => {
  const base = await serve(fixtures('all2', { voices: () => true }));
  const page = await open(base, '?seed=3');
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length >= 2 && window.__ddrh.bank.live.size > 0);
  await page.click('#play');
  const beat = await page.evaluate(() => window.__ddrh.engine.beat);
  assert.equal(await page.evaluate(() => window.__ddrh.bank.live.size), 0, 'playback stopped');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__ddrh.engine.beat), beat, 'held at the same beat');
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 60000);
  assert.deepEqual(await page.evaluate(() => window.__spoken), []);
  await page.close();
});

test('recorded ambiences and one-shots replace synthesis and still drive the picture', async () => {
  const base = await serve(fixtures('sfx', { sfx: { wind: { bed: 1 }, train: { shot: 2 }, campfire: { bed: 1 } } }));
  const page = await open(base);
  await page.evaluate(() => {
    window.__cues = [];
    const v = window.__ddrh.view, ev = v.event.bind(v);
    v.event = e => { window.__cues.push(e.type); ev(e); };
  });
  await page.click('#engage-btn');
  await until(page, () => window.__ddrh.sound.layers.get('wind')?.recorded && window.__ddrh.sound.layers.get('train')?.recorded);
  assert.equal(await page.evaluate(() => window.__ddrh.sound.layers.get('coyote').recorded), false, 'no files: still synthesised');
  await until(page, () => window.__cues.includes('train') && window.__cues.includes('gust'), null, 10000);
  await page.waitForTimeout(400);
  assert.ok(await page.locator('.el[data-id=wind] .vu i.lit').count() > 0, 'wind meter moves');
  await page.evaluate(() => window.__ddrh.selectEnv('campground', true));
  await until(page, () => window.__ddrh.sound.layers.get('campfire')?.recorded);
  await until(page, () => window.__cues.includes('pop'), null, 8000);
  await page.close();
});

test('a short bed loops seamlessly, unclipped, and one-shots land on cue', async () => {
  const base = await serve(fixtures('empty', {}));
  const page = await open(base);
  const r = await page.evaluate(async () => {
    const { renderSampleLayer } = await import(new URL('js/audio.js', location.href).href);
    const make = ctx => {
      const buf = (sec, fn) => { const b = ctx.createBuffer(1, Math.floor(sec * ctx.sampleRate), ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = fn(i / ctx.sampleRate); return b; };
      return { bed: [buf(7, () => (Math.random() * 2 - 1) * 0.6)], shot: [buf(1.2, t => 0.9 * Math.sin(2 * Math.PI * 500 * t))] };
    };
    const bed = await renderSampleLayer('rain', ctx => ({ bed: make(ctx).bed, shot: [] }), 40);
    const shots = await renderSampleLayer('gulls', ctx => ({ bed: [], shot: make(ctx).shot }), 40);
    return { bed, shots: { peak: shots.peak, bad: shots.bad, events: shots.events.map(e => e.type) } };
  });
  assert.equal(r.bed.bad, 0);
  assert.ok(r.bed.peak < 0.99, `bed peak ${r.bed.peak}`);
  const steady = r.bed.windows.slice(2);
  const med = [...steady].sort((a, b) => a - b)[Math.floor(steady.length / 2)];
  for (const [i, w] of steady.entries()) assert.ok(Math.abs(20 * Math.log10(w / med)) < 4, `bed dips or swells at ${(i + 2) / 2}s (${(20 * Math.log10(w / med)).toFixed(1)} dB)`);
  assert.ok(Math.abs(20 * Math.log10(med) - -27) < 3, `bed level ${(20 * Math.log10(med)).toFixed(1)} dB`);
  assert.ok(r.shots.peak < 0.99 && r.shots.bad === 0);
  assert.ok(r.shots.events.filter(t => t === 'gull').length >= 4, 'gulls call several times in 40 s');
  await page.close();
});

test('music: the station ident plays after the static, the bed sits under the story', async () => {
  const base = await serve(fixtures('music', { music: ['prairie', 'docks'] }));
  const page = await open(base, '?seed=4');
  assert.equal(await page.locator('.fader.music').isVisible(), true);
  await page.evaluate(() => {
    const s = window.__ddrh.sound;
    window.__idents = 0;
    const id = s.ident.bind(s);
    s.ident = b => { window.__idents++; id(b); };
  });
  await page.click('#play');
  await until(page, () => window.__idents === 1 && window.__ddrh.sound.bed);
  await page.click('.preset[data-id=docks]');
  await until(page, () => window.__idents === 2);
  await page.click('.preset[data-id=market]'); // no music for this one: the bed goes quiet
  await until(page, () => !window.__ddrh.sound.bed);
  await page.click('#stop');
  await page.close();
});

test('the booth: record with a microphone, export, build, and the game finds the takes', async () => {
  const base = await serve(null);
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  page.on('pageerror', e => errors.push(`booth pageerror: ${e.message}`));
  await page.goto(base + 'record.html?narrator=campground');
  await page.waitForFunction(() => window.__booth);
  await page.evaluate(() => indexedDB.deleteDatabase('ddrh-booth'));
  await page.reload();
  await page.waitForFunction(() => window.__booth);
  assert.match(await page.locator('#who').textContent(), /The Ranger/);
  const first = await page.locator('#clip').textContent();
  await page.click('#mic');
  await until(page, () => document.getElementById('mic-state').textContent === 'Mic ready');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('r');
    await page.waitForTimeout(900);
    await page.keyboard.press('r');
    await until(page, n => window.__booth.state.takes.size === n, i + 1, 10000);
  }
  assert.notEqual(await page.locator('#clip').textContent(), first, 'moved on after the takes');
  assert.equal(await page.locator('.tabs [data-id=campground] i').evaluate(e => e.style.width !== '0%'), true);
  // Survives a reload.
  await page.reload();
  await page.waitForFunction(() => window.__booth && window.__booth.state.takes.size === 3);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const zip = path.join(TMP, 'booth.zip');
  await download.saveAs(zip);
  const src = path.join(TMP, 'src'), out = path.join(TMP, 'out');
  const log = execFileSync('node', [path.join(ROOT, 'tools/build-audio.mjs'), '--zip', zip, '--src', src, '--out', out]).toString();
  assert.match(log, /Unpacked 4 files/);
  const index = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
  const clips = Object.keys(index.voice);
  assert.equal(clips.length, 3);
  assert.ok(clips.every(c => c.startsWith('campground/')));
  for (const f of Object.values(index.voice)) assert.ok(fs.statSync(path.join(out, f)).size > 500, `${f} encoded`);
  await page.close();
});

test('no console errors along the way', () => {
  assert.deepEqual(errors.filter(e => !/Failed to load resource.*404/.test(e)), []);
});
