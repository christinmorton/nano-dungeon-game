// Index of every asset reference sheet the game knows about.
//
// Each pack/sheet lives in its own tileReference.*.json (one _meta per file), because the
// packs are genuinely different sheets at different tile sizes (Kenney 16px, 32rogues/7Souls/
// minerals 32px, legendaries 64px) and shouldn't share one sheet's _meta.
//
// `_meta.mode` on each file tells consumers how to load it:
//   - "spritesheet" (default) : one image grid; entries index it by `frame` (Kenney legacy uses `tile`).
//                               `browseAllFrames: true` => no named entries; iterate `total` frames by index.
//   - "images"               : a folder of individual PNGs; entries name a `file` under `_meta.dir`.
//
// The Kenney file (tileReference.json) is the original single-sheet catalog and is left
// untouched — it carries no `_meta.mode`/`key`, so it's tagged here as the legacy sheet.

import kenney from "./tileReference.json"
import roguesItems from "./tileReference.32rogues-items.json"
import roguesTiles from "./tileReference.32rogues-tiles.json"
import rogues32 from "./tileReference.32rogues-rogues.json"
import souls1a from "./tileReference.7souls-1a.json"
import minerals from "./tileReference.minerals.json"
import legendaries from "./tileReference.legendaries.json"
import legendariesFloor from "./tileReference.legendaries-floor.json"
import heroes from "./tileReference.heroes.json"
import monsters from "./tileReference.monsters.json"
import npcs from "./tileReference.npcs.json"
import props from "./tileReference.props.json"
import cosmic from "./tileReference.cosmic.json"
import traps from "./tileReference.traps.json"
import realm from "./tileReference.realm.json"
import fantasyDungeon from "./tileReference.fantasyrpg-dungeon.json"
import lightingLight from "./tileReference.lighting-light.json"
import lightingLightAlpha from "./tileReference.lighting-light-alpha.json"
import forestAutotile from "./tileReference.forest-autotile.json"
import forestCave from "./tileReference.forest-cave.json"
import castleTown from "./tileReference.castletown.json"
import castleTownInterior from "./tileReference.castletown-interior.json"
import snowAutotile from "./tileReference.snow-autotile.json"
import snow from "./tileReference.snow.json"
import desertAutotile from "./tileReference.desert-autotile.json"
import desert from "./tileReference.desert.json"
import fxFire from "./tileReference.fx-fire.json"
import fxGreen from "./tileReference.fx-green.json"
import fxPurple from "./tileReference.fx-purple.json"
import fxWater from "./tileReference.fx-water.json"
import rpgitemsRetro from "./tileReference.rpgitems-retro.json"
import impact1A from "./tileReference.impact-1a.json"
import impact1B from "./tileReference.impact-1b.json"
import impact1C from "./tileReference.impact-1c.json"
import impact1D from "./tileReference.impact-1d.json"
import impact1E from "./tileReference.impact-1e.json"
import impact1F from "./tileReference.impact-1f.json"
import impact2A from "./tileReference.impact-2a.json"
import impact2B from "./tileReference.impact-2b.json"
import impact2C from "./tileReference.impact-2c.json"
import impact2D from "./tileReference.impact-2d.json"
import impact2E from "./tileReference.impact-2e.json"
import impact2F from "./tileReference.impact-2f.json"
import impact3A from "./tileReference.impact-3a.json"
import impact3B from "./tileReference.impact-3b.json"
import impact3C from "./tileReference.impact-3c.json"
import impact3D from "./tileReference.impact-3d.json"
import impact3E from "./tileReference.impact-3e.json"
import impact3F from "./tileReference.impact-3f.json"
import impact4A from "./tileReference.impact-4a.json"
import impact4B from "./tileReference.impact-4b.json"
import impact4C from "./tileReference.impact-4c.json"
import impact4D from "./tileReference.impact-4d.json"
import impact4E from "./tileReference.impact-4e.json"
import impact4F from "./tileReference.impact-4f.json"
import impact5A from "./tileReference.impact-5a.json"
import impact5B from "./tileReference.impact-5b.json"
import impact5C from "./tileReference.impact-5c.json"
import impact5D from "./tileReference.impact-5d.json"
import impact5E from "./tileReference.impact-5e.json"
import impact5F from "./tileReference.impact-5f.json"
import trapBrick from "./tileReference.trap-brick.json"
import trapFire from "./tileReference.trap-fire.json"
import trapFirebox from "./tileReference.trap-firebox.json"
import trapJumper from "./tileReference.trap-jumper.json"
import trapArrow from "./tileReference.trap-arrow.json"
import trapSpear from "./tileReference.trap-spear.json"
import trapSpike from "./tileReference.trap-spike.json"
import trapSpikeball from "./tileReference.trap-spikeball.json"
import trapSuriken from "./tileReference.trap-suriken.json"
import trapSpikerun from "./tileReference.trap-spikerun.json"
import trapSpiketrap from "./tileReference.trap-spiketrap.json"

// `key` is the texture-load key used for spritesheet packs and the prefix for image keys.
export const SHEETS = [
    { key: "kenney", ref: kenney, legacy: true },
    { key: "32rogues-items", ref: roguesItems },
    { key: "32rogues-tiles", ref: roguesTiles },
    { key: "32rogues-rogues", ref: rogues32 },
    { key: "7souls-1a", ref: souls1a },
    { key: "minerals", ref: minerals },
    { key: "legendaries", ref: legendaries },
    { key: "legendaries-floor", ref: legendariesFloor },
    { key: "heroes", ref: heroes },
    { key: "monsters", ref: monsters },
    { key: "npcs", ref: npcs },
    { key: "props", ref: props },
    { key: "cosmic", ref: cosmic },
    { key: "traps", ref: traps },
    // Per-realm art for the role-driven mechanic props (levels/themeRoles.js).
    { key: "realm", ref: realm },
    { key: "fantasyrpg-dungeon", ref: fantasyDungeon },
    { key: "lighting-light", ref: lightingLight },
    { key: "lighting-light-alpha", ref: lightingLightAlpha },
    { key: "forest-autotile", ref: forestAutotile },
    { key: "forest-cave", ref: forestCave },
    { key: "castletown", ref: castleTown },
    { key: "castletown-interior", ref: castleTownInterior },
    { key: "snow-autotile", ref: snowAutotile },
    { key: "snow", ref: snow },
    { key: "desert-autotile", ref: desertAutotile },
    { key: "desert", ref: desert },
    { key: "fx-fire", ref: fxFire },
    { key: "fx-green", ref: fxGreen },
    { key: "fx-purple", ref: fxPurple },
    { key: "fx-water", ref: fxWater },
    { key: "rpgitems-retro", ref: rpgitemsRetro },
    { key: "impact-1a", ref: impact1A },
    { key: "impact-1b", ref: impact1B },
    { key: "impact-1c", ref: impact1C },
    { key: "impact-1d", ref: impact1D },
    { key: "impact-1e", ref: impact1E },
    { key: "impact-1f", ref: impact1F },
    { key: "impact-2a", ref: impact2A },
    { key: "impact-2b", ref: impact2B },
    { key: "impact-2c", ref: impact2C },
    { key: "impact-2d", ref: impact2D },
    { key: "impact-2e", ref: impact2E },
    { key: "impact-2f", ref: impact2F },
    { key: "impact-3a", ref: impact3A },
    { key: "impact-3b", ref: impact3B },
    { key: "impact-3c", ref: impact3C },
    { key: "impact-3d", ref: impact3D },
    { key: "impact-3e", ref: impact3E },
    { key: "impact-3f", ref: impact3F },
    { key: "impact-4a", ref: impact4A },
    { key: "impact-4b", ref: impact4B },
    { key: "impact-4c", ref: impact4C },
    { key: "impact-4d", ref: impact4D },
    { key: "impact-4e", ref: impact4E },
    { key: "impact-4f", ref: impact4F },
    { key: "impact-5a", ref: impact5A },
    { key: "impact-5b", ref: impact5B },
    { key: "impact-5c", ref: impact5C },
    { key: "impact-5d", ref: impact5D },
    { key: "impact-5e", ref: impact5E },
    { key: "impact-5f", ref: impact5F },
    { key: "trap-brick", ref: trapBrick },
    { key: "trap-fire", ref: trapFire },
    { key: "trap-firebox", ref: trapFirebox },
    { key: "trap-jumper", ref: trapJumper },
    { key: "trap-arrow", ref: trapArrow },
    { key: "trap-spear", ref: trapSpear },
    { key: "trap-spike", ref: trapSpike },
    { key: "trap-spikeball", ref: trapSpikeball },
    { key: "trap-suriken", ref: trapSuriken },
    { key: "trap-spikerun", ref: trapSpikerun },
    { key: "trap-spiketrap", ref: trapSpiketrap }
]

export default SHEETS
