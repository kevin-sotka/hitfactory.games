import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES } from '../js/data.js';
import { StoryEngine } from '../js/engine.js';
import { Narrator, splitSentences, chooseVoice, estimateSeconds } from '../js/narrator.js';

const V = (name, lang) => ({ name, lang, voiceURI: name });
const MAC = [
  V('Samantha', 'en-US'), V('Aaron', 'en-US'), V('Daniel', 'en-GB'), V('Karen', 'en-AU'),
  V('Moira', 'en-IE'), V('Fiona', 'en-GB-u-sd-gbsct'), V('Rishi', 'en-IN'), V('Bubbles', 'en-US'), V('Thomas', 'fr-FR'),
];
const LINUX = [V('English (America)', 'en-US')];

// A speech engine that "speaks" instantly-ish and records what it was asked.
class FakeSynth {
  constructor(voices, { silent = false } = {}) { this.voices = voices; this.spoken = []; this.silent = silent; this.paused = false; }
  getVoices() { return this.voices; }
  addEventListener() {}
  speak(u) {
    this.spoken.push(u);
    if (this.silent) return; // never calls back: the watchdog must save us
    setTimeout(() => {
      u.onstart && u.onstart();
      u.onboundary && u.onboundary({ name: 'word', charIndex: 0, charLength: 3 });
      setTimeout(() => u.onend && u.onend(), 2);
    }, 1);
  }
  cancel() {
    const live = this.spoken.filter(u => !u.done);
    live.forEach(u => { u.done = true; u.onerror && u.onerror({ error: 'interrupted' }); });
  }
  resume() { this.paused = false; }
}
class FakeUtterance { constructor(text) { this.text = text; } }

test('splits into sentences, keeping offsets into the original line', () => {
  const t = 'Hm. The signal appears to be... interfering with itself... Yodelled. Loud, long! Done?';
  const parts = splitSentences(t);
  for (const p of parts) assert.equal(t.slice(p.start, p.start + p.text.length), p.text);
  assert.ok(parts.every(p => p.text.split(/\s+/).length >= 2), JSON.stringify(parts));
  assert.equal(parts.map(p => p.text).join(' '), t);
  assert.deepEqual(splitSentences('No full stop'), [{ text: 'No full stop', start: 0 }]);
});

test('every story line survives sentence splitting intact', () => {
  const e = new StoryEngine({ seed: 2 });
  for (const s of STORIES) {
    e.start(s.id, s.id);
    e.beat = 9;
    for (const t of [...s.beats.flat(), ...s.arrive, ...s.drift]) {
      const line = e.render(t, s.id);
      const parts = splitSentences(line);
      assert.equal(parts.map(p => p.text).join(' '), line);
      for (const p of parts) assert.equal(line.slice(p.start, p.start + p.text.length), p.text);
    }
  }
});

test('on a well stocked Mac every station gets its own accent', () => {
  const picks = STORIES.map(s => chooseVoice(MAC, s.voice));
  assert.deepEqual(picks.map(p => p.voice.name), ['Aaron', 'Karen', 'Moira', 'Daniel', 'Fiona']);
  assert.ok(picks.every(p => p.accent));
});

test('novelty voices are never chosen, and foreign voices never stand in', () => {
  const p = chooseVoice([V('Bubbles', 'en-US'), V('Thomas', 'fr-FR')], STORIES[0].voice);
  assert.equal(p.voice, null);
});

test('a missing accent falls back to any English voice and says so', () => {
  const p = chooseVoice(LINUX, STORIES[2].voice);
  assert.equal(p.voice.name, 'English (America)');
  assert.equal(p.accent, false);
  const scot = chooseVoice([V('Daniel', 'en-GB')], STORIES[4].voice);
  assert.equal(scot.voice.name, 'Daniel');
  assert.equal(scot.accent, false, 'English is not Scottish');
});

test('stations spread across voices when they can', async () => {
  const n = await new Narrator({ synth: new FakeSynth([V('A', 'en-GB'), V('B', 'en-GB')]), Utterance: FakeUtterance }).init(STORIES);
  const market = n.cast.get('market').voice.name;
  const trench = n.cast.get('trench').voice.name;
  assert.notEqual(market, trench);
});

test('speaks a line sentence by sentence with the station voice settings', async () => {
  const synth = new FakeSynth(MAC);
  const n = await new Narrator({ synth, Utterance: FakeUtterance }).init(STORIES);
  n.volume = 0.5;
  const sentences = [];
  const ok = await n.speak('One two three. Four five six! Seven eight nine?', STORIES[1], { onSentence: (i, s) => sentences.push(s.text) });
  assert.equal(ok, true);
  assert.deepEqual(sentences, ['One two three.', 'Four five six!', 'Seven eight nine?']);
  assert.equal(synth.spoken.length, 4 - 1);
  for (const u of synth.spoken) {
    assert.equal(u.voice.name, 'Karen');
    assert.equal(u.rate, STORIES[1].voice.rate);
    assert.equal(u.pitch, STORIES[1].voice.pitch);
    assert.equal(u.volume, 0.5);
  }
});

test('cancel stops mid line and the line reports it was cut off', async () => {
  const synth = new FakeSynth(MAC, { silent: true });
  const n = await new Narrator({ synth, Utterance: FakeUtterance }).init(STORIES);
  const p = n.speak('First sentence here. Second sentence here.', STORIES[0]);
  await new Promise(r => setTimeout(r, 5));
  n.cancel();
  assert.equal(await p, false);
  assert.equal(synth.spoken.length, 1, 'never moved on to the second sentence');
});

test('watchdog moves on when the engine never reports back', async () => {
  const synth = new FakeSynth(MAC, { silent: true });
  const fast = { setTimeout: (f, ms) => setTimeout(f, ms / 1000), clearTimeout, setInterval: (f, ms) => setInterval(f, Math.max(1, ms / 1000)), clearInterval };
  const n = await new Narrator({ synth, Utterance: FakeUtterance, timers: fast }).init(STORIES);
  assert.equal(await n.speak('Hello there, my friends. Is anyone out there listening?', STORIES[3]), true);
  assert.equal(synth.spoken.length, 2);
});

test('with no speech engine at all it reads along in captions only', async () => {
  const fast = { setTimeout: (f, ms) => setTimeout(f, ms / 100), clearTimeout, setInterval: (f, ms) => setInterval(f, Math.max(1, ms / 100)), clearInterval };
  const n = await new Narrator({ synth: null, timers: fast }).init(STORIES);
  assert.equal(n.captionsOnly, true);
  assert.equal(n.describe(STORIES[0]).name, 'Captions only');
  const words = [];
  const line = 'The quick brown fox jumps over the lazy dog.';
  assert.equal(await n.speak(line, STORIES[0], { onWord: (i, len) => words.push(line.slice(i, i + len)) }), true);
  assert.deepEqual(words, line.split(' '));
});

test('voices that load late are still found', async () => {
  const synth = new FakeSynth([]);
  synth.addEventListener = (_, cb) => setTimeout(() => { synth.voices = MAC; cb(); }, 5);
  const n = await new Narrator({ synth, Utterance: FakeUtterance }).init(STORIES);
  assert.equal(n.captionsOnly, false);
  assert.equal(n.describe(STORIES[2]).name, 'Moira');
});

test('pace estimate tracks rate', () => {
  assert.ok(estimateSeconds('one two three four five six', 1) > estimateSeconds('one two three four five six', 1.5));
});
