// The recording script. Every line the narrators can say is cut into pieces a
// performer can record: the fixed wording of each line, and every name, place
// and flavour word that gets stitched into it. A clip id names one recording:
//   prairie/b3v1-0        KDRY's beat 3, take 1, first stretch of wording
//   docks/hero-prairie0   the Irish narrator saying "Dusty"
//   docks/hero-docks2-intro   ... introducing their own hero in full
//   market/trench-place   the London narrator saying "the bottom of the Mariana Trench"
//   campground/food1      the Ranger's second food

import { STORIES, ENVIRONMENTS, SPLICES, SCENE_QUIPS, INTRODUCES } from './data.js';

const SLOT_RE = /\{([a-zA-Z]+)(?:\.(short))?\}/g;
const CAST = Object.keys(INTRODUCES); // hero side thing villain

export const TEMPLATE_KEY = new Map();
for (const s of STORIES) {
  s.beats.forEach((vs, b) => vs.forEach((t, v) => TEMPLATE_KEY.set(t, `b${b}v${v}`)));
  s.arrive.forEach((t, i) => TEMPLATE_KEY.set(t, `arrive${i}`));
  s.drift.forEach((t, i) => TEMPLATE_KEY.set(t, `drift${i}`));
}
SPLICES.forEach((t, i) => TEMPLATE_KEY.set(t, `splice${i}`));
SCENE_QUIPS.forEach((t, i) => TEMPLATE_KEY.set(t, `quip${i}`));

const hasWords = s => /[a-z0-9]/i.test(s);

// Cut a template into wording and slots. A narrator's own station name and
// title are part of the wording, since only they ever say them.
export function splitTemplate(template, story) {
  const baked = template.replaceAll('{station}', story.station).replaceAll('{title}', story.title);
  const out = [];
  let last = 0, n = 0;
  const literal = text => {
    if (!text) return;
    if (hasWords(text)) out.push({ type: 'text', text, n: n++ });
    else out.push({ type: 'punct', text });
  };
  for (const m of baked.matchAll(SLOT_RE)) {
    literal(baked.slice(last, m.index));
    out.push({ type: 'slot', key: m[2] ? `${m[1]}.${m[2]}` : m[1] });
    last = m.index + m[0].length;
  }
  literal(baked.slice(last));
  return out;
}

// What a performer should actually say for a stretch of wording: no stray
// punctuation or spaces at the edges, but keep the full stop or question mark
// at the end, since it shapes the read.
export function sayable(text) {
  return text.replace(/^[\s,.;:!?]+/, '').replace(/[\s,;:]+$/, '').trim();
}

export function castClip(narrator, slot, home, i, form) {
  const base = `${narrator}/${slot}-${home}${i}`;
  return form === 'intro' ? `${base}-intro` : form === 'a' ? `${base}-a` : base;
}

// Pause to leave between two recorded pieces, from the punctuation at the join.
export function pauseBetween(prevText, nextText) {
  const end = (prevText || '').trimEnd();
  const start = (nextText || '').trimStart();
  if (/\.\.\.$/.test(end) || /^\.\.\./.test(start)) return 0.5;
  if (/[.!?]["']?$/.test(end) || /^[.!?]/.test(start)) return 0.38;
  if (/[,;:]$/.test(end) || /^[,;:]/.test(start)) return 0.16;
  return 0.05;
}

const PERSONA = {
  prairie: 'The Drifter. Old Texas cowhand by a campfire: slow, warm, dusty, a smile in the voice. Lean into the drawl and drop your g\'s.',
  campground: 'The Ranger. Cheery Australian park ranger, quick and chatty, slightly over-excited about everything.',
  docks: 'The Old Salt. Irish storyteller in the corner of a pub: a twinkle, a rolling rhythm, savouring every word.',
  market: 'The Inspector. Dry London noir detective: deadpan, clipped, world weary, never surprised.',
  trench: 'The Chief Engineer. Scottish submarine engineer: gruff, warm, slightly exasperated, fond of the crew.',
};
export const personaOf = id => PERSONA[id];

function contextOf(template, story, focusIndex, label) {
  // The whole line with the other slots shown as [BRACKETS], and the part to read marked.
  const parts = splitTemplate(template, story);
  return parts.map((p, i) => {
    const text = p.type === 'slot' ? `[${p.key.replace('.short', '').replace('aThing', 'thing').toUpperCase()}]` : p.text;
    return { text, focus: p.type === 'text' && p.n === focusIndex && label === undefined };
  });
}

// Everything one narrator needs to record, in recording order.
// tier 1: their own story told once through on their own scene
// tier 2: second takes, bridges and asides
// tier 3: other stations' characters and other scenes, for when stories cross over
export function scriptFor(narratorId) {
  const story = STORIES.find(s => s.id === narratorId);
  const home = ENVIRONMENTS.find(e => e.id === narratorId);
  const items = [];
  const add = item => items.push({ narrator: narratorId, ...item, clip: `${narratorId}/${item.id}` });

  const lines = (template, key, group, tier, note) => {
    for (const p of splitTemplate(template, story)) {
      if (p.type !== 'text') continue;
      add({ id: `${key}-${p.n}`, say: sayable(p.text), group, tier, note, context: contextOf(template, story, p.n) });
    }
  };
  story.beats.forEach((vs, b) => vs.forEach((t, v) => lines(t, `b${b}v${v}`, `Beat ${b + 1}`, v === 0 ? 1 : 2)));
  story.arrive.forEach((t, i) => lines(t, `arrive${i}`, 'Arriving mid story', 2, 'You are taking over someone else\'s story, live on air.'));
  story.drift.forEach((t, i) => lines(t, `drift${i}`, 'Losing the signal', 2, 'The signal is going. Trail off at the end.'));
  SPLICES.forEach((t, i) => lines(t, `splice${i}`, 'Bridges', 2));
  SCENE_QUIPS.forEach((t, i) => lines(t, `quip${i}`, 'Scenery changes', 2));

  // Their own cast, introduced in full, then every station's cast by short name.
  for (const slot of CAST) {
    story.cast[slot].forEach((c, i) => {
      if (slot === 'thing') {
        add({ id: `thing-${narratorId}${i}-a`, say: withA(c), group: 'Your cast', tier: 1, note: 'First mention, mid sentence.' });
      } else {
        add({ id: `${slot}-${narratorId}${i}-intro`, say: c.intro, group: 'Your cast', tier: 1, note: 'Introducing them for the first time. Give it a little flourish.' });
      }
    });
  }
  for (const s of STORIES) {
    for (const slot of CAST) {
      s.cast[slot].forEach((c, i) => {
        add({
          id: `${slot}-${s.id}${i}`,
          say: slot === 'thing' ? c : c.short,
          group: s.id === narratorId ? 'Your cast' : `Visitors from ${s.station}`,
          tier: s.id === narratorId ? 1 : 3,
          note: slot === 'thing' ? 'Read as "the ..." would carry on: say only the words shown, mid sentence.' : 'A name in passing, mid sentence.',
        });
      });
    }
  }
  for (const env of ENVIRONMENTS) {
    for (const [k, v] of Object.entries(env.vocab)) {
      add({ id: `${env.id}-${k}`, say: v, group: env.id === home.id ? 'Your scene' : `Scene: ${env.name}`, tier: env.id === home.id ? 1 : 3, note: 'Mid sentence, a touch of colour.' });
    }
  }
  for (const [pool, values] of Object.entries(story.pools)) {
    values.forEach((v, i) => add({ id: `${pool}${i}`, say: v, group: 'Flavour', tier: 1, note: pool === 'exclaim' ? 'An exclamation. Go big.' : 'Mid sentence.' }));
  }
  return items.sort((a, b) => a.tier - b.tier);
}

function withA(phrase) { return (/^[aeiou]/i.test(phrase) ? 'an ' : 'a ') + phrase; }

export const FULL_SCRIPT = () => STORIES.flatMap(s => scriptFor(s.id));
