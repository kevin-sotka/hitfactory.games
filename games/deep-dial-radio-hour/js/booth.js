// The recording booth: walks a performer through a narrator's script, records
// each piece from the microphone, trims and levels it, keeps it in the
// browser (IndexedDB) between sessions, and exports a zip for
// tools/build-audio.mjs.

import { STORIES, ENVIRONMENTS } from './data.js';
import { scriptFor, personaOf, splitTemplate, TEMPLATE_KEY, pauseBetween } from './script.js';
import { processTake, encodeWav, zipStore } from './wav.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hue = id => ENVIRONMENTS.find(e => e.id === id).hue;

// ---------- storage: IndexedDB, or memory when that is unavailable ----------
const store = await (async () => {
  const mem = new Map();
  const fallback = { all: async () => [...mem.values()], put: async t => mem.set(t.clip, t), del: async c => mem.delete(c), persistent: false };
  try {
    const db = await new Promise((ok, no) => {
      const req = indexedDB.open('ddrh-booth', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('takes', { keyPath: 'clip' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => no(req.error);
    });
    const tx = (mode, fn) => new Promise((ok, no) => {
      const t = db.transaction('takes', mode);
      const r = fn(t.objectStore('takes'));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => no(t.error);
    });
    return {
      all: () => tx('readonly', s => s.getAll()),
      put: t => tx('readwrite', s => s.put(t)),
      del: c => tx('readwrite', s => s.delete(c)),
      persistent: true,
    };
  } catch { return fallback; }
})();

const state = {
  narrator: new URLSearchParams(location.search).get('narrator') || 'prairie',
  items: [],
  pos: 0,
  filter: 'todo',
  takes: new Map(),
  recording: null,
};
if (!STORIES.some(s => s.id === state.narrator)) state.narrator = 'prairie';

for (const t of await store.all()) state.takes.set(t.clip, t);

// ---------- audio ----------
let ctx = null, mic = null, analyser = null, playing = null;
function audio() {
  if (!ctx) ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function openMic(deviceId) {
  audio();
  if (mic) mic.getTracks().forEach(t => t.stop());
  mic = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(mic).connect(analyser);
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
  $('device').innerHTML = devices.map(d => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Microphone')}</option>`).join('');
  const current = mic.getAudioTracks()[0].getSettings().deviceId;
  if (current) $('device').value = current;
  $('mic-state').textContent = 'Mic ready';
  $('mic-state').className = 'ok';
}

function meter() {
  if (analyser) {
    const d = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(d);
    let peak = 0;
    for (const v of d) peak = Math.max(peak, Math.abs(v));
    const db = 20 * Math.log10(peak + 1e-6);
    const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    $('meter-fill').style.width = pct + '%';
    $('meter-fill').className = db > -3 ? 'hot' : db > -24 ? 'good' : '';
  }
  requestAnimationFrame(meter);
}

function stopPlayback() {
  if (playing) { playing.forEach(s => { try { s.stop(); } catch { /* done */ } }); playing = null; }
}

function bufferOf(take) {
  const b = audio().createBuffer(1, take.data.length, take.rate);
  b.copyToChannel(take.data, 0);
  return b;
}

// Play takes one after another with the pauses the game would leave.
function playSequence(seq) {
  stopPlayback();
  const c = audio();
  let t = c.currentTime + 0.05;
  playing = [];
  seq.forEach((s, i) => {
    if (i > 0) t += pauseBetween(seq[i - 1].text, s.text);
    const src = c.createBufferSource();
    src.buffer = bufferOf(s.take);
    src.connect(c.destination);
    src.start(t);
    playing.push(src);
    t += src.buffer.duration;
  });
}

// ---------- recording ----------
async function startRecording() {
  if (state.recording) return;
  if (!mic) {
    try { await openMic(); } catch (e) { setStatus(`No microphone: ${e.message}`, 'bad'); return; }
  }
  stopPlayback();
  const chunks = [];
  const rec = new MediaRecorder(mic);
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const item = current();
  const started = performance.now();
  state.recording = { rec, item, chunks, started };
  rec.start();
  document.body.classList.add('recording');
  $('rec').setAttribute('aria-pressed', 'true');
  $('rec-label').textContent = 'Stop';
  setStatus('Recording. Speak the line, then stop.', 'live');
}

async function stopRecording() {
  const r = state.recording;
  if (!r) return;
  state.recording = null;
  document.body.classList.remove('recording');
  $('rec').setAttribute('aria-pressed', 'false');
  $('rec-label').textContent = 'Record';
  await new Promise(ok => { r.rec.onstop = ok; r.rec.stop(); });
  try {
    const blob = new Blob(r.chunks, { type: r.rec.mimeType });
    const buf = await audio().decodeAudioData(await blob.arrayBuffer());
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    const data = processTake(chans, buf.sampleRate);
    if (!data) { setStatus('Did not catch any words. Check the mic level and try again.', 'bad'); return; }
    const take = { clip: r.item.clip, say: r.item.say, rate: buf.sampleRate, data, at: Date.now() };
    state.takes.set(take.clip, take);
    await store.put(take);
    setStatus(`Saved ${(data.length / buf.sampleRate).toFixed(1)}s take.`, 'ok');
    renderList();
    if ($('playback').checked) playSequence([{ text: r.item.say, take }]);
    if ($('auto').checked) setTimeout(() => move(1, true), $('playback').checked ? data.length / buf.sampleRate * 1000 + 300 : 150);
    else renderCard();
  } catch (e) {
    setStatus(`That take could not be read: ${e.message}`, 'bad');
  }
}

// ---------- script view ----------
function statusOf(item) {
  const t = state.takes.get(item.clip);
  if (!t) return 'todo';
  return t.say === item.say ? 'done' : 'stale';
}
const visible = () => state.items.filter(x => state.filter === 'all' || (state.filter === 'todo' ? statusOf(x) !== 'done' : statusOf(x) === 'done'));
const current = () => visible()[state.pos] || visible()[0];

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

function renderTabs() {
  $('tabs').innerHTML = STORIES.map(s => {
    const items = scriptFor(s.id);
    const done = items.filter(x => statusOf(x) === 'done').length;
    return `<button type="button" role="tab" data-id="${s.id}" aria-selected="${s.id === state.narrator}" style="--c:${hue(s.id)}">
      <b>${esc(s.narrator)}</b><span>${esc(s.accent)} &middot; ${s.station}</span><i style="width:${(100 * done) / items.length}%"></i></button>`;
  }).join('');
  for (const b of $('tabs').querySelectorAll('button')) b.addEventListener('click', () => selectNarrator(b.dataset.id));
}

function renderProgress() {
  const tiers = [1, 2, 3].map(t => {
    const all = state.items.filter(x => x.tier === t);
    const done = all.filter(x => statusOf(x) === 'done').length;
    return { t, all: all.length, done };
  });
  const names = { 1: 'Home story', 2: 'Extra takes and bridges', 3: 'Crossovers' };
  $('progress').innerHTML = tiers.map(({ t, all, done }) =>
    `<div class="tier"><span>Tier ${t}: ${names[t]}</span><b>${done}/${all}</b><i><u style="width:${(100 * done) / Math.max(1, all)}%"></u></i></div>`).join('');
}

function renderList() {
  renderTabs();
  renderProgress();
  const list = visible();
  if (state.pos >= list.length) state.pos = Math.max(0, list.length - 1);
  let group = '';
  $('list').innerHTML = list.map((x, i) => {
    const head = x.group !== group ? `<li class="group">${esc((group = x.group))}</li>` : '';
    return `${head}<li><button type="button" class="item ${statusOf(x)}" data-i="${i}" aria-current="${i === state.pos}"><i></i><span>${esc(x.say)}</span></button></li>`;
  }).join('') || '<li class="empty">All done here. Switch the filter to see recorded takes.</li>';
  for (const b of $('list').querySelectorAll('.item')) b.addEventListener('click', () => { state.pos = +b.dataset.i; renderList(); });
  renderCard();
}

function renderCard() {
  const x = current();
  const card = $('card');
  if (!x) { card.hidden = true; return; }
  card.hidden = false;
  const s = statusOf(x);
  $('say').textContent = x.say;
  $('context').innerHTML = x.context
    ? x.context.map(p => (p.focus ? `<mark>${esc(p.text)}</mark>` : esc(p.text))).join('')
    : `<em>${esc(x.group)}</em>`;
  $('note').textContent = x.note || '';
  $('clip').textContent = x.clip;
  $('take-state').textContent = s === 'done' ? 'Recorded' : s === 'stale' ? 'Recorded against older wording: please redo' : 'Not recorded yet';
  $('take-state').className = s;
  $('play').disabled = s === 'todo';
  $('clear').disabled = s === 'todo';
  $('hear').hidden = !x.context;
  const item = $('list').querySelector('[aria-current=true]');
  if (item) item.scrollIntoView({ block: 'nearest' });
}

function selectNarrator(id) {
  state.narrator = id;
  state.items = scriptFor(id);
  state.pos = 0;
  history.replaceState(null, '', `?narrator=${id}`);
  document.documentElement.style.setProperty('--hue', hue(id));
  const s = STORIES.find(x => x.id === id);
  $('persona').textContent = personaOf(id);
  $('who').textContent = `${s.narrator}, ${s.station}`;
  renderList();
}

function move(d, afterTake = false) {
  const list = visible();
  if (afterTake && state.filter === 'todo') {
    // The finished item drops out of the to-do list, so the next one slides into place.
    state.pos = Math.min(state.pos, list.length - 1);
  } else {
    state.pos = Math.max(0, Math.min(list.length - 1, state.pos + d));
  }
  renderList();
}

// The whole line, stitched from whatever has been recorded, with this
// narrator's own first cast member and home scene filling the gaps.
function hearLine() {
  const x = current();
  if (!x || !x.context) return;
  const key = x.id.replace(/-\d+$/, '');
  const template = [...TEMPLATE_KEY.entries()].find(([, k]) => k === key)?.[0];
  if (!template) return;
  const story = STORIES.find(s => s.id === state.narrator);
  const n = state.narrator;
  const seq = [], missing = [];
  for (const p of splitTemplate(template, story)) {
    if (p.type === 'punct') { if (seq.length) seq[seq.length - 1].text += p.text; continue; }
    let clip, text;
    if (p.type === 'text') { clip = `${n}/${key}-${p.n}`; text = p.text; }
    else {
      const k = p.key, base = k.split('.')[0];
      if (base === 'aThing') clip = `${n}/thing-${n}0-a`;
      else if (base === 'thing') clip = `${n}/thing-${n}0`;
      else if (['hero', 'side', 'villain'].includes(base)) clip = `${n}/${base}-${n}0${k.includes('.') ? '' : '-intro'}`;
      else if (story.pools[base]) clip = `${n}/${base}0`;
      else clip = `${n}/${n}-${base}`;
      text = k;
    }
    const take = state.takes.get(clip);
    if (take) seq.push({ text, take }); else missing.push(p.type === 'text' ? `"${p.text.trim()}"` : `{${p.key}}`);
  }
  if (!seq.length) { setStatus('Nothing in this line is recorded yet.', 'bad'); return; }
  playSequence(seq);
  setStatus(missing.length ? `Playing what exists. Still missing: ${missing.join(', ')}` : 'Playing the whole line.', missing.length ? '' : 'ok');
}

async function exportZip(all) {
  const takes = [...state.takes.values()].filter(t => all || t.clip.startsWith(state.narrator + '/'));
  if (!takes.length) { setStatus('Nothing recorded to export yet.', 'bad'); return; }
  const files = [];
  const said = {};
  for (const t of takes) {
    const [n, id] = t.clip.split('/');
    files.push({ name: `voice/${n}/${id}.wav`, data: encodeWav(t.data, t.rate) });
    (said[n] ||= {})[t.clip] = t.say;
  }
  for (const [n, map] of Object.entries(said)) files.push({ name: `voice/${n}/takes.json`, data: new TextEncoder().encode(JSON.stringify(map, null, 1)) });
  const blob = new Blob([zipStore(files)], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `deep-dial-voices-${all ? 'all' : state.narrator}-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  setStatus(`Exported ${takes.length} takes. Unzip into audio-src/ or run: node tools/build-audio.mjs --zip ${a.download}`, 'ok');
}

// ---------- wiring ----------
$('rec').addEventListener('click', () => (state.recording ? stopRecording() : startRecording()));
$('play').addEventListener('click', () => { const t = state.takes.get(current().clip); if (t) playSequence([{ text: t.say, take: t }]); });
$('hear').addEventListener('click', hearLine);
$('clear').addEventListener('click', async () => { const c = current().clip; state.takes.delete(c); await store.del(c); renderList(); });
$('prev').addEventListener('click', () => move(-1));
$('next').addEventListener('click', () => move(1));
$('export').addEventListener('click', () => exportZip(false));
$('export-all').addEventListener('click', () => exportZip(true));
$('mic').addEventListener('click', () => openMic().catch(e => setStatus(`No microphone: ${e.message}`, 'bad')));
$('device').addEventListener('change', e => openMic(e.target.value).catch(err => setStatus(err.message, 'bad')));
$('filter').addEventListener('change', e => { state.filter = e.target.value; state.pos = 0; renderList(); });
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'r' || (k === 'enter' && e.target.tagName !== 'BUTTON')) { e.preventDefault(); state.recording ? stopRecording() : startRecording(); }
  else if (k === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('play').click(); }
  else if (k === 'h') hearLine();
  else if (k === 'arrowdown' || k === 'j') { e.preventDefault(); move(1); }
  else if (k === 'arrowup' || k === 'k') { e.preventDefault(); move(-1); }
});
if (!store.persistent) setStatus('This browser will not keep takes between visits. Export before you close the tab.', 'bad');
if (!globalThis.MediaRecorder || !navigator.mediaDevices) setStatus('This browser cannot record audio. Try Chrome, Edge, Firefox or Safari.', 'bad');

selectNarrator(state.narrator);
meter();
globalThis.__booth = { state, store, exportZip, hearLine };
