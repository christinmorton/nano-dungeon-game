# itch.io page copy — The Lantern Company

Paste-ready text for the itch.io project page, plus the settings that a Phaser
build needs to actually run in the embed. Written 2026-09-22, renamed 2026-10-17.

---

## 1. Project settings

| Field | Value |
|---|---|
| Title | The Lantern Company |
| Project URL | `the-lantern-company` — live at <https://woodgriot.itch.io/the-lantern-company> |
| Short description / tagline | Five floors down, one way back. A small turn-based roguelike. |
| Classification | Game |
| Kind of project | **HTML** |
| Release status | Released |
| Pricing | No payments (free) |

### Upload

Upload the **contents** of `code/v5/dist/` as a zip — `index.html` must sit at
the zip root, not inside a `dist/` folder. Tick **"This file will be played in
the browser."**

The upload button is under **Edit game → Uploads**, below Pricing. The Embed
options below only appear after a file is uploaded with that box ticked.

> **⚠ Do not build the zip with PowerShell's `Compress-Archive`.** On Windows
> PowerShell 5.1 it stores entry names with backslashes (`bundle\index-….js`).
> itch serves from Linux, where a backslash is part of the filename, so
> `./bundle/…` 404s and the embed is a **black screen** with no other symptom.
> This is exactly what happened to the first v1.0.0 upload (2026-11-17). Zip with
> forward slashes instead, from `code/v5`:
>
> ```
> python -c "import os,zipfile; z=zipfile.ZipFile('the-lantern-company-vX.Y.Z-itch.zip','w',zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f), os.path.relpath(os.path.join(r,f),'dist').replace(os.sep,'/')) for r,_,fs in os.walk('dist') for f in fs]"
> ```
>
> Python's `zipfile` hides the problem on Windows: it rewrites `\` to `/` when
> *reading*, so `namelist()` looks clean even on a broken zip. To check a zip,
> look at the raw bytes, or just upload as a Draft and click **Run game**.

### Embed options

| Setting | Value | Why |
|---|---|---|
| Viewport width | **1280** | The design resolution in `Game.js`. |
| Viewport height | **800** | Same. |
| Fullscreen button | **Enabled** | The canvas is `Scale.FIT`; fullscreen is where it looks best. |
| Mobile friendly | **Off** | Keyboard-only abilities and item slots. |
| Automatically start on page load | Off | Let the player click in first — audio needs a gesture. |

### Metadata

- **Genre:** Role Playing
- **Tags:** `roguelike`, `turn-based`, `dungeon-crawler`, `pixel-art`,
  `procedural-generation`, `fantasy`, `singleplayer`, `phaser`
- **Input:** Keyboard, Mouse
- **Cover image:** `code/v5/marketing/cover.png` (630×500)

---

## 2. Short description (the tagline, 140 char max)

```
Five floors down, one way back. A small turn-based roguelike.
```

Alternates, if that reads flat:

```
A turn-based dungeon crawl. Three heroes, five floors, one amulet.
```

```
Descend five floors, take the Amulet, live long enough to regret it.
```

---

## 3. Page body

*Paste into the page description. itch.io's editor handles this formatting.*

---

### The Lantern Company

The Realm sealed this ground and carved a warning over the stair. The Lantern
Company took the job anyway. The amulet is five floors down.

The Lantern Company is a small turn-based roguelike that runs in your browser.
Pick a hero, go down, and find out how far you get. No account, no saving, no
unlocks — one run at a time, the way the old ones did it.

**Every run is built fresh.** The rooms, the loot, and what is waiting in the
dark are different each time. You descend through caverns, then the overgrown
stone of a Verdant Ruin, then the Magma Deep — and the last floor belongs to
somebody. One species lives there, there are a lot of them, and the one in
charge is holding the deepest room. The amulet is in that room.

**Three heroes, and they play nothing alike.**

- **Warrior** — heavy armour, no magic. Walks into the room and closes it down.
  His ultimate, The Reaving, sweeps three times through everything adjacent.
- **Ranger** — fast and evasive, dangerous at a distance and fragile up close.
  Rain of Talons blankets an area and keeps falling for three more rounds.
- **Wizard** — the most powerful and the easiest to kill. The Unraveling tears
  the ground open and leaves it coming apart underneath whatever survived.

Each hero has five abilities and one ultimate, all available from floor one.
There is no skill tree. The run is decided by how you use what you already have.

**Turn-based, so the pressure is positional.** Enemies have to actually see you
— they have facing and a vision cone, so there is a difference between walking
into a room and looking into it first. Some patrol, some hang back and shoot,
and some come straight for you no matter what. Fog of war means
the room you are about to enter is a question. Standing in a doorway is a
tactic; standing in the open with three archers is a mistake.

**You get one Revive per run,** at half health, on a countdown. Let it run out
and that is the run.

---

**Controls** — arrow keys or click to move, click to attack, **F** to interact,
**Q W E A S** for abilities, **R** for your ultimate, **1–0** for items,
**Esc** to pause. There is a full controls screen on the title card and in the
pause menu.

---

*Made with Phaser 3. Sound and music from licensed libraries; full credits in
the game's repository. Cover art and terrain are original.*

---

## 4. Pre-publish checklist

- [x] ~~Rebuild~~ — **done 2026-10-17.** Rebuilt at commit `2aedd14`; the
      previous `dist/` was from 2026-09-22 and predated fourteen commits
      including the rename, so it would have shipped a game called Undercrown.
- [x] ~~Strip the Mana Beam scaffolding~~ — **done**, stripped by `5c52156`
      in the sustained-only rewrite. Verified 2026-10-17: a grep for
      `VARIANTS`, `setVariant`, `variantNames`, `variantLabel`, `window.beam`
      and `window.beamTrace` across `src/` returns three explanatory comments
      and no live code.
- [x] ~~Test the build locally~~ — **done 2026-10-17, played and working.**

      > **⚠ CORRECTION — this item used to say "open `dist/index.html`
      > straight off disk". That test cannot pass and never could.** Vite emits
      > the game as `<script type="module" crossorigin>`, and ES modules are
      > always fetched under CORS rules. Over `file://` the page's origin is
      > `null`, so the browser blocks the bundle outright:
      > *"Access to script … from origin 'null' has been blocked by CORS
      > policy."* Nothing in the build config can change that — Chrome's own
      > error lists the protocols it allows and `file` is not one of them.
      >
      > **What `base: './'` actually guarantees** is that the emitted paths are
      > relative (`./bundle/…`), so the game works when served from a
      > *subdirectory* — which is what itch does, and what the default `/`
      > would break with a silent black screen.
      >
      > **The real test is any static HTTP server:**
      > `cd dist && python -m http.server 8777` then open
      > <http://127.0.0.1:8777/>. That matches how itch serves it.

      Verified this way at `2aedd14`: `index.html`, the bundle, `art/skills.png`,
      the arcade font, `audio/`, and `game_dev_sprites/sprites/` all return 200;
      13 MB total; tab title reads *The Lantern Company*.
- [ ] **Resize the window** and confirm `Scale.FIT` behaves at small and large
      sizes.
- [ ] Confirm audio starts after the first click (browsers block autoplay).
- [x] ~~Settle the name~~ — **done 2026-10-17, see §6.** The game is *The
      Lantern Company*; code strings, README, CREDITS and this file are
      updated. The Figma wordmark component is renamed and reset to one line at
      48px, and `marketing/cover.png` is re-exported at 630×500.
      **`compose_cover.py` needed no code change** — it composes only the scene
      and the dark top band; the wordmark is composited over it in Figma. So
      "re-render the cover" means re-export from Figma, not re-run the script.
- [x] ~~At least one screenshot~~ — **done 2026-10-17.** Seven stills and
      three GIFs in `documents/screenshots/`, cut from the playthrough
      recordings. See §5 for which shots they cover.

## 5. Screenshots to capture

Four shots, in the order they should appear on the page:

1. **A lit fight in a cavern room** — brazier light, two or three enemies
   closing. This is the one that has to sell the game; make it the first image.
2. **The class select screen** — shows there are three ways to play, and it is
   the most finished-looking screen in the game.
3. **An ultimate firing** — The Unraveling or Rain of Talons, mid-detonation.
4. **The stronghold floor** — the elite leader and its retinue, ideally with
   the Amulet room visible.

Save to `documents/screenshots/` (the `.gitignore` has an explicit escape hatch
for that folder, so these are safe to commit).

**Captured 2026-10-17**, cut from the per-class playthrough recordings in
`design_files/`. All cropped to `crop=1280:612:0:72`, which removes the browser
chrome and the Windows taskbar OBS recorded; stills are upscaled 2x
nearest-neighbour so the pixel art stays sharp.

| File | Covers | Source |
|---|---|---|
| `01_rain_of_talons.png` | shot 3 (ultimate) | Ranger, arrows mid-storm |
| `02_magma_deep.png` | **substitute for shot 4** | Ranger surrounded, floor 5 |
| `03_camp.png` | the Camp room (§10.11) | Warrior, "Rest at the campfire" |
| `04_mana_beam.png` | Wizard signature | beam crossing a cavern room |
| `05_the_reaving.png` | Warrior ultimate | burst ring, two enemies caught |
| `06_class_select.png` | **shot 2** | all three kits, Warrior selected |
| `07_controls.png` | — | the Controls overlay |
| `talons.gif` · `manabeam.gif` · `reaving.gif` | motion | one per class |

**Shot 4 could not be captured: no recorded run ever reached a stronghold
floor.** The Magma Deep frame stands in — it is the only footage of floor 5,
the biome is visually distinct from the other shots, and the hero is genuinely
surrounded. Replace it if a stronghold run is ever recorded.

Shot 1 (a lit cavern fight) is the one still unfilled; `03_camp.png` occupies
that slot and sells a system instead of a fight.

## 6. The name — resolved 2026-10-17

**The game is `The Lantern Company`.** Full reasoning in scope doc §10.19; the
short version follows.

`Undercrown` was taken — *Undercrown Playtest* by TarikHavoc, a turn-based
hex-grid fantasy tactics game, close enough in genre that search results mix
(<https://tarikhavoc.itch.io/undercrown>). Verified by search 2026-09-22. The
name was stripped from the running game on 2026-10-09 (`1b5db00`), before a
replacement existed, so the per-class playthrough recordings would not put a
doomed title on camera.

**Availability of the new name, checked 2026-10-17:** no exact title on itch,
none on Steam, and both `lantern-company.itch.io` and
`thelanterncompany.itch.io` free. Nearest neighbours are single-word *Lantern*
games in other genres.

> **Method note, because it bit three times.** itch.io varies the attribute
> order in its search markup between responses, so a brittle grep silently
> returns "no results" for names that are in fact taken. Always run a control
> query with known hits (`hollow`) in the same batch and confirm it parses.
> Use raw `curl`, never WebFetch — WebFetch returns the JS-rendered homepage
> and falsely reports zero results. A free `<name>.itch.io` subdomain does not
> prove the game slug is free under some other account, and an HTTP 429 is
> rate limiting, not a taken name. **Unreleased projects with no web presence
> stay invisible to all of this — which is exactly how Undercrown Playtest was
> missed the first time.**

**The §10.7 constraint is retired.** It required the title to work in *The
Amulet of ____*, which is why thirty candidates all named the place or the
dark. A guild name cannot fill that blank without implying the band owns the
amulet. `Amulet.js` now describes the artifact without naming the game, and
the title is unconstrained.
