# Where in the World is Chargers, San Diego?

An escalating tap-the-globe gridiron chase. A detective agency tracks a crew of NFL players across a real 3D globe, and you drop a pin on the college, stadium, or city that each clue points to. Five leads per case, the last one is the boss.

**Play it:** https://hitfactory.games/games/chargers-san-diego/

## How to play

Drag to spin the globe, zoom in and out, and click to drop a pin. Lock the pin before the clock runs out. Scoring uses great-circle distance, so a near miss still earns credit. The tolerance tightens and the clock gets stingier from lead 1 to lead 5, and the first lead surfaces a funny nudge once half the clock is gone. Clues are about football identity only (stats, accolades, draft slot, jersey number), never geography. Each new case picks a random crew (never an immediate repeat) from ten, such as the Patriots dynasty, the Greatest Show on Turf, the Legion of Boom, and the 1983 QB draft class.

## Tech

One self-contained `index.html`. D3 orthographic globe with TopoJSON land shapes. It loads D3 and TopoJSON from cdnjs and web fonts from Google Fonts, and tries to fetch a detailed world atlas from jsDelivr (unpkg as backup), falling back to simplified inline continent outlines. D3 itself must load, so it needs a network connection, a known break from the rest of the catalog's zero-dependency default.

## Provenance

Started life as `demo/geo-game.html` in the Gridiron Gazette project. This copy is the studio's; edits here do not flow back.
