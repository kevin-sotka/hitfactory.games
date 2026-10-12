// Recorded audio: the index of what exists, and the voice bank that stitches
// recorded pieces into a spoken line. audio/index.json is written by
// tools/build-audio.mjs; when it is missing, everything falls back to the
// synthesised sounds and the device's own voices.

import { splitTemplate, TEMPLATE_KEY, pauseBetween } from './script.js';
import { STORIES } from './data.js';

export const EMPTY_INDEX = { voice: {}, sfx: {}, music: {} };

export async function loadIndex(base = 'audio/') {
  try {
    const res = await fetch(base + 'index.json', { cache: 'no-cache' });
    if (!res.ok) return { ...EMPTY_INDEX, base };
    const j = await res.json();
    return { voice: j.voice || {}, sfx: j.sfx || {}, music: j.music || {}, base };
  } catch {
    return { ...EMPTY_INDEX, base };
  }
}

// Fetches and decodes audio files once each.
export class Loader {
  constructor(base) { this.base = base; this.cache = new Map(); }
  get(ctx, path) {
    if (!this.cache.has(path)) {
      const p = fetch(this.base + path)
        .then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.arrayBuffer(); })
        .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)));
      p.catch(() => this.cache.delete(path));
      this.cache.set(path, p);
    }
    return this.cache.get(path);
  }
}

export class VoiceBank {
  constructor(index, loader, { pace = 1 } = {}) {
    this.pace = pace; // scales the pauses between pieces; tests run it fast
    this.files = index.voice || {};
    this.loader = loader;
    this.gen = 0;
    this.live = new Set();
  }

  get size() { return Object.keys(this.files).length; }
  has(clip) { return !!clip && clip in this.files; }

  // Every piece of the line is recorded.
  covers(parts) {
    return !!parts && parts.some(p => p.clip) && parts.every(p => !p.clip || this.has(p.clip));
  }

  // Every stretch of fixed wording in this take is recorded by this narrator.
  takeRecorded(template, storyId) {
    const key = TEMPLATE_KEY.get(template);
    if (!key) return false;
    const story = STORIES.find(s => s.id === storyId);
    return splitTemplate(template, story).every(p => p.type !== 'text' || this.has(`${storyId}/${key}-${p.n}`));
  }

  // How much of a narrator's script is recorded, 0 to 1.
  coverage(narrator, total) {
    const n = Object.keys(this.files).filter(k => k.startsWith(narrator + '/')).length;
    return total ? n / total : 0;
  }

  prefetch(ctx, parts) {
    return Promise.all(parts.filter(p => p.clip).map(p => this.loader.get(ctx, this.files[p.clip])));
  }

  cancel() {
    this.gen++;
    for (const stop of this.live) stop();
    this.live.clear();
  }

  // Play a line from its recorded pieces, from part `from` onward.
  // Resolves true when finished, false if cancelled.
  async speak(ctx, out, seg, { from = 0, onPart, onWord } = {}) {
    const gen = this.gen;
    let bufs;
    try { bufs = await this.prefetch(ctx, seg.parts); } catch { return 'missing'; }
    if (gen !== this.gen) return false;
    const audible = seg.parts.filter(p => p.clip);
    const byClip = new Map(audible.map((p, i) => [p, bufs[i]]));
    const text = seg.text;
    const timers = [];
    const sources = [];
    let t = ctx.currentTime + 0.06;
    const t0 = t;
    let prevText = '';
    for (let i = 0; i < seg.parts.length; i++) {
      const p = seg.parts[i];
      const piece = text.slice(p.start, p.end);
      if (i < from) { prevText = piece; continue; }
      if (!p.clip) { prevText += piece; continue; }
      if (i > from && prevText) t += pauseBetween(prevText, piece) * this.pace;
      const buf = byClip.get(p);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      src.start(t);
      sources.push(src);
      const at = (t - ctx.currentTime) * 1000;
      timers.push(setTimeout(() => onPart && onPart(i, p), Math.max(0, at)));
      // Captions: walk the words across the clip.
      const words = [...piece.matchAll(/\S+/g)];
      words.forEach((w, k) => {
        const wt = at + (buf.duration * 1000 * k) / Math.max(1, words.length);
        timers.push(setTimeout(() => onWord && onWord(p.start + w.index, w[0].length), Math.max(0, wt)));
      });
      t += buf.duration;
      prevText = piece;
    }
    const total = (t - ctx.currentTime) * 1000;
    return new Promise(resolve => {
      const stop = () => {
        timers.forEach(clearTimeout);
        sources.forEach(s => { try { s.stop(); } catch { /* not started */ } });
        resolve(false);
      };
      this.live.add(stop);
      timers.push(setTimeout(() => { this.live.delete(stop); resolve(gen === this.gen); }, Math.max(0, total) + 20));
      if (t0 > t) resolve(true);
    });
  }
}
