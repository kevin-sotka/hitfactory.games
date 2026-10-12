// The narrative engine. Pure logic, no DOM, no audio: it decides what gets
// said next. The player asks for the next program with next(), speaks it,
// then calls complete(). A station switch mid-beat means the interrupted beat
// is told again by the new station, so the ten beats always arrive in order.

import { STORIES, ENVIRONMENTS, BEATS, MIDPOINT, INTRODUCES, SPLICES, SCENE_QUIPS } from './data.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOT_RE = /\{([a-zA-Z]+)(?:\.(short))?\}/g;

export function templateSlots(text) {
  const out = [];
  for (const m of text.matchAll(SLOT_RE)) out.push(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  return out;
}

export function withArticle(phrase) {
  return (/^[aeiou]/i.test(phrase) ? 'an ' : 'a ') + phrase;
}

// Capitalise the first letter of the line and of each sentence in it.
export function tidy(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^([^a-zA-Z]*)([a-z])/, (_, p, c) => p + c.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

// Which cast slot a placeholder refers to, if any ('aThing' and 'thing' are the same slot).
export function castSlotOf(key) {
  const base = key.split('.')[0];
  if (base === 'aThing') return 'thing';
  return base in INTRODUCES ? base : null;
}

export class StoryEngine {
  constructor({ stories = STORIES, envs = ENVIRONMENTS, seed = Date.now(), drift = true } = {}) {
    this.stories = stories;
    this.envs = envs;
    this.rng = mulberry32(seed);
    this.drift = drift;
    this.reset();
  }

  story(id) { return this.stories.find(s => s.id === id); }
  env(id) { return this.envs.find(e => e.id === id); }
  pick(list) { return list[Math.floor(this.rng() * list.length)]; }

  reset() {
    this.storyId = null;
    this.envId = null;
    this.beat = 0;
    this.cast = {};
    this.history = [];
    this.manualSwitch = false;
    this.drifted = false;
    this.pendingArrival = false;
    this.pendingQuip = false;
    this.envAtLastBeat = null;
    this.playing = false;
  }

  get done() { return this.beat >= BEATS.length; }

  start(storyId, envId) {
    this.reset();
    this.storyId = storyId;
    this.envId = envId;
    this.playing = true;
    this.rollCast(Object.keys(INTRODUCES));
  }

  rollCast(slots) {
    const pools = this.story(this.storyId).cast;
    for (const slot of slots) this.cast[slot] = this.pick(pools[slot]);
  }

  introduced(slot) { return INTRODUCES[slot] < this.beat; }

  setDrift(on) { this.drift = !!on; }

  setEnv(envId) {
    if (envId === this.envId) return;
    this.envId = envId;
    if (this.playing && this.beat > 0 && !this.done) this.pendingQuip = envId !== this.envAtLastBeat;
  }

  // A listener pressed a different station button.
  switchStation(storyId) {
    if (!this.playing || storyId === this.storyId || !this.story(storyId)) return false;
    this.storyId = storyId;
    this.manualSwitch = true;
    // Nobody has met these yet, so let the new station cast them.
    this.rollCast(Object.keys(INTRODUCES).filter(s => !this.introduced(s)));
    this.pendingArrival = this.beat > 0;
    return true;
  }

  context(storyId) {
    const story = this.story(storyId);
    const vocab = this.env(this.envId).vocab;
    const { hero, side, villain, thing } = this.cast;
    return {
      hero: hero.intro, 'hero.short': hero.short,
      side: side.intro, 'side.short': side.short,
      villain: villain.intro, 'villain.short': villain.short,
      thing, aThing: withArticle(thing),
      station: story.station, title: story.title,
      ...vocab,
      pools: story.pools,
    };
  }

  render(template, storyId) {
    const ctx = this.context(storyId);
    const chosen = {};
    const text = template.replace(SLOT_RE, (whole, key, short) => {
      const k = short ? `${key}.${short}` : key;
      if (k in chosen) return chosen[k];
      let v;
      if (ctx.pools[k]) v = this.pick(ctx.pools[k]);
      else if (k in ctx) v = ctx[k];
      if (v === undefined) throw new Error(`Unknown slot ${whole} in "${template}"`);
      chosen[k] = v;
      return v;
    });
    return tidy(text);
  }

  // Templates whose cast slots have all been met by now.
  usable(templates) {
    return templates.filter(t => templateSlots(t).every(k => {
      const slot = castSlotOf(k);
      return !slot || this.introduced(slot);
    }));
  }

  bridge(storyId) {
    const story = this.story(storyId);
    const segs = [{ kind: 'arrive', storyId, text: this.render(this.pick(story.arrive), storyId) }];
    const splices = this.usable(SPLICES);
    if (splices.length) segs.push({ kind: 'splice', storyId, text: this.render(this.pick(splices), storyId) });
    return segs;
  }

  // Everything to say for the current beat, including any bridge in front of it.
  next() {
    if (!this.playing || this.done) return null;
    const segments = [];
    const from = this.storyId;

    if (this.beat === MIDPOINT && this.drift && !this.manualSwitch && !this.drifted) {
      const target = this.pick(this.stories.filter(s => s.id !== from)).id;
      segments.push({ kind: 'drift', storyId: from, text: this.render(this.pick(this.story(from).drift), from) });
      segments.push({ kind: 'tune', storyId: target, text: '' });
      this.storyId = target;
      this.drifted = true;
      this.pendingArrival = true;
    }

    if (this.pendingArrival) {
      segments.push(...this.bridge(this.storyId));
    } else if (this.pendingQuip) {
      segments.push({ kind: 'quip', storyId: this.storyId, text: this.render(this.pick(SCENE_QUIPS), this.storyId) });
    }
    this.pendingArrival = false;
    this.pendingQuip = false;

    const variants = this.story(this.storyId).beats[this.beat];
    segments.push({ kind: 'beat', storyId: this.storyId, text: this.render(this.pick(variants), this.storyId) });
    this.envAtLastBeat = this.envId;
    return { beat: this.beat, name: BEATS[this.beat], storyId: this.storyId, segments };
  }

  complete() {
    if (!this.playing || this.done) return;
    this.history.push({ beat: this.beat, storyId: this.storyId });
    this.beat += 1;
    if (this.done) this.playing = false;
  }

  stop() { this.playing = false; }
}
