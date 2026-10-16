// The view through the cockpit glass. Five painted scenes, drawn in code,
// that answer the sound elements: the train you hear is the train you see.
// Each scene paints its still parts once per size into an offscreen canvas,
// then draws the living parts on top every frame.

const TAU = Math.PI * 2;

// Older Safari has no roundRect.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    r = Math.max(0, Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }
function fbm(x, oct = 4) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * noise1(x * f + i * 17.3); f *= 2.03; a *= 0.5; } return s; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function glow(g, x, y, r, color, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalAlpha = alpha; g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}

// A silhouette edge along the width, filled down to `bottom`.
function ridge(g, w, bottom, fn, fill, step = 4) {
  g.beginPath(); g.moveTo(0, bottom);
  for (let x = 0; x <= w + step; x += step) g.lineTo(x, fn(x));
  g.lineTo(w, bottom); g.closePath();
  g.fillStyle = fill; g.fill();
}

function pine(g, x, base, h, color) {
  g.fillStyle = color;
  g.fillRect(x - h * 0.025, base - h * 0.12, h * 0.05, h * 0.14);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const top = base - h + (i * h * 0.17);
    const wide = h * (0.12 + i * 0.065);
    g.beginPath();
    g.moveTo(x, top);
    g.quadraticCurveTo(x + wide * 0.4, top + h * 0.18, x + wide, top + h * 0.3);
    g.lineTo(x - wide, top + h * 0.3);
    g.quadraticCurveTo(x - wide * 0.4, top + h * 0.18, x, top);
    g.fill();
  }
}

function particles() {
  const list = [];
  return {
    list,
    add(p) { list.push(p); if (list.length > 600) list.shift(); },
    step(dt, fn) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) { list.splice(i, 1); continue; }
        fn(p, p.age / p.life);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Prairie desert railway station at sunset

const prairie = {
  paint(g, w, h, R) {
    const hz = h * 0.7;
    g.fillStyle = vgrad(g, 0, hz, [[0, '#2f2560'], [0.32, '#8e4479'], [0.6, '#ec7b57'], [0.84, '#ffbf6e'], [1, '#ffe2a6']]);
    g.fillRect(0, 0, w, hz + 2);
    const sx = w * 0.64, sy = hz - h * 0.05, sr = h * 0.13;
    glow(g, sx, sy, sr * 5, 'rgba(255,214,140,0.55)');
    glow(g, sx, sy, sr * 2, 'rgba(255,240,190,0.8)');
    g.fillStyle = vgrad(g, sy - sr, sy + sr, [[0, '#fff7d6'], [1, '#ffc56e']]);
    g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    // Thin cloud bands across the sun.
    g.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = h * (0.18 + i * 0.075) + R() * 10;
      g.fillStyle = i % 2 ? '#c55a7c' : '#f39a7a';
      const x0 = R() * w * 0.6, len = w * (0.25 + R() * 0.4);
      g.beginPath(); g.ellipse(x0 + len / 2, y, len / 2, 2 + R() * 3, 0, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // Mesas: plateaus with steep sides.
    const mesa = (seed, amp, base, scale) => x => base - amp * smooth(0.42, 0.5, fbm(x * scale + seed)) * (0.85 + 0.15 * noise1(x * 0.05 + seed));
    ridge(g, w, hz + 2, mesa(3, h * 0.2, hz, 0.004), '#9c5481');
    ridge(g, w, hz + 2, mesa(11, h * 0.13, hz, 0.006), '#76365f');
    // Plain.
    g.fillStyle = vgrad(g, hz, h, [[0, '#d98a52'], [0.35, '#b85e3a'], [1, '#6e2f27']]);
    g.fillRect(0, hz, w, h - hz);
    g.globalAlpha = 0.18;
    for (let i = 0; i < 260; i++) {
      const y = hz + Math.pow(R(), 1.6) * (h - hz);
      g.fillStyle = R() < 0.5 ? '#5a2318' : '#ffd29a';
      g.fillRect(R() * w, y, 2 + (y - hz) * 0.05 * R(), 1);
    }
    g.globalAlpha = 1;
    // Telegraph line.
    const poleY = h * 0.79, poles = [];
    for (let x = -w * 0.02; x < w * 1.1; x += w / 6.5) poles.push(x);
    g.strokeStyle = '#3a1c2c'; g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      for (const off of [0, 6]) {
        g.beginPath(); g.moveTo(poles[i], poleY - h * 0.27 + off);
        g.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, poleY - h * 0.22 + off, poles[i + 1], poleY - h * 0.27 + off);
        g.stroke();
      }
    }
    g.fillStyle = '#3a1c2c';
    for (const x of poles) { g.fillRect(x - 2, poleY - h * 0.28, 4, h * 0.28); g.fillRect(x - 12, poleY - h * 0.27, 24, 3); }
    // Water tower, leaning.
    g.save(); g.translate(w * 0.44, poleY); g.rotate(-0.04);
    g.fillStyle = '#4a2433';
    const tw = h * 0.1;
    for (const lx of [-tw * 0.45, tw * 0.45]) g.fillRect(lx - 2, -h * 0.2, 4, h * 0.2);
    g.fillRect(-tw * 0.5, -h * 0.12, tw, 2);
    g.beginPath(); g.moveTo(-tw * 0.45, 0); g.lineTo(tw * 0.45, -h * 0.12); g.moveTo(tw * 0.45, 0); g.lineTo(-tw * 0.45, -h * 0.12);
    g.strokeStyle = '#4a2433'; g.lineWidth = 1.5; g.stroke();
    g.fillRect(-tw * 0.6, -h * 0.31, tw * 1.2, h * 0.11);
    g.beginPath(); g.moveTo(-tw * 0.68, -h * 0.31); g.lineTo(0, -h * 0.37); g.lineTo(tw * 0.68, -h * 0.31); g.fill();
    g.fillStyle = 'rgba(255,190,120,0.35)'; g.fillRect(-tw * 0.6, -h * 0.31, 3, h * 0.11);
    g.restore();
    // Station house.
    const bx = w * 0.55, bw = Math.max(120, w * 0.19), bh = h * 0.17, by = poleY;
    g.fillStyle = '#5b2c2e'; g.fillRect(bx, by - bh, bw, bh);
    g.fillStyle = '#3f1d25';
    g.beginPath(); g.moveTo(bx - 10, by - bh); g.lineTo(bx + bw * 0.5, by - bh - h * 0.07); g.lineTo(bx + bw + 10, by - bh); g.fill();
    g.fillRect(bx - bw * 0.25, by - bh * 0.62, bw * 0.25, 4); // awning
    for (let i = 0; i < 3; i++) g.fillRect(bx - bw * 0.24 + i * bw * 0.11, by - bh * 0.6, 3, bh * 0.6);
    g.fillStyle = 'rgba(255,170,110,0.45)'; g.fillRect(bx, by - bh, 3, bh);
    g.fillStyle = '#f0d49a'; g.fillRect(bx + bw * 0.2, by - bh * 0.92, bw * 0.6, bh * 0.2);
    g.fillStyle = '#3a1414'; g.font = `${Math.round(bh * 0.17)}px Federant, Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('DRY GULCH', bx + bw * 0.5, by - bh * 0.82);
    g.fillStyle = '#2a1218';
    g.fillRect(bx + bw * 0.12, by - bh * 0.55, bw * 0.16, bh * 0.55); // door
    this.window = { x: bx + bw * 0.52, y: by - bh * 0.58, w: bw * 0.26, h: bh * 0.3 };
    g.fillStyle = '#2a1218'; g.fillRect(this.window.x, this.window.y, this.window.w, this.window.h);
    // Rails.
    const ry = h * 0.83;
    g.fillStyle = '#4b2422';
    for (let x = 0; x < w; x += 12) g.fillRect(x, ry - 1, 6, 6);
    g.fillStyle = '#2c1414'; g.fillRect(0, ry - 3, w, 2); g.fillRect(0, ry + 3, w, 2);
    g.fillStyle = 'rgba(255,200,140,0.6)'; g.fillRect(0, ry - 3, w, 1);
    this.railY = ry;
    // Saguaros in the foreground.
    const cactus = (x, base, s) => {
      g.fillStyle = '#2b1222';
      const arm = (dx, up, len) => {
        g.beginPath(); g.roundRect(x + dx * s * 0.5 - (dx > 0 ? 0 : s * 0.9), base - up, s * 0.9, s * 0.32, s * 0.16); g.fill();
        g.beginPath(); g.roundRect(x + dx * s * 1.1 - s * 0.16, base - up - len, s * 0.34, len + s * 0.3, s * 0.17); g.fill();
      };
      g.beginPath(); g.roundRect(x - s * 0.25, base - s * 4, s * 0.5, s * 4.2, s * 0.25); g.fill();
      arm(1, s * 2.2, s * 1.1); arm(-1, s * 1.6, s * 0.9);
    };
    cactus(w * 0.08, h * 1.02, h * 0.07);
    cactus(w * 0.93, h * 1.04, h * 0.055);
    cactus(w * 0.38, h * 0.9, h * 0.025);
    this.mesaTop = { x: w * 0.3, y: mesa(3, h * 0.2, hz, 0.004)(w * 0.3) };
  },

  init(st, w, h) {
    st.blades = 0; st.wobble = 0; st.dust = particles(); st.smoke = particles(); st.weeds = []; st.trains = [];
    st.howl = 0; st.tap = 0; st.gust = 0;
    st.birds = [0, 1, 2].map(i => ({ a: i * 2.1, r: h * (0.05 + i * 0.02), x: w * (0.25 + i * 0.12), y: h * (0.22 + i * 0.03) }));
  },

  event(st, e, w, h) {
    if (e.type === 'train') st.trains.push({ t: 0, dur: e.data.dur });
    if (e.type === 'gust') { st.gust = Math.max(st.gust, e.data.strength); if (e.data.strength > 0.65 && st.weeds.length < 3) st.weeds.push({ x: -40, r: h * 0.035, a: 0, vy: 0, y: 0 }); }
    if (e.type === 'creak') st.wobble = 1;
    if (e.type === 'howl') st.howl = e.data.dur + 0.6;
    if (e.type === 'tap') st.tap = Math.max(st.tap, e.data.dur + 0.04);
  },

  draw(g, w, h, t, dt, st, on) {
    // Buzzards circling high up.
    g.strokeStyle = 'rgba(60,25,50,0.7)'; g.lineWidth = 1.5;
    for (const b of st.birds) {
      b.a += dt * 0.35;
      const x = b.x + Math.cos(b.a) * b.r * 2, y = b.y + Math.sin(b.a) * b.r * 0.6, f = Math.sin(t * 3 + b.a) * 2;
      g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 3, x, y); g.quadraticCurveTo(x + 3, y - 3, x + 7, y - f); g.stroke();
    }
    // Coyote on the mesa.
    if (on.coyote || st.howl > 0) {
      const { x, y } = this.mesaTop;
      const up = st.howl > 0 ? 1 : 0;
      st.howl = Math.max(0, st.howl - dt);
      const s = h * 0.012;
      g.fillStyle = '#4c1f46';
      g.beginPath(); g.ellipse(x, y - s * 1.5, s * 2.2, s * 1.1, 0, 0, TAU); g.fill();
      g.fillRect(x - s * 1.8, y - s * 1.2, s * 0.4, s * 1.2); g.fillRect(x + s * 1.3, y - s * 1.2, s * 0.4, s * 1.2);
      g.beginPath(); g.moveTo(x - s * 2, y - s * 1.8); g.lineTo(x - s * 3.6, y - s * 1.1); g.lineTo(x - s * 2, y - s * 1.1); g.fill();
      g.save(); g.translate(x + s * 1.9, y - s * 2.2); g.rotate(up ? -1.0 : -0.2);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 2.4, -s * 0.3); g.lineTo(s * 0.2, s * 1.0); g.fill();
      g.beginPath(); g.moveTo(s * 0.2, -s * 0.4); g.lineTo(s * 0.5, -s * 1.5); g.lineTo(s * 0.9, -s * 0.3); g.fill();
      g.restore();
    }
    // Station window: lit, and blinking with the telegraph key.
    const win = this.window;
    st.tap = Math.max(0, st.tap - dt);
    g.fillStyle = st.tap > 0 ? '#fff2b0' : on.telegraph ? '#f3a85a' : '#7a3a2e';
    g.fillRect(win.x, win.y, win.w, win.h);
    if (st.tap > 0 || on.telegraph) glow(g, win.x + win.w / 2, win.y + win.h / 2, win.h * (st.tap > 0 ? 1.6 : 1.1), 'rgba(255,200,120,0.55)');
    // Windmill.
    const mx = w * 0.1, my = h * 0.79, mh = h * 0.42;
    g.strokeStyle = '#3d1a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(mx - mh * 0.12, my); g.lineTo(mx, my - mh); g.lineTo(mx + mh * 0.12, my);
    for (let i = 1; i < 5; i++) { const y = my - mh * i / 5, d = mh * 0.12 * (1 - i / 5); g.moveTo(mx - d, y); g.lineTo(mx + d, y); }
    g.stroke();
    st.gust = Math.max(0, st.gust - dt * 0.15);
    st.wobble = Math.max(0, st.wobble - dt * 1.5);
    const speed = on.windmill ? 0.9 + (on.wind ? st.gust * 2.2 : 0) : 0.08;
    st.blades += dt * speed;
    g.save(); g.translate(mx, my - mh); g.rotate(st.blades + Math.sin(t * 30) * 0.02 * st.wobble);
    g.fillStyle = '#4a2133';
    for (let i = 0; i < 14; i++) {
      g.rotate(TAU / 14);
      g.beginPath(); g.moveTo(mh * 0.04, -3); g.lineTo(mh * 0.2, -6); g.lineTo(mh * 0.2, 6); g.lineTo(mh * 0.04, 3); g.fill();
    }
    g.beginPath(); g.arc(0, 0, mh * 0.03, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = '#4a2133';
    g.beginPath(); g.moveTo(mx + mh * 0.02, my - mh); g.lineTo(mx + mh * 0.22, my - mh - 6); g.lineTo(mx + mh * 0.22, my - mh + 10); g.fill();

    // Trains.
    for (let i = st.trains.length - 1; i >= 0; i--) {
      const tr = st.trains[i];
      tr.t += dt;
      const p = tr.t / tr.dur;
      if (p > 1) { st.trains.splice(i, 1); continue; }
      const L = Math.max(360, w * 0.55);
      const x = lerp(-L, w + 40, p);
      this.drawTrain(g, x, this.railY, h, L, t);
      if (Math.random() < dt * 14) st.smoke.add({ x: x + L - h * 0.1, y: this.railY - h * 0.2, r: h * 0.02, age: 0, life: 3 + Math.random() * 2, vx: -20 - Math.random() * 20 });
    }
    st.smoke.step(dt, (p, k) => {
      p.x += p.vx * dt; p.y -= 18 * dt; p.r += 14 * dt;
      g.fillStyle = `rgba(230,200,215,${0.45 * (1 - k)})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    });
    // Tumbleweeds.
    for (let i = st.weeds.length - 1; i >= 0; i--) {
      const tw = st.weeds[i];
      tw.x += dt * (90 + st.gust * 160); tw.a += dt * 6;
      tw.vy += dt * 600; tw.y += tw.vy * dt;
      if (tw.y > 0) { tw.y = 0; tw.vy = -120 - Math.random() * 140; }
      if (tw.x > w + 60) { st.weeds.splice(i, 1); continue; }
      const cx = tw.x, cy = h * 0.88 + tw.y - tw.r;
      g.strokeStyle = 'rgba(80,40,30,0.85)'; g.lineWidth = 1.2;
      for (let j = 0; j < 7; j++) {
        g.beginPath(); g.ellipse(cx, cy, tw.r, tw.r * 0.7, tw.a + j * 0.45, 0, TAU); g.stroke();
      }
    }
    // Dust in the wind.
    if (on.wind && Math.random() < dt * (8 + st.gust * 30)) {
      st.dust.add({ x: -10, y: h * (0.55 + Math.random() * 0.4), age: 0, life: 4, v: 120 + Math.random() * 160 });
    }
    st.dust.step(dt, (p, k) => {
      p.x += p.v * dt * (1 + st.gust); p.y += Math.sin(p.age * 3) * 0.3;
      g.fillStyle = `rgba(255,220,170,${0.5 * Math.sin(k * Math.PI)})`;
      g.fillRect(p.x, p.y, 3, 1.5);
    });
    // Grass tufts sway; cicadas make them shimmer.
    g.strokeStyle = on.cicadas ? 'rgba(255,214,140,0.8)' : 'rgba(110,55,35,0.9)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97.3) % w, y = h * (0.86 + (i % 5) * 0.025);
      const sway = Math.sin(t * 2 + i) * (2 + st.gust * 8 + (on.wind ? 2 : 0));
      for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(x + j * 2, y); g.quadraticCurveTo(x + j * 3, y - 8, x + j * 4 + sway, y - 14 - Math.abs(j) * -2); g.stroke(); }
    }
  },

  drawTrain(g, x, ry, h, L, t) {
    const s = h * 0.012;
    g.save(); g.translate(x, ry - 3);
    g.fillStyle = '#241018';
    const cars = 4, cw = (L * 0.72) / cars;
    for (let i = 0; i < cars; i++) {
      const cx = i * cw + 4;
      g.fillRect(cx, -s * 9, cw - 8, s * 7.5);
      g.fillStyle = 'rgba(255,190,110,0.85)';
      for (let j = 0; j < 4; j++) g.fillRect(cx + 8 + j * (cw - 16) / 4, -s * 7.5, (cw - 16) / 4 - 6, s * 2.2);
      g.fillStyle = '#241018';
      for (const wx of [cx + cw * 0.2, cx + cw * 0.75]) { g.beginPath(); g.arc(wx, -s * 1.2, s * 1.3, 0, TAU); g.fill(); }
    }
    const lx = L * 0.74;
    g.fillRect(lx, -s * 10, s * 7, s * 8.5);
    g.beginPath(); g.roundRect(lx + s * 6, -s * 7, L * 0.2, s * 6, s * 3); g.fill();
    g.fillRect(lx + L * 0.17, -s * 11, s * 2.2, s * 5);
    g.beginPath(); g.moveTo(lx + L * 0.25, -s * 1); g.lineTo(lx + L * 0.27, s * 0.5); g.lineTo(lx + L * 0.22, s * 0.5); g.fill();
    const spin = t * 8;
    for (const wx of [lx + s * 3, lx + s * 9, lx + s * 15]) {
      g.beginPath(); g.arc(wx, -s * 1.6, s * 1.9, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,170,100,0.5)'; g.beginPath(); g.moveTo(wx, -s * 1.6); g.lineTo(wx + Math.cos(spin) * s * 1.6, -s * 1.6 + Math.sin(spin) * s * 1.6); g.stroke();
    }
    glow(g, lx + L * 0.22, -s * 5, h * 0.12, 'rgba(255,240,190,0.7)');
    g.restore();
  },
};

// ---------------------------------------------------------------------------
// Evening campground by a lake

const campground = {
  paint(g, w, h, R) {
    const hz = h * 0.6;
    g.fillStyle = vgrad(g, 0, hz, [[0, '#0b0f33'], [0.5, '#232c6c'], [0.82, '#5a4b8f'], [1, '#d58a8f']]);
    g.fillRect(0, 0, w, hz + 2);
    for (let i = 0; i < 220; i++) {
      const y = Math.pow(R(), 1.4) * hz * 0.85, a = 0.3 + R() * 0.7 * (1 - y / hz);
      g.fillStyle = `rgba(255,250,235,${a})`;
      g.fillRect(R() * w, y, R() < 0.1 ? 2 : 1, R() < 0.1 ? 2 : 1);
    }
    // Crescent moon.
    const mx = w * 0.7, my = h * 0.26, mr = h * 0.06;
    glow(g, mx, my, mr * 6, 'rgba(200,210,255,0.25)');
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(mr * 2 + 4);
    const cg = c.getContext('2d');
    cg.fillStyle = '#fff6dc'; cg.beginPath(); cg.arc(mr + 2, mr + 2, mr, 0, TAU); cg.fill();
    cg.globalCompositeOperation = 'destination-out'; cg.beginPath(); cg.arc(mr + 2 + mr * 0.45, mr + 2 - mr * 0.2, mr * 0.9, 0, TAU); cg.fill();
    g.drawImage(c, mx - mr - 2, my - mr - 2);
    this.moon = { x: mx, y: my };
    // Hills and the far treeline.
    ridge(g, w, hz + 2, x => hz - h * 0.14 * fbm(x * 0.004 + 2), '#2a2c63');
    for (let x = -10; x < w + 20; x += 9 + R() * 8) pine(g, x, hz + 2, h * (0.06 + R() * 0.05), '#1a2052');
    // Lake.
    const lb = h * 0.72;
    g.fillStyle = vgrad(g, hz, lb, [[0, '#4b4688'], [1, '#1b1d4a']]);
    g.fillRect(0, hz, w, lb - hz);
    this.lake = { top: hz, bottom: lb };
    // Near shore and big framing pines.
    g.fillStyle = vgrad(g, lb, h, [[0, '#141a3a'], [1, '#0a0c1d']]);
    g.beginPath(); g.moveTo(0, lb + 6);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, lb + Math.sin(x * 0.02) * 4 + 2);
    g.lineTo(w, h); g.lineTo(0, h); g.fill();
    for (let x = w * 0.22; x < w * 0.38; x += 22 + R() * 20) pine(g, x, lb + 6, h * (0.18 + R() * 0.08), '#10173a');
    for (let x = w * 0.84; x < w * 0.97; x += 26 + R() * 20) pine(g, x, lb + 6, h * (0.22 + R() * 0.08), '#10173a');
    pine(g, w * 0.08, h * 1.02, h * 0.95, '#070a1c');
    pine(g, w * 0.99, h * 1.02, h * 0.85, '#070a1c');
    // Tent.
    const tx = w * 0.66, ty = h * 0.86, tw = h * 0.2;
    this.tent = { x: tx, y: ty, w: tw };
    // Logs.
    this.fire = { x: w * 0.47, y: h * 0.88 };
    // Lily pads.
    g.fillStyle = '#1e3a3a';
    for (const [px, py] of [[0.58, 0.69], [0.62, 0.705], [0.55, 0.71]]) { g.beginPath(); g.ellipse(w * px, h * py, h * 0.022, h * 0.006, 0, 0, TAU); g.fill(); }
    this.frog = { x: w * 0.58, y: h * 0.685 };
  },

  init(st, w, h) {
    st.sparks = particles(); st.ripples = []; st.hoot = 0; st.notes = particles(); st.ribbit = 0; st.blink = 0;
    st.flies = Array.from({ length: 22 }, (_, i) => ({ x: Math.random() * w, y: h * (0.5 + Math.random() * 0.4), p: Math.random() * TAU, s: 0.4 + Math.random() }));
    st.twinkle = Array.from({ length: 40 }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.45, p: Math.random() * TAU }));
    st.shoot = null;
  },

  event(st, e) {
    if (e.type === 'pop') for (let i = 0; i < 8; i++) st.sparks.add({ x: this.fire.x, y: this.fire.y - 10, vx: (Math.random() - 0.5) * 80, vy: -90 - Math.random() * 120, age: 0, life: 1 + Math.random() });
    if (e.type === 'lap') st.ripples.push({ age: 0, x: Math.random() });
    if (e.type === 'hoot') st.hoot = e.data.dur;
    if (e.type === 'strum') st.notes.add({ x: this.fire.x + 70, y: this.fire.y - 50, age: 0, life: 2.4, g: ['♪', '♫'][Math.random() < 0.5 ? 0 : 1], d: (Math.random() - 0.5) * 20 });
    if (e.type === 'ribbit') st.ribbit = 0.4;
  },

  draw(g, w, h, t, dt, st, on) {
    for (const s of st.twinkle) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      g.fillStyle = `rgba(255,255,240,${a * 0.9})`; g.fillRect(s.x, s.y, 1.5, 1.5);
    }
    if (!st.shoot && Math.random() < dt * 0.05) st.shoot = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.2, age: 0 };
    if (st.shoot) {
      const s = st.shoot; s.age += dt;
      const len = 80, x = s.x + s.age * 500, y = s.y + s.age * 160;
      const gr = g.createLinearGradient(x - len, y - len * 0.32, x, y);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${1 - s.age / 0.8})`);
      g.strokeStyle = gr; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - len, y - len * 0.32); g.lineTo(x, y); g.stroke();
      if (s.age > 0.8) st.shoot = null;
    }
    // Moon on the water.
    const { top, bottom } = this.lake;
    for (let i = 0; i < 14; i++) {
      const y = top + 4 + i * (bottom - top - 6) / 14;
      const wob = Math.sin(t * (on.creek ? 2.4 : 0.8) + i * 1.7) * (on.creek ? 10 : 4);
      g.fillStyle = `rgba(255,240,210,${0.5 - i * 0.03})`;
      g.fillRect(this.moon.x - 14 + wob - i, y, 28 + i * 2, 1.5);
    }
    // Lapping ripples along the shore.
    for (let i = st.ripples.length - 1; i >= 0; i--) {
      const r = st.ripples[i]; r.age += dt;
      if (r.age > 2.5) { st.ripples.splice(i, 1); continue; }
      g.strokeStyle = `rgba(200,200,255,${0.35 * (1 - r.age / 2.5)})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(w * (0.3 + r.x * 0.5), bottom - 3, 20 + r.age * 60, 2 + r.age * 2, 0, 0, TAU); g.stroke();
    }
    // Frog.
    st.ribbit = Math.max(0, st.ribbit - dt);
    if (on.frogs) {
      const { x, y } = this.frog;
      g.fillStyle = '#0f2a22';
      g.beginPath(); g.ellipse(x, y, 7, 4.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(x - 3, y - 4, 2, 0, TAU); g.arc(x + 3, y - 4, 2, 0, TAU); g.fill();
      if (st.ribbit > 0) { g.fillStyle = 'rgba(200,230,170,0.7)'; g.beginPath(); g.arc(x, y + 2, 2 + st.ribbit * 12, 0, TAU); g.fill(); }
    }
    // Firelight.
    const { x: fx, y: fy } = this.fire;
    const lit = on.campfire;
    const flick = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    if (lit) glow(g, fx, fy - 10, h * 0.55 * flick, 'rgba(255,140,60,0.45)');
    // Tent, lit from inside by the fire.
    const { x: tx, y: ty, w: tw } = this.tent;
    g.fillStyle = lit ? vgrad(g, ty - tw * 0.8, ty, [[0, '#a8562c'], [1, '#e8913f']]) : '#2b2648';
    g.beginPath(); g.moveTo(tx - tw, ty); g.lineTo(tx, ty - tw * 0.8); g.lineTo(tx + tw, ty); g.fill();
    g.fillStyle = lit ? '#ffcf7a' : '#1a1735';
    g.beginPath(); g.moveTo(tx - tw * 0.25, ty); g.lineTo(tx, ty - tw * 0.55); g.lineTo(tx + tw * 0.25, ty); g.fill();
    g.strokeStyle = '#120e24'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(tx, ty - tw * 0.8); g.lineTo(tx, ty - tw * 0.92); g.stroke();
    // Guitarist on a log.
    if (on.guitar) {
      const gx = fx + h * 0.16, gy = fy + 4;
      g.fillStyle = '#120c1c';
      g.fillRect(gx - 20, gy - 6, 50, 9);
      g.beginPath(); g.ellipse(gx + 4, gy - 26, 9, 18, 0.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(gx + 6, gy - 50, 8, 0, TAU); g.fill();
      g.save(); g.translate(gx - 6, gy - 20); g.rotate(-0.5);
      g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, TAU); g.fill(); g.fillRect(-30, -1.5, 30, 3); g.restore();
      if (lit) { g.fillStyle = 'rgba(255,150,70,0.5)'; g.fillRect(gx - 4, gy - 44, 3, 36); }
    }
    st.notes.step(dt, (p, k) => {
      g.fillStyle = `rgba(255,220,160,${1 - k})`; g.font = '18px Georgia, serif';
      g.fillText(p.g, p.x + Math.sin(p.age * 3) * 8 + p.d * k, p.y - k * 70);
    });
    // Logs and flames.
    g.fillStyle = '#2a160f';
    g.save(); g.translate(fx, fy); g.rotate(0.25); g.fillRect(-30, -4, 60, 8); g.rotate(-0.5); g.fillRect(-30, -4, 60, 8); g.restore();
    if (lit) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const ph = t * (5 + i) + i * 2;
        const fh = h * (0.08 + 0.05 * Math.abs(Math.sin(ph)) + 0.03 * noise1(t * 3 + i * 9));
        const fw = h * 0.02 + i % 3 * 2;
        const x = fx + (i - 3) * h * 0.008 + Math.sin(ph * 0.7) * 2;
        const gr = g.createLinearGradient(0, fy, 0, fy - fh);
        gr.addColorStop(0, 'rgba(255,230,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,130,40,0.7)'); gr.addColorStop(1, 'rgba(200,40,20,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - fw, fy);
        g.quadraticCurveTo(x - fw, fy - fh * 0.5, x + Math.sin(ph) * 6, fy - fh);
        g.quadraticCurveTo(x + fw, fy - fh * 0.5, x + fw, fy); g.fill();
      }
      g.restore();
      if (Math.random() < dt * 10) st.sparks.add({ x: fx + (Math.random() - 0.5) * 20, y: fy - 20, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 60, age: 0, life: 1.5 + Math.random() });
    } else {
      glow(g, fx, fy, 24, 'rgba(255,90,40,0.5)');
    }
    st.sparks.step(dt, (p, k) => {
      p.x += p.vx * dt + Math.sin(p.age * 6) * 0.4; p.y += p.vy * dt; p.vy *= 0.99;
      g.fillStyle = `rgba(255,${200 - k * 120},90,${1 - k})`;
      g.fillRect(p.x, p.y, 2, 2);
    });
    // Fireflies come out with the crickets.
    for (const f of st.flies.slice(0, on.crickets ? 22 : 5)) {
      f.p += dt * f.s;
      const x = f.x + Math.sin(f.p * 0.7) * 30, y = f.y + Math.cos(f.p * 0.5) * 18;
      const a = Math.max(0, Math.sin(f.p * 2.3));
      glow(g, x, y, 8, `rgba(210,255,120,${a * 0.8})`);
    }
    // Owl in the big pine.
    if (on.owl) {
      st.hoot = Math.max(0, st.hoot - dt);
      const ox = w * 0.1, oy = h * 0.42, s = h * 0.03;
      g.fillStyle = '#050714';
      g.fillRect(ox - s * 2, oy + s * 1.2, s * 5, s * 0.3);
      g.beginPath(); g.ellipse(ox, oy, s, s * 1.4, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(ox - s, oy - s); g.lineTo(ox - s * 0.8, oy - s * 1.9); g.lineTo(ox - s * 0.3, oy - s * 1.2);
      g.lineTo(ox + s * 0.3, oy - s * 1.2); g.lineTo(ox + s * 0.8, oy - s * 1.9); g.lineTo(ox + s, oy - s); g.fill();
      st.blink -= dt;
      if (st.blink < -3) st.blink = 0.15;
      const eye = st.blink > 0 ? 0.2 : st.hoot > 0 ? 1 : 0.55;
      for (const dx of [-0.4, 0.4]) {
        glow(g, ox + dx * s, oy - s * 0.6, s * (st.hoot > 0 ? 1.6 : 0.8), `rgba(255,210,80,${eye * 0.6})`);
        g.fillStyle = `rgba(255,220,90,${eye})`; g.beginPath(); g.arc(ox + dx * s, oy - s * 0.6, s * 0.22, 0, TAU); g.fill();
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Seashore docks at golden hour

const docks = {
  paint(g, w, h, R) {
    const hz = h * 0.56;
    g.fillStyle = vgrad(g, 0, hz, [[0, '#4f9ad8'], [0.45, '#9cc8ea'], [0.78, '#ffd9a8'], [1, '#ffaf80']]);
    g.fillRect(0, 0, w, hz + 2);
    const sx = w * 0.3, sy = hz - h * 0.02;
    glow(g, sx, sy, h * 0.6, 'rgba(255,230,170,0.6)');
    glow(g, sx, sy, h * 0.12, 'rgba(255,250,225,1)');
    // Headland and lighthouse.
    ridge(g, w, hz + 2, x => hz - h * 0.12 * smooth(0.55, 0.9, x / w) * (0.7 + 0.3 * fbm(x * 0.01)), '#5d6f96');
    const lx = w * 0.84, ly = hz - h * 0.1;
    this.lamp = { x: lx, y: ly - h * 0.25 };
    const lh = h * 0.24, lw = h * 0.035;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#c8423c' : '#f6f1e6';
      const y0 = ly - lh * (i + 1) / 4, y1 = ly - lh * i / 4;
      const w0 = lw * (1 - 0.25 * (i + 1) / 4), w1 = lw * (1 - 0.25 * i / 4);
      g.beginPath(); g.moveTo(lx - w1, y1); g.lineTo(lx - w0, y0); g.lineTo(lx + w0, y0); g.lineTo(lx + w1, y1); g.fill();
    }
    g.fillStyle = '#2d3550'; g.fillRect(lx - lw, ly - lh - 4, lw * 2, 4);
    g.fillStyle = '#fff3c0'; g.fillRect(lx - lw * 0.55, ly - lh - h * 0.04, lw * 1.1, h * 0.04);
    g.fillStyle = '#2d3550';
    g.beginPath(); g.moveTo(lx - lw * 0.8, ly - lh - h * 0.04); g.lineTo(lx, ly - lh - h * 0.07); g.lineTo(lx + lw * 0.8, ly - lh - h * 0.04); g.fill();
    // Sea.
    g.fillStyle = vgrad(g, hz, h, [[0, '#6aa6c8'], [0.25, '#3d86ae'], [1, '#124364']]);
    g.fillRect(0, hz, w, h - hz);
    this.hz = hz; this.sun = { x: sx, y: sy };
    // Pier deck and pilings.
    const dy = h * 0.8, dx1 = w * 0.48;
    g.fillStyle = '#4a2c1c';
    for (let x = 14; x < dx1; x += w * 0.06) g.fillRect(x, dy, h * 0.025, h - dy);
    g.fillStyle = vgrad(g, dy - h * 0.035, dy, [[0, '#c28a5a'], [1, '#7a4a2e']]);
    g.fillRect(0, dy - h * 0.035, dx1, h * 0.035);
    g.fillStyle = 'rgba(255,230,190,0.6)'; g.fillRect(0, dy - h * 0.035, dx1, 1.5);
    g.fillStyle = '#3a2216';
    for (let x = 0; x < dx1; x += 18) g.fillRect(x, dy - h * 0.035, 1, h * 0.035);
    // Bollard with rope.
    g.fillStyle = '#2b2b33'; g.beginPath(); g.roundRect(dx1 * 0.62, dy - h * 0.07, h * 0.035, h * 0.04, 5); g.fill();
    g.strokeStyle = '#d7b98a'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(dx1 * 0.62 + h * 0.017, dy - h * 0.05 + i * 3, h * 0.025, 4, 0, 0, TAU); g.stroke(); }
    // Art nouveau lamp post at the end of the pier.
    const px = dx1 - 20;
    g.strokeStyle = '#1f2530'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(px, dy - h * 0.035); g.lineTo(px, dy - h * 0.38);
    g.bezierCurveTo(px, dy - h * 0.46, px - h * 0.09, dy - h * 0.46, px - h * 0.09, dy - h * 0.38); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, dy - h * 0.2); g.bezierCurveTo(px - 18, dy - h * 0.22, px - 18, dy - h * 0.3, px - 6, dy - h * 0.3); g.stroke();
    this.postLamp = { x: px - h * 0.09, y: dy - h * 0.36 };
    this.deck = { y: dy, x1: dx1 };
  },

  init(st, w, h) {
    st.gulls = []; st.bob = 0; st.bell = 0; st.horn = 0; st.waves = []; st.clink = 0; st.creak = 0; st.foam = particles();
    st.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * w, y: h * (0.08 + Math.random() * 0.25), s: 0.6 + Math.random() * 0.8, v: 4 + Math.random() * 6 }));
    st.ship = { x: w * 0.6 };
    for (let i = 0; i < 2; i++) st.gulls.push(this.gull(w, h, true));
  },

  gull(w, h, ambient) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { x: dir > 0 ? -30 : w + 30, y: h * (0.15 + Math.random() * 0.3), dir, v: 50 + Math.random() * 60, p: Math.random() * TAU, ambient, s: 0.7 + Math.random() * 0.6 };
  },

  event(st, e, w, h) {
    if (e.type === 'gull' && st.gulls.length < 8) st.gulls.push(this.gull(w, h));
    if (e.type === 'bell') st.bell = 1;
    if (e.type === 'horn') st.horn = st.hornLen = e.data.dur;
    if (e.type === 'wave') { st.waves.push({ age: 0, size: e.data.size }); for (let i = 0; i < 14; i++) st.foam.add({ x: Math.random() * this.deck.x1, y: h * 0.86, vx: (Math.random() - 0.4) * 40, vy: -60 - Math.random() * 80, age: 0, life: 1.2 }); }
    if (e.type === 'clink') st.clink = 0.6;
    if (e.type === 'creak') st.creak = 1;
  },

  draw(g, w, h, t, dt, st, on) {
    // Clouds.
    for (const c of st.clouds) {
      c.x += c.v * dt; if (c.x > w + 200) c.x = -200;
      g.fillStyle = 'rgba(255,245,235,0.75)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(c.x + i * 28 * c.s, c.y - (i % 2) * 8 * c.s, 34 * c.s, 14 * c.s, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,190,160,0.35)'; g.beginPath(); g.ellipse(c.x + 45 * c.s, c.y + 6 * c.s, 70 * c.s, 6 * c.s, 0, 0, TAU); g.fill();
    }
    // Lighthouse beam swings out to sea.
    const { x: lx, y: ly } = this.lamp;
    const a = t * 0.9;
    const facing = Math.cos(a);
    const reach = w * 0.7 * Math.abs(Math.sin(a));
    const bright = (0.18 + 0.25 * Math.max(0, facing)) * (st.horn > 0 ? 1.6 : 1);
    const dir = Math.sin(a) > 0 ? -1 : 1;
    const gr = g.createLinearGradient(lx, ly, lx + dir * reach, ly);
    gr.addColorStop(0, `rgba(255,248,200,${bright})`); gr.addColorStop(1, 'rgba(255,248,200,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(lx, ly - 3); g.lineTo(lx + dir * reach, ly - h * 0.08); g.lineTo(lx + dir * reach, ly + h * 0.08); g.lineTo(lx, ly + 3); g.fill();
    glow(g, lx, ly, h * (0.05 + 0.04 * Math.max(0, facing)), 'rgba(255,250,210,0.9)');
    // A ship on the horizon answers the foghorn.
    st.horn = Math.max(0, st.horn - dt);
    if (on.foghorn) {
      st.ship.x -= dt * 6; if (st.ship.x < -80) st.ship.x = w + 80;
      const sx = st.ship.x, sy = this.hz;
      g.fillStyle = '#3c4b6e';
      g.fillRect(sx - 40, sy - 8, 80, 8); g.fillRect(sx - 18, sy - 16, 30, 8); g.fillRect(sx + 2, sy - 26, 6, 10);
      if (st.horn > 0) {
        glow(g, sx + 5, sy - 18, 30, 'rgba(255,255,220,0.7)');
        const k = 1 - st.horn / st.hornLen;
        g.strokeStyle = `rgba(255,255,255,${0.4 * (1 - k)})`; g.lineWidth = 1.5;
        g.beginPath(); g.arc(sx + 5, sy - 26, 10 + k * 70, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; g.beginPath(); g.arc(sx + 5, sy - 30 - k * 20, 4 + k * 10, 0, TAU); g.fill();
      }
    }
    // Sun glitter and swell lines.
    const swell = on.waves ? 1 : 0.4;
    for (let i = 0; i < 24; i++) {
      const y = this.hz + 3 + Math.pow(i / 24, 1.5) * (h - this.hz);
      const spread = 8 + i * 4;
      const x = this.sun.x + Math.sin(t * 1.3 + i * 2.1) * spread;
      g.fillStyle = `rgba(255,240,200,${0.7 - i * 0.025})`;
      g.fillRect(x - spread * 0.6, y, spread * 1.2, 1.5);
    }
    g.strokeStyle = 'rgba(220,240,255,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const y = this.hz + 12 + i * (h - this.hz) / 9;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = y + Math.sin(x * 0.02 + t * (0.8 + i * 0.1) + i) * (2 + i) * swell;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
    // Buoy.
    st.bell = Math.max(0, st.bell - dt * 0.5);
    const bx = w * 0.5, by = h * 0.7 + Math.sin(t * 1.4) * 3 * swell;
    const tilt = Math.sin(t * 1.1) * 0.12 * swell + Math.sin(t * 9) * 0.2 * st.bell;
    g.save(); g.translate(bx, by); g.rotate(tilt);
    g.fillStyle = '#c8302c'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-8, -26); g.lineTo(8, -26); g.lineTo(14, 0); g.fill();
    g.fillStyle = '#f2e9d8'; g.fillRect(-11, -14, 22, 4);
    g.strokeStyle = '#2a2a33'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -26); g.lineTo(0, -40); g.lineTo(8, -26); g.stroke();
    g.fillStyle = '#d6a640'; g.beginPath(); g.arc(0, -32, 4, 0, TAU); g.fill();
    g.restore();
    if (on.buoy && st.bell > 0.5) {
      g.strokeStyle = `rgba(255,240,200,${(st.bell - 0.5) * 1.2})`; g.lineWidth = 1;
      g.beginPath(); g.arc(bx, by - 32, 10 + (1 - st.bell) * 50, 0, TAU); g.stroke();
    }
    // Sailboats.
    st.creak = Math.max(0, st.creak - dt * 0.6);
    st.clink = Math.max(0, st.clink - dt);
    for (const [i, fx] of [[0, 0.6], [1, 0.72]]) {
      const x = w * fx, y = h * 0.74 + i * h * 0.035;
      const rock = Math.sin(t * (1 + i * 0.3) + i) * (0.04 * swell + 0.06 * st.creak);
      const L = h * (0.1 + i * 0.025), mast = h * (0.26 + i * 0.05);
      g.save(); g.translate(x, y + Math.sin(t * 1.3 + i) * 2 * swell); g.rotate(rock);
      g.fillStyle = i ? '#f3eee2' : '#244a6e';
      g.beginPath(); g.moveTo(-L, -L * 0.08); g.lineTo(L * 1.05, -L * 0.1); g.quadraticCurveTo(L * 0.9, L * 0.14, L * 0.7, L * 0.16); g.lineTo(-L * 0.8, L * 0.16); g.quadraticCurveTo(-L * 0.95, L * 0.1, -L, -L * 0.08); g.fill();
      g.fillStyle = i ? '#c8423c' : '#f3eee2'; g.fillRect(-L * 0.95, -L * 0.02, L * 1.95, L * 0.035);
      g.fillStyle = 'rgba(10,40,60,0.35)'; g.beginPath(); g.ellipse(0, L * 0.2, L * 0.9, L * 0.05, 0, 0, TAU); g.fill();
      g.fillStyle = '#f6efe2'; g.fillRect(-L * 0.25, -L * 0.22, L * 0.4, L * 0.13);
      g.strokeStyle = '#2b2b33'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -L * 0.1); g.lineTo(0, -mast); g.stroke();
      g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -mast); g.lineTo(-L * 0.95, -L * 0.08); g.moveTo(0, -mast); g.lineTo(L, -L * 0.1); g.stroke();
      g.fillStyle = '#e9dccb'; g.beginPath(); g.roundRect(-2, -mast * 0.42, L * 0.75, 5, 2.5); g.fill();
      const flap = Math.sin(t * 12) * (2 + st.clink * 6);
      g.fillStyle = i ? '#ff5a3c' : '#ffd23c';
      g.beginPath(); g.moveTo(0, -mast); g.lineTo(16, -mast + 3 + flap); g.lineTo(0, -mast + 7); g.fill();
      g.restore();
    }
    // Breaking waves against the pilings.
    for (let i = st.waves.length - 1; i >= 0; i--) {
      const wv = st.waves[i]; wv.age += dt;
      if (wv.age > 2) { st.waves.splice(i, 1); continue; }
      const k = wv.age / 2;
      g.fillStyle = `rgba(240,250,255,${0.6 * (1 - k)})`;
      for (let x = 0; x < this.deck.x1 + 40; x += 24) {
        g.beginPath(); g.ellipse(x + k * 30, h * 0.92 - Math.sin(k * Math.PI) * h * 0.06 * wv.size, 18, 5 + 6 * Math.sin(k * Math.PI), 0, 0, TAU); g.fill();
      }
    }
    st.foam.step(dt, (p, k) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
      g.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; g.fillRect(p.x, p.y, 2.5, 2.5);
    });
    // Gulls.
    for (let i = st.gulls.length - 1; i >= 0; i--) {
      const gl = st.gulls[i];
      if (gl.ambient && !on.gulls) { st.gulls.splice(i, 1); continue; }
      gl.x += gl.dir * gl.v * dt; gl.p += dt * 7;
      gl.y += Math.sin(gl.p * 0.2) * 0.3;
      if (gl.x < -60 || gl.x > w + 60) { if (gl.ambient) Object.assign(gl, this.gull(w, h, true)); else { st.gulls.splice(i, 1); continue; } }
      const f = Math.sin(gl.p) * 6 * gl.s, s = gl.s;
      g.strokeStyle = '#f7f4ee'; g.lineWidth = 2.2 * s;
      g.beginPath(); g.moveTo(gl.x - 14 * s, gl.y - f); g.quadraticCurveTo(gl.x - 6 * s, gl.y - 6 * s, gl.x, gl.y); g.quadraticCurveTo(gl.x + 6 * s, gl.y - 6 * s, gl.x + 14 * s, gl.y - f); g.stroke();
      g.strokeStyle = 'rgba(60,70,90,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(gl.x - 14 * s, gl.y - f); g.lineTo(gl.x - 10 * s, gl.y - f * 0.9); g.stroke();
    }
    if (on.gulls && st.gulls.filter(x => x.ambient).length < 2) st.gulls.push(this.gull(w, h, true));
    glow(g, this.postLamp.x, this.postLamp.y, 26, 'rgba(255,220,150,0.7)');
  },
};

// ---------------------------------------------------------------------------
// Neon night market in the rain

const SIGNS = [
  { text: 'NOODLES', color: '#ff3ea5', x: 0.12, y: 0.36, size: 0.07, landmark: true },
  { text: 'OPEN 25 HRS', color: '#35f2ff', x: 0.68, y: 0.3, size: 0.045 },
  { text: 'TEA', color: '#ffb547', x: 0.86, y: 0.42, size: 0.07 },
  { text: 'KARAOKE', color: '#b07bff', x: 0.44, y: 0.24, size: 0.05 },
  { text: 'DUMPLINGS', color: '#5dff9e', x: 0.58, y: 0.5, size: 0.04 },
];

const market = {
  paint(g, w, h, R) {
    g.fillStyle = vgrad(g, 0, h * 0.78, [[0, '#0d0420'], [0.6, '#2a0d45'], [1, '#55175f']]);
    g.fillRect(0, 0, w, h);
    // Far towers.
    let x = -10;
    while (x < w) {
      const bw = 30 + R() * 60, bh = h * (0.35 + R() * 0.4);
      g.fillStyle = '#1c0b35'; g.fillRect(x, h * 0.78 - bh, bw, bh);
      for (let wy = h * 0.78 - bh + 8; wy < h * 0.76; wy += 9) for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
        if (R() < 0.25) { g.fillStyle = ['#ffce7a', '#ff6ec7', '#5ef0ff'][Math.floor(R() * 3)]; g.globalAlpha = 0.5; g.fillRect(wx, wy, 3, 4); g.globalAlpha = 1; }
      }
      x += bw + 4;
    }
    // Near buildings, two side walls.
    g.fillStyle = '#140826';
    g.fillRect(0, h * 0.12, w * 0.32, h); g.fillRect(w * 0.76, h * 0.2, w * 0.24, h);
    g.fillStyle = '#1d0c33';
    for (let i = 0; i < 7; i++) { g.fillRect(w * 0.02, h * (0.2 + i * 0.09), w * 0.27, 2); g.fillRect(w * 0.78, h * (0.26 + i * 0.09), w * 0.2, 2); }
    // Wet street.
    g.fillStyle = vgrad(g, h * 0.78, h, [[0, '#2a1240'], [1, '#08040f']]);
    g.fillRect(0, h * 0.78, w, h * 0.22);
    // Stall awnings.
    this.stalls = [];
    const cols = ['#ff3ea5', '#35f2ff', '#ffb547'];
    for (let i = 0; i < 3; i++) {
      const sx = w * (0.08 + i * 0.3), sw = w * 0.2, sy = h * 0.68;
      this.stalls.push({ x: sx + sw / 2, y: sy });
      g.fillStyle = '#1a0a28'; g.fillRect(sx + 6, sy, sw - 12, h * 0.12);
      for (let j = 0; j < 8; j++) {
        g.fillStyle = j % 2 ? '#f6efe4' : cols[i];
        g.fillRect(sx + j * sw / 8, sy - h * 0.06, sw / 8, h * 0.06);
        g.beginPath(); g.arc(sx + (j + 0.5) * sw / 8, sy, sw / 16, 0, Math.PI); g.fill();
      }
      g.fillStyle = 'rgba(255,200,120,0.25)'; g.fillRect(sx + 10, sy + 6, sw - 20, h * 0.05);
    }
  },

  init(st, w, h) {
    st.rain = Array.from({ length: 220 }, () => ({ x: Math.random() * w * 1.2, y: Math.random() * h, v: 500 + Math.random() * 300 }));
    st.splash = particles(); st.steam = particles(); st.scooters = []; st.flicker = 0; st.pulse = 0; st.noteGlow = particles();
    st.people = Array.from({ length: 11 }, (_, i) => ({ x: Math.random() * w, v: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18), s: 0.8 + Math.random() * 0.5, umb: Math.random() < 0.5, c: ['#ff3ea5', '#35f2ff', '#ffb547'][i % 3], p: Math.random() * TAU }));
    st.blimp = { x: w * 0.7 };
  },

  event(st, e, w, h) {
    if (e.type === 'flicker') st.flicker = e.data.dur;
    if (e.type === 'sizzle') { const s = this.stalls[Math.floor(Math.random() * 3)]; for (let i = 0; i < 12; i++) st.steam.add({ x: s.x + (Math.random() - 0.5) * 40, y: s.y + 8, r: 6, age: -i * 0.08, life: 2.4 }); }
    if (e.type === 'scooter') st.scooters.push({ age: 0, dur: e.data.dur, dir: e.data.dir, trail: [] });
    if (e.type === 'note') { st.pulse = 1; st.noteGlow.add({ x: w * 0.9, y: h * 0.62, age: 0, life: 1.4, hue: e.data.n }); }
  },

  draw(g, w, h, t, dt, st, on) {
    // A blimp with an advert.
    st.blimp.x -= dt * 8; if (st.blimp.x < -140) st.blimp.x = w + 140;
    const bx = st.blimp.x, by = h * 0.22;
    g.fillStyle = '#2b1748'; g.beginPath(); g.ellipse(bx, by, 70, 20, 0, 0, TAU); g.fill();
    g.fillStyle = '#35f2ff'; g.globalAlpha = 0.85; g.font = '600 11px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TUNE IN · DEEP DIAL', bx, by + 1); g.globalAlpha = 1;
    // Lanterns.
    const sag = h * 0.06;
    g.strokeStyle = '#1a0a1a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(w * 0.3, h * 0.32); g.quadraticCurveTo(w * 0.54, h * 0.32 + sag * 2, w * 0.78, h * 0.36); g.stroke();
    for (let i = 1; i < 9; i++) {
      const k = i / 9, x = lerp(w * 0.3, w * 0.78, k), y = lerp(h * 0.32, h * 0.36, k) + 4 * sag * k * (1 - k) + 6;
      const sw = Math.sin(t * 1.4 + i) * 3;
      glow(g, x + sw, y + 10, 26, 'rgba(255,90,60,0.45)');
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.ellipse(x + sw, y + 10, 7, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd27a'; g.fillRect(x + sw - 4, y + 9, 8, 1.5);
    }
    // Neon signs.
    st.flicker = Math.max(0, st.flicker - dt);
    const power = on.neon ? 1 : 0.35;
    for (const s of SIGNS) {
      let a = power * (0.85 + 0.15 * Math.sin(t * 50 + s.x * 10));
      if (s.landmark && st.flicker > 0) a = Math.sin(t * 90) > 0 ? 0.15 : 1;
      const size = Math.round(Math.min(h, w * 0.42) * s.size);
      g.font = `400 ${size}px Federant, "Marcellus SC", Georgia, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save();
      g.globalAlpha = a;
      g.shadowColor = s.color; g.shadowBlur = 18 * a;
      g.strokeStyle = s.color; g.lineWidth = Math.max(1.5, size * 0.06);
      g.strokeText(s.text, w * s.x, h * s.y);
      g.fillStyle = '#fff'; g.globalAlpha = a * 0.75; g.fillText(s.text, w * s.x, h * s.y);
      g.restore();
    }
    // Reflections in the puddles.
    g.save(); g.globalAlpha = 0.35 * power;
    for (const s of SIGNS) {
      const gr = g.createLinearGradient(0, h * 0.8, 0, h);
      gr.addColorStop(0, s.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (let i = 0; i < 5; i++) g.fillRect(w * s.x - 24 + i * 12 + Math.sin(t * 2 + i) * 2, h * 0.8, 5, h * 0.2);
    }
    g.restore();
    // Steam.
    st.steam.step(dt, (p, k) => {
      if (p.age < 0) return;
      p.y -= 30 * dt; p.r += 16 * dt; p.x += Math.sin(p.age * 2) * 0.4;
      g.fillStyle = `rgba(255,240,250,${0.35 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    });
    // Crowd under umbrellas.
    if (on.crowd) {
      for (const p of st.people) {
        p.x += p.v * dt; p.p += dt * 5;
        if (p.x < -30) p.x = w + 30; if (p.x > w + 30) p.x = -30;
        const s = p.s * h * 0.0045, y = h * 0.9 + Math.abs(Math.sin(p.p)) * -2;
        g.fillStyle = '#07030d';
        g.beginPath(); g.roundRect(p.x - 4 * s, y - 22 * s, 8 * s, 22 * s, 3 * s); g.fill();
        g.beginPath(); g.arc(p.x, y - 25 * s, 3.4 * s, 0, TAU); g.fill();
        g.strokeStyle = p.c; g.globalAlpha = 0.6; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + 4 * s, y - 20 * s); g.lineTo(p.x + 4 * s, y - 4 * s); g.stroke(); g.globalAlpha = 1;
        if (p.umb) { g.fillStyle = p.c; g.globalAlpha = 0.85; g.beginPath(); g.arc(p.x, y - 30 * s, 9 * s, Math.PI, TAU); g.fill(); g.globalAlpha = 1; }
      }
    }
    // Busker with a keytar.
    if (on.busker) {
      st.pulse = Math.max(0, st.pulse - dt * 3);
      const x = w * 0.9, y = h * 0.9, s = h * 0.005;
      glow(g, x, y - 20 * s, 60 * s * (1 + st.pulse * 0.5), `rgba(176,123,255,${0.3 + st.pulse * 0.4})`);
      g.fillStyle = '#05020a';
      g.beginPath(); g.roundRect(x - 5 * s, y - 26 * s, 10 * s, 26 * s, 4 * s); g.fill();
      g.beginPath(); g.arc(x, y - 30 * s, 4 * s, 0, TAU); g.fill();
      g.save(); g.translate(x, y - 15 * s); g.rotate(-0.3); g.fillStyle = '#b07bff'; g.fillRect(-14 * s, -2 * s, 26 * s, 4 * s); g.restore();
    }
    st.noteGlow.step(dt, (p, k) => {
      g.strokeStyle = `hsla(${280 + p.hue * 20},100%,70%,${1 - k})`; g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x, p.y, 10 + k * 40, 0, TAU); g.stroke();
    });
    // Hover scooters with light trails.
    for (let i = st.scooters.length - 1; i >= 0; i--) {
      const sc = st.scooters[i]; sc.age += dt;
      const k = sc.age / sc.dur;
      if (k > 1.3) { st.scooters.splice(i, 1); continue; }
      const x = sc.dir > 0 ? lerp(-60, w + 60, k) : lerp(w + 60, -60, k), y = h * 0.82 + Math.sin(sc.age * 6) * 2;
      if (k <= 1) sc.trail.push({ x, y });
      if (sc.trail.length > 30) sc.trail.shift();
      g.strokeStyle = 'rgba(53,242,255,0.6)'; g.lineWidth = 3; g.beginPath();
      sc.trail.forEach((p, j) => (j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
      if (k <= 1) {
        glow(g, x, y + 8, 40, 'rgba(53,242,255,0.5)');
        g.fillStyle = '#0b0614'; g.beginPath(); g.roundRect(x - 22, y - 6, 44, 10, 5); g.fill();
        g.beginPath(); g.roundRect(x - 5, y - 26, 10, 20, 4); g.fill(); g.beginPath(); g.arc(x, y - 30, 5, 0, TAU); g.fill();
        glow(g, x + sc.dir * 22, y - 2, 14, 'rgba(255,255,220,0.9)');
      }
    }
    // Rain.
    if (on.rain) {
      g.strokeStyle = 'rgba(210,190,255,0.35)'; g.lineWidth = 1;
      g.beginPath();
      for (const d of st.rain) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.15;
        if (d.y > h) { if (Math.random() < 0.3) st.splash.add({ x: d.x, y: h * (0.8 + Math.random() * 0.2), age: 0, life: 0.35 }); d.y = -10; d.x = Math.random() * w * 1.2; }
        g.moveTo(d.x, d.y); g.lineTo(d.x + 3, d.y - 14);
      }
      g.stroke();
    }
    st.splash.step(dt, (p, k) => {
      g.strokeStyle = `rgba(220,200,255,${0.6 * (1 - k)})`; g.beginPath(); g.ellipse(p.x, p.y, 2 + k * 8, 1 + k * 2, 0, 0, TAU); g.stroke();
    });
  },
};

// ---------------------------------------------------------------------------
// The abyssal trench, the only scene that is actually outside a submarine

const trench = {
  paint(g, w, h, R) {
    g.fillStyle = vgrad(g, 0, h, [[0, '#0b4a78'], [0.35, '#06294a'], [1, '#01070f']]);
    g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = w * (0.1 + i * 0.17 + R() * 0.05);
      const gr = g.createLinearGradient(0, 0, 0, h * 0.8);
      gr.addColorStop(0, 'rgba(120,200,255,0.12)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x + 120, h * 0.8); g.lineTo(x + 40, h * 0.8); g.fill();
    }
    g.restore();
    // A wreck in the far distance.
    const wx = w * 0.62, wy = h * 0.66;
    g.fillStyle = '#06233d';
    g.beginPath(); g.moveTo(wx - 90, wy); g.lineTo(wx + 80, wy - 10); g.lineTo(wx + 60, wy + 18); g.lineTo(wx - 70, wy + 22); g.fill();
    g.fillRect(wx - 20, wy - 70, 4, 66); g.fillRect(wx + 25, wy - 55, 3, 50); g.fillRect(wx - 40, wy - 50, 70, 2);
    this.wreck = { x: wx, y: wy };
    // Canyon walls.
    g.fillStyle = '#031426';
    g.beginPath(); g.moveTo(0, 0);
    for (let y = 0; y <= h; y += 8) g.lineTo(w * (0.12 + 0.1 * fbm(y * 0.012 + 4)) + Math.sin(y * 0.05) * 6, y);
    g.lineTo(0, h); g.fill();
    g.beginPath(); g.moveTo(w, 0);
    for (let y = 0; y <= h; y += 8) g.lineTo(w * (0.86 - 0.1 * fbm(y * 0.012 + 9)), y);
    g.lineTo(w, h); g.fill();
    ridge(g, w, h, x => h * 0.86 - h * 0.08 * fbm(x * 0.008 + 1), '#020c18');
    // Glowing spots on the rocks.
    this.spots = [];
    for (let i = 0; i < 40; i++) this.spots.push({ x: R() < 0.5 ? R() * w * 0.18 : w - R() * w * 0.16, y: R() * h, p: R() * TAU, c: R() < 0.5 ? '90,255,220' : '255,110,200' });
    // Vent chimneys.
    this.vents = [w * 0.3, w * 0.36];
    g.fillStyle = '#05101c';
    for (const vx of this.vents) { g.beginPath(); g.moveTo(vx - 14, h * 0.9); g.lineTo(vx - 5, h * 0.72); g.lineTo(vx + 5, h * 0.72); g.lineTo(vx + 16, h * 0.9); g.fill(); }
  },

  init(st, w, h) {
    st.snow = Array.from({ length: 140 }, () => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() * 1.5 + 0.5, v: 6 + Math.random() * 12 }));
    st.jellies = Array.from({ length: 4 }, (_, i) => ({ x: w * (0.25 + i * 0.17), y: h * (0.3 + (i % 2) * 0.2), p: Math.random() * TAU, c: i % 2 ? '255,110,200' : '90,240,255', s: 0.7 + Math.random() * 0.6 }));
    st.rings = []; st.whales = []; st.bubbles = particles(); st.plume = particles(); st.ghost = 0;
    st.shake = 0;
  },

  event(st, e, w, h) {
    if (e.type === 'ping') st.rings.push({ age: 0 });
    if (e.type === 'whale') st.whales.push({ age: 0, dur: e.data.dur + 14, dir: Math.random() < 0.5 ? 1 : -1, y: h * (0.25 + Math.random() * 0.2) });
    if (e.type === 'bubbles') for (let i = 0; i < e.data.count * 2; i++) st.bubbles.add({ x: w * (0.3 + Math.random() * 0.4), y: h + Math.random() * 40, r: 2 + Math.random() * 5, age: 0, life: 4, v: 50 + Math.random() * 60, p: Math.random() * TAU });
    if (e.type === 'groan') st.shake = e.data.dur;
    if (e.type === 'ghost') st.ghost = e.data.dur;
  },

  draw(g, w, h, t, dt, st, on) {
    // Whale passing in the distance.
    for (let i = st.whales.length - 1; i >= 0; i--) {
      const wh = st.whales[i]; wh.age += dt;
      const k = wh.age / wh.dur;
      if (k > 1) { st.whales.splice(i, 1); continue; }
      const L = w * 0.35, x = wh.dir > 0 ? lerp(-L, w + L, k) : lerp(w + L, -L, k), y = wh.y + Math.sin(wh.age * 0.6) * 10;
      g.save(); g.translate(x, y); g.scale(wh.dir, 1); g.globalAlpha = 0.7;
      g.fillStyle = '#0a3354';
      g.beginPath(); g.moveTo(L * 0.5, 0);
      g.bezierCurveTo(L * 0.45, -L * 0.12, L * 0.1, -L * 0.13, -L * 0.3, -L * 0.04);
      g.lineTo(-L * 0.45, -L * 0.12 + Math.sin(wh.age * 1.4) * L * 0.03); g.lineTo(-L * 0.42, 0); g.lineTo(-L * 0.45, L * 0.1 + Math.sin(wh.age * 1.4) * L * 0.03);
      g.lineTo(-L * 0.3, L * 0.04); g.bezierCurveTo(L * 0.1, L * 0.1, L * 0.45, L * 0.08, L * 0.5, 0); g.fill();
      g.beginPath(); g.moveTo(L * 0.1, L * 0.06); g.lineTo(-L * 0.02, L * 0.16); g.lineTo(-L * 0.04, L * 0.06); g.fill();
      g.restore();
    }
    // Ghost lights on the wreck.
    st.ghost = Math.max(0, st.ghost - dt);
    if (st.ghost > 0) {
      const { x, y } = this.wreck;
      for (const [dx, dy] of [[-50, -8], [-10, -12], [30, -14], [-18, -60]]) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 7 + dx));
        glow(g, x + dx, y + dy, 18, `rgba(150,255,200,${a * 0.6})`);
      }
    }
    // Rock lights.
    for (const s of this.spots) {
      const a = 0.4 + 0.6 * Math.sin(t * 1.5 + s.p);
      glow(g, s.x, s.y, 6, `rgba(${s.c},${a * 0.7})`);
    }
    // Vent plumes when the current runs.
    if (on.current && Math.random() < dt * 14) {
      const vx = this.vents[Math.random() < 0.5 ? 0 : 1];
      st.plume.add({ x: vx, y: h * 0.72, r: 5, age: 0, life: 4 });
    }
    st.plume.step(dt, (p, k) => {
      p.y -= 26 * dt; p.r += 9 * dt; p.x += Math.sin(p.age) * 0.5 + 6 * dt;
      g.fillStyle = `rgba(10,20,30,${0.55 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    });
    if (on.current) for (const vx of this.vents) glow(g, vx, h * 0.73, 16, 'rgba(255,120,60,0.6)');
    // Jellyfish.
    for (const j of st.jellies) {
      j.p += dt * 1.6;
      const pulse = 1 + 0.15 * Math.sin(j.p * 2);
      j.y += Math.sin(j.p) * 0.25 - dt * (on.current ? 3 : 1);
      j.x += (on.current ? 8 : 2) * dt;
      if (j.x > w + 40) j.x = -40;
      if (j.y < -40) j.y = h * 0.8;
      const r = h * 0.03 * j.s;
      glow(g, j.x, j.y, r * 3, `rgba(${j.c},0.25)`);
      g.fillStyle = `rgba(${j.c},0.55)`;
      g.beginPath(); g.ellipse(j.x, j.y, r * pulse, r * 0.8 / pulse, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = `rgba(${j.c},0.45)`; g.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(j.x + i * r * 0.35, j.y);
        for (let s = 1; s <= 6; s++) g.lineTo(j.x + i * r * 0.35 + Math.sin(j.p * 2 + s + i) * 3, j.y + s * r * 0.35);
        g.stroke();
      }
    }
    // Anglerfish lure.
    const ax = w * 0.8, ay = h * 0.78;
    glow(g, ax, ay - 18, 26, `rgba(200,255,220,${0.5 + 0.3 * Math.sin(t * 3)})`);
    g.fillStyle = '#020a14'; g.beginPath(); g.ellipse(ax + 20, ay, 24, 14, 0, 0, TAU); g.fill();
    g.strokeStyle = '#03131f'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax + 8, ay - 10); g.quadraticCurveTo(ax, ay - 30, ax, ay - 18); g.stroke();
    // Marine snow.
    g.fillStyle = 'rgba(220,240,255,0.5)';
    for (const s of st.snow) {
      s.y += s.v * dt * 0.5; s.x += (on.current ? 14 : 3) * dt;
      if (s.y > h) s.y = -4; if (s.x > w) s.x = 0;
      g.fillRect(s.x, s.y, s.s, s.s);
    }
    // Sonar rings.
    for (let i = st.rings.length - 1; i >= 0; i--) {
      const r = st.rings[i]; r.age += dt;
      if (r.age > 3) { st.rings.splice(i, 1); continue; }
      for (let k = 0; k < 3; k++) {
        const a = r.age - k * 0.9;
        if (a < 0) continue;
        g.strokeStyle = `rgba(120,255,200,${0.5 * Math.max(0, 1 - a / 2) * (1 - k * 0.3)})`; g.lineWidth = 2;
        g.beginPath(); g.ellipse(w / 2, h * 0.55, a * w * 0.25, a * h * 0.18, 0, 0, TAU); g.stroke();
      }
    }
    // Bubbles.
    st.bubbles.step(dt, (p, k) => {
      p.y -= p.v * dt; p.x += Math.sin(p.age * 4 + p.p) * 0.6;
      g.strokeStyle = `rgba(200,240,255,${0.7 * (1 - k)})`; g.lineWidth = 1;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
      g.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; g.fillRect(p.x - p.r * 0.4, p.y - p.r * 0.5, 1.5, 1.5);
    });
  },
};

export const SCENES = { prairie, campground, docks, market, trench };

// ---------------------------------------------------------------------------
// The viewport: scene canvas, crossfades, events.

export class Viewport {
  constructor(canvas, { reducedMotion = false, onShake } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.reduced = reducedMotion;
    this.onShake = onShake;
    this.states = {};
    this.statics = {};
    this.envId = null;
    this.prev = null;
    this.fade = 1;
    this.on = {};
    this.t = 0;
    this.bubbles = [];
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.statics = {};
    this.states = {};
  }

  scene(id) {
    const sc = SCENES[id];
    if (!this.statics[id]) {
      const c = document.createElement('canvas');
      c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
      const g = c.getContext('2d');
      g.scale(this.dpr, this.dpr);
      sc.paint(g, this.w, this.h, seeded(id.length * 7919 + 13));
      this.statics[id] = c;
      const st = {};
      sc.init(st, this.w, this.h);
      this.states[id] = st;
    }
    return { sc, still: this.statics[id], st: this.states[id] };
  }

  setEnv(id, instant = false) {
    if (id === this.envId) return;
    this.prev = instant ? null : this.envId;
    this.envId = id;
    this.fade = instant || !this.prev ? 1 : 0;
    if (this.prev && !this.reduced) {
      for (let i = 0; i < 70; i++) this.bubbles.push({ x: Math.random() * this.w, y: this.h + Math.random() * this.h, r: 2 + Math.random() * 9, v: 300 + Math.random() * 500 });
    }
  }

  setLayers(on) { this.on = on; }

  event(e) {
    if (!this.envId) return;
    const { sc, st } = this.scene(this.envId);
    sc.event(st, e, this.w, this.h);
    if (e.type === 'groan' && !this.reduced && this.onShake) this.onShake(e.data.dur);
  }

  frame(dt) {
    if (!this.envId) return;
    dt = Math.min(0.05, dt);
    this.t += dt;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.prev && this.fade < 1) this.fade = Math.min(1, this.fade + dt / 1.4);
    if (this.prev && this.fade < 1) {
      this.drawScene(this.prev, dt, {}, g);
      // Scenes set their own alpha, so paint the newcomer aside and fade it in whole.
      if (!this.buf || this.buf.width !== this.canvas.width || this.buf.height !== this.canvas.height) {
        this.buf = document.createElement('canvas');
        this.buf.width = this.canvas.width; this.buf.height = this.canvas.height;
      }
      const bg = this.buf.getContext('2d');
      bg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      bg.clearRect(0, 0, this.w, this.h);
      this.drawScene(this.envId, dt, this.on, bg);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = smooth(0.25, 1, this.fade);
      g.drawImage(this.buf, 0, 0);
      g.restore();
    } else {
      this.prev = null;
      this.drawScene(this.envId, dt, this.on, g);
    }
    // The dive: a rush of bubbles and a blue wash between scenes.
    if (this.bubbles.length) {
      const wash = Math.sin(Math.PI * Math.min(1, this.fade));
      g.fillStyle = `rgba(10,40,80,${0.55 * wash})`;
      g.fillRect(0, 0, this.w, this.h);
      g.strokeStyle = 'rgba(220,245,255,0.7)'; g.lineWidth = 1.2;
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        b.y -= b.v * dt;
        if (b.y < -20) { this.bubbles.splice(i, 1); continue; }
        g.beginPath(); g.arc(b.x + Math.sin(b.y * 0.03) * 4, b.y, b.r, 0, TAU); g.stroke();
      }
    }
  }

  drawScene(id, dt, on, g) {
    const { sc, still, st } = this.scene(id);
    g.save();
    g.drawImage(still, 0, 0, this.w, this.h);
    sc.draw.call(sc, g, this.w, this.h, this.t, this.reduced ? dt * 0.5 : dt, st, on);
    g.restore();
  }
}
