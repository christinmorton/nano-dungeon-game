import { normalizeRoles } from "./themeRoles.js"

// Level Recipes — the concrete "dungeon archetype" artifact (design doc §14.2).
//
// A recipe binds one point on Geometry x Theme as DATA: the generator is built
// once, realms are recipes. MapState builds each floor of a run from a recipe,
// so a new themed dungeon is a data entry here, not new generator code.
//
// This first slice carries two of the eventual recipe fields:
//   geometry — the corridor/room shape params passed to the level generator.
//   theme    — the tileset (see DEFAULT_THEME for the shape). Names the sheet to
//              paint from, how to slice it (source tile size + spacing), and the
//              floor/wall frames. (Future recipe fields: terrain, prop-palette/
//              scene mix, roster, boss — see §14.2/§14.7.)
//
// Kept import-free on purpose: MapState already imports BSPLevel and constructs
// the { type, config } level entries, so recipes stay pure data (no cycle risk).

// A theme fully describes how to paint a floor:
//   sheet     — the loaded Phaser texture key to slice tiles from.
//   tileSize  — the SOURCE tile size in that sheet (16 for Kenney/fantasyrpg,
//               32 for 32rogues, ...). The world grid stays at MapState.tileSize
//               regardless; the tilemap slices at this source size and lets each
//               tile render into the world cell, so sheets of ANY native size mix
//               freely with no impact on tile<->world coordinate math.
//   spacing   — inter-tile spacing in the sheet (Kenney = 1, most packs = 0).
//   margin    — outer margin in the sheet.
//   floorTile / wallTile — frame indices INTO `sheet` for floor and wall.
// Carrying the slice params here keeps recipes self-contained (no _meta lookup)
// and matches the explicit-over-implicit convention.
export const DEFAULT_THEME = {
    sheet: "tiles",     // the World-preloaded Kenney 1-bit sheet
    tileSize: 16,
    spacing: 1,         // Kenney packs its tiles with 1px spacing
    margin: 0,
    floorTile: 17,
    wallTile: 555,
}

export const RECIPES = {
    // Today's dungeon, unchanged. The default realm and the behavior-preserving
    // baseline that proves the seam.
    classic: {
        key: "classic",
        name: "Classic Dungeon",
        geometry: { corridorStyle: "simple", corridorWidth: 1 },
        theme: DEFAULT_THEME,
        // Prop palette KEY (§14.5) — resolves to role->Prop classes in furnish.js.
        // A key, not the classes, so recipes.js stays import-free (like theme.sheet).
        propPalette: "wilderness",
    },

    // First themed realm — a cave/dungeon painted from the 16px Time-Fantasy
    // "fantasyrpg-dungeon" sheet (public/tilesets/fantasyrpg/dungeon.png, 51x29).
    // Frames verified on test.html (labels r{row}_c{col}; frame = row*51 + col):
    //   floor r13_c19 = 682 (brown dungeon floor), wall r6_c19 = 325 (cave rock).
    fantasy: {
        key: "fantasy",
        name: "Fantasy Dungeon",
        geometry: { corridorStyle: "simple", corridorWidth: 1 },
        theme: { sheet: "fantasyrpg-dungeon", tileSize: 16, spacing: 0, margin: 0, floorTile: 682, wallTile: 325 },
        propPalette: "wilderness",
    },
}

// Non-default tilesets any recipe paints from — World preloads these so a themed
// floor's sheet is available at bind time. 'tiles' (Kenney) is loaded by World
// separately, so it's excluded. Derived from RECIPES so adding a realm needs no
// edit here.
export const RECIPE_SHEETS = [
    ...new Set(
        Object.values(RECIPES)
            .flatMap(r => [r.theme.sheet, r.theme.wallSheet, r.theme.envSheet, r.theme.propSheet, r.theme.debrisSheet])
            .filter(s => s && s !== "tiles")
    )
]

// TEMPORARY: pointed at 'fantasy' to verify the themed-sheet pipeline in-game
// (sheet load -> recipe -> tilemap paint). The floor/wall frames are still
// placeholders, so expect the wrong tiles until they're picked on test.html.
// Switch back to "classic" (or add a real selector) once the look is dialed in.
export const DEFAULT_RECIPE = "fantasy"

// Resolve a recipe by key, falling back to the default. Central so callers
// (MapState now; a Settings selector later) don't each re-implement the guard.
export function getRecipe(key) {
    return RECIPES[key] || RECIPES[DEFAULT_RECIPE]
}

// Fan one role's tile spec out to the canonical weighted-LIST form the paint
// sampler consumes (design §15.10). Accepts, in priority order, a widened LIST
// (`floorTiles: [...]`) or a historical SCALAR (`floorTile: 682`), and inside a
// list either bare frame numbers or `{frame, weight}` objects. env entries also
// carry `name` + `density` (fraction of floor cells the decal may claim). A bare
// frame is sugar for weight 1, so scalars stay valid forever.
function normList(scalar, list) {
    const src = Array.isArray(list) && list.length ? list
              : (scalar != null ? [scalar] : [])
    return src.map(e => {
        if (typeof e === "number") return { frame: e, weight: 1 }
        if (!e || e.frame == null) return null
        const out = { frame: e.frame, weight: e.weight != null ? e.weight : 1 }
        if (e.name != null) out.name = e.name
        if (e.density != null) out.density = e.density
        return out
    }).filter(Boolean)
}

function ensure(listResult, fallbackFrame) {
    return listResult.length ? listResult : [{ frame: fallbackFrame, weight: 1 }]
}

// Normalize a theme (scalar OR list form) into `{sheet, tileSize, spacing,
// margin, floorTiles[], wallTiles[], doorTiles[], envTiles[]}` so MapState.bind
// samples one way regardless of how the theme was authored (design §15.10).
// floor/wall are guaranteed non-empty (fall back to DEFAULT_THEME's frame) so a
// malformed authored theme never paints a hole. doorTiles is the ART the Door
// entity picks from at spawn — never painted into the tilemap.
// Theme fields the designer STORES but never reinterprets: which pack each role
// paints from, and the region names for decals / scenery / debris. They are set
// wholesale when a dungeon type is applied and read only by the engine.
//
// This list exists because the theme shape is written in three places — the
// producer (dungeonTypes.themeForDungeonType), the engine normalizer below, and
// the designer's round-trip (DesignerScene._themeFromData) — and every one of
// them builds an EXPLICIT object. Adding a field and forgetting one of the three
// drops it silently: that is exactly how wall autotiling, then env decals, then
// scenery each came to work until the designer was reloaded and the autosave
// wrote the stripped theme back over the good one. The designer now copies this
// list verbatim, so a new field means editing here and nowhere else.
export const THEME_CONTENT_FIELDS = [
    "wallSheet", "envSheet", "envTiles", "propSheet", "props", "debrisSheet", "debris",
    "lighting", "timeOfDay", "roles",
]

export function normalizeTheme(theme) {
    const t = theme || DEFAULT_THEME
    return {
        sheet: t.sheet,
        // Per-ROLE sheet overrides. `sheet` is the primary (ground) pack; walls
        // and env decals may come off a different one, because the packs split
        // the wrong way for us — the autotile sheets carry ground terrains and
        // nothing else, while the props/decals that stop a floor reading empty
        // live on their paired OBJECT sheet. MapState.bind registers each
        // distinct sheet as its own tileset on the one layer and offsets that
        // role's frames by its firstgid. Absent = same sheet as the ground, so
        // every single-sheet theme keeps behaving exactly as it did.
        wallSheet: (typeof t.wallSheet === "string" && t.wallSheet) ? t.wallSheet : null,
        envSheet: (typeof t.envSheet === "string" && t.envSheet) ? t.envSheet : null,
        // SCENERY: named tile regions the furnisher scatters through ordinary
        // rooms as blocking decor (a well, a cactus, a crate). Unlike floor/wall/
        // env these are ENTITIES, not tilemap frames, so they don't need a
        // tileset — but their sheet still has to be preloaded for the sprite.
        //
        // This is what makes a realm's rooms feel like the realm. Decoration used
        // to hang off room.kind, which meant it only ever reached the one room per
        // floor that rolled "treasure" or "rest" — and never at all in an authored
        // dungeon, where rooms carry no kind.
        propSheet: (typeof t.propSheet === "string" && t.propSheet) ? t.propSheet : null,
        props: Array.isArray(t.props) ? t.props.filter(p => typeof p === "string" && p) : [],
        // DEBRIS: the walk-over half of scenery — flowers, pebbles, sprigs,
        // scattered litter. Same region mechanism as `props`, but placed as
        // non-blocking dressing strewn across open floor rather than furniture
        // set against the walls.
        //
        // Its art has the OPPOSITE requirement to an env decal: a decal replaces
        // the floor frame so it must be opaque, while debris is drawn over the
        // floor so it must be TRANSPARENT. Which means the overlay art that was
        // useless as decals — snow-specks, green-sprigs, desert-props — is
        // exactly what belongs here.
        debrisSheet: (typeof t.debrisSheet === "string" && t.debrisSheet) ? t.debrisSheet : null,
        debris: Array.isArray(t.debris) ? t.debris.filter(p => typeof p === "string" && p) : [],
        // How the floor is lit — FogOfWar resolves this to a sight radius and a
        // memory dim (see LIGHTING there). Absent = "torchlit", the historical
        // behaviour, so every recipe and every dungeon authored before this keeps
        // the underground feel unchanged.
        lighting: (typeof t.lighting === "string" && t.lighting) ? t.lighting : "torchlit",
        // Pins the hour on a floor with a sky ("always night"); "cycle" (the
        // default) follows the clock. Ignored entirely by a torchlit floor,
        // which has no sky to have an hour.
        timeOfDay: (typeof t.timeOfDay === "string" && t.timeOfDay) ? t.timeOfDay : "cycle",
        // Per-role art for the mechanic props (stairs, chest, shrine, font…).
        // null = every consumer keeps its historical Kenney tile, which is what
        // every recipe and every dungeon authored before this does.
        roles: normalizeRoles(t.roles),
        tileSize: t.tileSize ?? 16,
        spacing: t.spacing ?? 0,
        margin: t.margin ?? 0,
        floorTiles: ensure(normList(t.floorTile, t.floorTiles), DEFAULT_THEME.floorTile),
        wallTiles: ensure(normList(t.wallTile, t.wallTiles), DEFAULT_THEME.wallTile),
        doorTiles: normList(t.doorTile, t.doorTiles),
        envTiles: normList(null, t.envTiles),
        // Autotile ground terrain (§autotile): a terrain name labeled on `sheet`
        // (data/tileLabels.json). When set, floor cells are painted by the
        // neighbor-aware autotiler instead of sampling floorTiles. null = off.
        autotile: (typeof t.autotile === "string" && t.autotile) ? t.autotile : null,
        // Autotile WALL terrain — the same mechanism applied to wall cells, so a
        // wall mass gets real edges and corners instead of one frame repeated.
        // Must be labeled on the SAME sheet (one tileset per floor). null = off,
        // and wall cells fall back to sampling wallTiles as they always did.
        wallAutotile: (typeof t.wallAutotile === "string" && t.wallAutotile) ? t.wallAutotile : null,
    }
}
