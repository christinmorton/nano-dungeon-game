import LevelManager from './levels/LevelManager.js'
import BSPLevel from './levels/BSPLevel.js'
import AuthoredLevel from './levels/AuthoredLevel.js'
import MazeLevel from './levels/MazeLevel.js'
import ArenaLevel from './levels/ArenaLevel.js'
import FortressTestLevel from './levels/FortressTestLevel.js'
import PartyTestLevel from './levels/PartyTestLevel.js'
import TrainingLevel from './levels/TrainingLevel.js'
import worldQueries from './WorldQueries.js'
import account from './Account.js'
import { getRecipe, DEFAULT_RECIPE, DEFAULT_THEME, normalizeTheme } from './levels/recipes.js'
import { autotileTerrains, pickAutotileFrame } from './levels/autotile.js'
import SHEETS from '../data/assetSheets.js'

// Run-length presets (run-time budgeting). Always 5 floors; the preset sizes
// EACH floor toward a target TOTAL playtime so a run matches the player's
// intent — a 1-min phone break vs a 7-min desktop session vs the full "free"
// dungeon. Sizes are a FIRST CUT, validated only for clean generation
// (0 disconnects across 100 seeds each); the in-game play-time tracker is the
// instrument for calibrating these to the actual minute targets. See
// documents/v3_dungeon_archetype_system.md.
// localStorage slot the Dungeon Designer autosaves its skeleton to. The
// ?authored=1 handoff reads it to play an authored floor (design §15.6 step 6).
// Kept in sync with DesignerScene's LS_KEY. Temporary — a start-screen file
// importer replaces the URL-param + localStorage handoff later.
const AUTHORED_LS_KEY = "dungeonDesigner.autosave.v1"

const RUN_PROFILES = {
    "1min": { width: 22, height: 15, iterations: 2 },
    "3min": { width: 34, height: 22, iterations: 3 },
    "5min": { width: 44, height: 30, iterations: 3 },
    "7min": { width: 56, height: 38, iterations: 4 },
    "free": { width: 80, height: 50, iterations: 4 },
}

// Per-floor map state. Owns:
//   - levelManager: the floor-sequence generator
//   - level / levelWithTiles / rooms / tree / stairs: snapshot of the
//     current floor pulled from levelManager on each bind()
//   - map: the Phaser tilemap layer (used for world<->tile coordinate
//     conversion by Animations / BaseHero / items)
//   - sprites + tileSize: render config
//
// Lifecycle:
//   - start() once per fresh game: builds the floor sequence and creates
//     the LevelManager. Each entry in the array is {type, config} so
//     mixing in maze/cave/static floors later is a config edit.
//   - bind(scene) on every floor entry: snapshots the new floor and
//     creates a fresh Phaser tilemap layer (the previous one is destroyed
//     by scene.restart on floor transitions)
//
// Spatial queries (isWalkableTile, entityAtTile, hasLineOfSight,
// gridForEntity, distanceBetweenEntities, etc.) live in WorldQueries.
// The methods below are thin delegates so callers that still
// `import mapState` keep working; new code should import worldQueries.

// naturalTerrain ground: dirt is the base (1-4), grass (5-7) appears only in
// occasional clustered patches — a war-camp is trampled dirt, not a meadow.
// Confirm these read right in test.html before relying on them (per the
// verify-tiles-visually convention).
const OUTDOOR_DIRT_TILES = [1, 2, 3, 4]
const OUTDOOR_GRASS_TILES = [5, 6, 7]

// Solid ground colour drawn UNDER outdoor rooms. The tiles come from the
// colored-TRANSPARENT sheet, so sparse dirt/grass tiles let the black canvas
// show through; this earth underlay sits below the tilemap and fills those
// gaps so the camp floor reads as packed soil. Tweak freely — it's cosmetic.
const OUTDOOR_GROUND_COLOR = 0x33281b

// Deterministic per-tile pick so the outdoor floor is identical on every
// revisit (Math.random would shimmer the ground each floor entry). Two hashes:
// a coarse 2x2-quantized one decides whether a patch is grass (so grass
// clusters instead of speckling), a fine one varies the tile within. No
// Date/random, which keeps it resume-safe too.
function outdoorFloorTile(x, y) {
    const coarse = (((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) >>> 0
    const fine = ((x * 2654435761) ^ (y * 40503)) >>> 0
    if (coarse % 5 === 0) return OUTDOOR_GRASS_TILES[fine % OUTDOOR_GRASS_TILES.length]
    return OUTDOOR_DIRT_TILES[fine % OUTDOOR_DIRT_TILES.length]
}

// Deterministic per-cell hash for the tile-palette sampler (design §15.10).
// Keyed by (x, y, floor-seed, salt) — NOT Math.random — so a floor paints
// identically on every revisit and matches the designer preview (preview==game,
// §15.3). Mirrors outdoorFloorTile's hashing style, avalanched so nearby cells
// don't correlate. `salt` separates the independent draws made for ONE cell
// (base floor/wall frame vs the env-decal roll) so they stay decorrelated.
function paletteHash(x, y, seed, salt) {
    let h = (Math.imul(x, 2654435761) ^ Math.imul(y, 40503) ^ Math.imul(seed | 0, 2246822519) ^ Math.imul(salt, 3266489917)) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822519)
    h = Math.imul(h ^ (h >>> 13), 3266489917)
    return (h ^ (h >>> 16)) >>> 0
}

// Weighted pick of a frame from a normalized tile list, deterministic per cell.
// A one-entry list (the scalar-theme case) returns its frame with no hashing, so
// the classic flat look is byte-identical to before this change.
function pickFrame(list, x, y, seed, salt) {
    if (!list || !list.length) return null
    if (list.length === 1) return list[0].frame
    let total = 0
    for (const e of list) total += e.weight > 0 ? e.weight : 0
    if (total <= 0) return list[0].frame
    let r = paletteHash(x, y, seed, salt) % total
    for (const e of list) {
        const w = e.weight > 0 ? e.weight : 0
        if (r < w) return e.frame
        r -= w
    }
    return list[list.length - 1].frame
}

// Cosmetic ground-substitution decal for a floor cell, or null for plain floor
// (design §15.10). Each env entry claims a `density` fraction of floor cells;
// densities accumulate, so the remaining probability paints plain floor. Env
// decals live in the one tilemap layer (they replace the floor frame) and never
// affect passability — anything that blocks/interacts is a Prop, not an env tile.
function envDecalFrame(envTiles, x, y, seed) {
    if (!envTiles || !envTiles.length) return null
    const roll = paletteHash(x, y, seed, 101) / 0x100000000   // [0, 1)
    let acc = 0
    for (const e of envTiles) {
        acc += e.density > 0 ? e.density : 0
        if (roll < acc) return e.frame
    }
    return null
}

// Read the Dungeon Designer's autosaved skeleton from localStorage for the
// ?authored handoff. Returns the parsed object or null (empty slot / bad JSON /
// no localStorage). Safe to call in any environment.
function loadAuthoredSkeleton() {
    try {
        if (typeof localStorage === "undefined") return null
        const raw = localStorage.getItem(AUTHORED_LS_KEY)
        return raw ? JSON.parse(raw) : null
    } catch (e) {
        return null
    }
}

// A blank authored floor (no rooms) still needs a start + end so it's walkable
// and its stairs have an anchor. Mirrors DesignerScene._makeDefaultFloor's
// placement; real content is authored on the floor later (procedural-fill floors
// are a separate slice).
function minimalFloorAreas(grid) {
    const w = (grid && grid.w) || 48, h = (grid && grid.h) || 32
    return [
        { id: 1, name: "Start", kind: "starting", walled: true, shape: "rect", x: 3, y: 3, w: 8, h: 6 },
        { id: 2, name: "End",   kind: "ending",   walled: true, shape: "rect", x: w - 11, y: h - 9, w: 8, h: 6 },
    ]
}

// A designer theme is usable only if both floor and wall frames are set on one
// sheet (the engine paints one tileset per floor). Incomplete/absent → the floor
// falls back to the default recipe tileset.
function validAuthoredTheme(t) {
    if (!t || !t.sheet) return false
    const hasFloor = t.floorTile != null || (Array.isArray(t.floorTiles) && t.floorTiles.length > 0)
    const hasWall = t.wallTile != null || (Array.isArray(t.wallTiles) && t.wallTiles.length > 0)
    return !!(hasFloor && hasWall)
}

class MapState {
    constructor() {
        this.sprites = {
            floor: 17,
            wall: 555,
        }
        this.tileSize = 16
        this.levelManager = null
        this.level = null
        this.levelWithTiles = null
        this.rooms = null
        this.tree = null
        this.stairs = null
        // Authored dungeon win condition (§15.8), read from the designer skeleton
        // in start(); null = the default Amulet win (see Quest.js).
        this.authoredGoal = null
        this.map = null
        // Sturdy / story walls a phasing ability (Breach, Dig) cannot pass through —
        // a Set of "x,y" keys, reset per floor in bind(), populated by a level or
        // the generator via markSturdyWall(). Empty by default.
        this.sturdyWalls = new Set()
    }

    // Build the floor sequence — once per fresh game. Dungeon.initialize
    // calls this on first init, gated on its initialized flag.
    //
    // Alternating startEndMode across the run for visible layout variety:
    // "tree" preserves the emergent BSP placement, "banded" pins start/end
    // to specific spatial bands. Per-floor scheduling lives here so the
    // mode mix is data, not buried in BSPLevel. A future game-mode UI can
    // swap this for a preset (all-tree / all-banded / random per floor).
    start() {
        // Arena test mode (window.ARENA_MODE set by arenaMain.js) replaces
        // the BSP floor sequence with a single fixed-layout room used to
        // verify AI behavior — alert propagation, archetypes, future
        // captain coordination — in isolation from procedural variance.
        if (typeof window !== "undefined" && window.ARENA_MODE) {
            // ?settlement=fortress|outpost swaps the AI arena for a single
            // large outdoor war-camp so the settlement perimeter feature can be
            // tested in isolation (the BSP large-room requirement makes forts
            // rare in a real run). Absent the param, the AI ArenaLevel loads.
            const params = new URLSearchParams(window.location.search)
            const settlement = params.get("settlement")
            const species = params.get("species") || "orc"
            // ?party[=N] swaps the AI arena for a party-vs-band test bench: the
            // hero spawns with a party of followers facing an enemy band, so the
            // player PARTY can be exercised in isolation.
            const partyTest = params.get("party") != null
            // ?training[=<spec>] swaps the AI arena for the A->Z ability bench:
            // a hero facing an inert Training Dummy, abilities loaded onto the
            // bar (see levels/TrainingLevel.js + window.training helpers).
            const trainingTest = params.get("training") != null
            this.levelManager = new LevelManager({
                levels: trainingTest
                    ? [{ type: TrainingLevel, config: {} }]
                    : partyTest
                        ? [{ type: PartyTestLevel, config: {} }]
                        : settlement
                            ? [{ type: FortressTestLevel, config: { form: settlement, species } }]
                            : [{ type: ArenaLevel, config: {} }]
            })
            return
        }

        // Authored-floor mode (?authored=1): play the floor the Dungeon Designer
        // stashed in localStorage as a single AuthoredLevel — "author a floor ->
        // walk into it" (design §15.6 step 6). Themed with the safe 'classic'
        // Kenney tileset. Falls through to a normal run if the slot is empty or
        // malformed. Temporary handoff; see AUTHORED_LS_KEY.
        // Dungeon-wide enemy perception scale (designer Dungeon tab). Default 1x
        // for every run; an authored run may override below. Read live by
        // BaseEnemy.effectiveDetectionRadius / effectiveVisionCone.
        this.perceptionRangeScale = 1
        this.perceptionConeScale = 1
        // Ambient enemy-sight multiplier from the day/night cycle, republished by
        // FogOfWar on each hero move (see levels/lighting.js). 1 = no effect,
        // which is every floor with no sky and every floor at midday. Kept
        // separate from the designer's scale above so the two compose instead of
        // one clobbering the other.
        this.ambientPerceptionScale = 1
        // Dungeon-wide enemy-generation suppression toggles (designer Dungeon tab
        // → Enemy behavior). Read live by the relevant spawn code: noHunters by
        // BaseEnemy.rollArchetype, noElites/noCaptains by spawnFromTable, noCursed
        // by enemies/personalities.js. noRoyals is reserved (royals aren't
        // generated yet). All default off (normal generation).
        this.noHunters = false
        this.noElites = false
        this.noCaptains = false
        this.noCursed = false
        this.noRoyals = false
        if (typeof window !== "undefined" && window.location) {
            const params = new URLSearchParams(window.location.search)
            if (params.get("authored") != null) {
                const skeleton = loadAuthoredSkeleton()
                // Dungeon-wide perception scale from the designer (Dungeon tab).
                const perc = (skeleton && skeleton.perception) || {}
                if (Number.isFinite(perc.rangeScale)) this.perceptionRangeScale = perc.rangeScale
                if (Number.isFinite(perc.coneScale)) this.perceptionConeScale = perc.coneScale
                this.noHunters = !!(skeleton && skeleton.noHunters)
                this.noElites = !!(skeleton && skeleton.noElites)
                this.noCaptains = !!(skeleton && skeleton.noCaptains)
                this.noCursed = !!(skeleton && skeleton.noCursed)
                this.noRoyals = !!(skeleton && skeleton.noRoyals)
                // Multi-floor run (§15.7/15.8): one AuthoredLevel per floor in the
                // roster, so Start/End rooms become up/down stairs the existing
                // LevelManager sequences. Falls back to the legacy flat single-floor
                // export. Blank floors (no rooms) aren't playable yet (procedural-
                // fill floors are a later slice) — filtered with a warning.
                const roster = (skeleton && Array.isArray(skeleton.floors) && skeleton.floors.length)
                    ? skeleton.floors
                    : (skeleton && Array.isArray(skeleton.areas) && skeleton.areas.length)
                        ? [{ grid: skeleton.grid, areas: skeleton.areas, routePoints: skeleton.routePoints, connections: skeleton.connections }]
                        : []
                if (roster.length) {
                    const recipe = getRecipe("classic")
                    // Authored floor's picked tileset when complete (both frames on
                    // one sheet); otherwise the classic default. World.preload loads
                    // the sheets via getAuthoredThemeSheets(). Theme is dungeon-global.
                    const theme = validAuthoredTheme(skeleton.theme) ? skeleton.theme : recipe.theme
                    // One AuthoredLevel per floor. Dungeon-level fill style is shared;
                    // each floor supplies its own grid / areas / routePoints. A blank
                    // floor gets a minimal start+end so it stays traversable.
                    //
                    // Seed policy (§15.8): a LOCKED seed pins the layout — every run
                    // reproduces the same floors (the raw pinned seed, so the in-game
                    // floor matches the designer's locked preview — "preview == game",
                    // §15.3; floors still differ because their skeletons differ).
                    // UNLOCKED rerolls a fresh seed per floor at run start (roguelike
                    // variety). Injected HERE (runtime) so the shared engine-free
                    // generator stays deterministic — each floor's skeleton carries a
                    // concrete seed marked locked, so hydrateSkeleton uses it verbatim.
                    const pinned = !!skeleton.fillSeedLocked
                    const levels = roster.map(f => {
                        const grid = f.grid || skeleton.grid
                        const seed = pinned
                            ? ((skeleton.fillSeed | 0) >>> 0)                       // pinned: matches the preview
                            : ((Math.floor(Math.random() * 0x100000000)) >>> 0)    // fresh each run
                        // §17: a 'maze' floor is a PURE procedural labyrinth built
                        // by MazeLevel (a maze carved across the whole floor, no BSP
                        // rooms — labyrinth first), NOT the authored skeleton, so its
                        // drawn areas are ignored. This is the room-density=0 pole of
                        // §17.4; the rooms-in-a-maze end (BSPLevel corridorStyle:'maze')
                        // returns behind a future density knob. Slice 1 uses default
                        // maze knobs (algorithm + low braid) until the params panel.
                        if (f.mode === "maze") {
                            const w = (grid && grid.w) || 41, h = (grid && grid.h) || 31
                            const mz = (f.maze && typeof f.maze === "object") ? f.maze : {}
                            return {
                                type: MazeLevel,
                                config: {
                                    width: w,
                                    height: h,
                                    mazeAlgorithm: mz.algorithm,   // §17 slice 2 params (MazeLevel defaults fill gaps)
                                    braid: mz.braid,               // 0..1 (dead-ends ↔ loops)
                                    roomDensity: mz.roomDensity,   // 0..100 (rooms carved into the maze)
                                    dungeonPool: skeleton.dungeonPool,   // §17 follow-up: designer enemy pool → maze rooms
                                    poolMode: skeleton.poolMode,
                                    roomKinds: skeleton.roomKinds,       // authored special-room mix (levels/roomKinds.js)
                                    defaultStance: f.defaultStance,      // this floor's default enemy stance
                                    theme,                       // dungeon-wide palette (§15.10)
                                    propPalette: recipe.propPalette,
                                    seed,
                                },
                            }
                        }
                        const areas = (f && Array.isArray(f.areas) && f.areas.length) ? f.areas : minimalFloorAreas(grid)
                        return {
                            type: AuthoredLevel,
                            config: {
                                skeleton: {
                                    grid,
                                    areas,
                                    routePoints: f.routePoints,
                                    connections: f.connections,   // authored portals (§15.9)
                                    dungeonPool: skeleton.dungeonPool,   // dungeon-wide enemy pool for procedural rooms (§16)
                                    poolMode: skeleton.poolMode,   // "authored" (pool-only, no random fill) | "random" (legacy) (§16)
                                    roomKinds: skeleton.roomKinds,   // authored special-room mix rolled over un-authored rooms (levels/roomKinds.js)
                                    defaultStance: f.defaultStance,   // per-floor default enemy stance; rooms inherit unless they set their own (§16 Stage 2)
                                    corridorStyle: skeleton.corridorStyle,
                                    fillSeed: seed,
                                    fillSeedLocked: true,   // use the seed we computed
                                },
                                theme,
                                propPalette: recipe.propPalette,
                            },
                        }
                    })
                    this.levelManager = new LevelManager({ levels })
                    this.authoredGoal = skeleton.goal || null   // dungeon win condition (§15.8)
                    if (typeof console !== "undefined") {
                        console.log(`[MapState] authored run loaded (${levels.length} floor(s))`)
                    }
                    return
                }
                if (typeof console !== "undefined") {
                    console.warn("[MapState] ?authored set but no valid designer skeleton in localStorage; normal run")
                }
            }
        }

        // Run seed for reproducible layout. A `?seed=<value>` URL param pins it
        // (regenerate the exact same run for debugging/replay); otherwise it's
        // time-derived. Each floor gets a distinct per-floor seed `${runSeed}:${i}`
        // so floors differ but the whole run reproduces from one value. Logged so
        // a seed can be copied off a session. (Only layout is seeded so far —
        // populate-time spawns/doors/traps are a follow-on; see
        // documents/v3_dungeon_archetype_system.md §11.)
        let seedParam = null
        if (typeof window !== "undefined" && window.location) {
            seedParam = new URLSearchParams(window.location.search).get("seed")
        }
        this.runSeed = seedParam || String(Date.now())
        if (typeof console !== "undefined") {
            console.log(`[MapState] run seed = ${this.runSeed}`)
        }

        // Size all 5 floors from the selected run-length preset (defaults to the
        // full "free" dungeon if the pref is missing/unknown).
        this.runLength = account.getPreferences().runLength || "free"
        const profile = RUN_PROFILES[this.runLength] || RUN_PROFILES["free"]
        // The run's dungeon Recipe (design doc §14.2) — the data object binding
        // geometry + tileset theme (+ future terrain/roster). 'classic' is the
        // default (discrete-room 'simple' geometry, current tileset) until themed
        // realms are authored and a selector is added. The recipe supplies
        // geometry + theme; the run-length profile sizes each floor; doors:false
        // stays while door placement is reworked (corridors guarantee connectivity).
        const recipe = getRecipe(DEFAULT_RECIPE)
        const modes = ["banded", "tree", "banded", "tree", "banded"]
        const levels = modes.map((mode, i) => ({
            type: BSPLevel,
            config: {
                ...profile,
                ...recipe.geometry,
                theme: recipe.theme,
                propPalette: recipe.propPalette,
                doors: false,
                startEndMode: mode,
                seed: `${this.runSeed}:${i}`,
            }
        }))
        this.levelManager = new LevelManager({ levels })
    }

    // Every sheet key an authored floor's theme needs, so World.preload can load
    // them before bind() paints the tilemap (the theme is chosen in the designer,
    // so it isn't in the game's fixed preload sets). A theme may name a different
    // pack per role, and a sheet that isn't loaded when bind() asks for its frame
    // count silently shifts every later pack's tiles — so this must return ALL of
    // them, not just the ground. Empty outside authored mode or when the theme is
    // absent/incomplete/the default. Reads localStorage directly because start()
    // (which stores the level) runs after preload.
    getAuthoredThemeSheets() {
        if (typeof window === "undefined" || !window.location) return []
        const params = new URLSearchParams(window.location.search)
        if (params.get("authored") == null) return []
        const skeleton = loadAuthoredSkeleton()
        const t = skeleton && skeleton.theme
        if (!validAuthoredTheme(t)) return []
        return [...new Set([t.sheet, t.wallSheet, t.envSheet, t.propSheet, t.debrisSheet].filter(Boolean))]
    }

    // The sheet key the authored goal item's Atlas sprite needs, so World.preload
    // can load it before the goal is spawned (mirrors getAuthoredThemeSheets).
    // Null outside authored mode or when the goal isn't an Atlas-sourced item.
    getAuthoredGoalSheet() {
        if (typeof window === "undefined" || !window.location) return null
        const params = new URLSearchParams(window.location.search)
        if (params.get("authored") == null) return null
        const skeleton = loadAuthoredSkeleton()
        const item = skeleton && skeleton.goal && skeleton.goal.item
        return (item && item.source === "atlas" && item.sheet) ? item.sheet : null
    }

    // Snapshot the current floor's geometry from levelManager and build
    // the Phaser tilemap layer for it. Called on every floor entry from
    // Dungeon.initialize after run.transitioning is reset.
    bind(scene) {
        this.level = this.levelManager.getCurrentLevel()
        this.sturdyWalls = new Set()   // per-floor; clear any stale story-wall coords
        this.rooms = this.levelManager.getRooms()
        this.tree = this.levelManager.getTree()
        this.stairs = this.levelManager.getStairs()
        // Per-floor tileset from the active recipe's theme (§14.2). Non-BSP
        // levels (arena / training) carry no theme, so fall back to the default
        // (Kenney) dungeon theme. Resolved every bind so a themed floor and an
        // unthemed one in the same session don't bleed into each other.
        const theme = normalizeTheme(this.levelManager.getCurrent().theme || DEFAULT_THEME)
        this.theme = theme   // normalized; doorTiles consumed by Door spawns
        // Representative single frames for callers that still want one. NOTE:
        // walkability no longer keys off sprites.wall (WorldQueries reads the
        // passability grid), so a multi-frame wall list is safe here.
        this.sprites = { floor: theme.floorTiles[0].frame, wall: theme.wallTiles[0].frame }
        // Paint each cell by sampling the theme's weighted lists, deterministic
        // per (floor, cell) so revisits are identical (design §15.10). A floor
        // cell may instead take a cosmetic env decal. Walls (grid 1) and floors
        // (grid 0) both draw from their lists; a one-entry list == the old flat
        // look, byte-for-byte.
        const seed = this._floorPaintSeed()
        // Which pack each ROLE paints from. Walls and env decals may name their
        // own sheet; absent, they share the ground's (see normalizeTheme).
        const roleSheet = {
            floor: theme.sheet,
            wall: theme.wallSheet || theme.sheet,
            env: theme.envSheet || theme.sheet,
        }
        // Every frame index below is LOCAL to its role's sheet, but they all land
        // in one tilemap layer, so each sheet gets a firstgid and each role's
        // frames are shifted by it. Single-sheet themes get base 0 throughout and
        // are byte-for-byte unchanged.
        //
        // THE GROUND SHEET IS ALWAYS FIRST, so gidFloor is always 0. That is not
        // incidental — anything that writes a raw frame straight into
        // levelWithTiles after this pass (_applyOutdoorThemes, the settlement
        // repaints) is implicitly addressing the floor sheet, exactly as it did
        // when there was only one. Reorder this and those writes land in whatever
        // pack happens to sit at index 0.
        const sheetOrder = [...new Set([roleSheet.floor, roleSheet.wall, roleSheet.env])]
        const base = {}
        let nextGid = 0
        for (const key of sheetOrder) {
            base[key] = nextGid
            nextGid += this._sheetFrameCount(scene, key, theme)
        }
        const gidFloor = base[roleSheet.floor] || 0
        const gidWall = base[roleSheet.wall] || 0
        const gidEnv = base[roleSheet.env] || 0

        // Walls autotile the same way against a wall terrain, so a wall mass gets
        // its own edges and corners. Each terrain is looked up on ITS role's sheet.
        const autotileSet = theme.autotile ? autotileTerrains(roleSheet.floor)[theme.autotile] : null
        const wallSet = theme.wallAutotile ? autotileTerrains(roleSheet.wall)[theme.wallAutotile] : null
        const grid = this.level
        const isFloor = (x, y) => !!(grid[y] && grid[y][x] === 0)
        // For a wall cell, "same terrain" means "also wall". OUT OF BOUNDS COUNTS
        // AS WALL (the !== 0 test): the grid's border cells are real walls, and
        // treating the void beyond them as open would draw an edge all the way
        // around the map, framing it instead of reading as solid mass.
        const isWall = (x, y) => !(grid[y] && grid[y][x] === 0)
        this.levelWithTiles = grid.map((row, y) => row.map((t, x) => {
            if (t === 1) {
                if (wallSet) {
                    const f = pickAutotileFrame(wallSet, (dx, dy) => isWall(x + dx, y + dy))
                    if (f != null) return f + gidWall
                }
                return pickFrame(theme.wallTiles, x, y, seed, 2) + gidWall
            }
            if (autotileSet) {
                const f = pickAutotileFrame(autotileSet, (dx, dy) => isFloor(x + dx, y + dy))
                if (f != null) return f + gidFloor
            }
            const env = envDecalFrame(theme.envTiles, x, y, seed)
            return env != null ? env + gidEnv : pickFrame(theme.floorTiles, x, y, seed, 1) + gidFloor
        }))
        this._applyOutdoorThemes()

        const config = {
            data: this.levelWithTiles,
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
        }
        const phaserMap = scene.make.tilemap(config)
        // Slice each tileset at ITS OWN sheet's source tile size / spacing, while
        // the map grid stays at the world tileSize. A 16px sheet is 1:1; a larger
        // sheet's tiles render down into the world cell — no change to any
        // tile<->world coordinate math. The gid passed here MUST match the base
        // used when the frames were written above, or every tile from the second
        // pack onward is off by that sheet's frame count.
        const tilesets = sheetOrder.map(key => {
            const slice = this._sheetSlice(key, theme)
            return phaserMap.addTilesetImage(
                key, key, slice.tileSize, slice.tileSize, slice.margin, slice.spacing, base[key]
            )
        }).filter(Boolean)
        this.map = phaserMap.createLayer(0, tilesets, 0, 0)
        this._drawOutdoorUnderlays(scene)
    }

    // How a sheet is sliced. Per-sheet `_meta` is the truth (it's the same data
    // the Atlas and the validator slice by); the theme's own values are the
    // fallback, which is what keeps DEFAULT_THEME working — its "tiles" key is
    // the World-preloaded Kenney texture and has no assetSheets entry.
    _sheetSlice(key, theme) {
        const sheet = SHEETS.find(s => s.key === key)
        const meta = (sheet && sheet.ref && sheet.ref._meta) || null
        if (!meta) {
            return { tileSize: theme.tileSize ?? 16, spacing: theme.spacing ?? 0, margin: theme.margin ?? 0 }
        }
        return {
            tileSize: meta.tileSize ?? meta.frameWidth ?? theme.tileSize ?? 16,
            spacing: meta.spacing ?? 0,
            margin: meta.margin ?? 0,
        }
    }

    // How many frames a sheet contributes, which is what the NEXT sheet's firstgid
    // is offset by. Get this wrong and every tile of every later pack is silently
    // off by the difference.
    //
    // Computed from the source image with the SAME slice params passed to
    // addTilesetImage, because Phaser's Tileset re-slices the image itself rather
    // than reusing however load.spritesheet cut it — so the texture's own frame
    // count is the wrong authority the moment the two disagree (preloadSheets
    // passes spacing but not margin). This mirrors Tileset.updateTileData.
    // `_meta.total` is the fallback for a texture that isn't loaded.
    _sheetFrameCount(scene, key, theme) {
        const slice = this._sheetSlice(key, theme)
        const tex = scene.textures && scene.textures.exists(key) ? scene.textures.get(key) : null
        const src = tex && tex.source && tex.source[0]
        if (src && src.width && src.height) {
            const pitch = slice.tileSize + slice.spacing
            const cols = Math.floor((src.width - slice.margin * 2 + slice.spacing) / pitch)
            const rows = Math.floor((src.height - slice.margin * 2 + slice.spacing) / pitch)
            if (cols > 0 && rows > 0) return cols * rows
        }
        const sheet = SHEETS.find(s => s.key === key)
        const total = sheet && sheet.ref && sheet.ref._meta && sheet.ref._meta.total
        if (!total) console.warn(`[MapState] no frame count for sheet '${key}' — multi-pack tile offsets will be wrong`)
        return total || 0
    }

    // A stable numeric seed for the per-cell palette sampler, keyed by (run,
    // floor index). Constant across revisits of the same floor within a run, so
    // the sampled floor/wall variety + env decals repaint identically every
    // entry (design §15.10). runSeed is a string (a `?seed=` value or Date.now),
    // folded here to an int via FNV-1a with the floor index appended.
    _floorPaintSeed() {
        const idx = (this.levelManager && this.levelManager.currentLevel) | 0
        const s = String(this.runSeed || "0") + ":" + idx
        let h = 2166136261
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i)
            h = Math.imul(h, 16777619)
        }
        return h >>> 0
    }

    // Fill an earth-coloured rectangle beneath each outdoor room so the
    // transparent dirt/grass tiles read as solid ground instead of showing the
    // black canvas. Depth -10 keeps it under the tilemap (and the fog overlay
    // at depth 5 still darkens it consistently). Recreated each bind; the
    // scene.restart on floor transitions clears the old ones.
    _drawOutdoorUnderlays(scene) {
        if (!this.rooms) return
        const ts = this.tileSize
        for (const room of this.rooms) {
            if (room.floorTheme !== "outdoor") continue
            scene.add.rectangle(
                room.x * ts, room.y * ts, room.w * ts, room.h * ts, OUTDOOR_GROUND_COLOR
            ).setOrigin(0, 0).setDepth(-10)
        }
    }

    // Repaint the floor of any room flagged room.floorTheme === "outdoor"
    // (fortress / outpost settlements) as dirt + grass so it reads as an
    // open-air war-camp. Runs on the freshly-built levelWithTiles every floor
    // entry — room.floorTheme is set at level generation (before bind), so the
    // look is stable and survives revisits with no runtime tilemap editing.
    // Only floor tiles are repainted; walls (and the palisade entities laid on
    // top during populate) are untouched.
    _applyOutdoorThemes() {
        if (!this.rooms) return
        for (const room of this.rooms) {
            if (room.floorTheme !== "outdoor") continue
            for (let y = room.y; y < room.y + room.h; y++) {
                if (!this.levelWithTiles[y] || !this.level[y]) continue
                for (let x = room.x; x < room.x + room.w; x++) {
                    // Grid is authoritative: repaint every FLOOR cell (grid 0),
                    // regardless of which sampled floor frame / env decal it took,
                    // so outdoor rooms read as dirt+grass. Walls (grid 1) untouched.
                    if (this.level[y][x] !== 0) continue
                    this.levelWithTiles[y][x] = outdoorFloorTile(x, y)
                }
            }
        }
    }

    isWalkableTile(x, y) { return worldQueries.isWalkableTile(x, y) }
    randomWalkableTile() { return worldQueries.randomWalkableTile() }
    randomWalkableTileInRoom(x, y, w, h) { return worldQueries.randomWalkableTileInRoom(x, y, w, h) }
    // The room whose rectangle contains tile (x, y), or null. Rooms don't
    // overlap, so the first match wins. Used by room-aware AI (hunter search;
    // territorial roam later).
    roomAt(x, y) {
        if (!this.rooms) return null
        return this.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null
    }
    freeWalkableTileNear(cx, cy, maxRadius) { return worldQueries.freeWalkableTileNear(cx, cy, maxRadius) }
    findPathToRandomReachable(entity, maxAttempts) { return worldQueries.findPathToRandomReachable(entity, maxAttempts) }
    gridForEntity(entity) { return worldQueries.gridForEntity(entity) }
    findPath(entity, tx, ty, opts) { return worldQueries.findPath(entity, tx, ty, opts) }
    getRandomFloorTile() { return worldQueries.getRandomFloorTile() }
    entityAtTile(x, y) { return worldQueries.entityAtTile(x, y) }
    blockingStructureAt(x, y, entity) { return worldQueries.blockingStructureAt(x, y, entity) }
    isDoorAt(x, y) { return worldQueries.isDoorAt(x, y) }
    isBlockingDoorAt(x, y) { return worldQueries.isBlockingDoorAt(x, y) }
    isSturdyWallAt(x, y) { return worldQueries.isSturdyWallAt(x, y) }
    isBreachableWallAt(x, y) { return worldQueries.isBreachableWallAt(x, y) }

    // Resolve a cross-floor portal arrival spec (§15.9 slice 2b) to a concrete
    // tile on the CURRENT floor. { tile } is used verbatim; { room:areaId } finds
    // the authored region carrying that id (AuthoredLevel tags regions with
    // `areaId`) and picks a walkable tile inside it. Null if unresolvable — the
    // caller (placePlayer) then falls back to the floor's default start room.
    arrivalTileFor(spec) {
        if (!spec) return null
        if (spec.tile) return { x: spec.tile.x, y: spec.tile.y }
        if (spec.room != null && this.rooms) {
            const r = this.rooms.find(rm => rm.areaId === spec.room)
            if (r) return this.randomWalkableTileInRoom(r.x, r.y, r.w, r.h)
        }
        return null
    }

    // Mark / clear a sturdy (impassable to Breach & Dig) wall at a tile. A level
    // or the generator calls markSturdyWall during setup for story walls; the Set
    // is reset each floor in bind(). x,y are tile coords.
    markSturdyWall(x, y) { this.sturdyWalls.add(`${x},${y}`) }
    clearSturdyWalls() { this.sturdyWalls = new Set() }
    containerAtTile(x, y) { return worldQueries.containerAtTile(x, y) }
    hasLineOfSight(from, to) { return worldQueries.hasLineOfSight(from, to) }
    projectileBlockerAt(x, y, attacker, magic) { return worldQueries.projectileBlockerAt(x, y, attacker, magic) }
    hasProjectilePath(from, to, attacker, magic) { return worldQueries.hasProjectilePath(from, to, attacker, magic) }
    distanceBetweenEntities(e1, e2) { return worldQueries.distanceBetweenEntities(e1, e2) }
}

export default new MapState()
