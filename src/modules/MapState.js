import LevelManager from './levels/LevelManager.js'
import BSPLevel from './levels/BSPLevel.js'
import worldQueries from './WorldQueries.js'
import { getRecipe, FLOOR_RECIPES, DEFAULT_THEME, normalizeTheme } from './levels/recipes.js'
import { autotileTerrains, pickAutotileFrame, pickWallPatchFrame, wallPatchSpec } from './levels/autotile.js'
import { pickStronghold } from './levels/strongholds.js'
// Safe to import here: dungeonTypes' whole transitive closure is leaf modules
// (autotile, tileRegions, themeRoles, assetLoader), none of which reach MapState.
// DIAGNOSTIC 2026-08-25: unused while the theme re-derive above is disabled.
// import { refreshThemeFromType } from './levels/dungeonTypes.js'
import SHEETS from '../data/assetSheets.js'

// Run-length presets (run-time budgeting). Always 5 floors; the preset sizes
// EACH floor toward a target TOTAL playtime so a run matches the player's
// intent — a 1-min phone break vs a 7-min desktop session vs the full "free"
// dungeon. Sizes are a FIRST CUT, validated only for clean generation
// (0 disconnects across 100 seeds each); the in-game play-time tracker is the
// instrument for calibrating these to the actual minute targets. See
// documents/v3_dungeon_archetype_system.md.

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
        this.runLength = "free"   // v5: no Account/preferences layer (scope doc section 6)
        const profile = RUN_PROFILES[this.runLength] || RUN_PROFILES["free"]
        // Each floor's dungeon Recipe (design doc §14.2) — the data object binding
        // geometry + tileset theme — comes from FLOOR_RECIPES by floor index, so
        // the descent changes realm as it goes down. The recipe supplies
        // geometry + theme; the run-length profile sizes each floor; doors:false
        // stays while door placement is reworked (corridors guarantee connectivity).
        const modes = ["banded", "tree", "banded", "tree", "banded"]
        // The LAST floor is a stronghold: one inhabited place with a single
        // resident species and a leader, instead of a random assortment. Rolled
        // once per run so the finale differs between playthroughs. Geometry is
        // unchanged — only the population reads differently. See
        // levels/strongholds.js.
        const strongholdKey = pickStronghold()
        const lastFloor = modes.length - 1
        const levels = modes.map((mode, i) => {
            const recipe = getRecipe(FLOOR_RECIPES[i])
            return {
                type: BSPLevel,
                config: {
                    ...profile,
                    ...recipe.geometry,
                    theme: recipe.theme,
                    propPalette: recipe.propPalette,
                    doors: false,
                    startEndMode: mode,
                    seed: `${this.runSeed}:${i}`,
                    stronghold: i === lastFloor ? strongholdKey : null,
                }
            }
        })
        this.levelManager = new LevelManager({ levels })
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
        // A wall sheet may instead declare a PATCH scheme in its own _meta (mask x
        // position cuts, plus elevation faces along the mass's south edge). The
        // sheet declares it, not the theme — see autotile.js. Absent on every
        // sheet that predates it, so this is null for all existing themes.
        const wallPatch = wallPatchSpec(this._sheetMeta(roleSheet.wall))
        const grid = this.level
        const isFloor = (x, y) => !!(grid[y] && grid[y][x] === 0)
        // For a wall cell, "same terrain" means "also wall". OUT OF BOUNDS COUNTS
        // AS WALL (the !== 0 test): the grid's border cells are real walls, and
        // treating the void beyond them as open would draw an edge all the way
        // around the map, framing it instead of reading as solid mass.
        const isWall = (x, y) => !(grid[y] && grid[y][x] === 0)
        this.levelWithTiles = grid.map((row, y) => row.map((t, x) => {
            if (t === 1) {
                if (wallPatch) {
                    const f = pickWallPatchFrame(wallPatch, x, y, isWall)
                    if (f != null) return f + gidWall
                }
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

        // Build the layer at the SHEETS' native tile size, then scale it back to
        // the world grid. Phaser draws a tile at its TILESET's size but positions
        // it by the MAP's, so a 32px pack on a 16px map renders every tile at 2x,
        // overlapping its neighbours — every theme sheet until now happened to be
        // 16px, so this path had never been exercised.
        //
        // Scaling is safe for coordinates because Phaser derives tileToWorldX /
        // worldToTileX from baseTileWidth * scaleX: 32 at 0.5 is 16 per tile, the
        // same number those return today. Everything positioning an entity through
        // mapState.map keeps working untouched.
        //
        // A floor whose roles disagree on size falls back to the world grid — the
        // old behaviour — because one layer has a single base size and scaling to
        // suit one role would mis-size the other. When native === tileSize (every
        // pre-existing theme) this is byte-for-byte what it was.
        const natives = sheetOrder.map(key => this._sheetSlice(key, theme).tileSize)
        const native = natives.length && natives.every(n => n === natives[0]) ? natives[0] : this.tileSize
        const config = {
            data: this.levelWithTiles,
            tileWidth: native,
            tileHeight: native,
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
        if (this.map && native !== this.tileSize) this.map.setScale(this.tileSize / native)
        this._drawOutdoorUnderlays(scene)
    }

    // How a sheet is sliced. Per-sheet `_meta` is the truth (it's the same data
    // the Atlas and the validator slice by); the theme's own values are the
    // fallback, which is what keeps DEFAULT_THEME working — its "tiles" key is
    // the World-preloaded Kenney texture and has no assetSheets entry.
    // A registered sheet's `_meta`, or null for a key with no assetSheets entry
    // (DEFAULT_THEME's "tiles" is the World-preloaded Kenney texture and has none).
    _sheetMeta(key) {
        const sheet = SHEETS.find(s => s.key === key)
        return (sheet && sheet.ref && sheet.ref._meta) || null
    }

    _sheetSlice(key, theme) {
        const meta = this._sheetMeta(key)
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
    wouldSplitFloor(x, y) { return worldQueries.wouldSplitFloor(x, y) }
    findPathToRandomReachable(entity, maxAttempts) { return worldQueries.findPathToRandomReachable(entity, maxAttempts) }
    gridForEntity(entity) { return worldQueries.gridForEntity(entity) }
    findPath(entity, tx, ty, opts) { return worldQueries.findPath(entity, tx, ty, opts) }
    getRandomFloorTile() { return worldQueries.getRandomFloorTile() }
    entityAtTile(x, y) { return worldQueries.entityAtTile(x, y) }
    combatantAtTile(x, y) { return worldQueries.combatantAtTile(x, y) }
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
