import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES, ENVIRONMENTS, BEATS, MIDPOINT, INTRODUCES, SPLICES, SCENE_QUIPS } from '../js/data.js';
import { StoryEngine, templateSlots, castSlotOf, tidy, withArticle, mulberry32 } from '../js/engine.js';

const ENV_KEYS = Object.keys(ENVIRONMENTS[0].vocab);
const KNOWN = new Set([
  'hero', 'hero.short', 'side', 'side.short', 'villain', 'villain.short', 'thing', 'aThing',
  'station', 'title', 'exclaim', 'food', 'num', ...ENV_KEYS,
]);
const words = s => s.split(/\s+/).filter(Boolean).length;
const allTemplates = () => STORIES.flatMap(s => [
  ...s.beats.flat().map(t => ({ t, where: `${s.id} beat` })),
  ...s.arrive.map(t => ({ t, where: `${s.id} arrive` })),
  ...s.drift.map(t => ({ t, where: `${s.id} drift` })),
]).concat(SPLICES.map(t => ({ t, where: 'splice' })), SCENE_QUIPS.map(t => ({ t, where: 'quip' })));

test('five environments, five stations, one each', () => {
  assert.equal(ENVIRONMENTS.length, 5);
  assert.equal(STORIES.length, 5);
  assert.deepEqual(STORIES.map(s => s.id), ENVIRONMENTS.map(e => e.id));
  const freqs = STORIES.map(s => s.freq);
  assert.deepEqual([...freqs].sort((a, b) => a - b), freqs, 'stations sit on the dial in order');
  for (const f of freqs) assert.ok(f >= 530 && f <= 1700, 'AM band');
});

test('every environment has the same vocabulary and six sound elements', () => {
  for (const env of ENVIRONMENTS) {
    assert.deepEqual(Object.keys(env.vocab).sort(), [...ENV_KEYS].sort(), env.id);
    assert.equal(env.layers.length, 6, env.id);
    assert.equal(new Set(env.layers.map(l => l.id)).size, 6, `${env.id} layer ids unique`);
  }
  const all = ENVIRONMENTS.flatMap(e => e.layers.map(l => l.id));
  assert.equal(new Set(all).size, all.length, 'layer ids unique across environments');
});

test('every story has ten beats, two or more takes each, and a full cast', () => {
  for (const s of STORIES) {
    assert.equal(s.beats.length, BEATS.length, s.id);
    s.beats.forEach((b, i) => assert.ok(b.length >= 2, `${s.id} beat ${i}`));
    for (const slot of Object.keys(INTRODUCES)) assert.ok(s.cast[slot].length >= 4, `${s.id} ${slot}`);
    for (const p of ['exclaim', 'food', 'num']) assert.ok(s.pools[p].length >= 3, `${s.id} ${p}`);
    assert.ok(s.arrive.length >= 2 && s.drift.length >= 2, s.id);
    assert.ok(s.voice.langs.length && s.voice.rate > 0.5 && s.voice.pitch > 0.5, s.id);
  }
});

test('templates only use known slots', () => {
  for (const { t, where } of allTemplates()) {
    for (const k of templateSlots(t)) assert.ok(KNOWN.has(k), `${where}: unknown {${k}} in "${t}"`);
    assert.ok(!/[{}]/.test(t.replace(/\{[a-zA-Z]+(\.short)?\}/g, '')), `${where}: stray brace in "${t}"`);
  }
});

test('house style: no em or en dashes anywhere the narrator speaks', () => {
  const blob = JSON.stringify({ STORIES, ENVIRONMENTS, SPLICES, SCENE_QUIPS });
  assert.ok(!/[\u2013\u2014]/.test(blob));
});

test('cast slots are introduced on their beat and never before it', () => {
  for (const s of STORIES) {
    s.beats.forEach((variants, beat) => {
      for (const t of variants) {
        const keys = templateSlots(t);
        for (const [slot, at] of Object.entries(INTRODUCES)) {
          const full = slot === 'thing' ? 'aThing' : slot;
          const used = keys.filter(k => castSlotOf(k) === slot);
          if (beat < at) assert.equal(used.length, 0, `${s.id} beat ${beat} uses ${slot} early: "${t}"`);
          if (beat === at) assert.ok(keys.includes(full), `${s.id} beat ${beat} must introduce ${slot}: "${t}"`);
          if (beat > at) assert.ok(!keys.includes(full), `${s.id} beat ${beat} re-introduces ${slot}: "${t}"`);
        }
      }
    });
  }
  for (const t of [...SPLICES, ...SCENE_QUIPS, ...STORIES.flatMap(s => [...s.arrive, ...s.drift])]) {
    for (const k of templateSlots(t)) {
      assert.ok(!['hero', 'side', 'villain', 'aThing'].includes(k), `bridges only use short forms: "${t}"`);
    }
  }
});

test('the opening beat names the station and the title', () => {
  for (const s of STORIES) for (const t of s.beats[0]) {
    assert.ok(t.includes('{station}') && t.includes('{title}'), `${s.id}: "${t}"`);
  }
});

test('every station signs off by name in the coda', () => {
  for (const s of STORIES) for (const t of s.beats[9]) assert.ok(t.includes('{station}'), `${s.id}: "${t}"`);
});

test('stations keep the same pace: beats sit in the same word band', () => {
  const perStory = STORIES.map(s => s.beats.flat().reduce((n, t) => n + words(t), 0) / s.beats.flat().length);
  const mean = perStory.reduce((a, b) => a + b) / perStory.length;
  perStory.forEach((avg, i) => assert.ok(Math.abs(avg - mean) / mean < 0.2, `${STORIES[i].id} averages ${avg.toFixed(1)} words vs ${mean.toFixed(1)}`));
  for (const s of STORIES) for (const t of s.beats.flat()) {
    const n = words(t);
    assert.ok(n >= 14 && n <= 48, `${s.id} beat is ${n} words: "${t}"`);
  }
});

test('helpers', () => {
  assert.equal(withArticle('umbrella that rained upward'), 'an umbrella that rained upward');
  assert.equal(withArticle('jar of pickled thunder'), 'a jar of pickled thunder');
  assert.equal(tidy('the end.  then  more! yes? ok'), 'The end. Then more! Yes? Ok');
  assert.equal(tidy("'tis fine"), "'Tis fine");
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

// Exhaustive render: every template, every station's cast, every scene.
test('every line renders cleanly with every cast and every scene', () => {
  const e = new StoryEngine({ seed: 1 });
  for (const s of STORIES) for (const env of ENVIRONMENTS) {
    for (let h = 0; h < 4; h++) {
      e.start(s.id, env.id);
      e.cast = {
        hero: s.cast.hero[h], side: s.cast.side[h], villain: s.cast.villain[h], thing: s.cast.thing[h],
      };
      e.beat = BEATS.length - 1; // everybody introduced
      for (const { t, where } of allTemplates()) {
        for (let r = 0; r < 3; r++) {
          const out = e.render(t, s.id);
          assert.ok(!/[{}]|undefined|null|NaN/.test(out), `${where}: "${out}"`);
          assert.ok(/^[^a-z]/.test(out), `${where} starts lower case: "${out}"`);
          assert.ok(/[.!?]$/.test(out), `${where} must end with punctuation: "${out}"`);
          assert.ok(!/\s[,.!?]/.test(out), `${where} has a space before punctuation: "${out}"`);
          assert.ok(!/\b(a|an) (a|an|the)\b/i.test(out), `${where} doubled article: "${out}"`);
        }
      }
    }
  }
});

function playThrough(seed, { switchChance = 0, drift = true, envChance = 0 } = {}) {
  const rng = mulberry32(seed * 977 + 3);
  const e = new StoryEngine({ seed, drift });
  const start = STORIES[Math.floor(rng() * 5)].id;
  e.start(start, ENVIRONMENTS[Math.floor(rng() * 5)].id);
  const programs = [];
  let guard = 0;
  while (!e.done) {
    if (++guard > 200) throw new Error('runaway');
    const p = e.next();
    programs.push(p);
    if (envChance && rng() < envChance) e.setEnv(ENVIRONMENTS[Math.floor(rng() * 5)].id);
    if (switchChance && rng() < switchChance) {
      const others = STORIES.filter(s => s.id !== e.storyId);
      e.switchStation(others[Math.floor(rng() * others.length)].id);
      continue; // interrupted: the beat is told again by the new station
    }
    e.complete();
  }
  return { e, programs, start };
}

test('a straight play: ten beats in order, drift once at the midpoint', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { e, programs, start } = playThrough(seed);
    assert.deepEqual(e.history.map(h => h.beat), BEATS.map((_, i) => i));
    assert.equal(programs.length, 10);
    const drifts = programs.flatMap(p => p.segments).filter(s => s.kind === 'drift');
    assert.equal(drifts.length, 1);
    assert.equal(programs[MIDPOINT].segments[0].kind, 'drift');
    assert.equal(programs[MIDPOINT].segments[0].storyId, start, 'old narrator announces the drift');
    assert.equal(programs[MIDPOINT].segments[1].kind, 'tune');
    const after = programs[MIDPOINT].storyId;
    assert.notEqual(after, start);
    for (let i = 0; i < MIDPOINT; i++) assert.equal(programs[i].storyId, start);
    for (let i = MIDPOINT; i < 10; i++) assert.equal(programs[i].storyId, after);
    assert.equal(e.next(), null);
    assert.equal(e.playing, false);
  }
});

test('drift off: one station start to finish, no bridges', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { programs, start } = playThrough(seed, { drift: false });
    for (const p of programs) {
      assert.equal(p.storyId, start);
      assert.deepEqual(p.segments.map(s => s.kind), ['beat']);
    }
  }
});

test('chaotic listeners: random switches and scene changes still tell one whole story', () => {
  for (let seed = 1; seed <= 1500; seed++) {
    const { e, programs } = playThrough(seed, { switchChance: 0.35, envChance: 0.3 });
    assert.deepEqual(e.history.map(h => h.beat), BEATS.map((_, i) => i), `seed ${seed}`);
    for (const p of programs) {
      const segs = p.segments;
      assert.equal(segs.at(-1).kind, 'beat');
      for (const s of segs) {
        assert.ok(STORIES.some(x => x.id === s.storyId));
        if (s.kind !== 'tune') assert.ok(s.text.length > 0 && !/[{}]|undefined/.test(s.text), `seed ${seed}: ${s.text}`);
      }
      const kinds = segs.map(s => s.kind);
      if (kinds.includes('splice')) assert.equal(kinds[kinds.indexOf('splice') - 1], 'arrive');
      assert.ok(!(kinds.includes('quip') && kinds.includes('arrive')), 'one bridge at a time');
      // whoever tells the beat also tells the bridge in front of it
      for (const s of segs) if (['arrive', 'splice', 'quip'].includes(s.kind)) assert.equal(s.storyId, p.storyId);
    }
    const drifts = programs.flatMap(p => p.segments).filter(s => s.kind === 'drift').length;
    assert.ok(drifts <= 1);
  }
});

test('the cast carries across a switch, and the newcomer casts whoever is not on stage yet', () => {
  const e = new StoryEngine({ seed: 11 });
  e.start('prairie', 'docks');
  e.next(); e.complete(); // open
  e.next(); e.complete(); // hero and sidekick are on stage
  const { hero, side } = e.cast;
  e.switchStation('trench');
  assert.equal(e.cast.hero, hero);
  assert.equal(e.cast.side, side);
  assert.ok(STORIES[4].cast.thing.includes(e.cast.thing), 'thing recast by the new station');
  assert.ok(STORIES[4].cast.villain.includes(e.cast.villain), 'villain recast by the new station');
  const p = e.next();
  assert.deepEqual(p.segments.map(s => s.kind), ['arrive', 'splice', 'beat']);
  assert.ok(p.segments[2].text.includes(hero.short));
});

test('switching during the opening simply retunes, no bridge', () => {
  const e = new StoryEngine({ seed: 5 });
  e.start('campground', 'campground');
  e.next();
  e.switchStation('market');
  const p = e.next();
  assert.equal(p.beat, 0);
  assert.deepEqual(p.segments.map(s => s.kind), ['beat']);
  assert.ok(p.segments[0].text.includes('Station Neon 1050'));
  assert.ok(STORIES[3].cast.hero.includes(e.cast.hero));
});

test('a manual switch before halftime cancels the drift', () => {
  const e = new StoryEngine({ seed: 9 });
  e.start('docks', 'docks');
  for (let i = 0; i < 3; i++) { e.next(); e.complete(); }
  e.switchStation('prairie');
  while (!e.done) {
    const p = e.next();
    assert.ok(!p.segments.some(s => s.kind === 'drift'));
    e.complete();
  }
  assert.ok(e.history.slice(3).every(h => h.storyId === 'prairie'));
});

test('changing the scene mid story earns one quip, in the scene it changed to', () => {
  const e = new StoryEngine({ seed: 3, drift: false });
  e.start('market', 'market');
  e.next(); e.complete();
  e.next(); e.complete();
  e.setEnv('campground');
  e.setEnv('trench');
  const p = e.next();
  assert.deepEqual(p.segments.map(s => s.kind), ['quip', 'beat']);
  e.complete();
  assert.deepEqual(e.next().segments.map(s => s.kind), ['beat']);
  e.setEnv('docks'); e.setEnv('trench'); // back where we were: nothing to remark on
  assert.deepEqual(e.next().segments.map(s => s.kind), ['beat']);
});

test('same seed, same broadcast', () => {
  const a = playThrough(42, { switchChance: 0.2 });
  const b = playThrough(42, { switchChance: 0.2 });
  assert.deepEqual(a.programs, b.programs);
  const c = playThrough(43, { switchChance: 0.2 });
  assert.notDeepEqual(a.programs, c.programs);
});

test('ignores nonsense', () => {
  const e = new StoryEngine({ seed: 1 });
  assert.equal(e.next(), null, 'nothing before start');
  assert.equal(e.switchStation('trench'), false, 'nothing to switch before start');
  e.start('trench', 'trench');
  assert.equal(e.switchStation('trench'), false, 'already there');
  assert.equal(e.switchStation('nowhere'), false);
  e.complete(); e.complete();
  assert.equal(e.beat, 2);
});
