// The cockpit window frame: polished nickel with brass whiplash ornament,
// three panes of glass and a neon strip along the sill. Painted once per
// resize (and per scene, for the neon colour) on a canvas above the scene.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function frameGeometry(w, h) {
  const T = clamp(h * 0.1, 16, 46);
  const B = clamp(h * 0.09, 16, 40);
  const S = clamp(w * 0.014, 8, 24);
  const M = clamp(w * 0.014, 10, 22);
  const side = w < 560 ? w * 0.17 : w * 0.2;
  const yBot = h - B;
  const panes = [
    { x0: S, x1: side - M / 2, kind: 'left' },
    { x0: side + M / 2, x1: w - side - M / 2, kind: 'center' },
    { x0: w - side + M / 2, x1: w - S, kind: 'right' },
  ];
  return { T, B, S, M, side, yBot, panes };
}

function panePath(g, p, geo, h) {
  const { T, yBot } = geo;
  const { x0, x1, kind } = p;
  const pw = x1 - x0;
  if (kind === 'center') {
    g.moveTo(x0, yBot);
    g.lineTo(x0, T + h * 0.03);
    g.quadraticCurveTo((x0 + x1) / 2, T - h * 0.05, x1, T + h * 0.03);
    g.lineTo(x1, yBot);
    g.closePath();
  } else if (kind === 'left') {
    g.moveTo(x0, yBot - 8);
    g.lineTo(x0, T + h * 0.22);
    g.quadraticCurveTo(x0, T + h * 0.05, x0 + pw * 0.55, T + h * 0.045);
    g.lineTo(x1, T + h * 0.03);
    g.lineTo(x1, yBot);
    g.lineTo(x0 + 8, yBot);
    g.quadraticCurveTo(x0, yBot, x0, yBot - 8);
    g.closePath();
  } else {
    g.moveTo(x1, yBot - 8);
    g.lineTo(x1, T + h * 0.22);
    g.quadraticCurveTo(x1, T + h * 0.05, x1 - pw * 0.55, T + h * 0.045);
    g.lineTo(x0, T + h * 0.03);
    g.lineTo(x0, yBot);
    g.lineTo(x1 - 8, yBot);
    g.quadraticCurveTo(x1, yBot, x1, yBot - 8);
    g.closePath();
  }
}

function rivet(g, x, y, r) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
  gr.addColorStop(0, '#fffdf4'); gr.addColorStop(0.45, '#c9bfa8'); gr.addColorStop(1, '#5a5244');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

// A whiplash tendril ending in a curl: the Art Nouveau signature stroke.
function tendril(g, x, y, dir, len, rise, curl) {
  g.beginPath();
  g.moveTo(x, y);
  const ex = x + dir * len, ey = y - rise;
  g.bezierCurveTo(x + dir * len * 0.2, y - rise * 1.4, x + dir * len * 0.65, y + rise * 0.6, ex, ey);
  let a = dir > 0 ? Math.PI : 0, r = curl, cx = ex + dir * curl, cy = ey;
  for (let i = 0; i < 28; i++) {
    a += dir * 0.32; r *= 0.93;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.stroke();
}

function leaf(g, x, y, ang, len) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.35, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.35, 0, 0);
  g.fill(); g.restore();
}

export function drawFrame(canvas, hue = '#35f2ff') {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const geo = frameGeometry(w, h);
  const { T, B, yBot, panes, M } = geo;

  // Polished nickel body with the panes cut out.
  g.save();
  g.beginPath(); g.rect(0, 0, w, h);
  for (const p of panes) panePath(g, p, geo, h);
  const metal = g.createLinearGradient(0, 0, 0, h);
  metal.addColorStop(0, '#fbf8f0'); metal.addColorStop(0.04, '#d9d2c2'); metal.addColorStop(0.09, '#8d8574');
  metal.addColorStop(0.13, '#e7e1d3'); metal.addColorStop(0.5, '#b7af9e');
  metal.addColorStop(0.87, '#d8d1c1'); metal.addColorStop(0.93, '#7d7566'); metal.addColorStop(1, '#4b453b');
  g.fillStyle = metal;
  g.fill('evenodd');
  g.clip('evenodd');
  // Brushed grain.
  g.globalAlpha = 0.07;
  for (let y = 0; y < h; y += 2) { g.fillStyle = y % 4 ? '#fff' : '#000'; g.fillRect(0, y, w, 1); }
  g.globalAlpha = 1;
  // Mullions read as polished columns.
  for (let i = 0; i < 2; i++) {
    const x = panes[i].x1, x2 = panes[i + 1].x0;
    const gr = g.createLinearGradient(x, 0, x2, 0);
    gr.addColorStop(0, '#5f584b'); gr.addColorStop(0.3, '#fffaf0'); gr.addColorStop(0.55, '#bdb5a3'); gr.addColorStop(1, '#4e483d');
    g.fillStyle = gr; g.fillRect(x, 0, x2 - x, h);
  }
  g.restore();

  // Brass ornament.
  const brass = g.createLinearGradient(0, 0, 0, T * 1.6);
  brass.addColorStop(0, '#fff0b8'); brass.addColorStop(0.5, '#d6a53e'); brass.addColorStop(1, '#8a5f1c');
  g.strokeStyle = brass; g.fillStyle = brass; g.lineCap = 'round';
  g.lineWidth = Math.max(1.6, T * 0.07);
  for (let i = 0; i < 2; i++) {
    const mx = (panes[i].x1 + panes[i + 1].x0) / 2;
    const len = Math.min(w * 0.12, 160);
    tendril(g, mx, T * 0.95, -1, len, T * 0.45, T * 0.16);
    tendril(g, mx, T * 0.95, 1, len, T * 0.45, T * 0.16);
    // Stem down the mullion with leaves at the foot.
    g.beginPath(); g.moveTo(mx, T * 0.95); g.bezierCurveTo(mx - M * 0.3, h * 0.4, mx + M * 0.3, h * 0.6, mx, yBot - 4); g.stroke();
    leaf(g, mx, yBot - 6, -2.2, M * 1.6);
    leaf(g, mx, yBot - 6, -0.95, M * 1.6);
    leaf(g, mx, h * 0.5, -2.6, M * 1.1);
  }
  // Corner flourishes on the outer posts.
  tendril(g, geo.S * 0.6, T * 0.6, 1, Math.min(w * 0.08, 110), T * 0.2, T * 0.14);
  tendril(g, w - geo.S * 0.6, T * 0.6, -1, Math.min(w * 0.08, 110), T * 0.2, T * 0.14);

  // Medallion on the crown.
  const cx = w / 2, cy = T * 0.52, cr = T * 0.46;
  const med = g.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 0, cx, cy, cr);
  med.addColorStop(0, '#fff3c4'); med.addColorStop(0.6, '#c99331'); med.addColorStop(1, '#6e4a12');
  g.fillStyle = med; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
  g.fillStyle = '#123f3c'; g.beginPath(); g.arc(cx, cy, cr * 0.62, 0, TAU); g.fill();
  g.save(); g.shadowColor = hue; g.shadowBlur = 12;
  g.strokeStyle = hue; g.lineWidth = Math.max(1.2, cr * 0.08);
  for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx, cy + cr * 0.3, cr * 0.17 * k, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); }
  g.fillStyle = hue; g.beginPath(); g.arc(cx, cy + cr * 0.3, cr * 0.08, 0, TAU); g.fill();
  g.restore();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; rivet(g, cx + Math.cos(a) * cr * 0.82, cy + Math.sin(a) * cr * 0.82, Math.max(1, cr * 0.06)); }
  // Brass wings either side of the medallion.
  g.strokeStyle = brass; g.lineWidth = Math.max(1.4, T * 0.06);
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * cr * 1.05, cy); g.bezierCurveTo(cx + d * cr * 2, cy - cr * 0.6, cx + d * cr * 2.8, cy + cr * 0.4, cx + d * cr * 3.6, cy - cr * 0.1); g.stroke(); }

  // Rivets along the bands.
  const rr = clamp(T * 0.07, 1.5, 3);
  for (let x = 18; x < w - 10; x += 34) {
    if (Math.abs(x - cx) > cr * 4) rivet(g, x, T * 0.2, rr);
    rivet(g, x, yBot + B * 0.72, rr);
  }

  // Glass: gaskets, glare and a soft inner shadow.
  for (const p of panes) {
    g.save();
    g.beginPath(); panePath(g, p, geo, h);
    g.clip();
    const glare = g.createLinearGradient(p.x0, T, p.x0 + (p.x1 - p.x0) * 0.6, yBot);
    glare.addColorStop(0, 'rgba(255,255,255,0.16)'); glare.addColorStop(0.35, 'rgba(255,255,255,0.02)'); glare.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glare; g.fillRect(p.x0, 0, p.x1 - p.x0, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    const sw = (p.x1 - p.x0);
    g.beginPath(); g.moveTo(p.x0 + sw * 0.55, T); g.lineTo(p.x0 + sw * 0.62, T); g.lineTo(p.x0 + sw * 0.32, yBot); g.lineTo(p.x0 + sw * 0.25, yBot); g.fill();
    g.beginPath(); panePath(g, p, geo, h);
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 24;
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10; g.stroke();
    g.restore();
    g.beginPath(); panePath(g, p, geo, h);
    g.strokeStyle = 'rgba(30,22,12,0.75)'; g.lineWidth = 5; g.stroke();
    g.strokeStyle = '#e2b553'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(255,250,230,0.8)'; g.lineWidth = 0.8; g.stroke();
  }

  // Neon along the sill.
  g.save();
  g.shadowColor = hue; g.shadowBlur = 14;
  g.strokeStyle = hue; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(geo.S + 16, yBot + B * 0.28); g.lineTo(w - geo.S - 16, yBot + B * 0.28); g.stroke();
  g.restore();
  return geo;
}
