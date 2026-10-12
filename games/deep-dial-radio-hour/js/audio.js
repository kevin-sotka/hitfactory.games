// The soundscape: thirty sound elements, all synthesised live with Web Audio.
// No samples. Each element is a little machine that builds its own nodes and,
// on tick(until), schedules its next events up to a time on the audio clock.
// That same tick lets a test render any element offline, faster than real time.

const TAU = Math.PI * 2;

// ---------- shared building blocks ----------

const noiseCache = new WeakMap();
function noise(ctx, kind) {
  let byKind = noiseCache.get(ctx);
  if (!byKind) noiseCache.set(ctx, (byKind = {}));
  if (byKind[kind]) return byKind[kind];
  const len = Math.floor(ctx.sampleRate * 4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.5;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // Fade the seam so loops do not click.
  const fade = 2048;
  for (let i = 0; i < fade; i++) { const a = i / fade; d[i] = d[i] * a + d[len - fade + i] * (1 - a); }
  return (byKind[kind] = buf);
}

function impulse(ctx, seconds = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}

const ksCache = new WeakMap();
// Karplus-Strong plucked string, rendered once per pitch.
function pluck(ctx, freq, seconds = 2.6) {
  let byFreq = ksCache.get(ctx);
  if (!byFreq) ksCache.set(ctx, (byFreq = {}));
  const key = freq.toFixed(2);
  if (byFreq[key]) return byFreq[key];
  const sr = ctx.sampleRate;
  const n = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(n);
  for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0; i < n; i++) ring[i] = (ring[i] + ring[(i + 1) % n]) * 0.5; // soften the pick
  for (let i = 0; i < len; i++) {
    const j = i % n;
    d[i] = ring[j] * 0.45;
    ring[j] = 0.4985 * (ring[j] + ring[(j + 1) % n]);
  }
  return (byFreq[key] = buf);
}

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 1: '.----', 4: '....-', 5: '.....',
};
// Morse as [start, length] marks in units.
function morse(word) {
  const marks = [];
  let u = 0;
  for (const ch of word.toUpperCase()) {
    if (ch === ' ') { u += 4; continue; }
    for (const sym of MORSE[ch] || '') {
      const len = sym === '.' ? 1 : 3;
      marks.push([u, len]);
      u += len + 1;
    }
    u += 2;
  }
  return { marks, units: u };
}

// The toolkit each element is built with.
function makeKit(ctx, out, verb, rng, emit) {
  const k = {
    ctx, out, verb, rng, emit,
    t0: ctx.currentTime,
    kept: [],
    r: (a, b) => a + rng() * (b - a),
    chance: p => rng() < p,
    pick: list => list[Math.floor(rng() * list.length)],
    keep(node) { k.kept.push(node); return node; },
    gain(v = 1, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; },
    filter(type, freq, q = 0.7, to) {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      if (to) f.connect(to); return f;
    },
    pan(v, to) {
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (p.pan) p.pan.value = Math.max(-1, Math.min(1, v));
      if (to) p.connect(to); return p;
    },
    osc(type, freq, to) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (to) o.connect(to); return o; },
    // A looping noise bed that runs until the element is switched off.
    loop(kind, to) {
      const s = ctx.createBufferSource();
      s.buffer = noise(ctx, kind); s.loop = true;
      if (to) s.connect(to);
      s.start(k.t0, rng() * 3.5);
      return k.keep(s);
    },
    drone(type, freq, to) { const o = k.osc(type, freq, to); o.start(k.t0); return k.keep(o); },
    // Shape a gain into a one-shot envelope. Exponential tails, never zero.
    env(param, t, attack, peak, hold, release) {
      param.setValueAtTime(0.0001, t);
      param.linearRampToValueAtTime(peak, t + attack);
      param.setValueAtTime(peak, t + attack + hold);
      param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
      return t + attack + hold + release;
    },
    // A filtered noise burst.
    burst({ t, dur, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, pan = 0, kind = 'white', to = out }) {
      const s = ctx.createBufferSource();
      s.buffer = noise(ctx, kind);
      const f = k.filter(type, freq, q);
      const g = k.gain(0);
      s.connect(f); f.connect(g); g.connect(pan ? k.pan(pan, to) : to);
      const end = k.env(g.gain, t, attack, gain, 0, Math.max(0.005, dur));
      s.start(t, rng() * 3); s.stop(end + 0.05);
      return g;
    },
    // A pitched one-shot with an optional glide.
    tone({ t, freq, dur, type = 'sine', gain = 0.2, attack = 0.005, hold = 0, glide, glideTime, pan = 0, to = out, filter }) {
      const o = k.osc(type, freq);
      const g = k.gain(0);
      let head = o;
      if (filter) { const f = k.filter(filter.type || 'lowpass', filter.freq, filter.q || 0.7); o.connect(f); head = f; }
      head.connect(g); g.connect(pan ? k.pan(pan, to) : to);
      if (glide) {
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(glide, t + (glideTime || dur));
      }
      const end = k.env(g.gain, t, attack, gain, hold, dur);
      o.start(t); o.stop(end + 0.05);
      return o;
    },
    // Inharmonic struck metal.
    bell({ t, f0, partials, amps, decays, gain = 0.2, pan = 0, to = out }) {
      const p = pan ? k.pan(pan, to) : to;
      partials.forEach((ratio, i) => {
        k.tone({ t, freq: f0 * ratio, dur: decays[i], gain: gain * amps[i], attack: 0.002, to: p });
      });
    },
    // Repeatedly schedule fn(t) every gap() seconds, starting at first.
    every(first, gap, fn) {
      let next = k.t0 + first;
      return until => { while (next < until) { const t = next; next += gap(t); fn(t); } };
    },
  };
  return k;
}

// Stick-slip friction: a low sawtooth is a train of clicks, a resonant filter makes them wood or iron.
function creak(k, t, { rate = [40, 70], body = 1100, q = 6, dur = 0.8, gain = 0.3, pan = 0 }) {
  const o = k.osc('sawtooth', rate[0]);
  const hp = k.filter('highpass', body * 0.5, 0.7);
  const bp = k.filter('bandpass', body, q);
  const g = k.gain(0);
  o.connect(hp); hp.connect(bp); bp.connect(g); g.connect(pan ? k.pan(pan, k.out) : k.out);
  o.frequency.setValueAtTime(rate[0], t);
  o.frequency.linearRampToValueAtTime(rate[1], t + dur * 0.55);
  o.frequency.linearRampToValueAtTime(rate[0] * 1.1, t + dur);
  bp.frequency.setValueAtTime(body, t);
  bp.frequency.linearRampToValueAtTime(body * 1.25, t + dur);
  const end = k.env(g.gain, t, dur * 0.25, gain, dur * 0.35, dur * 0.4);
  o.start(t); o.stop(end + 0.05);
}

// ---------- the thirty elements ----------
// trim: output level, verb: reverb send, make(kit) returns { tick(until) }.

export const LAYERS = {
  // ----- Prairie -----
  wind: {
    trim: 1.05, verb: 0.15,
    make(k) {
      const bp = k.filter('bandpass', 500, 0.8);
      const g = k.gain(0.2, k.out);
      k.loop('pink', bp); bp.connect(g);
      const wbp = k.filter('bandpass', 1100, 16);
      const wg = k.gain(0.0, k.out);
      k.loop('white', wbp); wbp.connect(wg);
      return { tick: k.every(0, () => k.r(1.5, 4), t => {
        const level = k.r(0.15, 0.8);
        g.gain.setTargetAtTime(level * 0.9, t, 0.8);
        bp.frequency.setTargetAtTime(280 + level * 900, t, 1.1);
        wbp.frequency.setTargetAtTime(700 + level * 1300, t, 1.2);
        wg.gain.setTargetAtTime(level * level * 0.35, t, 1.2);
        if (level > 0.55) k.emit('gust', t, { strength: level });
      }) };
    },
  },
  train: {
    trim: 0.85, verb: 0.3,
    make(k) {
      return { tick: k.every(k.r(1.5, 3), () => k.r(22, 32), t => {
        const D = 11;
        k.emit('train', t, { dur: D });
        const env = x => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, x / D))), 2);
        const panAt = x => -0.9 + 1.8 * (x / D);
        // Whistle: an open chord that sags as it passes.
        const wl = k.filter('lowpass', 2600, 1);
        const wg = k.gain(0);
        wl.connect(wg); wg.connect(k.pan(-0.6, k.out));
        for (const f of [392, 494, 587]) {
          const o = k.osc('triangle', f, wl);
          o.frequency.setValueAtTime(f, t + 0.6);
          o.frequency.linearRampToValueAtTime(f * 0.97, t + 3.4);
          o.start(t + 0.6); o.stop(t + 3.6);
        }
        wg.gain.setValueAtTime(0.0001, t + 0.6);
        wg.gain.linearRampToValueAtTime(0.16, t + 0.8);
        wg.gain.setValueAtTime(0.16, t + 1.8);
        wg.gain.linearRampToValueAtTime(0.0001, t + 2.0);
        wg.gain.linearRampToValueAtTime(0.14, t + 2.2);
        wg.gain.setValueAtTime(0.14, t + 2.9);
        wg.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        // Chuffs and rail joints.
        for (let x = 0, i = 0; x < D; x += 0.3, i++) {
          const a = env(x);
          if (a < 0.02) continue;
          k.burst({ t: t + x, dur: 0.12, freq: i % 2 ? 700 : 900, q: 1.2, gain: 0.32 * a, attack: 0.01, pan: panAt(x) });
        }
        for (let x = 0.4; x < D; x += 0.92) {
          const a = env(x);
          for (const off of [0, 0.13]) k.burst({ t: t + x + off, dur: 0.03, freq: 2600, q: 5, gain: 0.35 * a, pan: panAt(x) });
        }
        // Rumble.
        const lp = k.filter('lowpass', 140, 0.7);
        const rg = k.gain(0);
        lp.connect(rg); rg.connect(k.out);
        const s = k.ctx.createBufferSource(); s.buffer = noise(k.ctx, 'brown'); s.connect(lp);
        for (let x = 0; x <= D; x += 0.5) rg.gain.linearRampToValueAtTime(0.0001 + 0.5 * env(x), t + x);
        s.start(t); s.stop(t + D + 0.1);
      }) };
    },
  },
  windmill: {
    trim: 2.5, verb: 0.2,
    make(k) {
      let n = 0;
      return { tick: k.every(0.6, () => k.r(3.2, 5.5), t => {
        creak(k, t, { rate: [42, 68], body: 1150, q: 7, dur: k.r(0.6, 1.0), gain: 0.32, pan: 0.35 });
        k.emit('creak', t);
        if (n++ % 2 === 0) {
          k.tone({ t: t + 0.9, freq: 170, dur: 0.25, type: 'triangle', gain: 0.18, pan: 0.35 });
          k.burst({ t: t + 0.9, dur: 0.08, freq: 900, q: 2, gain: 0.12, pan: 0.35 });
        }
      }) };
    },
  },
  telegraph: {
    trim: 1.6, verb: 0.12,
    make(k) {
      const words = ['HOWDY', 'SEND BEANS', 'SOS', 'GO WEST', 'HI MOM', 'TRAIN LATE', 'YEEHAW'];
      return { tick: k.every(0.8, () => k.r(7, 11), t => {
        const { marks, units } = morse(k.pick(words));
        const unit = 0.075;
        for (const [u, len] of marks) {
          const on = t + u * unit, off = on + len * unit;
          k.burst({ t: on, dur: 0.014, freq: 2600, q: 1.2, gain: 1.35, pan: 0.5 });
          k.tone({ t: on, freq: 1900, dur: 0.02, type: 'triangle', gain: 0.25, pan: 0.5 });
          k.burst({ t: off, dur: 0.02, freq: 1400, q: 1.5, gain: 0.9, pan: 0.5 });
          k.emit('tap', on, { dur: len * unit });
        }
        k.emit('telegraph', t, { dur: units * unit });
      }) };
    },
  },
  coyote: {
    trim: 0.36, verb: 0.75,
    make(k) {
      return { tick: k.every(k.r(2, 4), () => k.r(13, 22), t => {
        const side = k.chance(0.5) ? -0.6 : 0.6;
        const bp = k.filter('bandpass', 900, 1.2);
        const g = k.gain(0);
        bp.connect(g); g.connect(k.pan(side, k.out));
        const vib = k.osc('sine', 6); const vg = k.gain(14); vib.connect(vg);
        for (const [type, mul] of [['sine', 1], ['triangle', 1.004]]) {
          const o = k.osc(type, 450 * mul, bp);
          vg.connect(o.frequency);
          o.frequency.setValueAtTime(450 * mul, t);
          o.frequency.exponentialRampToValueAtTime(840 * mul, t + 0.5);
          o.frequency.linearRampToValueAtTime(780 * mul, t + 1.3);
          o.frequency.linearRampToValueAtTime(640 * mul, t + 2.1);
          o.frequency.exponentialRampToValueAtTime(380 * mul, t + 2.6);
          o.start(t); o.stop(t + 2.8);
        }
        vib.start(t); vib.stop(t + 2.8);
        k.env(g.gain, t, 0.35, 0.3, 1.6, 0.7);
        k.emit('howl', t, { dur: 2.6 });
        if (k.chance(0.6)) {
          for (let i = 0; i < 3; i++) {
            const y = t + 2.9 + i * k.r(0.18, 0.28);
            k.tone({ t: y, freq: 700, glide: 1050, glideTime: 0.12, dur: 0.12, type: 'triangle', gain: 0.12, pan: -side, filter: { freq: 1800 } });
          }
        }
      }) };
    },
  },
  cicadas: {
    trim: 1.1, verb: 0.1,
    make(k) {
      const outs = [];
      for (const [freq, rate, side] of [[4900, 27, -0.5], [6300, 33, 0.5]]) {
        const bp = k.filter('bandpass', freq, 4);
        const am = k.gain(0.5);
        const depth = k.gain(0.5); depth.connect(am.gain);
        k.drone('square', rate, depth);
        const g = k.gain(0.3);
        k.loop('white', bp); bp.connect(am); am.connect(g); g.connect(k.pan(side, k.out));
        outs.push(g);
      }
      return { tick: k.every(0, () => k.r(3, 7), t => {
        for (const g of outs) g.gain.setTargetAtTime(k.r(0.05, 0.6), t, 1.5);
      }) };
    },
  },

  // ----- Campground -----
  crickets: {
    trim: 0.7, verb: 0.2,
    make(k) {
      const bugs = [[4400, 0.62, -0.6], [4750, 0.81, 0.15], [5150, 0.7, 0.65]].map(([f, period, side]) => {
        const g = k.gain(0);
        k.drone('sine', f, g);
        g.connect(k.pan(side, k.out));
        return { g, period, next: k.t0 + k.r(0, 1), rest: 0 };
      });
      return { tick(until) {
        for (const b of bugs) {
          while (b.next < until) {
            const t = b.next;
            if (b.rest <= 0 && k.chance(0.04)) b.rest = Math.floor(k.r(3, 8));
            if (b.rest > 0) { b.rest--; } else {
              for (let p = 0; p < 3; p++) {
                const s = t + p * 0.034;
                b.g.gain.setValueAtTime(0, s);
                b.g.gain.linearRampToValueAtTime(0.16, s + 0.006);
                b.g.gain.setValueAtTime(0.16, s + 0.016);
                b.g.gain.linearRampToValueAtTime(0, s + 0.022);
              }
            }
            b.next += b.period * k.r(0.94, 1.06);
          }
        }
      } };
    },
  },
  campfire: {
    trim: 0.85, verb: 0.08,
    make(k) {
      const lp = k.filter('lowpass', 520, 0.7);
      const bed = k.gain(0.3, k.out);
      k.loop('brown', lp); lp.connect(bed);
      const hp = k.filter('highpass', 3200, 0.7);
      const hiss = k.gain(0.04, k.out);
      k.loop('white', hp); hp.connect(hiss);
      let next = k.t0;
      const flicker = k.every(0, () => k.r(0.15, 0.5), t => {
        bed.gain.setTargetAtTime(k.r(0.18, 0.42), t, 0.12);
        hiss.gain.setTargetAtTime(k.r(0.015, 0.05), t, 0.1);
      });
      return { tick(until) {
        flicker(until);
        while (next < until) {
          const t = next;
          next += -Math.log(1 - k.rng()) * 0.085;
          if (k.chance(0.06)) {
            k.burst({ t, dur: 0.035, freq: k.r(700, 1200), q: 1, gain: 0.7, pan: k.r(-0.3, 0.3) });
            k.emit('pop', t);
          } else {
            k.burst({ t, dur: k.r(0.004, 0.018), freq: k.r(1500, 6000), q: k.r(0.8, 2), gain: k.r(0.06, 0.4), pan: k.r(-0.4, 0.4) });
          }
        }
      } };
    },
  },
  creek: {
    trim: 0.8, verb: 0.2,
    make(k) {
      const lp = k.filter('lowpass', 600, 0.8);
      const g = k.gain(0.18, k.out);
      k.loop('pink', lp); lp.connect(g);
      let next = k.t0;
      const lap = k.every(0.2, () => k.r(1.6, 2.6), t => {
        g.gain.setTargetAtTime(0.32, t, 0.25);
        g.gain.setTargetAtTime(0.12, t + 0.7, 0.5);
        lp.frequency.setTargetAtTime(950, t, 0.25);
        lp.frequency.setTargetAtTime(480, t + 0.7, 0.5);
        k.emit('lap', t);
      });
      return { tick(until) {
        lap(until);
        while (next < until) {
          const t = next;
          next += -Math.log(1 - k.rng()) * 0.14;
          const f = k.r(500, 1300);
          k.tone({ t, freq: f, glide: f * k.r(1.4, 1.9), dur: k.r(0.03, 0.07), gain: k.r(0.04, 0.12), pan: k.r(-0.7, 0.7) });
        }
      } };
    },
  },
  owl: {
    trim: 0.5, verb: 0.6,
    make(k) {
      return { tick: k.every(k.r(1.5, 3), () => k.r(10, 16), t => {
        const notes = [[0, 0.32], [0.62, 0.16], [0.86, 0.16], [1.32, 0.7]];
        const pan = -0.55;
        for (const [at, len] of notes) {
          k.tone({ t: t + at, freq: 372, glide: 352, dur: len * 0.5, hold: len * 0.5, attack: 0.06, gain: 0.32, pan });
          k.burst({ t: t + at, dur: len, freq: 420, q: 2, gain: 0.05, attack: 0.05, pan, kind: 'pink' });
        }
        k.emit('hoot', t, { dur: 2.1 });
      }) };
    },
  },
  guitar: {
    trim: 0.9, verb: 0.35,
    make(k) {
      const chords = {
        G: [98, 123.47, 146.83, 196, 246.94, 392],
        Em: [82.41, 123.47, 164.81, 196, 246.94, 329.63],
        C: [130.81, 164.81, 196, 261.63, 329.63],
        D: [146.83, 220, 293.66, 369.99],
      };
      const prog = ['G', 'G', 'Em', 'Em', 'C', 'C', 'D', 'D'];
      for (const c of Object.values(chords)) for (const f of c) pluck(k.ctx, f);
      const lp = k.filter('lowpass', 3400, 0.7);
      lp.connect(k.pan(0.25, k.out));
      const play = (t, freqs, gain, gap) => {
        freqs.forEach((f, i) => {
          const s = k.ctx.createBufferSource();
          s.buffer = pluck(k.ctx, f);
          const g = k.gain(gain);
          s.connect(g); g.connect(lp);
          s.start(t + i * gap);
        });
        k.emit('strum', t);
      };
      let bar = 0;
      const beat = 0.62;
      return { tick: k.every(0.3, () => beat * 4, t => {
        const freqs = chords[prog[bar++ % prog.length]];
        play(t, freqs, 0.5, 0.028);
        play(t + beat * 1.5, freqs.slice(-3).reverse(), 0.28, 0.02);
        play(t + beat * 2, freqs.slice(-4).reverse(), 0.3, 0.02);
        play(t + beat * 3, freqs, 0.38, 0.026);
      }) };
    },
  },
  frogs: {
    trim: 2.5, verb: 0.3,
    make(k) {
      const frogs = [[190, -0.7], [240, 0.4], [215, 0.8]].map(([f, side]) => ({ f, side, next: k.t0 + k.r(0.3, 3) }));
      const croak = (t, f, len, side) => {
        const o = k.osc('sawtooth', f);
        const bp = k.filter('bandpass', f * 4, 3);
        const g = k.gain(0);
        o.connect(bp); bp.connect(g); g.connect(k.pan(side, k.out));
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.12, t + len);
        const pulses = Math.round(len / 0.022);
        for (let p = 0; p < pulses; p++) {
          const s = t + p * 0.022;
          g.gain.setValueAtTime(0, s);
          g.gain.linearRampToValueAtTime(0.35, s + 0.004);
          g.gain.linearRampToValueAtTime(0, s + 0.014);
        }
        o.start(t); o.stop(t + len + 0.05);
      };
      return { tick(until) {
        for (const fr of frogs) {
          while (fr.next < until) {
            const t = fr.next;
            croak(t, fr.f, 0.13, fr.side);
            croak(t + 0.2, fr.f * 1.25, 0.09, fr.side);
            k.emit('ribbit', t, { side: fr.side });
            fr.next += k.r(2.4, 6);
          }
        }
      } };
    },
  },

  // ----- Docks -----
  waves: {
    trim: 0.9, verb: 0.15,
    make(k) {
      const voices = [-0.5, 0.5].map(side => {
        const lp = k.filter('lowpass', 400, 0.6);
        const g = k.gain(0.08);
        k.loop('pink', lp); lp.connect(g); g.connect(k.pan(side, k.out));
        const hp = k.filter('highpass', 2400, 0.7);
        const foam = k.gain(0.01);
        k.loop('white', hp); hp.connect(foam); foam.connect(k.pan(side, k.out));
        return { lp, g, foam, next: k.t0 + (side < 0 ? 0 : 3.2) };
      });
      return { tick(until) {
        for (const v of voices) {
          while (v.next < until) {
            const t = v.next;
            const size = k.r(0.6, 1);
            v.g.gain.setTargetAtTime(0.55 * size, t, 0.9);
            v.lp.frequency.setTargetAtTime(2300 * size, t, 0.9);
            v.foam.gain.setTargetAtTime(0.12 * size, t + 1.9, 0.15);
            v.g.gain.setTargetAtTime(0.1, t + 2.4, 1.1);
            v.lp.frequency.setTargetAtTime(450, t + 2.4, 1.2);
            v.foam.gain.setTargetAtTime(0.01, t + 2.6, 0.9);
            k.emit('wave', t + 2.2, { size });
            v.next += k.r(5.5, 8.5);
          }
        }
      } };
    },
  },
  gulls: {
    trim: 0.75, verb: 0.35,
    make(k) {
      return { tick: k.every(k.r(0.5, 2), () => k.r(3.5, 8), t => {
        const side = k.r(-0.8, 0.8);
        const f0 = k.r(1500, 2100);
        let at = t;
        const calls = 1 + Math.floor(k.r(0, 4));
        for (let i = 0; i < calls; i++) {
          const len = k.r(0.22, 0.38);
          const o = k.osc('sawtooth', f0);
          const a = k.filter('bandpass', 1900, 3), b = k.filter('bandpass', 3300, 4);
          const g = k.gain(0);
          o.connect(a); o.connect(b); a.connect(g); b.connect(g); g.connect(k.pan(side, k.out));
          o.frequency.setValueAtTime(f0 * 1.1, at);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.62, at + len);
          k.env(g.gain, at, 0.02, 0.28, len * 0.4, len * 0.6);
          o.start(at); o.stop(at + len + 0.1);
          at += len + k.r(0.06, 0.18);
        }
        k.emit('gull', t, { side });
      }) };
    },
  },
  foghorn: {
    trim: 0.3, verb: 0.7,
    make(k) {
      return { tick: k.every(k.r(2, 4), () => k.r(22, 34), t => {
        const lp = k.filter('lowpass', 650, 2.5);
        const g = k.gain(0);
        lp.connect(g); g.connect(k.pan(0.45, k.out));
        for (const [type, f] of [['sawtooth', 92.5], ['sawtooth', 93.6], ['square', 185]]) {
          const o = k.osc(type, f, lp);
          o.frequency.setValueAtTime(f, t + 2.4);
          o.frequency.exponentialRampToValueAtTime(f * 0.78, t + 3.4);
          o.start(t); o.stop(t + 3.8);
        }
        k.env(g.gain, t, 0.3, 0.42, 2.3, 1.1);
        k.emit('horn', t, { dur: 3.6 });
      }) };
    },
  },
  buoy: {
    trim: 0.8, verb: 0.55,
    make(k) {
      const ring = t => k.bell({
        t, f0: 520, gain: 0.16, pan: -0.3,
        partials: [0.56, 1, 1.19, 1.71, 2.0, 2.74, 3.0],
        amps: [0.5, 1, 0.6, 0.4, 0.3, 0.25, 0.2],
        decays: [4, 3.2, 2.5, 2, 1.6, 1.2, 1],
      });
      return { tick: k.every(k.r(0.5, 2), () => k.r(3.5, 8), t => {
        ring(t);
        k.emit('bell', t);
        if (k.chance(0.35)) { ring(t + 0.55); k.emit('bell', t + 0.55); }
      }) };
    },
  },
  rigging: {
    trim: 1.6, verb: 0.3,
    make(k) {
      return { tick: k.every(k.r(0.3, 1.5), () => k.r(1.5, 4.5), t => {
        const n = 1 + Math.floor(k.r(0, 4));
        const side = k.r(-0.8, 0.8);
        for (let i = 0, at = t; i < n; i++, at += k.r(0.08, 0.3)) {
          const f = k.r(2300, 3500);
          k.tone({ t: at, freq: f, dur: k.r(0.15, 0.4), gain: 0.12, pan: side });
          k.tone({ t: at, freq: f * 2.76, dur: 0.12, gain: 0.05, pan: side });
          k.burst({ t: at, dur: 0.01, freq: 5000, type: 'highpass', gain: 0.08, pan: side });
        }
        if (k.chance(0.3)) k.tone({ t: t + 0.4, freq: 620, dur: 0.2, type: 'triangle', gain: 0.1, pan: -side });
        k.emit('clink', t);
      }) };
    },
  },
  pier: {
    trim: 2.0, verb: 0.25,
    make(k) {
      return { tick: k.every(k.r(1, 3), () => k.r(4, 8.5), t => {
        creak(k, t, { rate: [24, 42], body: 460, q: 6, dur: k.r(0.9, 1.6), gain: 0.42, pan: k.r(-0.5, 0.5) });
        if (k.chance(0.4)) {
          k.tone({ t: t + 1.7, freq: 140, dur: 0.14, type: 'triangle', gain: 0.25 });
          k.burst({ t: t + 1.7, dur: 0.06, freq: 400, type: 'lowpass', gain: 0.2 });
        }
        k.emit('creak', t);
      }) };
    },
  },

  // ----- Neon Night Market -----
  rain: {
    trim: 0.65, verb: 0.1,
    make(k) {
      const hp = k.filter('highpass', 900, 0.7);
      const lp = k.filter('lowpass', 7000, 0.7);
      const g = k.gain(0.3, k.out);
      k.loop('white', hp); hp.connect(lp); lp.connect(g);
      const lp2 = k.filter('lowpass', 1100, 0.7);
      const drum = k.gain(0.2, k.out);
      k.loop('pink', lp2); lp2.connect(drum);
      let next = k.t0;
      return { tick(until) {
        while (next < until) {
          const t = next;
          next += -Math.log(1 - k.rng()) * 0.045;
          const f = k.r(2000, 5000);
          k.tone({ t, freq: f, glide: f * 0.7, dur: k.r(0.012, 0.03), gain: k.r(0.02, 0.08), pan: k.r(-0.9, 0.9) });
        }
      } };
    },
  },
  neon: {
    trim: 0.8, verb: 0.05,
    make(k) {
      const lp = k.filter('lowpass', 1100, 1);
      k.drone('sawtooth', 60, lp);
      const hum = k.gain(0.1, k.out); lp.connect(hum);
      k.drone('sine', 120, k.gain(0.06, k.out));
      const bp = k.filter('bandpass', 2400, 4);
      k.drone('square', 120, bp);
      const buzz = k.gain(0, k.out); bp.connect(buzz);
      return { tick: k.every(k.r(0.5, 2), () => k.r(2, 6), t => {
        let at = t;
        const n = 2 + Math.floor(k.r(0, 4));
        for (let i = 0; i < n; i++) {
          const on = k.r(0.04, 0.12);
          buzz.gain.setValueAtTime(0.16, at);
          buzz.gain.setValueAtTime(0, at + on);
          at += on + k.r(0.03, 0.12);
        }
        k.emit('flicker', t, { dur: at - t });
      }) };
    },
  },
  wok: {
    trim: 1.1, verb: 0.2,
    make(k) {
      return { tick: k.every(k.r(0.5, 2), () => k.r(4, 8.5), t => {
        const side = k.r(-0.6, 0.6);
        k.bell({ t, f0: 310, gain: 0.1, pan: side, partials: [1, 2.39, 3.9, 6.1], amps: [1, 0.7, 0.5, 0.3], decays: [0.6, 0.5, 0.4, 0.3] });
        const dur = k.r(1.8, 3);
        const s = k.ctx.createBufferSource(); s.buffer = noise(k.ctx, 'white');
        const hp = k.filter('highpass', 3500, 0.7);
        const g = k.gain(0);
        s.connect(hp); hp.connect(g); g.connect(k.pan(side, k.out));
        g.gain.setValueAtTime(0.0001, t + 0.05);
        g.gain.linearRampToValueAtTime(0.42, t + 0.15);
        for (let x = 0.2; x < dur; x += 0.035) g.gain.linearRampToValueAtTime(0.42 * (1 - x / dur) * k.r(0.5, 1) + 0.0001, t + x);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
        s.start(t, k.r(0, 3)); s.stop(t + dur + 0.3);
        k.emit('sizzle', t, { dur, side });
      }) };
    },
  },
  scooter: {
    trim: 0.75, verb: 0.2,
    make(k) {
      return { tick: k.every(k.r(1, 3), () => k.r(7, 12), t => {
        const dur = k.r(2.2, 3.2), dir = k.chance(0.5) ? 1 : -1, f = k.r(380, 520), mid = t + dur / 2;
        const p = k.pan(-dir);
        p.pan && (p.pan.setValueAtTime(-dir * 0.95, t), p.pan.linearRampToValueAtTime(dir * 0.95, t + dur));
        p.connect(k.out);
        const lp = k.filter('lowpass', 2200, 1);
        const g = k.gain(0);
        lp.connect(g); g.connect(p);
        for (const [type, mul, lvl] of [['sawtooth', 1, 1], ['sine', 1.5, 0.8]]) {
          const o = k.osc(type, f * mul);
          const og = k.gain(lvl); o.connect(og); og.connect(lp);
          o.frequency.setValueAtTime(f * mul * 1.07, t);
          o.frequency.setTargetAtTime(f * mul * 0.93, mid, 0.12);
          o.start(t); o.stop(t + dur + 0.1);
        }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, mid);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const wb = k.burst({ t, dur, freq: 900, q: 0.8, gain: 0.0001, attack: 0.001, to: p });
        wb.gain.cancelScheduledValues(t);
        wb.gain.setValueAtTime(0.0001, t);
        wb.gain.exponentialRampToValueAtTime(0.25, mid);
        wb.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        k.emit('scooter', t, { dur, dir });
      }) };
    },
  },
  crowd: {
    trim: 3.0, verb: 0.25,
    make(k) {
      const lp = k.filter('lowpass', 3000, 0.7);
      lp.connect(k.out);
      const voices = [-0.7, -0.25, 0.2, 0.65].map(side => {
        const bp = k.filter('bandpass', 800, 4);
        const g = k.gain(0.05);
        k.loop('pink', bp); bp.connect(g); g.connect(k.pan(side, lp));
        return { bp, g, next: k.t0 };
      });
      return { tick(until) {
        for (const v of voices) {
          while (v.next < until) {
            const t = v.next;
            v.bp.frequency.setTargetAtTime(k.r(350, 1900), t, 0.05);
            v.g.gain.setTargetAtTime(k.chance(0.2) ? 0.01 : k.r(0.06, 0.24), t, 0.04);
            v.next += k.r(0.11, 0.3);
          }
        }
      } };
    },
  },
  busker: {
    trim: 1.05, verb: 0.3,
    make(k) {
      const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
      const bass = [110, 87.31, 130.81, 98];
      const delay = k.ctx.createDelay(1);
      delay.delayTime.value = 0.45;
      const fb = k.gain(0.35);
      const dlp = k.filter('lowpass', 2000, 0.7);
      delay.connect(dlp); dlp.connect(fb); fb.connect(delay);
      const bus = k.gain(1, k.out);
      delay.connect(bus);
      const lead = k.gain(1); lead.connect(bus); lead.connect(delay);
      const phrase = () => Array.from({ length: 16 }, (_, i) => (i % 4 === 0 || k.chance(0.65) ? Math.floor(k.r(0, scale.length)) : -1));
      let notes = phrase();
      let step = 0;
      const eighth = 0.3;
      return { tick: k.every(0.2, () => eighth, t => {
        const i = step % 16;
        if (i === 0 && step % 32 === 0) notes = notes.map(n => (k.chance(0.25) ? Math.floor(k.r(0, scale.length)) : n));
        if (i % 8 === 0) {
          k.tone({ t, freq: bass[Math.floor(step / 8) % 4], dur: 0.5, type: 'triangle', gain: 0.22, attack: 0.01, to: bus });
        }
        const n = notes[i];
        if (n >= 0) {
          k.tone({ t, freq: scale[n], dur: 0.22, type: 'square', gain: 0.07, attack: 0.004, to: lead, filter: { freq: 1700, q: 2 } });
          k.emit('note', t, { n });
        }
        step++;
      }) };
    },
  },

  // ----- Abyssal Trench -----
  sonar: {
    trim: 0.8, verb: 0.6,
    make(k) {
      const delay = k.ctx.createDelay(2);
      delay.delayTime.value = 0.9;
      const fb = k.gain(0.42);
      const lp = k.filter('lowpass', 1800, 0.7);
      delay.connect(lp); lp.connect(fb); fb.connect(delay);
      const wet = k.gain(0.7, k.out); delay.connect(wet);
      const dry = k.gain(1, k.out); dry.connect(delay);
      return { tick: k.every(k.r(0.4, 1.2), () => k.r(5, 7.5), t => {
        k.tone({ t, freq: 1180, dur: 0.7, gain: 0.3, attack: 0.004, to: dry });
        k.tone({ t, freq: 2360, dur: 0.3, gain: 0.06, attack: 0.004, to: dry });
        k.emit('ping', t);
      }) };
    },
  },
  hull: {
    trim: 0.95, verb: 0.45,
    make(k) {
      return { tick: k.every(k.r(1.5, 3.5), () => k.r(9, 15), t => {
        const dur = k.r(2.5, 4.5);
        const f = k.r(38, 55);
        const bp = k.filter('bandpass', 220, 9);
        const g = k.gain(0);
        bp.connect(g); g.connect(k.out);
        for (const mul of [1, 1.013]) {
          const o = k.osc('sawtooth', f * mul, bp);
          o.frequency.setValueAtTime(f * mul, t);
          o.frequency.linearRampToValueAtTime(f * mul * 1.4, t + dur * 0.5);
          o.frequency.linearRampToValueAtTime(f * mul * 0.9, t + dur);
          o.start(t); o.stop(t + dur + 0.2);
        }
        bp.frequency.setValueAtTime(220, t);
        bp.frequency.linearRampToValueAtTime(520, t + dur * 0.5);
        bp.frequency.linearRampToValueAtTime(300, t + dur);
        k.env(g.gain, t, dur * 0.3, 0.9, dur * 0.3, dur * 0.4);
        for (let i = 0; i < 3; i++) k.burst({ t: t + dur * 0.8 + i * k.r(0.15, 0.4), dur: 0.25, freq: k.r(2600, 3600), q: 12, gain: 0.25, pan: k.r(-0.7, 0.7) });
        k.emit('groan', t, { dur });
      }) };
    },
  },
  whale: {
    trim: 0.48, verb: 0.9,
    make(k) {
      return { tick: k.every(k.r(1, 3), () => k.r(15, 23), t => {
        let at = t;
        const notes = 2 + Math.floor(k.r(0, 3));
        const side = k.r(-0.6, 0.6);
        for (let i = 0; i < notes; i++) {
          const len = k.r(1.2, 2.4);
          const f = k.r(180, 480);
          const to = f * (k.chance(0.5) ? k.r(1.2, 1.5) : k.r(0.65, 0.85));
          const lp = k.filter('lowpass', 1200, 0.7);
          const g = k.gain(0);
          lp.connect(g); g.connect(k.pan(side, k.out));
          const vib = k.osc('sine', 4); const vg = k.gain(6); vib.connect(vg);
          for (const [type, mul, lvl] of [['sine', 1, 1], ['triangle', 0.5, 0.35]]) {
            const o = k.osc(type, f * mul);
            const og = k.gain(lvl); o.connect(og); og.connect(lp);
            vg.connect(o.frequency);
            o.frequency.setValueAtTime(f * mul, at);
            o.frequency.exponentialRampToValueAtTime(to * mul, at + len);
            o.start(at); o.stop(at + len + 0.7);
          }
          vib.start(at); vib.stop(at + len + 0.7);
          k.env(g.gain, at, 0.4, 0.3, len - 0.4, 0.6);
          at += len + k.r(0.3, 0.9);
        }
        k.emit('whale', t, { dur: at - t });
      }) };
    },
  },
  bubbles: {
    trim: 1.6, verb: 0.35,
    make(k) {
      return { tick: k.every(k.r(0.2, 1), () => k.r(2, 5), t => {
        const n = 5 + Math.floor(k.r(0, 10));
        for (let i = 0; i < n; i++) {
          const f = k.r(350, 1200);
          k.tone({ t: t + k.r(0, 0.8), freq: f, glide: f * 2.2, dur: k.r(0.04, 0.09), gain: k.r(0.06, 0.18), pan: k.r(-0.8, 0.8) });
        }
        k.emit('bubbles', t, { count: n });
      }) };
    },
  },
  current: {
    trim: 0.38, verb: 0.2,
    make(k) {
      const lp = k.filter('lowpass', 160, 0.7);
      const g = k.gain(0.5, k.out);
      k.loop('brown', lp); lp.connect(g);
      k.drone('sine', 38, k.gain(0.12, k.out));
      const bp = k.filter('bandpass', 300, 0.5);
      const swirl = k.gain(0.06, k.out);
      k.loop('pink', bp); bp.connect(swirl);
      return { tick: k.every(0, () => k.r(3, 6), t => {
        g.gain.setTargetAtTime(k.r(0.3, 0.7), t, 1.5);
        bp.frequency.setTargetAtTime(k.r(200, 500), t, 2);
      }) };
    },
  },
  ghost: {
    trim: 0.85, verb: 0.5,
    make(k) {
      return { tick: k.every(k.r(1.5, 4), () => k.r(9, 15), t => {
        const dur = 2.6;
        const o = k.osc('sine', 2400);
        const g = k.gain(0);
        o.connect(g); g.connect(k.pan(-0.4, k.out));
        o.frequency.setValueAtTime(2400, t);
        o.frequency.exponentialRampToValueAtTime(800, t + dur * 0.5);
        o.frequency.exponentialRampToValueAtTime(1500, t + dur);
        k.env(g.gain, t, 0.3, 0.07, dur - 0.6, 0.3);
        o.start(t); o.stop(t + dur + 0.1);
        k.burst({ t, dur, freq: 1800, q: 0.7, gain: 0.06, attack: 0.3, pan: -0.4 });
        const { marks } = morse(k.pick(['SOS', 'TEA', 'HI', 'NESSIE']));
        for (const [u, len] of marks) {
          k.tone({ t: t + 0.4 + u * 0.07, freq: 700, dur: 0.01, hold: len * 0.07, gain: 0.07, attack: 0.004, pan: 0.3 });
        }
        k.emit('ghost', t, { dur });
      }) };
    },
  },
};

// ---------- the mixer ----------

export class Soundscape {
  constructor(AC = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.AC = AC;
    this.ctx = null;
    this.layers = new Map(); // id -> runtime
    this.events = [];
    this.ambienceLevel = 0.8;
    this.ducked = false;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Must be called from a user gesture the first time.
  ensure() {
    if (!this.AC) return null;
    if (!this.ctx) {
      const ctx = (this.ctx = new this.AC({ latencyHint: 'playback' }));
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      this.comp.connect(this.master); this.master.connect(ctx.destination);
      this.ambience = ctx.createGain(); this.ambience.gain.value = this.ambienceLevel; this.ambience.connect(this.comp);
      this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx);
      const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
      this.verb.connect(verbOut); verbOut.connect(this.ambience);
      this.radio = ctx.createGain(); this.radio.gain.value = 0.6; this.radio.connect(this.comp);
      this.ui = ctx.createGain(); this.ui.gain.value = 0.5; this.ui.connect(this.comp);
      this.uiKit = makeKit(ctx, this.ui, null, Math.random, () => {});
      this.timer = setInterval(() => this.tick(), 60);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tick() {
    if (!this.ready) return;
    // Background tabs only tick once a second, so look further ahead there.
    const hidden = typeof document !== 'undefined' && document.hidden;
    const until = this.ctx.currentTime + (hidden ? 1.6 : 0.35);
    for (const rt of this.layers.values()) {
      try { rt.inst.tick && rt.inst.tick(until); } catch (e) { console.error(rt.id, e); }
    }
  }

  setLayer(id, on) {
    if (!this.ctx) return;
    const existing = this.layers.get(id);
    if (on && existing) return;
    if (!on) {
      if (!existing) return;
      this.layers.delete(id);
      const t = this.ctx.currentTime;
      existing.g.gain.cancelScheduledValues(t);
      existing.g.gain.setValueAtTime(existing.g.gain.value, t);
      existing.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      this.events = this.events.filter(e => e.layer !== id);
      setTimeout(() => {
        for (const n of existing.kit.kept) { try { n.stop(); } catch { /* already stopped */ } }
        existing.g.disconnect();
      }, 4000);
      return;
    }
    const def = LAYERS[id];
    if (!def) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    g.connect(analyser); analyser.connect(this.ambience);
    const send = ctx.createGain(); send.gain.value = def.verb; g.connect(send); send.connect(this.verb);
    const pre = ctx.createGain(); pre.connect(g);
    const kit = makeKit(ctx, pre, this.verb, Math.random, (type, at, data) => this.events.push({ layer: id, type, at, data }));
    const inst = def.make(kit);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(def.trim, ctx.currentTime + 0.6);
    const rt = { id, g, analyser, kit, inst, buf: new Float32Array(analyser.fftSize) };
    this.layers.set(id, rt);
    try { inst.tick && inst.tick(ctx.currentTime + 0.35); } catch (e) { console.error(id, e); }
  }

  // Swap the whole scene: everything not in `want` fades out, the rest fades in.
  setScene(want) {
    if (!this.ctx) return;
    for (const id of [...this.layers.keys()]) if (!want.includes(id)) this.setLayer(id, false);
    for (const id of want) this.setLayer(id, true);
  }

  level(id) {
    const rt = this.layers.get(id);
    if (!rt) return 0;
    rt.analyser.getFloatTimeDomainData(rt.buf);
    let sum = 0;
    for (let i = 0; i < rt.buf.length; i++) sum += rt.buf[i] * rt.buf[i];
    return Math.sqrt(sum / rt.buf.length);
  }

  // Events whose moment has arrived on the audio clock.
  drain() {
    if (!this.ctx || !this.events.length) return [];
    const now = this.ctx.currentTime;
    const due = [], later = [];
    for (const e of this.events) (e.at <= now ? due : later).push(e);
    this.events = later;
    return due;
  }

  setAmbience(v) {
    this.ambienceLevel = v;
    if (this.ambience) this.ambience.gain.setTargetAtTime(v * (this.ducked ? 0.6 : 1), this.ctx.currentTime, 0.1);
  }

  duck(on) {
    this.ducked = on;
    this.setAmbience(this.ambienceLevel);
  }

  setRadioLevel(v) { if (this.radio) this.radio.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.05); }

  // ---- interface sounds ----
  click() {
    if (!this.ready) return;
    const k = this.uiKit, t = this.now;
    k.burst({ t, dur: 0.012, freq: 3200, q: 2, gain: 0.5 });
    k.tone({ t, freq: 1700, dur: 0.02, gain: 0.08 });
    k.tone({ t: t + 0.01, freq: 120, dur: 0.07, gain: 0.35 });
  }
  detent() {
    if (!this.ready) return;
    const k = this.uiKit, t = this.now;
    k.tone({ t, freq: 85, dur: 0.12, gain: 0.5, type: 'triangle' });
    k.burst({ t, dur: 0.05, freq: 800, q: 1.5, gain: 0.3 });
    k.tone({ t: t + 0.03, freq: 2400, dur: 0.05, gain: 0.04 });
  }
  press() {
    if (!this.ready) return;
    const k = this.uiKit, t = this.now;
    k.tone({ t, freq: 210, dur: 0.09, gain: 0.45, type: 'triangle' });
    k.burst({ t, dur: 0.02, freq: 2000, q: 1, gain: 0.35 });
    k.tone({ t: t + 0.06, freq: 160, dur: 0.06, gain: 0.25 });
  }
  // Static and a heterodyne whistle, as if the dial were being swung across the band.
  tune(dur = 0.9) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    const k = makeKit(ctx, this.radio, null, Math.random, () => {});
    const s = ctx.createBufferSource(); s.buffer = noise(ctx, 'white');
    const bp = k.filter('bandpass', 800, 1.5);
    const am = k.gain(0.5); const amDepth = k.gain(0.5); amDepth.connect(am.gain);
    const lfo = k.osc('square', 47, amDepth);
    const g = k.gain(0);
    s.connect(bp); bp.connect(am); am.connect(g); g.connect(this.radio);
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(2800, t + dur * 0.6);
    bp.frequency.exponentialRampToValueAtTime(1200, t + dur);
    k.env(g.gain, t, 0.04, 0.55, dur * 0.6, dur * 0.35);
    s.start(t, Math.random() * 3); s.stop(t + dur + 0.1);
    lfo.start(t); lfo.stop(t + dur + 0.1);
    k.tone({ t: t + 0.05, freq: 3200, glide: 380, glideTime: dur * 0.8, dur: dur * 0.85, hold: 0, gain: 0.07 });
  }
  // A faint carrier hiss under the narrator while a story is on.
  carrier(on) {
    if (!this.ctx) return;
    const t = this.now;
    if (on && !this.hiss) {
      const s = this.ctx.createBufferSource(); s.buffer = noise(this.ctx, 'pink'); s.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
      const g = this.ctx.createGain(); g.gain.value = 0.0001;
      s.connect(bp); bp.connect(g); g.connect(this.radio);
      g.gain.linearRampToValueAtTime(0.05, t + 0.5);
      s.start();
      this.hiss = { s, g };
    } else if (!on && this.hiss) {
      const { s, g } = this.hiss;
      g.gain.setTargetAtTime(0.0001, t, 0.2);
      s.stop(t + 1.5);
      this.hiss = null;
    }
  }
}

// Render one element offline, for tests and for checking levels.
export async function renderLayer(id, seconds = 10, { sampleRate = 22050, seed = 1, withVerb = true } = {}) {
  const def = LAYERS[id];
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  let s = seed >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = ctx.createGain(); out.gain.value = def.trim; out.connect(ctx.destination);
  if (withVerb) {
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx);
    const send = ctx.createGain(); send.gain.value = def.verb * 0.55;
    out.connect(send); send.connect(verb); verb.connect(ctx.destination);
  }
  const pre = ctx.createGain(); pre.connect(out);
  const events = [];
  const kit = makeKit(ctx, pre, null, rng, (type, at, data) => events.push({ type, at, data }));
  const inst = def.make(kit);
  inst.tick && inst.tick(seconds);
  const buf = await ctx.startRendering();
  let peak = 0, sum = 0, n = 0, bad = 0;
  // Loudness of the loudest quarter second: fair to sparse sounds like a telegraph key.
  const win = Math.floor(sampleRate / 4);
  const wins = new Float64Array(Math.ceil(buf.length / win));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { bad++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v; n++;
      wins[Math.floor(i / win)] += v * v;
    }
  }
  const loud = Math.sqrt(Math.max(...wins) / (win * buf.numberOfChannels));
  return { id, peak, rms: Math.sqrt(sum / n), loud, bad, events: events.map(e => e.type), firstEvent: events.length ? Math.min(...events.map(e => e.at)) : null };
}

export const _test = { morse, noise, pluck };
