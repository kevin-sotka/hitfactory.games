# Where in the World is Chargers, San Diego?

## What it is
A geography chase for football fans. The player is a gumshoe at the ACME Pro Football Detective Agency. Each case is a crew of five NFL players: four henchmen and a ringleader. Every lead is a clue set about one player, and the answer is a place on Earth (usually a college, sometimes a stadium or city). The player spins a globe, drops a pin, and locks it. The final lead names the boss, and closing the case ends the run.

## Core loop
Read clues, spin and zoom the globe, drop a pin, lock it, see the distance and the score, advance the trail to the next lead.

## Systems
- Great-circle scoring: full credit inside a per-lead tolerance (km), a "close" band, and zero past a cutoff distance, with the bands tightening each lead.
- Escalation: clock runs 45 seconds on lead 1 down to 24 on lead 5, and tolerances shrink with it.
- Warrants: a running count of leads cracked cleanly.
- Dwindle hint: lead 1 only, a funny nudge that appears when the clock passes 50 percent.
- Travel trail: a record of where the chase has been.
- Content: ten crews of five leads each, authored as data in the `CREWS` array. A new case picks a random crew, never the same twice in a row. Clues never carry geo hints.

## Scope
Single `index.html`, mobile first is a goal, not yet verified. Needs network for D3, TopoJSON, and fonts. The world atlas is fetched with an inline simplified fallback.

## Open questions
- Self-contain the dependencies, or accept the network requirement.
- Name and likeness: it uses NFL team and player names. Fine for a personal site, worth a second look before promoting it.
