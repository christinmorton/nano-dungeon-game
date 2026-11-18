# The Lantern Company — Credits

The Lantern Company is a solo project. The code, the design and the terrain art
are original; the rest is licensed work by other people, listed here in full.

This file is the shipping record. It is more detailed than the credits section
in the README on purpose — the README tells a player who made the sounds, this
tells a future maintainer which pack a file came from and under what terms.

## Code and design

**Christin Morton** — design, code, terrain art.

## Engine and libraries

| | Licence | Used for |
|---|---|---|
| [Phaser 3](https://phaser.io/) | MIT | Renderer, scenes, input, tweens, camera, audio |
| [Vite](https://vite.dev/) | MIT | Build and development server |
| [PathFinding.js](https://github.com/qiao/PathFinding.js) | MIT | Enemy A* |

## Art

**Terrain, props, debris and stairs — original.** The five biome sets
(`cavern`, `verdant`, `magma`, plus `frozen` and `sandstone` unused in this
build) are original work made for this project, and ship with their own
manifests. Three of the five appear in the game.

**[Kenney 1-Bit Pack](https://kenney.nl/assets/1-bit-pack)** — CC0 1.0, public
domain. Registered as the fallback tileset for anything without dedicated art.

**7Soul RPG Icon Pack 1** — the eighteen ability icons, from `Pack 1A/skill`.
GameDev Market Pro Licence via the GameDev Market RPG Humble Bundle, with that
bundle's amendment lifting the single-project restriction. Commercial use
permitted; redistribution is not.

**[PixelLab](https://pixellab.ai/)** — heroes, monsters, NPCs and props,
generated for this project under a PixelLab subscription. Ownership per
PixelLab's terms of service.

## Audio

All audio is licensed commercial library work. Roughly seventy files ship out of
libraries totalling tens of gigabytes; `scripts/pick_audio.mjs` holds the
mapping from each game sound back to its source file.

| Library | Used for |
|---|---|
| RPG Magic SFX 2 | Spells, abilities, UI, potions, item pickups |
| Fantasy RPG Music Pack | Floor exploration music |
| RPG Battle Themes | Stronghold music and fanfares |
| Footsteps Sounds | Hero movement |
| Complete Elements | Monster voices (slime) |
| Beautiful Nature | Monster voices (skeleton) |
| Combat & Warfare | Impacts |
| Ultimate Whooshes | Bow shots and projectiles |

The RPG-specific packs are purpose-built game audio and are preferred
throughout. The cinematic libraries are used only where the RPG packs have no
equivalent — which in practice means bows and monster throats.

## Fonts

An arcade bitmap font ships in `public/assets/fonts/`. It is loaded but not
currently drawn by any scene.

## A note on the asset files

None of the art or audio files are committed to this repository. Several of the
packs above permit commercial use in a game while forbidding redistribution of
the source files, and a public repository containing them is redistribution.
The `.gitignore` blocks raster art and audio by extension across the whole repo,
so the rule fails closed rather than depending on a per-pack list staying
current.

Two generated files are committed, because they contain coordinates and names
rather than artwork: `src/data/audioManifest.json` and the `tileReference.*.json`
sheet labels. An index is not the book.
