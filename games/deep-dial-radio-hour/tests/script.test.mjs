import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, ENVIRONMENTS } from '../js/data.js';
import { StoryEngine, mulberry32 } from '../js/engine.js';
import { scriptFor, FULL_SCRIPT, splitTemplate, sayable, pauseBetween, TEMPLATE_KEY } from '../js/script.js';

const SCRIPT = new Map(FULL_SCRIPT().map(x => [x.clip, x]));

test('every template has its own key', () => {
  const all = STORIES.flatMap(s => [...s.beats.flat(), ...s.arrive, ...s.drift]);
  assert.equal(new Set(all).size, all.length, 'no two templates share wording');
  for (const t of all) assert.ok(TEMPLATE_KEY.has(t));
});

test('clip ids are unique and every item has something to say', () => {
  const all = FULL_SCRIPT();
  assert.equal(new Set(all.map(x => x.clip)).size, all.length);
  for (const x of all) {
    assert.ok(x.say.length > 0 && /[a-z0-9]/i.test(x.say), x.clip);
    assert.ok(!/[{}]/.test(x.say), `${x.clip}: ${x.say}`);
    assert.ok([1, 2, 3].includes(x.tier));
  }
});

test('a narrator only records their own station name', () => {
  for (const s of STORIES) for (const x of scriptFor(s.id)) {
    for (const other of STORIES) if (other.id !== s.id) assert.ok(!x.say.includes(other.station), `${x.clip} says ${other.station}`);
  }
});

test('splitting a template loses nothing', () => {
  for (const s of STORIES) for (const t of [...s.beats.flat(), ...s.arrive, ...s.drift]) {
    const parts = splitTemplate(t, s);
    const back = parts.map(p => (p.type === 'slot' ? `{${p.key}}` : p.text)).join('');
    assert.equal(back, t.replaceAll('{station}', s.station).replaceAll('{title}', s.title));
  }
});

test('sayable trims the joins but keeps the end of a sentence', () => {
  assert.equal(sayable('. Ridin\' alongside was '), 'Ridin\' alongside was');
  assert.equal(sayable(', who had opinions. '), 'who had opinions.');
  assert.equal(sayable(' and '), 'and');
});

test('pauses follow the punctuation at the join', () => {
  assert.equal(pauseBetween('the end.', 'Next'), 0.38);
  assert.equal(pauseBetween('Dusty', ', who'), 0.16);
  assert.equal(pauseBetween('trailing...', 'x'), 0.5);
  assert.equal(pauseBetween('Our story concerns', 'Dusty'), 0.05);
});

// The crux: whatever the listener does, every recording the engine asks for is in the script.
test('every clip any broadcast can ask for is in the narrator\'s script', () => {
  const needed = new Set();
  for (let seed = 1; seed <= 1200; seed++) {
    const rng = mulberry32(seed * 31 + 7);
    const e = new StoryEngine({ seed });
    e.start(STORIES[seed % 5].id, ENVIRONMENTS[(seed >> 2) % 5].id);
    let guard = 0;
    while (!e.done && guard++ < 200) {
      const p = e.next();
      for (const seg of p.segments) {
        if (seg.kind === 'tune') continue;
        let rebuilt = '';
        for (const part of seg.parts) {
          rebuilt += seg.text.slice(part.start, part.end);
          if (!part.clip) continue;
          needed.add(part.clip);
          assert.ok(SCRIPT.has(part.clip), `seed ${seed}: ${part.clip} is not in the script ("${seg.text}")`);
          assert.ok(part.clip.startsWith(seg.storyId + '/'), `${part.clip} spoken by ${seg.storyId}`);
        }
        assert.equal(rebuilt, seg.text, 'parts cover the line exactly');
        // A recorded piece says what the caption says.
        for (const part of seg.parts) {
          const item = part.clip && SCRIPT.get(part.clip);
          if (!item) continue;
          const shown = seg.text.slice(part.start, part.end);
          assert.equal(sayable(shown).toLowerCase(), item.say.toLowerCase(), `${part.clip}`);
        }
      }
      if (rng() < 0.3) e.setEnv(ENVIRONMENTS[Math.floor(rng() * 5)].id);
      if (rng() < 0.25) { e.switchStation(STORIES[Math.floor(rng() * 5)].id); continue; }
      e.complete();
    }
  }
  // Nearly the whole script is reachable; the rest is spare takes the dice did not land on.
  assert.ok(needed.size > SCRIPT.size * 0.9, `${needed.size} of ${SCRIPT.size} clips exercised`);
});

test('a recorded take is preferred when the engine is told which takes exist', () => {
  const recorded = new Set(STORIES.map(s => s.beats.map(v => v[1])).flat());
  const e = new StoryEngine({ seed: 4, drift: false, prefer: t => recorded.has(t) });
  e.start('docks', 'docks');
  while (!e.done) {
    const p = e.next();
    const beat = p.segments.at(-1);
    const takes = STORIES.find(s => s.id === p.storyId).beats[p.beat];
    assert.ok(beat.text.length > 0);
    assert.equal(beat.parts[0].clip.split('/')[1].split('-')[0], `b${p.beat}v1`);
    assert.ok(takes.length >= 2);
    e.complete();
  }
});
