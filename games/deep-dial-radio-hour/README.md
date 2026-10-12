# Deep Dial Radio Hour

A submarine control room that tells stories. Bright nickel and brass, Art Nouveau
whiplash ornament, a little cyberpunk neon, and a wide three-pane cockpit window.

- **Scene lever.** Sweep it across five scenes: Prairie Desert Station, Evening
  Campground, Seashore Docks, Neon Night Market and Abyssal Trench. The window
  dives to the new scene.
- **Sound elements.** Each scene has six switches stacked below the lever (wind,
  steam train, windmill, telegraph key, coyote, cicadas, and so on). All thirty are
  synthesised live with Web Audio, no samples, and the picture answers them: the
  train you hear is the train you see, gulls fly when they call, the hull groan
  shakes the glass.
- **The radio.** Five big preset buttons, one station per scene, each with its own
  narrator and accent (Texas, Australian, Irish, London, Scottish). Press play and
  the scene's home station tells its story.

## How the stories work

Every story has the same ten beats (open, hero, want, incitement, pursuit,
midpoint, trouble, low point, climax, coda) at the same pace, and each beat has
several takes written as templates. The cast (hero, sidekick, villain, the thing
everybody wants) is rolled mad-lib style from the starting station's pools, and
the scenery words come from whatever is outside the window when the line is said.

So stations are interchangeable mid-story:

- **Switch station** at any moment and the new narrator cuts in with an arrival
  line and a splice ("A small wormhole opened, apologised for the inconvenience,
  and closed again."), then retells the interrupted beat in their own story, with
  your hero still in it.
- **Signal drift** (on by default) does it for you at halftime.
- **Move the lever** mid-story and the narrator stays, but remarks on it ("And
  just like that, the scenery wandered off and came back as the bottom of the
  Mariana Trench.").

`?seed=42` replays the same broadcast.

## Sound and voices

Out of the box every sound is synthesised live and the narrators use the
listener's device voices (or captions, with no speech engine). Recordings
replace those piece by piece as they are added: performed narration recorded
in the built-in booth (`record.html`), real ambiences from Freesound, generated
effects for the impossible ones, and station music. See **AUDIO.md** for the
whole production plan.

## Files

- `index.html` markup and styles
- `js/data.js` scenes, sound element lists, the five stories, bridges
- `js/engine.js` the story engine (pure logic, no DOM)
- `js/narrator.js` speech: voice choice, sentence chunking, watchdog, captions-only
- `js/audio.js` the thirty sound elements and the mixer
- `js/scenes.js` the five window scenes, drawn in canvas
- `js/frame.js` the window frame
- `js/app.js` wiring
- `js/script.js` the recording script: every recordable piece of every line
- `js/bank.js` loads `audio/index.json` and stitches recorded narration
- `js/samples.js` sound elements built from recordings
- `record.html`, `js/booth.js`, `js/wav.js` the recording booth
- `tools/` build, fetch and generate audio (see AUDIO.md)

## Running and testing

Serve the folder over HTTP (ES modules will not load from `file://`):

```
python3 -m http.server 8000
```

Tests need Node 20+ and Playwright with Chromium:

```
npm test           # everything
npm run test:unit  # 48 tests: story engine, script, narrator, audio tools
npm run test:e2e   # 22 tests in headless Chromium
```

The end-to-end suite swaps in a fake speech engine so a whole broadcast runs in
seconds, then checks full broadcasts, the halftime drift, switching mid-beat,
pause and resume at the sentence, captions-only mode, keyboard, saved settings,
phone layout, frame time, and renders all thirty sound elements offline to check
for clipping, silence and mix balance. `SHOTS=dir npm run test:e2e` also saves
screenshots.
