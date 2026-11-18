# The Lantern Company

A small turn-based roguelike that runs in your browser. Pick one of three heroes,
descend five floors, and bring back the amulet — or die trying and find out how
far you got.

Built with [Phaser 3](https://phaser.io/). No install, no account, no saving:
one run at a time, the way the old ones did it.

**Play it:** <https://woodgriot.itch.io/the-lantern-company> — v1.0.0, free, in
the browser.

## This is my first game

I want to say that up front rather than let anyone wonder. The Lantern Company
is the first game I've built, and it shows in places — a few systems were
rewritten once I understood the problem properly, some corners are
half-finished, and the scope grew as I found out what I could actually do.

I've left that visible instead of tidying it away. The parts I'm proudest of
came from hitting walls rather than from planning: the tag system exists because
subclassing enemies stopped scaling, and the three-layer ability stack exists
because copy-pasting spell logic became untenable around the twentieth ability.
If you're reading the code, those two decisions are the ones worth your time.

## About the name

The game, the repository and older commits do not all agree on a name, so here
is how they fit together:

- **The Lantern Company** is the released game. It is named for the band of
  hired adventurers the player belongs to.
- **Nano Dungeon** was the working title. This repository was created under it,
  which is why it is called `nano-dungeon-game`.
- For a while the game was called **Undercrown**. That name turned out to
  belong to another itch.io game, so it was dropped before release.

This repository's history before the v1.0.0 commit holds the earlier, much
larger prototype that the released game was distilled from: 695 source files
and about 60,000 lines, an in-engine dungeon designer, and systems that were cut
to get a small game finished. The released game is 194 files and about 26,000
lines. Check out an earlier commit if you want the prototype.

<!-- SCREENSHOT: drop 3-4 captures in documents/screenshots/ and link them here.
     Suggested shots: a lit cavern room mid-fight, the class select screen,
     an ultimate firing, and the stronghold floor. -->

## The run

Five floors, one way down. Each floor is generated fresh, so the layout, the
loot and what is waiting in the dark are different every time.

The first two floors are **Cavern**, then two of **Verdant Ruin**, then the
**Magma Deep**. The last floor is a stronghold — a single inhabited place with
one resident species and an elite leader holding the deepest room. The Amulet is
in that room. Take it and the run is won.

Die instead and you get one **Revive** per run, at half health, on a timer — let
the countdown run out and the run ends there. Either ending scores the run and
shows you the breakdown.

## The heroes

| | Role | Kit | Ultimate |
|---|---|---|---|
| **Warrior** | Melee · heavy armour, no magic | Cleave, Charge, Bulwark, Mighty Blow, Shove | **The Reaving** — three sweeps through everything adjacent |
| **Ranger** | Ranged · evasive, fast | Dash, Piercing Shot, Root, Stealth, Sense | **Rain of Talons** — an arrow storm that keeps falling for three more rounds |
| **Wizard** | Caster · powerful, fragile | Rime Lance, Barrier, Arc Lightning, Riftstep, Mana Beam | **The Unraveling** — a wide arcane detonation that leaves the ground still coming apart |

Five class abilities and one ultimate each. No skill trees, no unlocks, no
meta-progression — you get the whole kit on floor one and the run is decided by
how you use it.

## Controls

The game is mouse-playable for the core loop — click to move, click to attack,
click to interact — but abilities and items are on the keyboard. There is a
Controls screen in-game, reachable from the title card and from Pause.

**Moving**

| | |
|---|---|
| Arrow Keys | Move one tile |
| Click a tile | Step toward it |
| Shift + Click | Travel there — keeps walking until something interrupts |
| Space | Wait — pass the rest of your turn |

**Fighting**

| | |
|---|---|
| Click an enemy | Attack it, if it is in weapon range |
| Q W E A S | Abilities — your five class skills |
| R | Ultimate — long cooldown, no cost gate |
| Click a target | Aim an ability that asks for one |
| X | Retreat from combat |

**Items and screens**

| | |
|---|---|
| 1 – 0 | Equip or use the item in that carry slot |
| Shift + 1 – 0 | Drop that item |
| F | Interact — doors, chests, stairs, bags |
| C | Character — your stats, your gear, and what each item in your pack would change |
| Esc | Pause — inventory, volume, and the controls screen |

Equipping and unequipping is by click, on the Character screen or the Pause
panel. If anything here and the in-game Controls screen disagree, the screen is
right — it reads every binding from the keymap, and this file is typed by hand.

## Sound

Music per floor, and sound on the things that matter: swings, misses, blocks,
crits, footsteps, pickups, potions, stairs, and a voice for each enemy when it
dies. Music and sound volume are on the Pause menu in 10% steps, and 0% is mute.

## Credits

The code, the design and the terrain art are original. The item icons, the
character sprites and all of the audio are licensed work by other people, named
here because that is the point of a credits section. Full detail, including
licence terms, is in [CREDITS.md](CREDITS.md).

**Art**

- Terrain, props and debris for all three biomes — original art made for this
  project
- **[32rogues](https://sethbb.itch.io/32rogues) by Seth Boyles** — weapons,
  armour and items
- **[Kenney 1-Bit Pack](https://kenney.nl/assets/1-bit-pack)** (CC0) — fallback tiles
- **7Soul RPG Icon Pack 1** — the eighteen ability icons
- **[PixelLab](https://pixellab.ai/)** — heroes, monsters and props, generated
  for this project

**Audio**

- *RPG Magic SFX 2* — spells, abilities, UI and item sounds
- *Fantasy RPG Music Pack* and *RPG Battle Themes* — floor and stronghold music
- *Footsteps Sounds* — movement
- *Complete Elements*, *Beautiful Nature*, *Combat & Warfare*, *Ultimate
  Whooshes* — bows, impacts and monster voices

**Engine**

[Phaser 3](https://phaser.io/) · [Vite](https://vite.dev/) ·
[PathFinding.js](https://github.com/qiao/PathFinding.js)

## A note on this repository

The art and audio files are not in this repo, and that is deliberate rather than
an oversight. Several of the packs above permit commercial use in a game but
forbid redistributing the source files — and a public repository containing them
*is* redistribution, since everyone who clones it receives a copy. So the rules
fail closed: no raster art, no audio, no exceptions by extension.

What that means if you clone this: it will build and run, but render untextured
and play silent. The asset scripts in `scripts/` record which source file every
sound and icon came from, so the set is reassemblable if you own the same packs —
but there is no download script, and that is the honest cost of the approach.

## Building from source

```
npm install
npm run dev      # development server
npm run build    # production build into dist/
```

The build targets itch.io: `base: './'` and a renamed asset directory, so
`dist/index.html` works when served from a subdirectory, which is how itch
serves it. It does **not** work opened straight off your disk: the game loads as
an ES module, and browsers block module scripts on `file://`. To check a build
before uploading, serve it over HTTP — `cd dist && python -m http.server 8777`,
then open <http://127.0.0.1:8777/>.

To upload, zip the **contents** of `dist/` so `index.html` sits at the zip root.
Do not use PowerShell's `Compress-Archive` for this: on Windows PowerShell 5.1
it writes backslashes into the zip's paths, itch's servers treat those as part
of the filename, and the game loads as a black screen.
`marketing/itch_page.md` has a command that builds a working zip, along with the
page copy and embed settings.

## Notes on the code

Many comments cite design notes under `documents/`. Those notes live in a
separate private repository with the game's setting material, so the references
point nowhere here. The comments themselves still explain the code.

## Licence

No licence is granted; all rights reserved. The code is public to read, not to
reuse.
