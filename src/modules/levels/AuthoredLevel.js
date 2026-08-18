// AuthoredLevel — a floor built from a Dungeon Designer skeleton (design doc
// §15.4 / §15.6 step 6: "author a floor → hit play → walk into it").
//
// This is the consumption end of the designer. It takes the exported skeleton
// (the same JSON the designer autosaves / exports) and turns it into the
// standard BaseLevel surface the engine already knows how to run:
//   getLevelData()   → the 0/1 wall/floor grid
//   getRegions()     → Room[] carrying their authored `kind`
//   getSpawnPoints() → stairs anchored in the starting / ending rooms
//   populate(tm)     → the shared spawn pass (spawnFromTable + rollElite)
//
// Geometry is produced by the SHARED generator (levels/authoredLayout.js) — the
// exact code the designer's preview runs — so what you author is what you walk
// into (design §15.3, "one build path, two callers"). No new generation lives
// here; this class only maps the result onto Room/kind/stairs.
//
// v1 scope: single floor, doorless (parity with the BSP default while door
// placement is reworked), kind-driven spawns. The finer enemy axes on an area
// (enemyTheme / enemyMix / enemyCount) ARE wired (§16 step 1): _toRoom copies
// them onto the Room and spawnFromTable consumes them. The dungeon-wide pool +
// `poolMode` ("authored" pool-only vs "random" legacy fill) drive fallback for
// unauthored rooms. See the project log (memory project_v3_dungeon_archetype_system).

import BaseLevel from './BaseLevel.js'
import Room from './Room.js'
import RNG from './rng.js'
import spawnFromTable, { rollElite } from './spawnFromTable.js'
import { hydrateSkeleton, generateLayout, buildGrid } from './authoredLayout.js'
import { assignRoomKinds as stampSpecialRoomKinds, fortressSelector, normalizeRoomKindMix } from './roomKinds.js'
import HiddenPassage from '../items/HiddenPassage.js'
import Portal from '../items/Portal.js'
import dungeon from '../Dungeon.js'

// Kinds spawnFromTable / placePlayer understand directly. An authored area whose
// kind isn't one of these (or is blank) falls back to "combat".
const GAME_KINDS = new Set([
    'starting', 'ending', 'combat', 'treasure', 'rest', 'shop', 'shrine',
    'secret', 'pact', 'essence', 'grove', 'settlement', 'duelist',
])

export default class AuthoredLevel extends BaseLevel {
    constructor(config) {
        super(config)
        // Tileset theme (§14.2) MapState.bind reads to paint this floor, and the
        // furnisher's prop palette (§14.5) read by furnish.js — both threaded in
        // by MapState from a recipe, same as BSPLevel.
        this.theme = config.theme || null
        this.propPalette = config.propPalette || null
        // Authored floors are doorless for now (parity with the BSP default while
        // door placement is reworked); corridors guarantee connectivity.
        this.doorsEnabled = false
        // No BSP tree — getTree() returns null; World's default-spawn path uses
        // rooms (kind === "starting"), not the tree, so null is safe.
        this.tree = null
        this.skeleton = config.skeleton
        this.generate()
    }

    generate() {
        const hy = hydrateSkeleton(this.skeleton)   // { voidSize, areas, routePoints, connections, style, seed }
        const { corridors, procRooms } = generateLayout(hy)
        this.levelData = buildGrid({ voidSize: hy.voidSize, areas: hy.areas, procRooms, corridors })
        // Authored connections (portals, §15.9). Resolved to concrete tiles after
        // the grid + regions exist (see _resolveConnections); placed in populate().
        this._connections = hy.connections || []

        // Regions = authored areas + procedural rooms. Authored areas carry their
        // own kind + enemy authoring; procedural rooms have none, so they draw
        // enemies from the dungeon-wide pool (§16, user 2026-07-12) — an empty
        // pool means no procedural enemies (so an all-authored dungeon can be
        // truly controlled / empty).
        this.regions = []
        const dungeonPool = Array.isArray(this.skeleton.dungeonPool)
            ? this.skeleton.dungeonPool.filter(x => typeof x === 'string') : []
        const poolMode = this.skeleton.poolMode === 'random' ? 'random' : 'authored'
        // Per-floor default stance (§16 Stage 2 ergonomics): rooms with no authored
        // stance inherit it, so a whole floor can share one disposition without
        // stamping every room. "" / absent = today's per-room behavior.
        const defaultStance = this.skeleton.defaultStance || ''
        for (const a of hy.areas) this.regions.push(this._toRoom(a, dungeonPool, poolMode, defaultStance))
        for (const r of procRooms) this.regions.push(this._toProcRoom(r, dungeonPool, poolMode, defaultStance))

        // Guarantee a safe spawn: if the author marked no "starting" room, make
        // the first region one so placePlayer resolves a start room and it spawns
        // no enemies (mirrors BSP always having a starting room).
        if (this.regions.length && !this.regions.some(r => r.kind === 'starting')) {
            this.regions[0].kind = 'starting'
            this.regions[0].authoredKind = true
        }

        this._stampSpecialRooms(hy)

        this.spawnPoints = this._deriveStairs()
        // Secret rooms (kind === "secret") are sealed down to a SINGLE hidden door
        // (the rest of their contact surface walled to solid), so they read as a
        // walled room with one secret passage rather than a cracked-wall face.
        // Mutates levelData; returns the door tiles to place HiddenPassages on.
        this.secretPassages = this._sealSecretRooms(hy.areas)
        // Portals (§15.9): resolve each authored connection to concrete source +
        // dest tiles now that the grid + sealing are final. Placed in populate().
        this.portals = this._resolveConnections(this._connections, hy.areas)
    }

    // Roll the dungeon's special-room mix over the rooms the author left generic.
    //
    // Authored floors used to get NO specials — every room was exactly what you
    // drew, so a hand-built dungeon had no treasure, shop, rest or shrine rooms
    // unless you placed each one by hand, while BSP floors got a full set. Both
    // now roll the same table (levels/roomKinds.js).
    //
    // ELIGIBILITY IS THE WHOLE POINT: a room the designer named keeps its kind.
    // Unlike BSP rooms, authored rooms are never blank — _toRoom defaults them to
    // 'combat' — so "has no kind" can't be the test. `authoredKind` marks the
    // rooms whose kind was a real choice; everything else (generic combat rooms
    // and procedural fill) is fair game.
    //
    // Seeded from the floor's own fill seed, so this follows the same lock policy
    // as the layout: a pinned seed gives the same specials every run, an unlocked
    // one rerolls them with the corridors.
    _stampSpecialRooms(hy) {
        const grid = hy.voidSize || { w: 0, h: 0 }
        stampSpecialRoomKinds({
            rooms: this.regions,
            rng: new RNG(hy.seed != null ? hy.seed : 'authored'),
            mix: normalizeRoomKindMix(this.skeleton.roomKinds),
            isEligible: (room) => !room.authoredKind,
            selectors: { fortress: fortressSelector(grid.w, grid.h) },
        })
    }

    // Turn authored connections into placeable portal specs (§15.9).
    //   - SAME-FLOOR (dest.floor === 'same'): resolve dest to a concrete { x, y }
    //     — dest.room -> a walkable tile inside that area, or dest.tile verbatim.
    //     Dropped if unresolvable.
    //   - CROSS-FLOOR (dest.floor is a number, slice 2b): keep the dest UNRESOLVED
    //     ({ floor, room, tile }) — it's resolved on ARRIVAL on the destination
    //     floor (run.pendingArrival -> mapState.arrivalTileFor), since this level
    //     only knows its own geometry. The Portal marks itself heroOnly.
    // The source tile is carved to floor so a hidden portal reads as a wall
    // feature sitting on reachable ground.
    _resolveConnections(connections, areas) {
        const out = []
        for (const c of (connections || [])) {
            let dest
            if (c.dest.floor === "same") {
                if (c.dest.tile) dest = { x: c.dest.tile.x, y: c.dest.tile.y }
                else if (c.dest.room != null) {
                    const area = areas.find(a => a.id === c.dest.room)
                    dest = area && this._walkableTileInArea(area)
                }
                if (!dest) continue   // unresolvable same-floor dest → no portal
            } else {
                dest = { floor: c.dest.floor, room: c.dest.room, tile: c.dest.tile }
            }
            const src = { x: c.source.x, y: c.source.y }
            if (this.levelData[src.y]) this.levelData[src.y][src.x] = 0   // ensure reachable
            out.push({ source: src, dest, hidden: c.hidden !== false })
        }
        return out
    }

    // A floor tile inside an authored area. Free shapes scan their cells; rects
    // spiral out from the center so the landing tile is roughly central. Returns
    // null if the area has no floor tile (fully walled — shouldn't happen for a
    // carved area, but the caller drops the connection if so).
    _walkableTileInArea(area) {
        const grid = this.levelData
        const isFloor = (x, y) => grid[y] && grid[y][x] === 0
        if (area.shape === 'free' && area.cells) {
            for (const k of area.cells) {
                const p = k.split(','), x = +p[0], y = +p[1]
                if (isFloor(x, y)) return { x, y }
            }
            return null
        }
        const cx = Math.floor(area.x + area.w / 2), cy = Math.floor(area.y + area.h / 2)
        if (isFloor(cx, cy)) return { x: cx, y: cy }
        for (let r = 1; r < Math.max(area.w, area.h); r++) {
            for (let yy = area.y; yy < area.y + area.h; yy++) {
                for (let xx = area.x; xx < area.x + area.w; xx++) {
                    if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) === r && isFloor(xx, yy)) return { x: xx, y: yy }
                }
            }
        }
        return null
    }

    // For every "secret"-kind area: find its entrance surface (room-edge cells
    // touching floor OUTSIDE the room — this catches wide corridors + incidental
    // adjacency, not just the authored opening), keep ONE as the secret door
    // (preferring the authored opening's tile), and WALL the rest to solid. Only
    // the room's OWN cells are walled (never the corridor), so it can't disconnect
    // the map. Returns the chosen door tile per secret room.
    _sealSecretRooms(areas) {
        const grid = this.levelData
        const isFloor = (x, y) => grid[y] && grid[y][x] === 0
        const doors = []
        for (const a of areas) {
            if (a.kind !== 'secret') continue
            const cells = new Set()
            if (a.shape === 'free' && a.cells) {
                for (const k of a.cells) cells.add(k)
            } else {
                for (let yy = a.y; yy < a.y + a.h; yy++)
                    for (let xx = a.x; xx < a.x + a.w; xx++) cells.add(xx + ',' + yy)
            }
            const entrances = []
            for (const k of cells) {
                const p = k.split(','), x = +p[0], y = +p[1]
                if (!isFloor(x, y)) continue
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    if (isFloor(x + dx, y + dy) && !cells.has((x + dx) + ',' + (y + dy))) { entrances.push({ x, y }); break }
                }
            }
            if (!entrances.length) continue
            const door = this._preferredDoor(a, entrances)
            doors.push(door)
            for (const e of entrances) if (e !== door) grid[e.y][e.x] = 1   // wall the extra contact
        }
        return doors
    }

    // The authored opening's tile if it's one of the entrances, else the first.
    _preferredDoor(a, entrances) {
        if (a.openings) {
            for (const k of a.openings) {
                const p = k.split(','), x = +p[0], y = +p[1]
                const hit = entrances.find(e => e.x === x && e.y === y)
                if (hit) return hit
            }
        }
        return entrances[0]
    }

    // Map an authored area onto a Room. `kind` uses the game kind when valid;
    // the `encounter` axis maps onto the duelist / settlement kinds that
    // spawnFromTable already handles; everything else is a combat room.
    _toRoom(a, pool = [], poolMode = 'authored', defaultStance = '') {
        let kind = GAME_KINDS.has(a.kind) ? a.kind : ''
        if (!kind && a.encounter === 'duelist') kind = 'duelist'
        const room = new Room(a.x, a.y, a.w, a.h, kind || 'combat')
        // Did the AUTHOR choose this room's role? If so the special-room roll
        // (_stampSpecialRooms) leaves it alone. Deliberately keyed off `a.kind`
        // rather than the resolved kind above: a kind the engine doesn't consume
        // yet (a "goal" room, which GAME_KINDS omits) is still a decision the
        // designer made, and must not have a shop rolled on top of it.
        if (a.kind || a.encounter) room.authoredKind = true
        // Carry the authored area id so a cross-floor portal arrival (§15.9) can
        // resolve its destination room on this floor (mapState.arrivalTileFor).
        room.areaId = a.id
        // Authored enemy population (§16 step 1): the per-area species pool
        // (enemyMix) + guaranteed species (enemyTheme) ride onto the Room for
        // spawnFromTable to consume. BSP rooms never set these, so their
        // spawning is unchanged.
        if (a.enemyTheme) room.enemyTheme = a.enemyTheme
        if (a.enemyMix && a.enemyMix.length) room.enemyMix = a.enemyMix.slice()
        if (typeof a.enemyCount === 'number') room.enemyCount = a.enemyCount
        // Authored disposition (§16 Stage 2): the room's own stance wins; a room
        // that didn't set one inherits the floor default (if any).
        const stance = a.stance || defaultStance
        if (stance) room.stance = stance
        // Authored mode (§16): a room with no per-room mix falls back to the
        // dungeon-wide pool, and `authoredPool` tells spawnFromTable never to
        // random-fill — so an empty pool yields an empty room, nothing random.
        // Random mode leaves unauthored rooms on the legacy spawn path.
        if (poolMode === 'authored') {
            room.authoredPool = true
            if (!room.enemyMix && pool.length) room.enemyMix = pool.slice()
        }
        if (a.encounter === 'settlement') {
            // {species, form} sub-authoring is a deferred follow-up (log caveat);
            // default to a small orc encampment so it populates + themes outdoors.
            room.kind = 'settlement'
            room.settlement = { species: 'orc', form: 'encampment', faction: 'orc' }
            room.floorTheme = 'outdoor'
        }
        return room
    }

    // A procedural (auto-generated) fill room. It has no authoring, so in
    // "authored" mode its enemies come from the dungeon-wide pool (§16): a
    // non-empty pool becomes the room's species mix (spawnFromTable draws from
    // it) and `authoredPool` suppresses random fill; an EMPTY pool sets
    // enemyCount 0 so no enemies spawn there. Count for a populated pool still
    // comes from the "combat" spawn table. In "random" mode it stays a plain
    // combat room the legacy spawn path populates. Authored rooms are unaffected.
    _toProcRoom(r, pool = [], poolMode = 'authored', defaultStance = '') {
        const room = new Room(r.x, r.y, r.w, r.h, 'combat')
        room.areaId = r.id
        room.procedural = true
        // Procedural rooms have no authored stance, so they inherit the floor
        // default (if set) — keeps "whole floor is territorial" consistent.
        if (defaultStance) room.stance = defaultStance
        if (poolMode === 'authored') {
            room.authoredPool = true
            if (pool.length) room.enemyMix = pool.slice()
            else room.enemyCount = 0
        }
        return room
    }

    // Stairs anchored at the center of the starting (up) / ending (down) rooms.
    // On a single-floor authored run LevelManager.getStairs() returns neither, so
    // no Stairs entities spawn — this just keeps the contract populated.
    _deriveStairs() {
        const start = this.regions.find(r => r.kind === 'starting') || this.regions[0]
        const end = this.regions.find(r => r.kind === 'ending') || start
        const center = (r) => r ? { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) } : null
        return { stairsUp: center(start), stairsDown: center(end) }
    }

    populate(tm) {
        // Seal secret rooms FIRST so their passage tiles read as occupied and the
        // spawn pass won't drop loot/enemies on top of a hidden passage.
        this._placeSecretPassages(tm)
        // Portals before the spawn pass too, so their source tiles read as
        // occupied and spawnFromTable won't drop loot/enemies on top of one.
        this._placePortals(tm)
        spawnFromTable(this.regions)
        rollElite()
    }

    _placePortals(tm) {
        if (!this.portals || !this.portals.length) return
        const player = dungeon.player
        for (const { source, dest, hidden } of this.portals) {
            if (player && player.x === source.x && player.y === source.y) continue   // never seal the spawn
            tm.addEntity(new Portal(source.x, source.y, { dest, hidden }))
        }
    }

    _placeSecretPassages(tm) {
        if (!this.secretPassages || !this.secretPassages.length) return
        const player = dungeon.player
        for (const { x, y } of this.secretPassages) {
            if (player && player.x === x && player.y === y) continue   // never seal the spawn
            tm.addEntity(new HiddenPassage(x, y))
        }
    }
}
