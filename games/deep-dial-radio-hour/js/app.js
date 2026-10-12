// Wires the console together: the scene lever, the sound element switches,
// the radio, and the broadcast loop that walks the story engine beat by beat.

import { ENVIRONMENTS, STORIES, BEATS } from './data.js';
import { StoryEngine } from './engine.js';
import { Narrator } from './narrator.js';
import { Soundscape } from './audio.js';
import { Viewport } from './scenes.js';
import { drawFrame } from './frame.js';

const $ = id => document.getElementById(id);
const PACE = globalThis.__DDRH_FAST ? 0.02 : 1; // tests run the clock fast
const wait = ms => new Promise(r => setTimeout(r, ms * PACE));
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('ddrh:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ddrh:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const envById = id => ENVIRONMENTS.find(e => e.id === id);
const storyById = id => STORIES.find(s => s.id === id);
const hueOf = id => envById(id).hue;

const startEnv = envById(store.get('env', 'prairie')) ? store.get('env', 'prairie') : 'prairie';
const state = {
  env: startEnv,
  station: startEnv,
  engaged: false,
  playing: false,
  paused: false,
  drift: store.get('drift', true),
  voice: store.get('voice', 1),
  ambience: store.get('ambience', 0.8),
  layers: store.get('layers', {}),
};

// ?seed=42 replays the same broadcast, for sharing a good one (and for tests).
const seed = Number(new URLSearchParams(location.search).get('seed')) || Date.now();
const engine = new StoryEngine({ drift: state.drift, seed });
const narrator = new Narrator({ pace: PACE });
const sound = new Soundscape();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const viewportEl = $('viewport');
const view = new Viewport($('scene'), {
  reducedMotion: reduced,
  onShake: dur => {
    viewportEl.classList.add('shake');
    clearTimeout(view.shakeTimer);
    view.shakeTimer = setTimeout(() => viewportEl.classList.remove('shake'), Math.min(1500, dur * 400));
  },
});

const layerOn = (envId, id) => {
  const m = state.layers[envId];
  return m && id in m ? !!m[id] : true;
};
const activeIds = () => envById(state.env).layers.filter(l => layerOn(state.env, l.id)).map(l => l.id);
const onMap = () => Object.fromEntries(envById(state.env).layers.map(l => [l.id, layerOn(state.env, l.id)]));

// ---------- build the console ----------

function buildDetents() {
  const box = $('detents');
  ENVIRONMENTS.forEach((env, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'detent';
    b.style.setProperty('--c', env.hue);
    b.dataset.id = env.id;
    b.innerHTML = `<svg aria-hidden="true"><use href="#i-${env.id}"/></svg><span>${env.short}</span>`;
    b.setAttribute('aria-label', env.name);
    b.addEventListener('click', () => { engage(); selectEnv(env.id, true); $('env').value = i; });
    box.appendChild(b);
  });
}

function buildElements() {
  const list = $('elements');
  list.innerHTML = '';
  envById(state.env).layers.forEach((l, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'el';
    b.setAttribute('role', 'switch');
    b.dataset.id = l.id;
    b.setAttribute('aria-checked', String(layerOn(state.env, l.id)));
    b.innerHTML = `<span class="bat" aria-hidden="true"><i></i></span><span class="jewel" aria-hidden="true"></span>`
      + `<span class="el-name">${l.label}<small>CH ${i + 1} &middot; ${l.code}</small></span>`
      + `<span class="vu" aria-hidden="true">${'<i></i>'.repeat(12)}</span>`;
    b.addEventListener('click', () => toggleLayer(l.id));
    li.appendChild(b);
    list.appendChild(li);
  });
  meters = [...list.querySelectorAll('.el')].map(b => ({ id: b.dataset.id, cells: [...b.querySelectorAll('.vu i')], lit: 0 }));
}

function buildPresets() {
  const box = $('presets');
  STORIES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.id = s.id;
    b.style.setProperty('--c', hueOf(s.id));
    b.setAttribute('aria-label', `${s.station}: ${s.title}, told in a ${s.accent} accent`);
    b.innerHTML = `<i class="lamp" aria-hidden="true"></i><b class="freq">${s.freq}</b><span class="call">${s.call}</span><span class="acc">${s.accent.split(' ')[0]}</span>`;
    b.addEventListener('click', () => { engage(); sound.press(); selectStation(s.id); });
    box.appendChild(b);
  });
}

const dialPct = f => 4 + ((f - 530) / (1610 - 530)) * 92;
function buildDial() {
  const scale = $('scale');
  let html = '';
  for (let f = 550; f <= 1600; f += 50) {
    const major = f % 100 === 0;
    html += `<i class="tick${major ? ' major' : ''}" style="left:${dialPct(f)}%"></i>`;
    if ([600, 700, 800, 1000, 1200, 1400, 1600].includes(f)) html += `<span class="num" style="left:${dialPct(f)}%">${f / 10}</span>`;
  }
  for (const s of STORIES) html += `<span class="stn" style="left:${dialPct(s.freq)}%;--c:${hueOf(s.id)}">${s.call}</span>`;
  scale.innerHTML = html;
}

function buildBeats() {
  $('beats').innerHTML = BEATS.map((b, i) => `<i title="Beat ${i + 1}: ${b}"></i>`).join('');
}

// ---------- show state ----------

function showEnv() {
  const env = envById(state.env);
  document.documentElement.style.setProperty('--hue', env.hue);
  $('scene-name').textContent = env.name;
  $('scene-time').textContent = env.time;
  $('env').value = ENVIRONMENTS.indexOf(env);
  $('env').setAttribute('aria-valuetext', env.name);
  for (const d of document.querySelectorAll('.detent')) d.setAttribute('aria-current', String(d.dataset.id === env.id));
  drawFrame($('frame'), env.hue);
  buildElements();
}

function showStation(id) {
  const s = storyById(id);
  const c = hueOf(id);
  for (const p of document.querySelectorAll('.preset')) p.setAttribute('aria-pressed', String(p.dataset.id === id));
  $('needle').style.left = dialPct(s.freq) + '%';
  $('now-station').textContent = s.station;
  $('now-station').style.setProperty('--c', c);
  $('now-title').textContent = s.title;
  document.querySelector('.vfd').style.setProperty('--c', c);
  showVoice(s);
}

function showVoice(s) {
  const v = narrator.describe(s);
  const tail = narrator.ready === false ? 'warming up the valves'
    : narrator.captionsOnly ? '<em>captions only on this device</em>'
    : v.accent ? `voice: ${escapeHtml(v.name)}`
    : `<em>${escapeHtml(v.name)} standing in, accent not installed</em>`;
  $('now-voice').innerHTML = `${escapeHtml(s.narrator)} &middot; ${escapeHtml(s.accent)} &middot; ${tail}`;
}

function showStatus() {
  $('st-synth').className = state.engaged && sound.ready ? 'on' : '';
  const voiced = STORIES.filter(s => narrator.describe(s).accent).length;
  const li = $('st-voice');
  li.className = narrator.ready === false ? '' : narrator.captionsOnly ? 'warn' : voiced === STORIES.length ? 'on' : 'warn';
  li.querySelector('span').textContent = narrator.ready === false ? 'Voices' : narrator.captionsOnly ? 'Captions' : `${voiced}/5 accents`;
  $('st-air').className = 'air' + (state.playing ? ' on' : '');
  $('play').classList.toggle('on', state.playing);
  $('play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  $('dial').classList.toggle('live', state.playing);
}

let captionText = '';
function showCaption(text) {
  captionText = text;
  const el = $('caption');
  el.classList.remove('idle');
  el.innerHTML = escapeHtml(text);
}
function highlight(i, len) {
  if (!captionText) return;
  const end = len ? i + len : (captionText.indexOf(' ', i) + 1 || captionText.length);
  $('caption').innerHTML = `<span class="said">${escapeHtml(captionText.slice(0, i))}</span><span class="word">${escapeHtml(captionText.slice(i, end))}</span>${escapeHtml(captionText.slice(end))}`;
}
function idleCaption(text) {
  captionText = '';
  const el = $('caption');
  el.classList.add('idle');
  el.textContent = text;
}

function markBeat(i, storyId, kind) {
  const lamps = $('beats').children;
  for (const l of lamps) l.classList.remove('now');
  const l = lamps[i];
  if (!l) return;
  l.style.setProperty('--c', hueOf(storyId));
  l.classList.add(kind);
  $('beats').setAttribute('aria-valuenow', String(engine.history.length));
}
function resetBeats() {
  for (const l of $('beats').children) { l.className = ''; l.style.removeProperty('--c'); }
  $('beats').setAttribute('aria-valuenow', '0');
}

// ---------- actions ----------

function engage() {
  if (state.engaged) return;
  state.engaged = true;
  sound.ensure();
  narrator.unlock();
  sound.setAmbience(state.ambience);
  sound.setRadioLevel(state.voice);
  sound.setScene(activeIds());
  $('engage').classList.add('gone');
  showStatus();
}

function selectEnv(id, user = false) {
  if (id === state.env) return;
  state.env = id;
  store.set('env', id);
  view.setEnv(id);
  showEnv();
  view.setLayers(onMap());
  if (state.engaged) { if (user) sound.detent(); sound.setScene(activeIds()); }
  if (engine.playing) engine.setEnv(id);
  else selectStation(id); // idle: the radio follows the scene to its home station
}

function selectStation(id) {
  if (id === state.station) return;
  state.station = id;
  showStation(id);
  if (engine.playing && engine.switchStation(id)) {
    run++;
    narrator.cancel();
    program = null;
    if (state.playing) {
      sound.tune(1.0);
      const my = run;
      setTimeout(() => { if (my === run) broadcast(my); }, 1000 * PACE);
    }
  }
}

function toggleLayer(id, force) {
  engage();
  const on = force === undefined ? !layerOn(state.env, id) : force;
  state.layers[state.env] = { ...(state.layers[state.env] || {}), [id]: on };
  store.set('layers', state.layers);
  const b = document.querySelector(`.el[data-id="${id}"]`);
  if (b) b.setAttribute('aria-checked', String(on));
  sound.click();
  sound.setLayer(id, on);
  view.setLayers(onMap());
}

// ---------- the broadcast ----------

let run = 0;          // bumping this cancels whatever loop is running
let program = null;   // the beat being told
let segIndex = 0;
let sentenceIndex = 0;

async function broadcast(my) {
  sound.carrier(true);
  while (my === run) {
    if (!program) {
      program = engine.next();
      segIndex = 0;
      sentenceIndex = 0;
      if (!program) return endOfBroadcast();
      markBeat(program.beat, program.storyId, 'now');
    }
    while (segIndex < program.segments.length) {
      const seg = program.segments[segIndex];
      if (seg.kind === 'tune') {
        sound.tune(1.1);
        state.station = seg.storyId;
        showStation(seg.storyId);
        idleCaption('~ signal drifting ~');
        await wait(1100);
        if (my !== run) return;
        segIndex++;
        continue;
      }
      const story = storyById(seg.storyId);
      showCaption(seg.text);
      sound.duck(true);
      const ok = await narrator.speak(seg.text, story, {
        from: sentenceIndex,
        onSentence: (i, s) => { sentenceIndex = i; highlight(s.start, 0); },
        onWord: highlight,
      });
      sound.duck(false);
      if (my !== run || !ok) return;
      segIndex++;
      sentenceIndex = 0;
      await wait(380);
      if (my !== run) return;
    }
    engine.complete();
    markBeat(program.beat, program.storyId, 'done');
    program = null;
    await wait(750);
  }
}

function endOfBroadcast() {
  state.playing = false;
  state.paused = false;
  sound.carrier(false);
  idleCaption('End of broadcast. Press play for a fresh reel, or try another scene.');
  showStatus();
}

function play() {
  engage();
  if (state.playing) return pause();
  if (state.paused && engine.playing) {
    state.paused = false;
    state.playing = true;
    showStatus();
    broadcast(++run);
    return;
  }
  engine.setDrift(state.drift);
  engine.start(state.station, state.env);
  program = null;
  resetBeats();
  state.playing = true;
  state.paused = false;
  showStatus();
  idleCaption('Tuning in...');
  sound.tune(0.7);
  const my = ++run;
  setTimeout(() => { if (my === run) broadcast(my); }, 700 * PACE);
}

function pause() {
  run++;
  narrator.cancel();
  sound.duck(false);
  sound.carrier(false);
  state.playing = false;
  state.paused = true;
  showStatus();
}

function stop() {
  run++;
  narrator.cancel();
  engine.stop();
  program = null;
  sound.duck(false);
  sound.carrier(false);
  state.playing = false;
  state.paused = false;
  resetBeats();
  idleCaption('Off air. Press play to start the story from the top.');
  showStatus();
}

// ---------- wiring ----------

function wire() {
  $('engage-btn').addEventListener('click', engage);
  $('env').addEventListener('input', e => { engage(); selectEnv(ENVIRONMENTS[+e.target.value].id, true); });
  $('all-on').addEventListener('click', () => envById(state.env).layers.forEach(l => toggleLayer(l.id, true)));
  $('all-off').addEventListener('click', () => envById(state.env).layers.forEach(l => toggleLayer(l.id, false)));
  $('play').addEventListener('click', play);
  $('stop').addEventListener('click', () => { engage(); sound.press(); stop(); });
  const drift = $('drift');
  drift.checked = state.drift;
  drift.addEventListener('change', () => { state.drift = drift.checked; store.set('drift', state.drift); engine.setDrift(state.drift); sound.click(); });
  const vv = $('voice-vol');
  vv.value = state.voice;
  vv.addEventListener('input', () => { state.voice = +vv.value; store.set('voice', state.voice); narrator.volume = state.voice; sound.setRadioLevel(state.voice); });
  const av = $('amb-vol');
  av.value = state.ambience;
  av.addEventListener('input', () => { state.ambience = +av.value; store.set('ambience', state.ambience); sound.setAmbience(state.ambience); });
  narrator.volume = state.voice;

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    if (/^[1-5]$/.test(e.key)) { engage(); sound.press(); selectStation(STORIES[+e.key - 1].id); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tag !== 'INPUT') {
      const i = ENVIRONMENTS.findIndex(x => x.id === state.env) + (e.key === 'ArrowLeft' ? -1 : 1);
      if (i >= 0 && i < ENVIRONMENTS.length) { engage(); selectEnv(ENVIRONMENTS[i].id, true); }
      e.preventDefault();
      return;
    }
    if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); play(); }
  });

  new ResizeObserver(() => { view.resize(); drawFrame($('frame'), hueOf(state.env)); }).observe(viewportEl);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => view.resize());
}

let meters = [];
let tickCount = 0;
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  const audioNow = sound.now;
  for (const e of sound.drain()) if (audioNow - e.at < 3) view.event(e); // skip a backlog after a hidden tab
  view.frame(dt);
  if (state.engaged && ++tickCount % 2 === 0) {
    for (const m of meters) {
      const rms = sound.level(m.id);
      const db = 20 * Math.log10(rms + 1e-6);
      const lit = Math.max(0, Math.min(12, Math.round((db + 54) / 3.6)));
      if (lit !== m.lit) {
        m.lit = lit;
        m.cells.forEach((c, i) => { c.classList.toggle('lit', i < lit); c.classList.toggle('hot', i < lit && i >= 10); });
      }
    }
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------

buildDetents();
buildPresets();
buildDial();
buildBeats();
wire();
view.setEnv(state.env, true);
showEnv();
view.setLayers(onMap());
showStation(state.station);
showStatus();
narrator.init(STORIES).then(() => {
  showVoice(storyById(state.station));
  showStatus();
});
requestAnimationFrame(frame);

// A handle for the test harness and the curious.
globalThis.__ddrh = { state, engine, narrator, sound, view, selectEnv, selectStation, toggleLayer, play, stop, pause };
