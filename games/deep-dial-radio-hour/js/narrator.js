// The narrator: the browser's own speech voices, one accent per station.
// Lines are spoken a sentence at a time (Chrome drops long utterances), each
// with a watchdog in case the engine never reports back. With no speech
// support at all, a timer reads at speaking pace so the captions still play.

const WPS = 2.6; // words per second at rate 1

export function splitSentences(text) {
  const parts = text.match(/[^.!?]+(?:\.\.\.|[.!?])+["']?\s*|[^.!?]+$/g) || [text];
  const out = [];
  let offset = 0;
  for (const raw of parts) {
    const start = text.indexOf(raw, offset);
    offset = start + raw.length;
    const s = raw.trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    // Fold very short fragments ("Yodelled.") into the one before, so the voice does not stutter.
    if (prev && s.split(/\s+/).length < 3) {
      prev.text = text.slice(prev.start, start + raw.trimEnd().length);
    } else {
      out.push({ text: s, start: start + (raw.length - raw.trimStart().length) });
    }
  }
  if (out.length > 1 && out[0].text.split(/\s+/).length < 3) {
    const [a, b] = out.splice(0, 2);
    out.unshift({ text: text.slice(a.start, b.start + b.text.length), start: a.start });
  }
  return out;
}

export function estimateSeconds(text, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return words / (WPS * rate) + 0.35;
}

const norm = l => (l || '').replace('_', '-').toLowerCase();

export function scoreVoice(voice, spec) {
  const lang = norm(voice.lang);
  let score = 0;
  let accent = false;
  spec.langs.forEach((l, i) => {
    if (lang === norm(l)) {
      score = Math.max(score, 100 - i * 15);
      // In a list of several, the last language is only a near miss (en-GB for Scottish).
      if (spec.langs.length === 1 || i < spec.langs.length - 1) accent = true;
    }
  });
  const nameIdx = spec.names.findIndex(n => voice.name.toLowerCase().includes(n.toLowerCase()));
  if (nameIdx >= 0 && score > 0) score += 40 - nameIdx * 3;
  if (nameIdx >= 0 && score === 0 && lang.startsWith('en')) { score = 70 - nameIdx; accent = true; }
  if (score === 0 && lang.startsWith('en')) score = 10;
  if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 8;
  if (/google/i.test(voice.name)) score += 3;
  if (/novelty|whisper|bells|bubbles|cellos|zarvox|trinoids|albert|bad news|good news|jester|organ|superstar|wobble|boing|hysterical/i.test(voice.name)) score -= 200;
  return { score, accent };
}

export function chooseVoice(voices, spec, avoid = new Set()) {
  let best = null;
  for (const v of voices) {
    const { score, accent } = scoreVoice(v, spec);
    // Prefer a voice no other station is using, so each accent sounds distinct.
    const s = score - (avoid.has(v.voiceURI || v.name) ? 25 : 0);
    // The penalty only ranks; a voice is never ruled out for being shared.
    if (score > 0 && (!best || s > best.s)) best = { voice: v, s, accent };
  }
  return best ? { voice: best.voice, accent: best.accent } : { voice: null, accent: false };
}

export class Narrator {
  constructor({
    synth = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    timers = globalThis,
    pace = 1, // scales caption-only timing; tests run it fast
  } = {}) {
    this.pace = pace;
    this.synth = synth && Utterance ? synth : null;
    this.Utterance = Utterance;
    this.timers = timers;
    this.volume = 1;
    this.voices = [];
    this.cast = new Map(); // story id -> { voice, accent }
    this.gen = 0;
    this.live = new Set(); // keep utterances referenced until they end
    this.ready = false;
  }

  get captionsOnly() { return !this.synth || this.voices.length === 0; }

  async init(stories, waitMs = 1500) {
    if (this.synth) {
      this.voices = this.synth.getVoices() || [];
      if (!this.voices.length) {
        await new Promise(resolve => {
          const done = () => { this.timers.clearTimeout(t); resolve(); };
          const t = this.timers.setTimeout(resolve, waitMs);
          try { this.synth.addEventListener('voiceschanged', done, { once: true }); } catch { /* old Safari */ }
        });
        this.voices = this.synth.getVoices() || [];
      }
    }
    this.assign(stories);
    this.ready = true;
    return this;
  }

  assign(stories) {
    this.cast.clear();
    const used = new Set();
    // Stations with a true accent match choose first; the rest take what is left.
    const strength = s => Math.max(0, ...this.voices.map(v => scoreVoice(v, s.voice).score));
    const order = [...stories].sort((a, b) => strength(b) - strength(a));
    for (const s of order) {
      const pick = chooseVoice(this.voices, s.voice, used);
      if (pick.voice) used.add(pick.voice.voiceURI || pick.voice.name);
      this.cast.set(s.id, pick);
    }
  }

  describe(story) {
    const c = this.cast.get(story.id);
    if (this.captionsOnly || !c || !c.voice) return { name: 'Captions only', accent: false };
    return { name: c.voice.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s+Online.*$/, ''), accent: c.accent };
  }

  // iOS only lets speech start inside a tap; call this from one.
  unlock() {
    if (!this.synth || this.unlocked) return;
    this.unlocked = true;
    try {
      const u = new this.Utterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch { /* ignore */ }
  }

  cancel() {
    this.gen++;
    if (this.synth) { try { this.synth.cancel(); } catch { /* ignore */ } }
    for (const stop of this.live) stop();
    this.live.clear();
  }

  // Speak one line. Resolves true when finished, false if cancelled.
  // `from` resumes partway through, at a sentence index.
  async speak(text, story, { onSentence, onWord, from = 0 } = {}) {
    const gen = this.gen;
    const sentences = splitSentences(text);
    for (let i = Math.min(from, sentences.length - 1); i < sentences.length; i++) {
      if (gen !== this.gen) return false;
      const s = sentences[i];
      onSentence && onSentence(i, s);
      const ok = await this.say(s, story, gen, onWord);
      if (!ok) return false;
    }
    return gen === this.gen;
  }

  say(sentence, story, gen, onWord) {
    const rate = story.voice.rate;
    const cast = this.cast.get(story.id);
    const voiced = !this.captionsOnly && cast && cast.voice;
    const expected = estimateSeconds(sentence.text, rate) * 1000 * (voiced ? 1 : this.pace);
    return new Promise(resolve => {
      let settled = false;
      let ticker = null;
      const timers = [];
      const finish = ok => {
        if (settled) return;
        settled = true;
        timers.forEach(t => this.timers.clearTimeout(t));
        if (ticker) this.timers.clearInterval(ticker);
        this.live.delete(stopper);
        resolve(ok && gen === this.gen);
      };
      const stopper = () => finish(false);
      this.live.add(stopper);

      // Reads along at speaking pace when the voice cannot report word positions.
      const fakeWords = (ms) => {
        const words = [...sentence.text.matchAll(/\S+/g)];
        let w = 0;
        const step = (ms * 0.9) / Math.max(1, words.length); // every word lands before the line ends
        ticker = this.timers.setInterval(() => {
          if (w >= words.length) { this.timers.clearInterval(ticker); ticker = null; return; }
          onWord && onWord(sentence.start + words[w].index, words[w][0].length);
          w++;
        }, step);
      };

      if (!voiced) {
        fakeWords(expected);
        timers.push(this.timers.setTimeout(() => finish(true), expected));
        return;
      }

      const u = new this.Utterance(sentence.text);
      u.voice = cast.voice;
      u.lang = cast.voice.lang;
      u.rate = rate;
      u.pitch = story.voice.pitch;
      u.volume = this.volume;
      let gotBoundary = false;
      u.onboundary = e => {
        if (e.name && e.name !== 'word') return;
        gotBoundary = true;
        if (ticker) { this.timers.clearInterval(ticker); ticker = null; }
        onWord && onWord(sentence.start + e.charIndex, e.charLength || 0);
      };
      u.onstart = () => {
        // Some voices never send boundaries; fall back to reading along.
        timers.push(this.timers.setTimeout(() => { if (!gotBoundary && !settled) fakeWords(expected * 0.85); }, 350));
      };
      u.onend = () => finish(true);
      u.onerror = e => finish(e && (e.error === 'interrupted' || e.error === 'canceled') ? false : true);
      // Watchdog: engines occasionally forget to say they finished.
      timers.push(this.timers.setTimeout(() => finish(true), expected * 2.5 + 4000));
      try {
        if (this.synth.paused) this.synth.resume();
        this.synth.speak(u);
      } catch {
        finish(true);
      }
    });
  }
}
