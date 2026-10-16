// Audio chores for the recording booth: tidy a raw take, encode WAV, and pack
// a zip. No DOM, so it runs (and is tested) in Node too.

// Trim the silence around a take, level it, and soften the edges.
// Returns a mono Float32Array, or null if nothing was said.
export function processTake(channels, sampleRate, { padStart = 0.06, padEnd = 0.12, target = 0.1 } = {}) {
  const n = channels[0].length;
  const mono = new Float32Array(n);
  for (const d of channels) for (let i = 0; i < n; i++) mono[i] += d[i] / channels.length;
  // Remove any DC offset from cheap interfaces.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += mono[i];
  mean /= n || 1;
  for (let i = 0; i < n; i++) mono[i] -= mean;

  const win = Math.max(1, Math.round(sampleRate * 0.01));
  const frames = Math.floor(n / win);
  if (frames < 3) return null;
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * win; i < (f + 1) * win; i++) s += mono[i] * mono[i];
    rms[f] = Math.sqrt(s / win);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(frames * 0.1)];
  const loudest = sorted[frames - 1];
  if (loudest < 0.003 || loudest < floor * 4) return null; // nothing but room tone
  const gate = Math.max(floor * 3, loudest * 0.04);
  let first = 0, last = frames - 1;
  while (first < frames && rms[first] < gate) first++;
  while (last > first && rms[last] < gate) last--;
  const a = Math.max(0, first * win - Math.round(padStart * sampleRate));
  const b = Math.min(n, (last + 1) * win + Math.round(padEnd * sampleRate));
  const out = mono.slice(a, b);

  // Level by the loudest tenth of a second, never past -1 dBFS peak.
  const w2 = Math.max(1, Math.round(sampleRate * 0.1));
  let loud = 0, peak = 0;
  for (let s = 0; s < out.length; s += w2) {
    let e = 0;
    const end = Math.min(out.length, s + w2);
    for (let i = s; i < end; i++) { e += out[i] * out[i]; const v = Math.abs(out[i]); if (v > peak) peak = v; }
    loud = Math.max(loud, Math.sqrt(e / (end - s)));
  }
  const gain = Math.min(target / Math.max(loud, 1e-6), 0.89 / Math.max(peak, 1e-6));
  const fadeIn = Math.min(out.length, Math.round(sampleRate * 0.008));
  const fadeOut = Math.min(out.length, Math.round(sampleRate * 0.025));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > out.length - fadeOut) g *= (out.length - i) / fadeOut;
    out[i] *= g;
  }
  return out;
}

export function encodeWav(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function decodeWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = v.getUint32(24, true);
  const len = v.getUint32(40, true) / 2;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = v.getInt16(44 + i * 2, true) / 0x8000;
  return { sampleRate: rate, samples: out };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// An uncompressed zip. WAV barely compresses anyway.
export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
