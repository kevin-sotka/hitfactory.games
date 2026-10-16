// End to end: the real page in headless Chromium.
// A fake speech engine stands in for the narrator so a whole broadcast runs in
// seconds; everything else (Web Audio, canvas, the DOM) is the real thing.
//   node tests/e2e.mjs            run
//   SHOTS=dir node tests/e2e.mjs  also save screenshots

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS;

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return createRequire(path.join(globalRoot, '/'))('playwright');
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      // This suite covers synthesis and device voices; the shipped recordings would mask
      // them, so it sees an empty audio index (e2e-recordings.mjs covers recordings).
      if (url === '/audio/index.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"voice":{},"sfx":{},"music":{}}'); }
      let file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Installed before the page loads: a speech engine that speaks `wordMs` per word.
function fakeSpeech({ wordMs = 2, voices = true } = {}) {
  window.__DDRH_FAST = true;
  window.__spoken = [];
  const VOICES = [
    { name: 'Aaron', lang: 'en-US', voiceURI: 'Aaron' }, { name: 'Karen', lang: 'en-AU', voiceURI: 'Karen' },
    { name: 'Moira', lang: 'en-IE', voiceURI: 'Moira' }, { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel' },
    { name: 'Fiona', lang: 'en-GB-u-sd-gbsct', voiceURI: 'Fiona' },
  ];
  let cur = null;
  const synth = {
    paused: false,
    getVoices: () => (voices ? VOICES : []),
    addEventListener() {},
    speak(u) {
      if (!u.text.trim()) return;
      window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate, volume: u.volume });
      const me = (cur = { u, cancelled: false, done: false });
      const words = [...u.text.matchAll(/\S+/g)];
      setTimeout(() => {
        if (me.cancelled) return;
        u.onstart && u.onstart();
        words.forEach((m, k) => setTimeout(() => { if (!me.cancelled) u.onboundary && u.onboundary({ name: 'word', charIndex: m.index, charLength: m[0].length }); }, k * window.__wordMs));
        setTimeout(() => { if (!me.cancelled) { me.done = true; u.onend && u.onend(); } }, words.length * window.__wordMs + 3);
      }, 1);
    },
    cancel() { if (cur && !cur.done && !cur.cancelled) { cur.cancelled = true; cur.u.onerror && cur.u.onerror({ error: 'interrupted' }); } },
    resume() {}, pause() {},
  };
  window.__wordMs = wordMs;
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
}

let browser, server, base;
const errors = [];

async function open(opts = {}, { viewport = { width: 1440, height: 900 }, query = '' } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()}`); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  if (opts !== null) await page.addInitScript(fakeSpeech, opts);
  else await page.addInitScript(() => { window.__DDRH_FAST = true; delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
  await page.goto(base + query);
  await page.waitForFunction(() => window.__ddrh && window.__ddrh.narrator.ready);
  return page;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 20 });

before(async () => {
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('loads clean: title, five scenes, five stations, six switches', async () => {
  const page = await open();
  assert.equal(await page.title(), 'Deep Dial Radio Hour');
  assert.equal(await page.locator('.detent').count(), 5);
  assert.equal(await page.locator('.preset').count(), 5);
  assert.equal(await page.locator('.el').count(), 6);
  assert.equal(await page.locator('#beats i').count(), 10);
  assert.equal(await page.locator('.preset[aria-pressed=true]').getAttribute('data-id'), 'prairie');
  assert.match(await page.locator('#now-voice').textContent(), /Aaron/);
  assert.match(await page.locator('#st-voice').textContent(), /5\/5 accents/);
  await shot(page, 'load');
  await page.close();
});

test('every scene paints, and each one looks different', async () => {
  const page = await open();
  const sigs = {};
  for (const id of ['prairie', 'campground', 'docks', 'market', 'trench']) {
    await page.evaluate(id => window.__ddrh.selectEnv(id, true), id);
    await page.waitForTimeout(1700); // let the dive transition finish
    sigs[id] = await page.evaluate(() => {
      const c = document.getElementById('scene');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let r = 0, g = 0, b = 0, n = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; if (d[i] + d[i + 1] + d[i + 2] > 30) lit++; }
      return { r: r / n, g: g / n, b: b / n, lit: lit / n };
    });
    assert.ok(sigs[id].lit > 0.5, `${id} is mostly painted`);
    assert.equal(await page.locator('#scene-name').textContent(), (await page.evaluate(id => window.__ddrh.state.env === id ? document.querySelector('.detent[aria-current=true]').getAttribute('aria-label') : '', id)));
    await shot(page, `scene-${id}`);
  }
  const ids = Object.keys(sigs);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = sigs[ids[i]], b = sigs[ids[j]];
    const dist = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
    assert.ok(dist > 12, `${ids[i]} and ${ids[j]} look too alike (${dist.toFixed(1)})`);
  }
  await page.close();
});

test('engage starts the synth; the lever swaps the sound elements; switches add and remove layers', async () => {
  const page = await open();
  await page.click('#engage-btn');
  await until(page, () => window.__ddrh.sound.ready);
  assert.ok(await page.locator('#engage.gone').count());
  for (const [i, id] of ['prairie', 'campground', 'docks', 'market', 'trench'].entries()) {
    await page.locator('#env').fill(String(i));
    const want = await page.evaluate(id => window.__ddrh.state.env === id, id);
    assert.ok(want, `lever moved to ${id}`);
    const layers = await page.evaluate(() => [...window.__ddrh.sound.layers.keys()].sort());
    const expected = await page.$$eval('.el', els => els.map(e => e.dataset.id).sort());
    assert.deepEqual(layers, expected, `${id} plays exactly its own six elements`);
    // Radio follows the scene while idle.
    assert.equal(await page.locator('.preset[aria-pressed=true]').getAttribute('data-id'), id);
  }
  const first = page.locator('.el').first();
  const lid = await first.getAttribute('data-id');
  await first.click();
  assert.equal(await first.getAttribute('aria-checked'), 'false');
  assert.ok(!(await page.evaluate(id => window.__ddrh.sound.layers.has(id), lid)));
  await first.click();
  assert.equal(await first.getAttribute('aria-checked'), 'true');
  assert.ok(await page.evaluate(id => window.__ddrh.sound.layers.has(id), lid));
  await page.click('#all-off');
  assert.equal(await page.evaluate(() => window.__ddrh.sound.layers.size), 0);
  await page.click('#all-on');
  assert.equal(await page.evaluate(() => window.__ddrh.sound.layers.size), 6);
  // Meters move once sound flows.
  await page.waitForTimeout(1500);
  assert.ok(await page.locator('.vu i.lit').count() > 0, 'some meter lights up');
  await shot(page, 'engaged');
  await page.close();
});

test('all thirty sound elements render offline: finite, unclipped, audible, and on cue', async () => {
  const page = await open();
  const results = await page.evaluate(async () => {
    const { LAYERS, renderLayer } = await import(new URL('js/audio.js', location.href).href);
    const out = [];
    for (const id of Object.keys(LAYERS)) out.push(await renderLayer(id, 12));
    return out;
  });
  assert.equal(results.length, 30);
  const dB = v => 20 * Math.log10(v);
  console.log('    ' + results.map(r => `${r.id.padEnd(10)} loudest ${dB(r.loud).toFixed(1).padStart(6)} dB  average ${dB(r.rms).toFixed(1).padStart(6)} dB  peak ${r.peak.toFixed(2)}  cues ${r.events.length}`).join('\n    '));
  for (const r of results) {
    assert.equal(r.bad, 0, `${r.id} produced NaN or Infinity`);
    assert.ok(r.peak < 0.99, `${r.id} clips (${r.peak.toFixed(2)})`);
    assert.ok(dB(r.loud) > -34, `${r.id} is too quiet (${dB(r.loud).toFixed(1)} dB at its loudest)`);
    assert.ok(dB(r.loud) < -9, `${r.id} is too loud (${dB(r.loud).toFixed(1)} dB at its loudest)`);
  }
  const spread = results.map(r => dB(r.loud));
  assert.ok(Math.max(...spread) - Math.min(...spread) < 18, 'elements sit within a sensible mix range');
  // Elements that drive the picture must say so, and promptly.
  const cues = { train: 'train', windmill: 'creak', telegraph: 'telegraph', coyote: 'howl', campfire: 'pop', owl: 'hoot', guitar: 'strum', frogs: 'ribbit', waves: 'wave', gulls: 'gull', foghorn: 'horn', buoy: 'bell', rigging: 'clink', pier: 'creak', neon: 'flicker', wok: 'sizzle', scooter: 'scooter', busker: 'note', sonar: 'ping', hull: 'groan', whale: 'whale', bubbles: 'bubbles', ghost: 'ghost', creek: 'lap' };
  for (const [id, type] of Object.entries(cues)) {
    const r = results.find(x => x.id === id);
    assert.ok(r.events.includes(type), `${id} never cued "${type}"`);
    assert.ok(r.firstEvent < 6, `${id} took ${r.firstEvent.toFixed(1)}s to do anything`);
  }
  await page.close();
});

test('a full broadcast: ten beats, the drift at halftime, sign off, in order', async () => {
  const page = await open({ wordMs: 1 }, { query: '?seed=7' });
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 30000);
  await until(page, () => /End of broadcast/.test(document.getElementById('caption').textContent));
  const h = await page.evaluate(() => window.__ddrh.engine.history);
  assert.deepEqual(h.map(x => x.beat), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(h.slice(0, 5).every(x => x.storyId === 'prairie'), 'first half on the home station');
  assert.ok(h.slice(5).every(x => x.storyId === h[5].storyId && x.storyId !== 'prairie'), 'second half on the drifted station');
  const spoken = await page.evaluate(() => window.__spoken.map(s => s.text).join(' '));
  assert.match(spoken, /KDRY 540/);
  const after = await page.evaluate(id => window.__ddrh.engine.story(id).station, h[5].storyId);
  assert.ok(spoken.includes(after), 'the new station signs off by name');
  assert.equal(await page.locator('#beats i.done').count(), 10);
  assert.equal(await page.locator('.preset[aria-pressed=true]').getAttribute('data-id'), h[5].storyId, 'the button followed the drift');
  // Voices: each station spoke in its own accent.
  const byVoice = await page.evaluate(() => [...new Set(window.__spoken.map(s => s.voice))]);
  assert.ok(byVoice.includes('Aaron') && byVoice.length === 2, `voices used: ${byVoice}`);
  assert.equal(await page.locator('#play[aria-label=Play]').count(), 1);
  await page.close();
});

test('switching station mid-beat: the new narrator takes over the same beat, with a bridge', async () => {
  const page = await open({ wordMs: 25 }, { query: '?seed=3' });
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length === 2 && window.__spoken.length > 0 && /Saltwater|KDRY/.test(document.getElementById('now-station').textContent));
  await until(page, () => document.querySelector('#caption .word'));
  const beatBefore = await page.evaluate(() => window.__ddrh.engine.beat);
  const heard = await page.evaluate(() => window.__spoken.length);
  await page.click('.preset[data-id=docks]');
  await until(page, n => window.__spoken.length > n && window.__spoken.at(-1).voice === 'Moira', heard);
  await shot(page, 'switched');
  const firstNew = await page.evaluate(n => window.__spoken[n].text, heard);
  const arrivals = await page.evaluate(() => window.__ddrh.engine.story('docks').arrive);
  assert.ok(arrivals.some(a => firstNew.startsWith(a.split(/[.!?]/)[0])), `opens with an arrival line: "${firstNew}"`);
  await page.evaluate(() => { window.__wordMs = 1; });
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 30000);
  const h = await page.evaluate(() => window.__ddrh.engine.history);
  assert.deepEqual(h.map(x => x.beat), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(h[beatBefore].storyId, 'docks', 'the interrupted beat was retold by the new station');
  assert.ok(h.slice(beatBefore).every(x => x.storyId === 'docks'), 'no drift after a manual switch');
  // The hero survived the switch.
  const hero = await page.evaluate(() => window.__ddrh.engine.cast.hero.short);
  const lateLines = await page.evaluate(n => window.__spoken.slice(n).map(s => s.text).join(' '), heard);
  assert.ok(lateLines.includes(hero), `${hero} carried over`);
  await page.close();
});

test('pause holds the line; play picks up at the same sentence', async () => {
  const page = await open({ wordMs: 20 }, { query: '?seed=11' });
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length >= 1 && window.__spoken.length >= 2);
  await page.click('#play'); // pause
  const beat = await page.evaluate(() => window.__ddrh.engine.beat);
  const n = await page.evaluate(() => window.__spoken.length);
  const last = await page.evaluate(() => window.__spoken.at(-1).text);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__spoken.length), n, 'silent while paused');
  assert.equal(await page.locator('#play[aria-label=Play]').count(), 1);
  await page.click('#play'); // resume
  await until(page, k => window.__spoken.length > k, n);
  assert.equal(await page.evaluate(k => window.__spoken[k].text, n), last, 'resumes with the interrupted sentence');
  assert.equal(await page.evaluate(() => window.__ddrh.engine.beat), beat);
  await page.click('#stop');
  assert.equal(await page.locator('#beats i.done').count(), 0);
  assert.equal(await page.evaluate(() => window.__ddrh.engine.playing), false);
  await page.close();
});

test('moving the lever mid-story keeps the narrator and earns a remark about the new scenery', async () => {
  const page = await open({ wordMs: 4 }, { query: '?seed=5' });
  await page.locator('#drift').uncheck({ force: true });
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length >= 2);
  await page.evaluate(() => window.__ddrh.selectEnv('trench', true));
  assert.equal(await page.locator('.preset[aria-pressed=true]').getAttribute('data-id'), 'prairie', 'radio stays put while on air');
  await until(page, () => window.__spoken.some(s => /Mariana Trench/.test(s.text)));
  await page.evaluate(() => { window.__wordMs = 1; });
  await until(page, () => window.__ddrh.engine.history.length === 10, null, 30000);
  assert.ok((await page.evaluate(() => window.__ddrh.engine.history)).every(x => x.storyId === 'prairie'));
  await page.close();
});

test('captions only: with no speech engine the story still plays, at reading pace', async () => {
  const page = await open(null, { query: '?seed=2' });
  assert.match(await page.locator('#st-voice').textContent(), /Captions/);
  assert.match(await page.locator('#now-voice').textContent(), /captions only/i);
  await page.click('#play');
  await until(page, () => window.__ddrh.engine.history.length >= 3, null, 30000);
  assert.ok((await page.locator('#caption').textContent()).length > 20);
  await page.close();
});

test('keys: 1 to 5 tune stations, arrows sweep scenes, space plays', async () => {
  const page = await open();
  await page.keyboard.press('4');
  assert.equal(await page.locator('.preset[aria-pressed=true]').getAttribute('data-id'), 'market');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => window.__ddrh.state.env), 'campground');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => window.__ddrh.state.env), 'prairie', 'stops at the end');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(' ');
  await until(page, () => window.__ddrh.state.playing);
  await page.close();
});

test('remembers your switches and scene between visits', async () => {
  const page = await open();
  await page.evaluate(() => window.__ddrh.selectEnv('docks', true));
  await page.locator('.el[data-id=gulls]').click();
  await page.reload();
  await page.waitForFunction(() => window.__ddrh && window.__ddrh.narrator.ready);
  assert.equal(await page.evaluate(() => window.__ddrh.state.env), 'docks');
  assert.equal(await page.locator('.el[data-id=gulls]').getAttribute('aria-checked'), 'false');
  assert.equal(await page.locator('.el[data-id=waves]').getAttribute('aria-checked'), 'true');
  await page.evaluate(() => localStorage.clear());
  await page.close();
});

test('phone width: no sideways scroll, everything reachable', async () => {
  for (const width of [320, 375, 414]) {
    const page = await open({}, { viewport: { width, height: 800 } });
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert.ok(sw <= iw, `${width}px: page is ${sw}px wide`);
    for (const sel of ['#play', '.preset[data-id=trench]', '#env', '.el >> nth=5']) {
      const box = await page.locator(sel).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${sel} fits at ${width}px`);
      assert.ok(box.width >= 30 && box.height >= 30, `${sel} is a decent tap target at ${width}px`);
    }
    if (width === 375) await shot(page, 'phone');
    await page.close();
  }
});

test('draws fast enough: every scene well inside a 60fps frame', async () => {
  const page = await open();
  await page.click('#engage-btn');
  const times = {};
  for (const id of ['prairie', 'campground', 'docks', 'market', 'trench']) {
    await page.evaluate(id => window.__ddrh.selectEnv(id, true), id);
    await page.waitForTimeout(1600);
    // Fire every visual cue at once, then time the busiest frames.
    times[id] = await page.evaluate(() => {
      const { view, sound } = window.__ddrh;
      for (const type of ['train', 'gust', 'howl', 'tap', 'pop', 'strum', 'hoot', 'ribbit', 'lap', 'gull', 'wave', 'horn', 'bell', 'clink', 'flicker', 'sizzle', 'scooter', 'note', 'ping', 'whale', 'bubbles', 'ghost']) {
        view.event({ type, at: sound.now, data: { dur: 3, strength: 0.9, size: 1, dir: 1, n: 2, count: 10, side: 0.5 } });
      }
      const t0 = performance.now();
      for (let i = 0; i < 90; i++) view.frame(1 / 60);
      return (performance.now() - t0) / 90;
    });
  }
  console.log('    ms per frame: ' + Object.entries(times).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '));
  for (const [id, ms] of Object.entries(times)) assert.ok(ms < 12, `${id} takes ${ms.toFixed(1)}ms a frame`);
  await page.close();
});

test('no console errors anywhere along the way', () => {
  assert.deepEqual(errors, []);
});
