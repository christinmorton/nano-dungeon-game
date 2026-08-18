# Nano Dungeon

A turn-based roguelike built in vanilla JavaScript on Phaser 3 — roughly 695 source files and
60,000 lines. Composition-first: entity behaviour comes from tags rather than a class hierarchy,
abilities are assembled from reusable parts, and levels are authored in an in-engine designer
that runs the same generation code the game does.

## This is my first game

I want to say that up front rather than let anyone wonder. Nano Dungeon is the first game I've
built, and it shows in places — a few systems were rewritten once I understood the problem
properly, some corners are half-finished, and the scope grew as I found out what I could
actually do.

I've left that visible instead of tidying it away. The parts I'm proudest of came from hitting
walls rather than from planning: the tag system exists because subclassing enemies stopped
scaling, and the three-layer ability stack exists because copy-pasting spell logic became
untenable around the twentieth ability. If you're reading the code, those two decisions are the
ones worth your time.

> ### ⚠️ No art assets are included
>
> The game runs on a mix of purchased and CC0 sprite packs. Several of those licences forbid
> redistribution, so none of the ~1,300 images are committed here. **A fresh clone will boot and
> run, but render missing textures.** The code, the level generation and the systems are all
> intact — only the pixels are absent.

## Running it

```bash
npm install
npm run dev
```

Vite serves five entry points, each a separate page:

| Page | What it is |
|---|---|
| `index.html` | The game |
| `designer.html` | Dungeon Designer — author floor layouts, export recipe JSON |
| `arena.html?training` | Ability test bench, driven from `window.training.*` |
| `test.html` | Tile reference browser |
| `grid.html` | Grid scratch page |

## Architecture

Four layers, deliberately shallow on inheritance.

### Presentation
Nineteen Phaser scenes registered in `screens/Game.js`. `World` runs gameplay with
`UserInterface` alongside it; modal overlays (`Shop`, `Loadout`, `GuildHall`, `DraftScreen`,
`DeathScreen`, `UpgradeScreen`, `Settings`, `Credits`…) pause both. Everything routes through
`SceneRouter`.

### Systems
Fourteen module-singletons, one concern each:

`Dungeon` (entity lifecycle and scene coordination) · `TurnManager` (the turn/round loop) ·
`MapState` (level data, tilemap, spatial queries) · `Combat` · `Run` (run-scoped state) ·
`Account` (cross-run persistence) · `FogOfWar` · `WorldQueries` · `GameLog` · `WorldTooltip` ·
`SpeechBubble` · `FloorMemory` · `InputMap` · `encounters`.

### Entities — composition over hierarchy

`BaseHero` and `BaseEnemy` both extend `Taggable`. Instead of subclassing for behaviour,
`addTag(template, ...args)` wraps entity methods with middleware, tracks applied tag names, and
runs `initialize`/`cleanup` hooks for setup and teardown. Around **170 tags** cover statuses,
damage-over-time effects and traits — one concept per file. `addTag` is idempotent, so stacking
effects carry their own counters rather than relying on reapplication. The same object hosts an
entity-agnostic passives API.

This is the load-bearing idea in the codebase. A burning, feared, shielded skeleton is three
tags on a plain enemy — not a class, and not a combinatorial explosion of them. The 52 enemy
definitions are mostly data as a result.

### Abilities — a three-layer stack

1. **Verbs** (`abilities/universals.js`) — physics primitives: damage resolution, beams,
   knockback, healing, wall creation.
2. **Patterns** (`abilities/patterns.js`) — around 30 delivery shapes: bolt, volley, chain,
   aura, afflict, shape-strike, all sharing one `dealHit`.
3. **Declarative payload** — `Ability` subclasses stay thin, setting fields (`cost`, `cooldown`,
   `range`, `target`, damage, applied status, and the level/augment/trait progression ladder)
   plus a short `activate()`.

An elemental affinity layer sits on top, applying an element across all of an entity's damage
and adjusting stats to match.

### Layout

```
src/
  main.js               entry -> modules/screens/Game.js
  modules/
    screens/            World, UI scenes, Dungeon Designer
    classes/            BaseHero, HeroController, Stats, abilities/, profiles/
    enemies/            BaseEnemy + 52 enemy definitions
    companions/         followers, pets, summons, bound spirits, party
    abilities/          universals, patterns, shapes, affinities, draft
    tags/               ~170 statuses / DoTs / traits
    levels/             BSPLevel, AuthoredLevel, LevelManager, autotiling
    items/              items, containers, shrines, tomes
    archetypes/         AI behaviours, per-stat ranges and HP formulas
    hazards/ encounters/ recipes/ settlements/ dialog/
  data/                 cosmic beings, spawn tables, tile reference catalogs
scripts/                reference builders and tile-label validation
```

## The Dungeon Designer

`designer.html` is an in-engine authoring tool rather than a conventional level editor. You draw
areas, place openings and route points, then hand the rest to procedural fill with style knobs.
It exports recipe JSON that `AuthoredLevel` consumes at runtime.

The point of the design is that the preview and the real game call the same generator, so what
you author is what you play — no separate export pipeline to drift out of sync. Multi-floor
rosters, stair placement and win conditions are authored the same way.

## Restoring the art

Sprites load from `public/`, indexed by the `tileReference.*.json` catalogs in `src/data/`.
Those catalogs are committed — they hold frame coordinates and names, not artwork — so any
replacement pack needs to match the expected grid and paths. `scripts/build_*_reference.mjs`
regenerates a catalog from a sheet, and `scripts/validate_tile_labels.mjs` checks the result.

## Status

In active development and not released. Expect half-built systems and rough edges.

No licence is granted; all rights reserved. The code is public to read, not to reuse.

## Credits

Built with [Phaser 3](https://phaser.io/), [Vite](https://vitejs.dev/) and
[pathfinding](https://github.com/qiao/PathFinding.js). Sprite work (not included here) draws on
[Kenney](https://kenney.nl/) (CC0), 32rogues by Seth Boyles, and original art generated with
PixelLab.
