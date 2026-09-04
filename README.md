# hitfactory.games

The front door to Hit Factory Games. One 1970s living room, one CRT, one dial.
Turn the dial to change channel; each channel is a game. Scroll for the full listings.

## What this is

A single static page. Three.js from a CDN, no build step, no dependencies to install.
The room, the set, the wall clock and the gel light boxes are all modelled and drawn in
code; there are no 3D assets.

- `index.html` - the whole site
- `assets/thumbs/*.jpg` - one still per game, used as the promo plate and video poster
- `assets/loops/*.mp4` - four second gameplay loops, 512x384, lazy loaded one at a time
- `games.json` - the studio catalogue this page renders from

## Cost

The page is about 67 KB. Thumbnails are roughly 210 KB total and loops about 380 KB, but
only the channel you are watching is ever fetched, so a first visit pulls one loop.

## Running it

Any static server. It must be served over HTTP rather than opened as a file, because
WebGL will not accept textures from a `file://` canvas.

```
python3 -m http.server 8000
```

## Credits

Hit Factory Games, a Meatbag Labs joint effort. Made in Vancouver, WA, by Kevin & Odawni.
Original music by [The Deluxxe](https://meatbagmade.com/the-deluxxe/).
