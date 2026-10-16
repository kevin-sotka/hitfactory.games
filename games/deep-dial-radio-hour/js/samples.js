// Sound elements built from recordings instead of synthesis. Each element can
// have looping beds (audio/sfx/<id>/bed*.mp3) and one-shots (shot*.mp3). The
// plan says how often one-shots fire and which picture cue they send, so the
// window still answers the sound. Levels are matched automatically, so files
// from different sources sit together without hand mixing.

// every: seconds between one-shots, first: delay before the first.
// cue: picture events for beds, which have no moments of their own.
// place: [dB, high cut Hz (0 for none), reverb send] puts the element at a distance.
// Levelling makes every file equally loud, so this is where the mix lives: things far
// off sit lower, lose their top end and pick up more of the room.
export const SAMPLE_PLANS = {
  wind: { cue: { type: 'gust', every: [2, 5], data: () => ({ strength: 0.6 + Math.random() * 0.35 }) }, place: [-2, 0, 0.1] },
  train: { every: [22, 34], first: [2, 4], event: 'train', pan: [0, 0], place: [-3, 7000, 0.25] },
  windmill: { every: [6, 11], first: [0.5, 1.5], event: 'creak', pan: [0.2, 0.5], place: [-16, 2500, 0.35] },
  telegraph: { every: [7, 12], first: [0.8, 2], event: 'tap', pan: [0.4, 0.6], place: [-9, 0, 0.05] },
  coyote: { every: [14, 24], first: [2, 4], event: 'howl', pan: [-0.7, 0.7], place: [0, 3000, 0.5] },
  cicadas: { place: [-6, 8000, 0] },
  crickets: { place: [-6, 0, 0.1] },
  campfire: { cue: { type: 'pop', every: [0.8, 2.5] }, place: [3, 0, 0] },
  creek: { cue: { type: 'lap', every: [1.6, 2.6] }, place: [-12, 2000, 0.25] },
  owl: { every: [10, 18], first: [1.5, 3], event: 'hoot', pan: [-0.6, -0.4], place: [-4, 3500, 0.5] },
  guitar: { cue: { type: 'strum', every: [1.5, 2.6] }, place: [-3, 6000, 0.25] },
  frogs: { every: [3, 7], first: [0.5, 2], event: 'ribbit', pan: [-0.8, 0.8], cue: { type: 'ribbit', every: [2.5, 6] }, place: [-9, 5000, 0.3] },
  waves: { every: [5.5, 9], first: [1, 3], event: 'wave', pan: [-0.5, 0.5], cue: { type: 'wave', every: [5.5, 8.5], data: () => ({ size: 0.6 + Math.random() * 0.4 }) }, place: [-1, 0, 0.1] },
  gulls: { every: [3.5, 9], first: [0.5, 2], event: 'gull', pan: [-0.8, 0.8], place: [-10, 6500, 0.3] },
  foghorn: { every: [22, 34], first: [2, 4], event: 'horn', pan: [0.3, 0.5], place: [-4, 1500, 0.55] },
  buoy: { every: [4, 9], first: [0.5, 2], event: 'bell', pan: [-0.4, -0.2], place: [-2, 4000, 0.45] },
  rigging: { every: [1.5, 4.5], first: [0.3, 1.5], event: 'clink', pan: [-0.8, 0.8], cue: { type: 'clink', every: [1.5, 4] }, place: [-8, 6000, 0.25] },
  pier: { every: [4, 9], first: [1, 3], event: 'creak', pan: [-0.5, 0.5], place: [-6, 0, 0.1] },
  rain: { place: [0, 0, 0] },
  neon: { every: [2.5, 7], first: [0.5, 2], event: 'flicker', pan: [-0.3, 0.3], place: [-10, 6000, 0] },
  wok: { every: [4, 9], first: [0.5, 2], event: 'sizzle', pan: [-0.6, 0.6], place: [-5, 7000, 0.15] },
  scooter: { every: [7, 13], first: [1, 3], event: 'scooter', sweep: true, place: [-3, 0, 0.15] },
  crowd: { place: [-6, 5000, 0.2] },
  busker: { cue: { type: 'note', every: [0.3, 0.7], data: () => ({ n: Math.floor(Math.random() * 7) }) }, place: [-6, 4500, 0.35] },
  sonar: { every: [5, 8], first: [0.4, 1.2], event: 'ping', pan: [0, 0], place: [0, 0, 0.35] },
  hull: { every: [9, 16], first: [1.5, 3.5], event: 'groan', pan: [-0.3, 0.3], place: [1, 0, 0.1] },
  whale: { every: [15, 25], first: [1, 3], event: 'whale', pan: [-0.6, 0.6], place: [0, 2500, 0.5] },
  bubbles: { every: [2, 5], first: [0.2, 1], event: 'bubbles', pan: [-0.6, 0.6], data: () => ({ count: 8 + Math.floor(Math.random() * 8) }), place: [-8, 5000, 0.1] },
  current: { place: [0, 0, 0] },
  ghost: { every: [14, 26], first: [1.5, 4], event: 'ghost', pan: [-0.5, -0.3], place: [-13, 3000, 0.45] },
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

  // Everything goes through the element's placement: level, then distance.
  const [db = 0, cut = 0, wet = 0] = plan.place || [];
  const out = k.gain(10 ** (db / 20));
  const far = cut ? k.filter('lowpass', cut, 0.5) : k.gain(1);
  out.connect(far); far.connect(k.out);
  if (wet && k.verb) far.connect(k.gain(wet, k.verb));

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
        src.connect(g); g.connect(out);
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
        const pan = k.pan(0, out);
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
