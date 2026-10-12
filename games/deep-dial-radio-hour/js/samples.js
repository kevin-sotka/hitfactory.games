// Sound elements built from recordings instead of synthesis. Each element can
// have looping beds (audio/sfx/<id>/bed*.mp3) and one-shots (shot*.mp3). The
// plan says how often one-shots fire and which picture cue they send, so the
// window still answers the sound. Levels are matched automatically, so files
// from different sources sit together without hand mixing.

// every: seconds between one-shots, first: delay before the first.
// cue: picture events for beds, which have no moments of their own.
export const SAMPLE_PLANS = {
  wind: { cue: { type: 'gust', every: [2, 5], data: () => ({ strength: 0.6 + Math.random() * 0.35 }) } },
  train: { every: [22, 34], first: [2, 4], event: 'train', pan: [0, 0] },
  windmill: { every: [3.5, 6], first: [0.5, 1.5], event: 'creak', pan: [0.2, 0.5] },
  telegraph: { every: [7, 12], first: [0.8, 2], event: 'tap', pan: [0.4, 0.6] },
  coyote: { every: [14, 24], first: [2, 4], event: 'howl', pan: [-0.7, 0.7] },
  cicadas: {},
  crickets: {},
  campfire: { cue: { type: 'pop', every: [0.8, 2.5] } },
  creek: { cue: { type: 'lap', every: [1.6, 2.6] } },
  owl: { every: [10, 18], first: [1.5, 3], event: 'hoot', pan: [-0.6, -0.4] },
  guitar: { cue: { type: 'strum', every: [1.5, 2.6] } },
  frogs: { every: [3, 7], first: [0.5, 2], event: 'ribbit', pan: [-0.8, 0.8], cue: { type: 'ribbit', every: [2.5, 6] } },
  waves: { every: [5.5, 9], first: [1, 3], event: 'wave', pan: [-0.5, 0.5], cue: { type: 'wave', every: [5.5, 8.5], data: () => ({ size: 0.6 + Math.random() * 0.4 }) } },
  gulls: { every: [3.5, 9], first: [0.5, 2], event: 'gull', pan: [-0.8, 0.8] },
  foghorn: { every: [22, 34], first: [2, 4], event: 'horn', pan: [0.3, 0.5] },
  buoy: { every: [4, 9], first: [0.5, 2], event: 'bell', pan: [-0.4, -0.2] },
  rigging: { every: [1.5, 4.5], first: [0.3, 1.5], event: 'clink', pan: [-0.8, 0.8], cue: { type: 'clink', every: [1.5, 4] } },
  pier: { every: [4, 9], first: [1, 3], event: 'creak', pan: [-0.5, 0.5] },
  rain: {},
  neon: { every: [2.5, 7], first: [0.5, 2], event: 'flicker', pan: [-0.3, 0.3] },
  wok: { every: [4, 9], first: [0.5, 2], event: 'sizzle', pan: [-0.6, 0.6] },
  scooter: { every: [7, 13], first: [1, 3], event: 'scooter', sweep: true },
  crowd: {},
  busker: { cue: { type: 'note', every: [0.3, 0.7], data: () => ({ n: Math.floor(Math.random() * 7) }) } },
  sonar: { every: [5, 8], first: [0.4, 1.2], event: 'ping', pan: [0, 0] },
  hull: { every: [9, 16], first: [1.5, 3.5], event: 'groan', pan: [-0.3, 0.3] },
  whale: { every: [15, 25], first: [1, 3], event: 'whale', pan: [-0.6, 0.6] },
  bubbles: { every: [2, 5], first: [0.2, 1], event: 'bubbles', pan: [-0.6, 0.6], data: () => ({ count: 8 + Math.floor(Math.random() * 8) }) },
  current: {},
  ghost: { every: [9, 16], first: [1.5, 4], event: 'ghost', pan: [-0.5, -0.3] },
};

// Loudness targets: beds sit under everything, one-shots stand out a little.
const BED_RMS = 0.045;   // about -27 dBFS
const SHOT_LOUD = 0.1;   // loudest quarter second, about -20 dBFS

const gainCache = new WeakMap();
export function matchGain(buf, kind) {
  const key = kind;
  let byKind = gainCache.get(buf);
  if (!byKind) gainCache.set(buf, (byKind = {}));
  if (byKind[key]) return byKind[key];
  const win = Math.max(1, Math.floor(buf.sampleRate / 4));
  let total = 0, loud = 0, peak = 0;
  const n = buf.length;
  const chans = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
  for (let start = 0; start < n; start += win) {
    let s = 0;
    const end = Math.min(n, start + win);
    for (let i = start; i < end; i++) {
      for (const d of chans) { const v = d[i]; s += v * v; const a = Math.abs(v); if (a > peak) peak = a; }
    }
    total += s;
    loud = Math.max(loud, Math.sqrt(s / ((end - start) * chans.length)));
  }
  const rms = Math.sqrt(total / (n * chans.length)) || 1e-6;
  let g = kind === 'bed' ? BED_RMS / rms : SHOT_LOUD / Math.max(loud, 1e-6);
  g = Math.min(g, 0.9 / Math.max(peak, 1e-6)); // never push a file into clipping
  return (byKind[key] = Math.max(0.05, Math.min(8, g)));
}

// kit: the same toolkit synthesised elements use. bufs: { bed: [], shot: [] }.
export function makeSampleLayer(k, id, bufs) {
  const plan = SAMPLE_PLANS[id] || {};
  const r = ([a, b]) => k.r(a, b);
  const tickers = [];

  // Beds: overlapping passes through the file from random points, crossfaded,
  // so even a short or unseamed recording loops without a click or a pattern.
  if (bufs.bed && bufs.bed.length) {
    const xf = 2.5;
    // Equal power fades: two unrelated recordings crossfading linearly dip 3 dB in the middle.
    const curve = (up, level) => Float32Array.from({ length: 64 }, (_, i) => level * (up ? Math.sin : Math.cos)((i / 63) * Math.PI / 2));
    let next = k.t0;
    let first = true;
    tickers.push(until => {
      while (next < until + xf) {
        const buf = k.pick(bufs.bed);
        const t = next;
        const span = Math.max(xf * 2 + 1, Math.min(buf.duration, k.r(18, 32)));
        const offset = buf.duration > span ? k.r(0, buf.duration - span) : 0;
        const len = Math.min(span, buf.duration - offset);
        const src = k.ctx.createBufferSource();
        src.buffer = buf;
        const g = k.gain(0);
        src.connect(g); g.connect(k.out);
        const level = matchGain(buf, 'bed');
        const fade = Math.min(xf, len / 3);
        const fadeIn = first ? 0.3 : fade; // the layer itself fades in; no need to wait on the first pass
        first = false;
        g.gain.setValueCurveAtTime(curve(true, level), t, fadeIn);
        g.gain.setValueCurveAtTime(curve(false, level), t + len - fade, fade);
        src.start(t, offset, len);
        next = t + len - fade;
      }
    });
  }

  if (bufs.shot && bufs.shot.length) {
    let next = k.t0 + r(plan.first || [0.5, 2]);
    let last = null;
    tickers.push(until => {
      while (next < until) {
        const t = next;
        // Avoid the same file twice in a row when there is a choice.
        let buf = k.pick(bufs.shot);
        if (bufs.shot.length > 1 && buf === last) buf = bufs.shot[(bufs.shot.indexOf(buf) + 1) % bufs.shot.length];
        last = buf;
        const src = k.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = k.r(0.97, 1.03);
        const g = k.gain(matchGain(buf, 'shot') * k.r(0.8, 1));
        const pan = k.pan(0, k.out);
        let dir = 1;
        if (plan.sweep) {
          dir = k.chance(0.5) ? 1 : -1;
          if (pan.pan) { pan.pan.setValueAtTime(-0.9 * dir, t); pan.pan.linearRampToValueAtTime(0.9 * dir, t + buf.duration); }
        } else if (pan.pan) pan.pan.value = r(plan.pan || [0, 0]);
        src.connect(g); g.connect(pan);
        src.start(t);
        if (plan.event) k.emit(plan.event, t, { dur: buf.duration, dir, side: pan.pan ? pan.pan.value : 0, ...(plan.data ? plan.data() : {}) });
        next = t + Math.max(buf.duration * 0.6, r(plan.every || [5, 10]));
      }
    });
  }

  // Picture cues for elements that are all bed.
  if (plan.cue && !(bufs.shot && bufs.shot.length && plan.event === plan.cue.type)) {
    let next = k.t0 + r(plan.cue.every);
    tickers.push(until => {
      while (next < until) {
        k.emit(plan.cue.type, next, { dur: 3, ...(plan.cue.data ? plan.cue.data() : {}) });
        next += r(plan.cue.every);
      }
    });
  }

  return { tick: until => tickers.forEach(f => f(until)) };
}
