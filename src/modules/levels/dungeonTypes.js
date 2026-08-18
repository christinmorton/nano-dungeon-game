// Dungeon Types — a named, ready-made look for a whole dungeon (design §14.2's
// "realms are recipes", finally as data you can pick rather than assemble).
//
// THE PROBLEM THIS SOLVES. Theming a dungeon used to mean opening the Atlas,
// picking a floor FRAME NUMBER off a sheet, picking a wall frame off the same
// sheet, and only then discovering the "Autotile ground" dropdown — which stays
// empty until a frame has been picked, because it reads terrains from
// theme.sheet and theme is null until then. The labeled terrain was the thing
// you actually wanted and it was the last thing you could reach. A type
// collapses all of it to one choice: "Castle Town".
//
// A TYPE NAMES TERRAINS, NEVER FRAMES: { sheet, ground, wall }. Frame indices
// are resolved at apply time from the live tile-label store, so re-labeling a
// sheet in the Atlas moves every dungeon built on it and nothing here goes
// stale. This is the same read-through-the-store rule autotile.js and
// tileRegions.js follow.
//
// ONE SHEET PER TYPE IS AN ENGINE CONSTRAINT, NOT A STYLE CHOICE. MapState.bind
// builds the floor's tilemap with a single addTilesetImage call, so ground and
// wall must come off the same sheet.
//
// WHAT COUNTS AS A "WALL" TERRAIN IS ABOUT READING, NOT MATERIAL. The castletown
// sheets ship literal brick rings, but the forest / snow / desert autotile sheets
// have no walls at all — every terrain on them is a ground material. They still
// make dungeons, because a wall only has to READ AS IMPASSABLE: thicket, deep
// water and brick all do; dirt, grass and sand do not.
//
// BUT DO NOT AUTOTILE BOTH SIDES ON THOSE SHEETS — that was the first attempt and
// it left a visible seam down every wall. A `<surround>-<fill>` terrain is a
// BORDERED PATCH: its nine tiles carry the fill inward and the surround outward,
// so it is drawn to be stamped ON a field of its surround, not to butt against a
// second terrain. Autotiling ground AND wall puts two border rings back to back,
// and you see both transitions at once — a sand/black gap in desert (its outer
// corners are transparent), a brown dirt line in snow, and a corner tile holding
// water, dirt and grass simultaneously in forest.
//
// So an outdoor realm uses `groundFill` — the sheet's SEAMLESS fill variants,
// labeled without a `:dir` ("sand-1", "snow-2", "leafy-grass-1") — as the floor,
// and autotiles ONLY the barrier. The barrier's own border then lands directly on
// matching ground and disappears, which is exactly what the art was drawn for.
//
// THE PAIRED OBJECT SHEETS ARE NOT A SOURCE OF WALL TERRAINS. forest-cave's
// crystal walls, snow's brick wall and castletown-interior's stone wall look like
// candidates and are not: they are either seamless FILL textures with no borders,
// or side-view wall FACES drawn for a 2.5D convention (lit cap on top, body
// below, no left/right edges). Neither is a top-down nine-tile ring. Verified by
// rendering the blocks; don't re-litigate it from the names.

import { terrainFillFrame, framesForLabels } from "./autotile.js"
import { findRegion, regionFrameList } from "./tileRegions.js"
import { realmStairs } from "./themeRoles.js"
import SHEETS from "../../data/assetSheets.js"

// The curated set. Curated rather than derived on purpose: the label store can
// be machine-read for "which terrains exist", but not for "which two look right
// together" — deriving every legal pair yields red carpet under blue roof tiles.
// Each entry is one deliberate pairing.
//
// NOT EVERY COMPLETE 9-TILE TERRAIN IS A GROUND TERRAIN. Autotiling assumes the
// 3x3 describes a RECTANGULAR border, so a set whose art is a ROUND standalone
// platform tiles into stray arcs and see-through corners the moment a room is
// anything but one isolated blob. castletown ships three of these —
// `raised-stone-floor`, `raised-stone-floor-cross`, `rounded-stone-border-grass`
// — as decorative plazas/daises with rounded, partly TRANSPARENT corners. They
// label and validate perfectly (they really are 9-tile sets), so the only way to
// catch it is to LOOK at the block. Old Quarter shipped on `raised-stone-floor`
// and had exactly this defect before moving to the square brown flagstone.
export const DUNGEON_TYPES = [
    {
        key: "castle-town",
        name: "Castle Town",
        description: "Open cobbled ground inside grey stone walls. A settlement built to be defended.",
        lighting: "daylight",   // streets under open sky, not an interior
        roles: {
            chest: { sheet: "castletown", name: "chest-white" },
            font: { sheet: "castletown", name: "stone-well" },
            doorClosed: { sheet: "castletown", name: "narrow-door" },
        },
        sheet: "castletown",
        ground: "stone-border-grass",
        wall: "grey-stone-brick-wall",
        scenery: { sheet: "castletown", regions: ["stone-well", "free-range-tall-bush", "wooden-crate", "barrel-blue-band"] },
        debris: { sheet: "castletown", regions: ["flowers-blue", "flowers-white", "flowers-yellow", "flowers-yellow-2"] },
    },
    {
        key: "castle-halls",
        name: "Castle Halls",
        description: "Patterned flagstones between whitewashed brick. The clean, formal interior.",
        roles: {
            chest: { sheet: "castletown", name: "chest-white" },
            shrine: { sheet: "castletown-interior", name: "statue-angel" },
            doorClosed: { sheet: "castletown-interior", name: "door-white" },
            doorOpen: { sheet: "castletown-interior", name: "doorway-lit" },
        },
        sheet: "castletown",
        ground: "patterned-stone-floor",
        wall: "white-brick-wall",
        scenery: { sheet: "castletown", regions: ["pale-stone-column", "chest-white", "white-round-table", "white-chair-pair"] },
    },
    {
        key: "sandstone-keep",
        name: "Sandstone Keep",
        description: "Warm tan stone throughout — a dry, sunlit fortress.",
        roles: {
            chest: { sheet: "castletown", name: "chest-white" },
            font: { sheet: "castletown", name: "stone-well" },
            doorClosed: { sheet: "castletown", name: "narrow-door" },
        },
        sheet: "castletown",
        ground: "patterned-stone-floor-tan",
        wall: "tan-brick-wall",
        scenery: { sheet: "castletown", regions: ["pale-stone-column", "chest-white", "wooden-crate", "barrel-blue-band"] },
    },
    {
        key: "old-quarter",
        name: "Old Quarter",
        description: "Worn terracotta flagstones hemmed in by pale cream brick. Older, tighter, sun-bleached.",
        lighting: "daylight",   // exterior streets, like Castle Town
        roles: {
            chest: { sheet: "castletown", name: "chest-white" },
            font: { sheet: "castletown", name: "stone-well" },
            doorClosed: { sheet: "castletown", name: "narrow-door" },
        },
        sheet: "castletown",
        ground: "patterned-stone-floor-brown",
        wall: "cream-brick-wall",
        scenery: { sheet: "castletown", regions: ["stone-well", "free-range-tall-bush", "wooden-crate", "barrel-blue-band"] },
        debris: { sheet: "castletown", regions: ["flowers-blue", "flowers-white", "flowers-yellow", "flowers-yellow-2"] },
    },
    {
        key: "candlelit-hall",
        name: "Candlelit Hall",
        description: "Red carpet swallowed by black void — rooms read as pools of light in the dark.",
        roles: {
            shrine: { sheet: "castletown-interior", name: "statue-angel" },
            doorClosed: { sheet: "castletown-interior", name: "door-white" },
            doorOpen: { sheet: "castletown-interior", name: "doorway-lit" },
        },
        sheet: "castletown-interior",
        ground: "red-carpet",
        wall: "darkness",
        scenery: { sheet: "castletown", regions: ["white-round-table", "white-chair-pair", "chest-white"] },
    },

    // Outdoor realms. Seamless fill for the floor, ONE autotiled barrier for the
    // wall — see the groundFill note above for why the floor must not autotile.
    {
        key: "frozen-thicket",
        name: "Frozen Thicket",
        description: "Open snowfield, hemmed in by thickets too dense to push through.",
        lighting: "daylight",
        sheet: "snow-autotile",
        groundFill: ["snow-1", "snow-2"],
        wall: "snow-thicket",
        // Scatter off the paired object sheet — the autotile sheet has nothing
        // but terrain on it. snow-fill is snow with pebbles showing through.
        decor: { sheet: "snow", regions: ["snow-fill"], density: 0.10 },
        scenery: { sheet: "snow", regions: ["snowman", "wooden-wheel"] },
        debris: { sheet: "snow", regions: ["snow-specks", "green-sprigs", "snowy-branches"] },
    },
    {
        key: "forest-glade",
        name: "Forest Glade",
        description: "Deep grass clearings cut off by standing water.",
        lighting: "daylight",
        sheet: "forest-autotile",
        groundFill: ["leafy-grass-1", "leafy-grass-2"],
        wall: "dirt-water",
        scenery: { sheet: "forest-cave", regions: ["bush-small", "boulder-brown"] },
        debris: { sheet: "forest-cave", regions: ["flowers-orange", "plant-purple-flower", "straw-pile", "pebbles"] },
    },
    {
        key: "desert-compound",
        name: "Desert Compound",
        description: "Open sand courtyards inside red brick walls.",
        lighting: "daylight",
        sheet: "desert-autotile",
        groundFill: ["sand-1", "sand-2", "sand-3", "sand-4"],
        wall: "sand-redbrick",
        // rubble-tiles-sand is a 3x1 strip = three independent rubble-on-sand
        // tiles, the clearest case of a region being N decals rather than one
        // object. Forest Glade takes no decor: the cave sheet's palette is dark
        // and cold against that bright grass, and its scatter is overlay art.
        decor: { sheet: "desert", regions: ["rubble-tiles-sand"], density: 0.10 },
        scenery: { sheet: "desert", regions: ["cactus-saguaro", "clay-pots", "wooden-crate"] },
        debris: { sheet: "desert", regions: ["desert-shrub"] },
    },
]

export function getDungeonType(key) {
    return DUNGEON_TYPES.find(t => t.key === key) || null
}

const metaFor = (sheetKey) => {
    const sheet = SHEETS.find(s => s.key === sheetKey)
    return (sheet && sheet.ref && sheet.ref._meta) || null
}

// Build the THEME object a type stands for — the shape MapState.bind consumes
// (see normalizeTheme in recipes.js). Returns null if the type is unknown or
// its terrains are no longer fully labeled on the sheet, so a broken type falls
// back to the default tileset instead of painting garbage.
//
// NOTE THE floorTiles / wallTiles: they are NOT decoration. MapState's
// validAuthoredTheme() rejects any authored theme lacking floor AND wall
// frames, and a rejected theme falls back to the recipe's default SILENTLY —
// a terrain-only theme would look like the feature simply doing nothing.
// Emitting each terrain's own fill (:c) frame satisfies that contract for free
// and doubles as the correct fallback for any cell the autotiler can't resolve.
// A type's floor frames, plus whether the floor autotiles. Two forms:
//   ground     — a TERRAIN name; the floor autotiles, and its fill frame is the
//                fallback. Right when floor and wall are both real bordered
//                terrains drawn to meet (the castletown sheets).
//   groundFill — seamless fill LABELS; the floor is sampled flat from them and
//                does not autotile, so the wall's border lands on plain ground.
// Returns null if nothing resolves.
// A type's scatter DECALS, or null. `decor` names a sheet plus REGIONS on it,
// and each region is expanded to its frames — a 3x1 "rubble-tiles-sand" is three
// independent single-tile decals, which is exactly what the env sampler wants.
// This is the first consumer of the named-region half of the label store.
//
// Decals normally come from a DIFFERENT pack than the ground: the autotile sheets
// are terrain-only (their spare frames are empty), so the scatter that stops a
// plain sand or snow floor reading as a blank field lives on the paired object
// sheet. That is what multi-sheet themes are for.
//
// `density` is shared out evenly across the frames, so adding a region dilutes
// rather than multiplies — the total fraction of floor cells that take a decal
// stays what the type asked for.
//
// DECALS MUST BE OPAQUE FULL TILES. An env decal REPLACES the floor frame in the
// one tilemap layer (see envDecalFrame in MapState), so a tile with a
// transparent background paints a hole, not scatter on the ground. Most of what
// reads like scatter on these sheets is exactly that — `snow-specks`,
// `green-sprigs`, `snowy-branches`, `desert-props-sand` are all overlay art with
// nothing behind them. The usable ones already have the ground baked in
// (`snow-fill` is snow with pebbles, `rubble-tiles-sand` is rubble on sand).
// Overlay scatter needs a second tilemap layer drawn above the floor; that
// doesn't exist yet, so check alpha before adding a region here.
function decorFor(type) {
    const d = type.decor
    if (!d || !d.sheet || !Array.isArray(d.regions) || !d.regions.length) return null
    const frames = d.regions.flatMap(name => {
        const region = findRegion(d.sheet, name)
        return region ? regionFrameList(d.sheet, region) : []
    })
    if (!frames.length) return null
    const density = (d.density > 0 ? d.density : 0.08) / frames.length
    return { sheet: d.sheet, envTiles: frames.map(frame => ({ frame, density })) }
}

// A type's SCENERY — named regions the furnisher scatters through rooms as
// blocking decor. Passed straight through; the furnisher resolves each region
// when it builds the prop, so an unknown name degrades to a 1x1 fallback rather
// than failing here.
//
// PROPS MUST HAVE TRANSPARENT BACKGROUNDS — the exact inverse of the env-decal
// rule. A decal REPLACES the floor tile so it has to be opaque; a prop is drawn
// OVER the floor as an entity, so anything with its own baked-in ground paints a
// square of the wrong terrain around itself. castletown's `flowerbed-mixed` is
// flowers on opaque grass and was rejected for exactly that.
//
// And a region must be ONE WHOLE object. It can fail in both directions:
//   TOO MANY — `barrels-wooden` is six barrels, `mushrooms-orange` four
//     clusters, `market-goods` six market crates. Placed as one prop they read
//     as a jumble.
//   TOO FEW — a lamppost is split across THREE regions stacked in one column
//     (`lamppost-head-unlit`, `lamppost-head-lit`, `lamppost-post`), so using
//     `lamppost-post` alone put headless poles all over the map. An object
//     assembled from several regions is a real case the archive will need to
//     express; a single region name cannot.
// Look at the block, and check nothing directly above or below it belongs to
// the same object.
//
// SCENERY MUST SUIT THE REALM. All four castletown types first shared one list,
// which put a village well and a garden hedge inside the formal castle interior.
// Exterior realms take wells, hedges and crates; interior ones take columns,
// chests and furniture; crates and barrels read fine in either.
function sceneryFor(type) {
    const s = type.scenery
    if (!s || !s.sheet || !Array.isArray(s.regions) || !s.regions.length) return null
    return { sheet: s.sheet, regions: s.regions }
}

function groundFor(type) {
    if (type.groundFill) {
        const frames = framesForLabels(type.sheet, type.groundFill)
        return frames.length ? { frames, autotile: null } : null
    }
    const frame = terrainFillFrame(type.sheet, type.ground)
    return frame == null ? null : { frames: [frame], autotile: type.ground }
}

export function themeForDungeonType(key) {
    const type = getDungeonType(key)
    if (!type) return null
    const ground = groundFor(type)
    const wallFrame = terrainFillFrame(type.sheet, type.wall)
    if (!ground || wallFrame == null) return null
    const meta = metaFor(type.sheet) || {}
    const decor = decorFor(type)
    const scenery = sceneryFor(type)
    // Same shape as scenery; the only difference is that it doesn't block.
    const debris = type.debris && type.debris.sheet && Array.isArray(type.debris.regions) && type.debris.regions.length
        ? { sheet: type.debris.sheet, regions: type.debris.regions }
        : null
    return {
        type: type.key,
        sheet: type.sheet,
        tileSize: meta.tileSize ?? meta.frameWidth ?? 16,
        spacing: meta.spacing ?? 0,
        margin: meta.margin ?? 0,
        floorTiles: ground.frames.map(frame => ({ frame, weight: 1 })),
        wallTiles: [{ frame: wallFrame, weight: 1 }],
        autotile: ground.autotile,
        wallAutotile: type.wall,
        // Decals are optional and may live on their own pack; absent = no scatter
        // and a single-sheet theme, exactly as before.
        envSheet: decor ? decor.sheet : null,
        envTiles: decor ? decor.envTiles : [],
        // Scenery props scattered through rooms by the furnisher.
        propSheet: scenery ? scenery.sheet : null,
        props: scenery ? scenery.regions : [],
        // Walk-over dressing scattered across open floor.
        debrisSheet: debris ? debris.sheet : null,
        debris: debris ? debris.regions : [],
        // How the floor is lit (FogOfWar LIGHTING). Interiors default to the
        // historical torchlight; anything under open sky says so explicitly.
        lighting: type.lighting || "torchlit",
        // Per-role art for the mechanic props (levels/themeRoles.js). Every realm
        // gets its own generated stairs; the rest are the tileset regions that
        // were VISUALLY VERIFIED to be single, usable objects — see the audit doc.
        // A role left unset keeps that entity's historical Kenney tile, which is
        // why this can ship with stairs complete and portals empty.
        roles: { ...realmStairs(type.key), ...(type.roles || {}) },
    }
}

// The types that actually resolve against the current label store — the
// picker-facing list. A type naming a terrain or fill that has since been
// renamed or un-labeled drops out here rather than being offered and failing.
export function readyDungeonTypes() {
    return DUNGEON_TYPES.filter(t =>
        groundFor(t) != null && terrainFillFrame(t.sheet, t.wall) != null
    )
}
