# Audio production guide

The game ships fully playable with synthesised sound and the listener's device
voices. Every recording you add replaces its synthetic stand-in, piece by
piece, so you can work in any order and publish whenever you like.

```
audio-src/   raw material (not committed)      audio/   what the game plays (committed)
  voice/<narrator>/<clip>.wav                    voice/<narrator>/<clip>.mp3
  sfx/<element>/bed-*.wav   loops                sfx/<element>/bed-*.mp3
  sfx/<element>/shot-*.wav  one-shots            sfx/<element>/shot-*.mp3
  music/<station>-ident.*   music/<station>-bed.*  music/...
                                                 index.json   <- tools/build-audio.mjs
```

After adding anything, run `node tools/build-audio.mjs` in this folder. It
trims and levels voices, encodes everything to MP3 (needs `ffmpeg`), writes
`audio/index.json`, and prints what is covered.

## 1. Narration: five performers

Each narrator records about 230 short pieces, roughly 1,200 words, which
comes to around 8 minutes of finished audio and an hour or so in the booth.
Lines are recorded in pieces so any hero, place or prop can be stitched into
any line: that is what keeps the mad-lib variety and lets a story change
hands between stations.

| Narrator | Station | Accent | Direction |
|---|---|---|---|
| The Drifter | KDRY 540 | Texas | Old cowhand by a campfire. Slow, warm, dusty. |
| The Ranger | Radio Billabong 710 | Australian | Cheery park ranger, quick and chatty. |
| The Old Salt | Saltwater Wireless 880 | Irish | Pub storyteller with a twinkle and a rolling rhythm. |
| The Inspector | Station Neon 1050 | London | Dry noir detective. Deadpan, clipped, never surprised. |
| The Chief Engineer | Fathom FM 1290 | Scottish | Gruff, warm, slightly exasperated with the crew. |

**Record in tiers.** The booth lists everything in this order:

1. **Home story** (about 80 pieces): the first take of every beat, the
   narrator's own cast, own scene and flavour words. With just this, that
   station's story plays fully performed on its home scene.
2. **Extra takes and bridges** (about 55): second takes, the lines for taking
   over a story mid-broadcast, losing the signal, and remarks on the scenery.
3. **Crossovers** (about 90): every other station's characters by short name,
   and every other scene's places, so stories can wander anywhere.

Until a narrator is finished, any line with an unrecorded piece is read by the
device voice, and recorded takes are picked first whenever there is a choice.

### Using the booth

Serve the folder (`python3 -m http.server 8000`) and open
`http://localhost:8000/record.html`. Chrome or Edge work best.

1. Pick the narrator tab and press **Open mic** (allow the microphone).
2. Read the big words. The line underneath shows the whole sentence with your
   piece underlined, so you know whether to land it or leave it hanging.
3. `R` (or Enter) starts and stops. The booth trims the silence, levels the
   take, saves it in the browser, and moves to the next piece.
4. `Space` replays the take. `H` plays the whole line stitched from what is
   recorded so far, which is the best way to check the joins sound natural.
5. **Export** downloads a zip. In this folder run
   `node tools/build-audio.mjs --zip <the zip>`.

Takes survive closing the tab (they live in the browser's storage), so a
session can be spread across days. Export before clearing browser data. If
the script wording changes later, affected takes show as "please redo".

**Mic tips.** A quiet, soft room (a wardrobe full of clothes is perfect), a
fist's width from the mic, slightly off axis to avoid pops. Keep the same
distance and energy for the whole session so pieces match when stitched.
Names and places want a neutral, mid-sentence read.

## 2. Sound effects: real recordings, AI for the impossible

`tools/sfx-sources.mjs` lists what each of the 30 elements wants.

**Real recordings (Freesound, CC0 only).** Get a free API token at
https://freesound.org/apiv2/apply, then:

```
FREESOUND_TOKEN=... node tools/fetch-freesound.mjs
```

For every element it downloads up to eight candidates into
`audio-src/sfx-candidates/<element>/` and copies the most downloaded one (beds)
or three (one-shots) into `audio-src/sfx/<element>/`, so the game has
something straight away. Listen through the candidates and swap in favourites
by copying them over, keeping the `bed-` or `shot-` prefix and the
`.credit.json` beside each file. Credits are collected into `audio/CREDITS.md`.

**Generated sounds** (hover scooters, the ghost signal, the synth busker):

```
ELEVENLABS_API_KEY=... node tools/generate-sfx.mjs
```

Check your ElevenLabs plan covers commercial use. Prompts live in
`tools/sfx-sources.mjs`; rerun with `--only scooter --takes 4` for more
options.

**Your own files** work too: drop them in `audio-src/sfx/<element>/` named
`bed-anything.wav` (looped ambience, 30 s or more is best) or
`shot-anything.wav` (moments fired on a timer). Levels are matched
automatically, and the picture still reacts: a recorded train still crosses
the window.

## 3. Music: The Deluxxe

Each station can have:

- `music/<station>-ident.mp3`: a 2 to 6 second sting played after the dial
  static, before the narrator starts.
- `music/<station>-bed.mp3`: a loop that sits quietly under the story and
  dips while the narrator talks.

Station ids are `prairie`, `campground`, `docks`, `market`, `trench`. A Music
fader appears on the radio once any music exists. Put the files in
`audio-src/music/` and run the build.

## Size

Expect roughly 4 MB of narration per narrator, 2 to 3 MB of effects per scene,
and whatever the music comes to. Files load only when a line or scene needs
them.
