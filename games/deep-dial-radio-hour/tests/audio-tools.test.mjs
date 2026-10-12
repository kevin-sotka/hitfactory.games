import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { processTake, encodeWav, decodeWav, zipStore, crc32 } from '../js/wav.js';
import { unzip, buildIndex } from '../tools/build-audio.mjs';

const SR = 48000;
function fakeTake({ lead = 0.8, speech = 1.2, tail = 0.9, level = 0.3, noise = 0.002 } = {}) {
  const n = Math.round((lead + speech + tail) * SR);
  const d = new Float32Array(n);
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    d[i] = rnd() * noise * 2 + 0.01; // hiss plus a little DC
    if (t >= lead && t < lead + speech) d[i] += level * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t));
  }
  return d;
}

test('a take is trimmed to the words, with a little air either side', () => {
  const out = processTake([fakeTake()], SR);
  const secs = out.length / SR;
  assert.ok(secs > 1.2 && secs < 1.2 + 0.3, `kept ${secs.toFixed(2)}s`);
  const peak = Math.max(...out.map(Math.abs));
  assert.ok(peak <= 0.9 && peak > 0.1, `peak ${peak}`); // a steady tone has far less crest than speech
  assert.ok(Math.abs(out[0]) < 0.01 && Math.abs(out.at(-1)) < 0.01, 'edges fade to silence');
});

test('quiet and loud takes come out at the same level', () => {
  const loud = (d) => { let m = 0; for (let s = 0; s < d.length; s += 4800) { let e = 0; for (let i = s; i < Math.min(d.length, s + 4800); i++) e += d[i] * d[i]; m = Math.max(m, Math.sqrt(e / 4800)); } return m; };
  const a = processTake([fakeTake({ level: 0.05 })], SR);
  const b = processTake([fakeTake({ level: 0.6 })], SR);
  assert.ok(Math.abs(20 * Math.log10(loud(a) / loud(b))) < 1.5);
});

test('a silent take is rejected', () => {
  assert.equal(processTake([fakeTake({ level: 0 })], SR), null);
});

test('stereo is folded to mono', () => {
  const l = fakeTake(), r = fakeTake();
  assert.ok(processTake([l, r], SR).length > 0);
});

test('WAV round trip', () => {
  const s = new Float32Array([0, 0.5, -0.5, 0.25, -1]);
  const back = decodeWav(encodeWav(s, 44100));
  assert.equal(back.sampleRate, 44100);
  back.samples.forEach((v, i) => assert.ok(Math.abs(v - s[i]) < 1e-3));
});

test('the booth zip opens with the build tool, byte for byte', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [
    { name: 'voice/prairie/b1v0-0.wav', data: encodeWav(new Float32Array(1000).fill(0.1), 44100) },
    { name: 'voice/prairie/takes.json', data: new TextEncoder().encode('{"prairie/b1v0-0":"Our story concerns"}') },
  ];
  const zip = zipStore(files);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddrh-'));
  const names = unzip(Buffer.from(zip), dir);
  assert.deepEqual(names, files.map(f => f.name));
  for (const f of files) assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(dir, f.name))), f.data);
  fs.rmSync(dir, { recursive: true });
});

test('the index knows voices, sound elements and music, and flags strays', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddrh-'));
  const put = p => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), 'x'); };
  ['voice/prairie/b1v0-0.mp3', 'voice/docks/hero-prairie0.mp3', 'voice/docks/not-a-clip.mp3',
    'sfx/wind/bed-1.mp3', 'sfx/train/shot-1.mp3', 'sfx/train/shot-2.mp3', 'sfx/kazoo/bed.mp3',
    'music/trench-ident.mp3', 'music/trench-bed.mp3', 'music/nowhere-bed.mp3', 'notes.txt'].forEach(put);
  const { index, warnings } = buildIndex(dir);
  assert.deepEqual(Object.keys(index.voice).sort(), ['docks/hero-prairie0', 'prairie/b1v0-0']);
  assert.deepEqual(index.sfx.wind, { bed: ['sfx/wind/bed-1.mp3'], shot: [] });
  assert.equal(index.sfx.train.shot.length, 2);
  assert.deepEqual(index.music.trench, { bed: 'music/trench-bed.mp3', ident: 'music/trench-ident.mp3' });
  assert.equal(warnings.length, 3, warnings.join('\n'));
  fs.rmSync(dir, { recursive: true });
});
