import Phaser from 'phaser'
import BaseLevel from './BaseLevel.js'
import Room from './Room.js'
import RNG from './rng.js'
import { MazeGrid, MAZE_ALGORITHMS } from './mazes.js'
import spawnFromTable, { rollElite } from './spawnFromTable.js'
import mapState from '../MapState.js'
import dungeon from '../Dungeon.js'
import Door from '../items/Door.js'
import HiddenPassage from '../items/HiddenPassage.js'
import DungeonKey from '../items/DungeonKey.js'
import Trap from '../hazards/Trap.js'
import { randomTrapKey } from '../hazards/trapDefs.js'
import { assignRoomKinds as stampSpecialRoomKinds, fortressSelector, normalizeRoomKindMix } from './roomKinds.js'

const DOOR_PLACEMENT_RATE = 0.35
const LOCKED_DOOR_RATE = 0.3
// The per-kind special-room rates that used to live here (tuned 2026-05-11 to
// land ~2.7 specials per 16-room floor) are now the defaults in the shared
// room-kind table, levels/roomKinds.js — the same table an authored dungeon
// overrides from the designer's Generate tab. The behaviour of an unauthored
// floor is unchanged, including the order rules fire in and the order they draw
// from the rng, so a pinned seed still reproduces its old layout.

class DNode {
    constructor(area) {
        this.left = false
        this.right = false
        this.area = area
    }

    forEachArea(f) {
        f(this.area)
        if (this.left) this.left.forEachArea(f)
        if (this.right) this.right.forEachArea(f)
    }

    forEachLeaf(f) {
        if (!this.left && !this.right) {
            f(this.area)
        }
        if (this.left) this.left.forEachLeaf(f)
        if (this.right) this.right.forEachLeaf(f)
    }
}

class DArea {
    constructor(x, y, w, h) {
        this.x = x
        this.y = y
        this.w = w
        this.h = h
    }
}

function rollBSPRoom(area, rng) {
    let x = Math.floor(area.x + (rng.between(1, area.w) / 3))
    let y = Math.floor(area.y + (rng.between(1, area.h) / 3))
    let w = area.w - (x - area.x)
    let h = area.h - (y - area.y)
    w -= Math.floor(rng.between(1, w / 3))
    h -= Math.floor(rng.between(1, h / 3))
    return new Room(x, y, w, h)
}

function splitArea(area, rng) {
    let x1, y1, w1, h1 = 0
    let x2, y2, w2, h2 = 0
    if (rng.between(0, 1) == 0) {
        let divider = rng.between(1, area.w)
        x1 = area.x
        y1 = area.y
        w1 = divider
        h1 = area.h
        x2 = area.x + w1
        y2 = area.y
        w2 = area.w - w1
        h2 = area.h
        if (w1 / h1 < 0.45 || w2 / h2 < 0.45) {
            return splitArea(area, rng)
        }
    } else {
        let divider = rng.between(1, area.h)
        x1 = area.x
        y1 = area.y
        w1 = area.w
        h1 = divider
        x2 = area.x
        y2 = area.y + h1
        w2 = area.w
        h2 = area.h - h1
        if (h1 / w1 < 0.45 || h2 / w2 < 0.45) {
            return splitArea(area, rng)
        }
    }

    return [new DArea(x1, y1, w1, h1), new DArea(x2, y2, w2, h2)]
}

function makeTree(area, iterations, rng) {
    let root = new DNode(area)
    if (iterations != 0) {
        let [a1, a2] = splitArea(root.area, rng)
        root.left = makeTree(a1, iterations - 1, rng)
        root.right = makeTree(a2, iterations - 1, rng)
    }
    return root
}

export default class BSPLevel extends BaseLevel {
    constructor(config) {
        super(config)
        // Seeded RNG for reproducible layout. All geometry in generate() draws
        // from this; the same seed reproduces the same map. config.seed may be a
        // string label or a number (see rng.js). Populate-time randomness
        // (doors/traps/spawnFromTable) is NOT seeded yet — a follow-on slice.
        this.rng = new RNG(config.seed != null ? config.seed : 'bsp')
        // Loop density for the maze connector pass: probability of opening an
        // already-redundant connector for an extra cycle. 0 = a perfect
        // spanning tree over regions (no loops); higher = more alternate routes.
        this.loopChance = config.loopChance != null ? config.loopChance : 0.06
        // Maze braiding: fraction of maze dead-ends to remove by connecting them to
        // an adjacent passage (turning the maze into a loopy network). Higher = fewer
        // dead-ends = faster to traverse. 0 = a perfect maze (every dead-end kept).
        this.braidMaze = config.braidMaze != null ? config.braidMaze : 0.7
        // Which maze-carving algorithm fills the between-room corridors (see
        // levels/mazes.js MAZE_ALGORITHMS). Each gives a different corridor texture.
        // Only consulted when corridorStyle is 'maze'.
        this.mazeAlgorithm = config.mazeAlgorithm || 'recursiveBacktracker'
        // Authored special-room mix ({ ruleKey: {count, chance} }, see
        // levels/roomKinds.js). Absent = the table's own defaults, which are the
        // rates this file used to hardcode.
        this.roomKindMix = normalizeRoomKindMix(config.roomKinds)
        // Corridor geometry style — the Geometry axis of the archetype system.
        // 'simple' (default) = discrete rooms joined by L-corridors: rooms keep
        // their rectangular integrity and pick up only a few clean entrances (the
        // "Classic" dungeon). 'maze' = rooms-and-mazes fill: a twisty labyrinth
        // with many room entrances, reserved for a future Labyrinth archetype.
        // loopChance/braidMaze/mazeAlgorithm above apply only in 'maze' mode.
        this.corridorStyle = config.corridorStyle || 'simple'
        // Corridor thickness in tiles for the 'simple' style (1 = classic tight
        // halls; higher = roomier). Entrances are derived from the finished map
        // after carving, so wider halls still read as discrete rooms.
        this.corridorWidth = config.corridorWidth != null ? config.corridorWidth : 1
        // Tileset theme from the run's Recipe (design doc §14.2): { floorTile,
        // wallTile } indices MapState.bind reads to paint this floor. null for
        // callers that don't theme (tests) → MapState falls back to defaults.
        this.theme = config.theme || null
        // Prop-palette key for the furnisher (§14.5), read at populate time by
        // furnish.js — same threading path as theme.
        this.propPalette = config.propPalette || null
        // Door placement toggle. Temporarily off (config.doors:false) while the
        // maze-era door PLACEMENT is reworked — the maze guarantees full
        // connectivity, so a doorless floor is completely playable. Flip back on
        // (drop config.doors, or set true) once placement is fixed.
        this.doorsEnabled = config.doors !== false
        this.rootArea = new DArea(0, 0, config.width, config.height)
        this.tree = makeTree(this.rootArea, config.iterations, this.rng)
        // "tree" preserves original placement: start/end at the deepest
        // left/right leaves of the BSP tree (spatially emergent from
        // split topology). "banded" partitions rooms by spatial position
        // — start picked from the left third, end from the right third,
        // each from one of three vertical bands (upper/middle/lower).
        // Falls back to tree-walk per-side when a band side is empty.
        this.startEndMode = config.startEndMode || "tree"
        this.generate()
    }

    generate() {
        this.initializeLevelData()
        this.makeRooms()
        this.assignRoomKinds()
        this.makeCorridors()
        this.addStairs()
    }

    initializeLevelData() {
        let lvl = []
        for (let y = 0; y <= this.rootArea.h; y++) {
            lvl[y] = lvl[y] || []
            for (let x = 0; x <= this.rootArea.w; x++) {
                lvl[y][x] = 1
            }
        }
        this.levelData = lvl
    }

    fillRect(x, y, w, h, tile) {
        for (let y1 = y; y1 < y + h; y1++) {
            for (let x1 = x; x1 < x + w; x1++) {
                this.levelData[y1][x1] = tile
            }
        }
    }

    makeRooms() {
        const rooms = []
        const makeRoom = (area) => {
            area.room = rollBSPRoom(area, this.rng)
            rooms.push(area.room)
            this.fillRect(area.room.x, area.room.y, area.room.w, area.room.h, 0)
        }
        this.tree.forEachLeaf(makeRoom)
        this.regions = rooms
    }

    // Tag rooms with their gameplay role. "starting" and "ending" come from the
    // placement mode; the special kinds are rolled from the shared room-kind
    // table (levels/roomKinds.js), which the designer can author over per
    // dungeon; everything left is "combat". Spawn tables in data/spawnTables.json
    // key off these names.
    assignRoomKinds() {
        const startRoom = this._pickStartRoom()
        const endRoom = this._pickEndRoom(startRoom)
        if (startRoom) startRoom.kind = "starting"
        if (endRoom && endRoom !== startRoom) endRoom.kind = "ending"

        stampSpecialRoomKinds({
            rooms: this.regions,
            rng: this.rng,
            mix: this.roomKindMix,
            selectors: { fortress: fortressSelector(this.rootArea.w, this.rootArea.h) },
        })

        for (const room of this.regions) {
            if (!room.kind) room.kind = "combat"
        }
    }

    _pickStartRoom() {
        if (this.startEndMode === "banded") {
            const picked = this._pickBandedRoom("left")
            if (picked) return picked
        }
        let node = this.tree
        while (node.left) node = node.left
        return node.area && node.area.room
    }

    _pickEndRoom(startRoom) {
        if (this.startEndMode === "banded") {
            const picked = this._pickBandedRoom("right", startRoom)
            if (picked) return picked
        }
        let node = this.tree
        while (node.right) node = node.right
        return node.area && node.area.room
    }

    // Two-stage uniform pick: choose a non-empty vertical band uniformly,
    // then a room within that band uniformly. A band with one room is as
    // likely to be picked as a band with five — keeps the upper/middle/
    // lower variety visible even on uneven floors. Returns null if no
    // room's center lies on the requested side.
    _pickBandedRoom(side, excludeRoom = null) {
        const w = this.rootArea.w
        const h = this.rootArea.h
        const sideMin = side === "left" ? 0 : w * 2 / 3
        const sideMax = side === "left" ? w / 3 : w
        const topMax = h / 3
        const bottomMin = h * 2 / 3

        const bands = { upper: [], middle: [], lower: [] }
        for (const room of this.regions) {
            if (room === excludeRoom) continue
            const cx = room.x + room.w / 2
            const cy = room.y + room.h / 2
            if (cx < sideMin || cx >= sideMax) continue
            if (cy < topMax) bands.upper.push(room)
            else if (cy >= bottomMin) bands.lower.push(room)
            else bands.middle.push(room)
        }

        const populated = [bands.upper, bands.middle, bands.lower]
            .filter(b => b.length > 0)
        if (populated.length === 0) return null
        const band = this.rng.pick(populated)
        return this.rng.pick(band)
    }

    // Pick the room a fortress/outpost settlement claims. A war-camp is a
    // mini-dungeon set-piece — it must be a genuinely large room with a real
    // courtyard, not a cramped square the palisade swallows. So we require a
    // hard minimum (both dims AND area) and pick the largest qualifier; if no
    // room is big enough this floor, return null and skip the camp rather than
    // forcing a tiny one. Capped at a quarter of the map so one camp can't take
    // over the floor (the cap is generous — BSP rooms rarely approach it).
    // Carve the corridors that join the placed rooms, dispatching on the
    // configured geometry style. Both styles record each room↔corridor opening
    // in this.doorways (a clean 1-wide choke) for later door placement.
    makeCorridors() {
        // Connector tiles that open into a room — the ACTUAL room↔corridor
        // doorways. placeDoors puts doors exactly here, so a door IS the opening.
        this.doorways = []
        if (this.corridorStyle === 'maze') {
            this._makeMazeCorridors()
        } else {
            this._makeSimpleCorridors()
        }
    }

    // "Simple" geometry (the Classic dungeon default): connect the BSP tree's
    // rooms with L-shaped corridors — at each internal node, join a room from
    // the left subtree to the nearest room in the right subtree. The tree
    // structure guarantees the whole floor is one connected network, so none of
    // the maze-style connector/braid/safety-net passes are needed. Rooms keep
    // their rectangular integrity and pick up only a few clean entrances.
    _makeSimpleCorridors() {
        const connect = (node) => {
            if (!node.left || !node.right) return   // leaf — nothing to join
            const a = this._representativeRoom(node.left, node.right.area)
            const b = this._representativeRoom(node.right, node.left.area)
            if (a && b) this._carveCorridor(a, b, this.corridorWidth)
            connect(node.left)
            connect(node.right)
        }
        connect(this.tree)
        this._recordDoorways()
    }

    // Pick a room from the leaves under `node`, preferring the one whose centre
    // is closest to `towardArea` (the sibling subtree) so corridors stay short
    // and are less likely to cut across a third room.
    _representativeRoom(node, towardArea) {
        const rooms = []
        node.forEachLeaf(area => { if (area.room) rooms.push(area.room) })
        if (rooms.length === 0) return null
        if (rooms.length === 1 || !towardArea) return rooms[0]
        const tx = towardArea.x + towardArea.w / 2
        const ty = towardArea.y + towardArea.h / 2
        let best = rooms[0], bestDist = Infinity
        for (const r of rooms) {
            const d = Math.abs((r.x + r.w / 2) - tx) + Math.abs((r.y + r.h / 2) - ty)
            if (d < bestDist) { bestDist = d; best = r }
        }
        return best
    }

    // Derive room↔corridor openings from the FINISHED map: scan every room's
    // perimeter for the single midpoint choke of each corridor mouth
    // (_findDoorwayCandidates). Style-agnostic — it reads levelData, so it works
    // for any carve that opens a room wall, and a wide mouth still collapses to
    // one recorded choke. Lets the later door pass drop one door per opening with
    // no "door beside the opening" ambiguity.
    _recordDoorways() {
        const seen = new Set()
        for (const room of this.regions) {
            for (const c of this._findDoorwayCandidates(room)) {
                const k = `${c.x},${c.y}`
                if (seen.has(k)) continue
                seen.add(k)
                this.doorways.push(c)
            }
        }
    }

    // "Maze" geometry (rooms-and-mazes, Nystrom): BSP places the rooms (already
    // carved), a recursive-backtracker maze fills the wall space BETWEEN them,
    // then a connector pass stitches rooms + maze fragments into one network (a
    // spanning tree over regions plus a few loop openings), and a braid pass
    // removes most dead-ends. Produces a twisty labyrinth with many room
    // entrances — reserved for a future Labyrinth archetype, not the default.
    _makeMazeCorridors() {
        const rows = this.levelData.length
        const cols = this.levelData[0].length
        this._regionGrid = []
        for (let y = 0; y < rows; y++) this._regionGrid[y] = new Array(cols).fill(-1)
        this._currentRegion = -1

        this._labelRooms()            // each room -> its own region (+ a no-maze border)
        this._roomRegionMax = this._currentRegion   // region ids 0.._roomRegionMax are rooms
        this._fillMaze()              // carve a maze into the remaining wall space
        this._connectRegions()        // open connectors: rooms <-> maze, maze <-> maze
        this._braidMaze()             // remove most dead-ends -> loops -> faster to traverse
        this._ensureRoomsConnected()  // safety net: force-join any stranded room
    }

    inBounds(x, y) {
        return y >= 0 && y < this.levelData.length
            && x >= 0 && x < this.levelData[0].length
    }

    _newRegion() { this._currentRegion += 1; return this._currentRegion }

    // Tag every room's floor tiles with a region id, and mark those tiles plus a
    // one-tile ring around them as OFF-LIMITS to the maze — the ring becomes the
    // wall the connector pass punches doorways through, and it stops a maze
    // passage from running flush against a room (which would merge them with no
    // controllable doorway).
    _labelRooms() {
        this._blocked = []
        for (let y = 0; y < this.levelData.length; y++) {
            this._blocked[y] = new Array(this.levelData[0].length).fill(false)
        }
        for (const room of this.regions) {
            const region = this._newRegion()
            room._region = region
            for (let y = room.y; y < room.y + room.h; y++) {
                for (let x = room.x; x < room.x + room.w; x++) {
                    if (!this.inBounds(x, y)) continue
                    this._regionGrid[y][x] = region
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (this.inBounds(x + dx, y + dy)) this._blocked[y + dy][x + dx] = true
                        }
                    }
                }
            }
        }
    }

    // Fill the wall space between rooms with a maze, using the configured
    // algorithm from levels/mazes.js (Recursive Backtracker, Prim's, Hunt-and-Kill,
    // …). The algorithms only carve tiles; regions are assigned afterwards by
    // flooding the carved pockets, so swapping the algorithm needs no other change.
    _fillMaze() {
        const mg = new MazeGrid(this.levelData, this._blocked, this.rng)
        const algorithm = MAZE_ALGORITHMS[this.mazeAlgorithm] || MAZE_ALGORITHMS.recursiveBacktracker
        algorithm(mg, this.rng)
        this._assignMazeRegions()
    }

    // Flood-fill each connected pocket of carved maze tiles into its own region
    // (rooms already carry theirs from _labelRooms; the border ring keeps maze and
    // room tiles from touching, so a flood never crosses into a room). The connector
    // pass then stitches these regions together.
    _assignMazeRegions() {
        const rows = this.levelData.length, cols = this.levelData[0].length
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (this.levelData[y][x] !== 0) continue        // walls
                if (this._regionGrid[y][x] >= 0) continue       // already a room region
                const region = this._newRegion()
                const stack = [[x, y]]
                this._regionGrid[y][x] = region
                while (stack.length) {
                    const [cx, cy] = stack.pop()
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const nx = cx + dx, ny = cy + dy
                        if (!this.inBounds(nx, ny)) continue
                        if (this.levelData[ny][nx] !== 0) continue
                        if (this._regionGrid[ny][nx] >= 0) continue
                        this._regionGrid[ny][nx] = region
                        stack.push([nx, ny])
                    }
                }
            }
        }
    }

    // Nystrom connector pass. A connector = a wall tile orthogonally adjacent to
    // two different regions; opening it merges them. Repeatedly open a random
    // connector between not-yet-merged regions until the whole map is one
    // network, occasionally opening an already-merged connector for a loop.
    _connectRegions() {
        const connectors = new Map()   // "x,y" -> Set(region ids)
        for (let y = 0; y < this.levelData.length; y++) {
            for (let x = 0; x < this.levelData[0].length; x++) {
                if (this.levelData[y][x] !== 1) continue
                const near = new Set()
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy
                    if (this.inBounds(nx, ny) && this._regionGrid[ny][nx] >= 0) near.add(this._regionGrid[ny][nx])
                }
                if (near.size >= 2) connectors.set(`${x},${y}`, near)
            }
        }

        const parent = []
        for (let i = 0; i <= this._currentRegion; i++) parent[i] = i
        const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
        const union = (a, b) => { parent[find(a)] = find(b) }

        let open = [...connectors.keys()]
        while (open.length) {
            const key = this.rng.pick(open)
            const [x, y] = key.split(',').map(Number)
            this._openConnector(x, y)
            if (this._touchesRoom(connectors.get(key))) this.doorways.push({ x, y })
            const regs = [...connectors.get(key)]
            for (let i = 1; i < regs.length; i++) union(regs[0], regs[i])
            open = open.filter(k => {
                const roots = new Set([...connectors.get(k)].map(find))
                if (roots.size > 1) return true
                // already merged — drop, but sometimes open anyway for a loop
                if (this.rng.chance(this.loopChance)) {
                    const [xx, yy] = k.split(',').map(Number)
                    this._openConnector(xx, yy)
                    if (this._touchesRoom(connectors.get(k))) this.doorways.push({ x: xx, y: yy })
                }
                return false
            })
        }
    }

    // A connector touches a room when any adjacent region id is a room's (room ids
    // are 0.._roomRegionMax; maze fragments are higher). Used to record real room
    // doorways for door placement.
    _touchesRoom(regionSet) {
        for (const r of regionSet) if (r <= this._roomRegionMax) return true
        return false
    }

    // Braid the maze: connect a fraction of dead-ends to an adjacent parallel passage,
    // turning frustrating single-path dead-ends into loops. This is the main lever for
    // "traverse the floor quickly" — a perfect maze forces backtracking; a braided one
    // flows. Only carves non-room walls (never breaches the room border ring).
    _braidMaze() {
        const chance = this.braidMaze
        if (!(chance > 0)) return
        const rows = this.levelData.length, cols = this.levelData[0].length
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        const deadEnds = []
        for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
                if (this.levelData[y][x] !== 0) continue
                if (this._blocked[y][x]) continue   // room tile or border ring — leave alone
                let n = 0
                for (const [dx, dy] of dirs) if (this.levelData[y + dy][x + dx] === 0) n++
                if (n === 1) deadEnds.push({ x, y })
            }
        }
        for (const d of deadEnds) {
            if (!this.rng.chance(chance)) continue
            // Carve a wall neighbour whose far side (2 out) is an existing passage,
            // linking this dead-end into a loop.
            const shuffled = this.rng.shuffle(dirs.slice())
            for (const [dx, dy] of shuffled) {
                const wx = d.x + dx, wy = d.y + dy
                const fx = d.x + dx * 2, fy = d.y + dy * 2
                if (wx < 1 || wy < 1 || wx >= cols - 1 || wy >= rows - 1) continue
                if (fx < 0 || fy < 0 || fx >= cols || fy >= rows) continue
                if (this.levelData[wy][wx] !== 1) continue   // must be a wall to carve
                if (this._blocked[wy][wx]) continue          // don't breach a room border
                if (this.levelData[fy][fx] !== 0) continue   // far side must be a passage
                this.levelData[wy][wx] = 0                   // carve -> loop
                break
            }
        }
    }

    _openConnector(x, y) {
        this.levelData[y][x] = 0
        // adopt a neighbouring region id so later floods read it as connected floor
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy
            if (this.inBounds(nx, ny) && this._regionGrid[ny][nx] >= 0) {
                this._regionGrid[y][x] = this._regionGrid[ny][nx]
                break
            }
        }
    }

    // Safety net: if any room's centre isn't reachable from the first room after
    // the connector pass (a room jammed with no maze pocket beside it), force a
    // straight corridor from it to the nearest already-connected room. Guarantees
    // the hero can always reach the stairs regardless of maze gaps.
    _ensureRoomsConnected() {
        if (this.regions.length < 2) return
        const center = (r) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) })
        const reachableFrom = (start) => {
            const seen = new Set([`${start.x},${start.y}`])
            const q = [start]
            while (q.length) {
                const { x, y } = q.shift()
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy
                    if (!this.inBounds(nx, ny) || this.levelData[ny][nx] !== 0) continue
                    const k = `${nx},${ny}`
                    if (seen.has(k)) continue
                    seen.add(k); q.push({ x: nx, y: ny })
                }
            }
            return seen
        }
        let safety = this.regions.length + 2
        while (safety-- > 0) {
            const seen = reachableFrom(center(this.regions[0]))
            const stranded = this.regions.filter(r => {
                const c = center(r)
                return !seen.has(`${c.x},${c.y}`)
            })
            if (stranded.length === 0) break
            const connected = this.regions.filter(r => {
                const c = center(r)
                return seen.has(`${c.x},${c.y}`)
            })
            for (const r of stranded) {
                const [a, b] = this._nearestRoomPair([r], connected)
                if (a && b) this._carveCorridor(a, b)
            }
        }
    }

    // The closest (Manhattan, center-to-center) pair of rooms with one drawn
    // from each set — used by the connectivity safety net.
    _nearestRoomPair(setA, setB) {
        let best = [null, null]
        let bestDist = Infinity
        for (const a of setA) {
            for (const b of setB) {
                const d = this._roomDist(a, b)
                if (d < bestDist) { bestDist = d; best = [a, b] }
            }
        }
        return best
    }

    _roomDist(a, b) {
        const ax = a.x + a.w / 2, ay = a.y + a.h / 2
        const bx = b.x + b.w / 2, by = b.y + b.h / 2
        return Math.abs(ax - bx) + Math.abs(ay - by)
    }

    // Carve an L-shaped corridor between two room centers, `thickness` tiles
    // wide (1 by default — the connectivity safety net calls it un-widened). The
    // elbow orientation (horizontal-first vs vertical-first) is random, so
    // corridors vary instead of all bending the same way.
    _carveCorridor(a, b, thickness = 1) {
        const ax = Math.floor(a.x + a.w / 2)
        const ay = Math.floor(a.y + a.h / 2)
        const bx = Math.floor(b.x + b.w / 2)
        const by = Math.floor(b.y + b.h / 2)
        if (this.rng.chance(0.5)) {
            this._carveH(ax, bx, ay, thickness)
            this._carveV(ay, by, bx, thickness)
        } else {
            this._carveV(ay, by, ax, thickness)
            this._carveH(ax, bx, by, thickness)
        }
    }

    // Carve a horizontal run at row `y`, `thickness` tiles tall (centered on y).
    // Out-of-bounds tiles are skipped, so a wide run near the map edge is safe.
    _carveH(xa, xb, y, thickness = 1) {
        const lo = Math.min(xa, xb), hi = Math.max(xa, xb)
        const half = Math.floor((thickness - 1) / 2)
        for (let x = lo; x <= hi; x++) {
            for (let t = 0; t < thickness; t++) {
                const yy = y - half + t
                if (this.levelData[yy] && this.levelData[yy][x] !== undefined) this.levelData[yy][x] = 0
            }
        }
    }

    // Carve a vertical run at column `x`, `thickness` tiles wide (centered on x).
    _carveV(ya, yb, x, thickness = 1) {
        const lo = Math.min(ya, yb), hi = Math.max(ya, yb)
        const half = Math.floor((thickness - 1) / 2)
        for (let y = lo; y <= hi; y++) {
            for (let t = 0; t < thickness; t++) {
                const xx = x - half + t
                if (this.levelData[y] && this.levelData[y][xx] !== undefined) this.levelData[y][xx] = 0
            }
        }
    }

    addStairs() {
        const startRoom = this.regions.find(r => r.kind === "starting")
        const endRoom = this.regions.find(r => r.kind === "ending") || startRoom

        const stairsIn = (r) => ({
            x: this.rng.between(r.x + 1, r.x + r.w - 1),
            y: this.rng.between(r.y + 1, r.y + r.h - 1)
        })

        this.spawnPoints = {
            stairsUp: startRoom ? stairsIn(startRoom) : null,
            stairsDown: endRoom ? stairsIn(endRoom) : null
        }
    }

    // Called by World on every floor entry. Reads dungeon.player for
    // door-placement BFS and mapState.stairs.down for the "deepest floor
    // gets no doors" gate, both of which are set by dungeon.initialize
    // before this runs.
    populate(tm) {
        spawnFromTable(this.regions)
        rollElite()
        this.placeDoors(tm)
        this.placeTraps(tm)
    }

    // Scatter hidden dungeon traps across the floor (known-issues #47.2). Traps
    // are floor hazards that threaten the player AND wandering enemies (they
    // trigger on step via the shared hazard registry; they never block pathing).
    // Count scales with depth. Placed on corridor + combat-room floor tiles only
    // — never in safe/reward rooms (start/end/shop/rest/treasure/secret/
    // settlement), never near the player's spawn, never on an occupied tile
    // (door/stair/key/enemy/chest). Runs after placeDoors so those tiles exist.
    placeTraps(tm) {
        const player = dungeon.player
        if (!player) return

        const floor = mapState.levelManager.currentLevel
        const count = Math.min(3 + floor, 12)
        const SPAWN_SAFE_RADIUS = 3
        // A trap in the camp would undo the point of a sanctuary. "shop" and
        // "rest" are gone as kinds (merged into "camp", scope doc §10.11) and the
        // rest belong to rules removed from roomKinds.js — kept here only because
        // an extra name in this set costs nothing and a missing one costs a trap
        // in a safe room.
        const SAFE_KINDS = new Set([
            "starting", "ending", "camp", "treasure", "secret",
        ])

        const roomAt = (x, y) => this.regions.find(r =>
            x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null

        const level = this.levelData
        const candidates = []
        for (let y = 0; y < level.length; y++) {
            for (let x = 0; x < level[y].length; x++) {
                if (level[y][x] !== 0) continue   // walkable floor only
                if (Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) <= SPAWN_SAFE_RADIUS) continue
                const room = roomAt(x, y)
                if (room && SAFE_KINDS.has(room.kind)) continue
                if (mapState.entityAtTile(x, y)) continue
                candidates.push({ x, y })
            }
        }

        Phaser.Utils.Array.Shuffle(candidates)
        const n = Math.min(count, candidates.length)
        for (let i = 0; i < n; i++) {
            // Trap self-registers with tm + the hazard tile registry in its ctor.
            new Trap(candidates[i].x, candidates[i].y, randomTrapKey())
        }
    }

    placeDoors(tm) {
        if (!this.doorsEnabled) return
        const player = dungeon.player
        const stairsTile = mapState.stairs.down
        if (!player || !stairsTile) return

        const spawnX = player.x
        const spawnY = player.y

        const blocked = new Set()

        // Pre-pass: each secret room gets exactly one HiddenPassage at a
        // random perimeter candidate. The chosen tile (plus its neighbors)
        // goes into the blocked set so the regular door pass doesn't drop
        // a normal door on top of it.
        const secretRooms = new Set(this.regions.filter(r => r.kind === "secret"))
        for (const room of secretRooms) {
            const roomCandidates = this._findDoorwayCandidates(room)
                .filter(c => c.x !== spawnX || c.y !== spawnY)
                .filter(c => !mapState.entityAtTile(c.x, c.y))
                .filter(c => !this._isInsideAnotherRoom(c, room))
            if (roomCandidates.length === 0) continue
            const cand = Phaser.Utils.Array.GetRandom(roomCandidates)
            tm.addEntity(new HiddenPassage(cand.x, cand.y))
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    blocked.add(`${cand.x + dx},${cand.y + dy}`)
                }
            }
        }

        // Main doors go on the maze's recorded room↔corridor CONNECTORS
        // (this.doorways) — the actual openings — so a door IS the doorway rather than
        // sitting beside it. Skip the spawn tile, occupied tiles, and secret-room
        // hidden-passage tiles (blocked above); dedupe (loops can record a connector
        // twice) and block each pick's neighbours so two doors can't cluster on one
        // opening.
        const seenDoor = new Set()
        const candidates = []
        for (const cand of (this.doorways || [])) {
            const key = `${cand.x},${cand.y}`
            if (seenDoor.has(key)) continue
            seenDoor.add(key)
            if (blocked.has(key)) continue
            if (cand.x === spawnX && cand.y === spawnY) continue
            if (mapState.entityAtTile(cand.x, cand.y)) continue
            candidates.push(cand)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    blocked.add(`${cand.x + dx},${cand.y + dy}`)
                }
            }
        }

        // The maze produces FAR more doorway candidates than the old wide-corridor
        // layout — every room-to-maze connector is one (~40/floor on a full map vs a
        // handful before). Cap the total so doors stay meaningful instead of lining
        // every opening; shuffle first so survivors spread across the floor rather
        // than clustering in the rooms scanned first. ~0.4 doors per room.
        Phaser.Utils.Array.Shuffle(candidates)
        const maxDoors = Math.max(2, Math.ceil(this.regions.length * 0.4))
        const plans = []
        for (const cand of candidates) {
            if (plans.length >= maxDoors) break
            if (Math.random() < DOOR_PLACEMENT_RATE) {
                plans.push({
                    x: cand.x,
                    y: cand.y,
                    locked: Math.random() < LOCKED_DOOR_RATE
                })
            }
        }

        // Reachability fixup: ensure spawn can reach EVERY room through the locks —
        // not just the stairs. The maze carves many small pockets, so a locked door
        // whose key sits behind another lock could otherwise seal a room's chest away
        // entirely. While any room is unreachable, downgrade a random locked door to
        // closed-unlocked. (Guarantees no chest-in-a-room is ever unreachable.)
        let safety = 100
        while (safety > 0) {
            const lockedTiles = new Set(
                plans.filter(d => d.locked).map(d => `${d.x},${d.y}`)
            )
            if (this._allRoomsReachable(spawnX, spawnY, lockedTiles)) break
            const lockedIndices = plans
                .map((d, i) => (d.locked ? i : -1))
                .filter(i => i !== -1)
            if (lockedIndices.length === 0) break
            const pick = lockedIndices[Math.floor(Math.random() * lockedIndices.length)]
            plans[pick].locked = false
            safety--
        }

        for (const plan of plans) {
            tm.addEntity(new Door(plan.x, plan.y, plan.locked))
        }

        // Spawn one DungeonKey per surviving locked door, in a room not
        // guarded by any locked door's perimeter.
        const lockedPlans = plans.filter(d => d.locked)
        if (lockedPlans.length === 0) return

        const lockedRoomIndices = new Set()
        for (const ld of lockedPlans) {
            for (let i = 0; i < this.regions.length; i++) {
                if (this._isOnRoomPerimeter(ld, this.regions[i])) {
                    lockedRoomIndices.add(i)
                }
            }
        }
        const safeRooms = this.regions.filter((_, i) => !lockedRoomIndices.has(i))
        if (safeRooms.length === 0) return

        for (let i = 0; i < lockedPlans.length; i++) {
            const room = Phaser.Utils.Array.GetRandom(safeRooms)
            let attempts = 0
            let keyTile = null
            while (!keyTile && attempts < 50) {
                const tile = mapState.randomWalkableTileInRoom(room.x, room.y, room.w, room.h)
                if (!mapState.entityAtTile(tile.x, tile.y)) keyTile = tile
                attempts++
            }
            if (keyTile) {
                tm.addEntity(new DungeonKey(keyTile.x, keyTile.y))
            }
        }
    }

    _findDoorwayCandidates(room) {
        const candidates = []
        const level = this.levelData

        const isWallOrOOB = (x, y) => {
            if (y < 0 || y >= level.length) return true
            if (x < 0 || x >= level[0].length) return true
            return level[y][x] === 1
        }

        // Accept only candidates flanked by at least one wall on the corridor
        // side, so doors don't appear free-standing in wide-open spaces.
        const isFlanked = (perpA, perpB) =>
            isWallOrOOB(perpA.x, perpA.y) || isWallOrOOB(perpB.x, perpB.y)

        // Each scan accumulates corridor tiles (the tile one step outside
        // the room edge) for runs of edge tiles facing open space. The
        // midpoint of the run becomes the door candidate.
        const scanEdge = (positions, getOutsideTile, getPerpendicularTiles) => {
            let stretch = []
            const flush = () => {
                if (stretch.length === 0) return
                const mid = stretch[Math.floor(stretch.length / 2)]
                const [perpA, perpB] = getPerpendicularTiles(mid)
                if (isFlanked(perpA, perpB)) candidates.push(mid)
                stretch = []
            }
            for (const pos of positions) {
                const out = getOutsideTile(pos)
                const inBounds = out.y >= 0 && out.y < level.length
                    && out.x >= 0 && out.x < level[0].length
                if (inBounds && level[out.y][out.x] === 0) {
                    stretch.push(out)
                } else {
                    flush()
                }
            }
            flush()
        }

        const top = []
        for (let x = room.x; x < room.x + room.w; x++) top.push({ x, y: room.y })
        scanEdge(
            top,
            p => ({ x: p.x, y: p.y - 1 }),
            mid => [{ x: mid.x - 1, y: mid.y }, { x: mid.x + 1, y: mid.y }]
        )

        const bottom = []
        for (let x = room.x; x < room.x + room.w; x++) bottom.push({ x, y: room.y + room.h - 1 })
        scanEdge(
            bottom,
            p => ({ x: p.x, y: p.y + 1 }),
            mid => [{ x: mid.x - 1, y: mid.y }, { x: mid.x + 1, y: mid.y }]
        )

        const left = []
        for (let y = room.y; y < room.y + room.h; y++) left.push({ x: room.x, y })
        scanEdge(
            left,
            p => ({ x: p.x - 1, y: p.y }),
            mid => [{ x: mid.x, y: mid.y - 1 }, { x: mid.x, y: mid.y + 1 }]
        )

        const right = []
        for (let y = room.y; y < room.y + room.h; y++) right.push({ x: room.x + room.w - 1, y })
        scanEdge(
            right,
            p => ({ x: p.x + 1, y: p.y }),
            mid => [{ x: mid.x, y: mid.y - 1 }, { x: mid.x, y: mid.y + 1 }]
        )

        return candidates
    }

    // BFS over floor tiles from spawn, treating blockedSet tiles (locked doors) as
    // walls. Returns the set of reachable "x,y" keys.
    _bfsReached(spawnX, spawnY, blockedSet) {
        const level = this.levelData
        const visited = new Set([`${spawnX},${spawnY}`])
        const queue = [{ x: spawnX, y: spawnY }]
        while (queue.length > 0) {
            const { x, y } = queue.shift()
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx
                const ny = y + dy
                if (ny < 0 || ny >= level.length) continue
                if (nx < 0 || nx >= level[0].length) continue
                if (level[ny][nx] !== 0) continue
                const nk = `${nx},${ny}`
                if (blockedSet.has(nk) || visited.has(nk)) continue
                visited.add(nk)
                queue.push({ x: nx, y: ny })
            }
        }
        return visited
    }

    // True when every room has at least one floor tile reachable from spawn through
    // the given locked doors — guarantees no room (and thus no chest) is sealed off.
    _allRoomsReachable(spawnX, spawnY, blockedSet) {
        const reached = this._bfsReached(spawnX, spawnY, blockedSet)
        for (const room of this.regions) {
            let ok = false
            for (let y = room.y; y < room.y + room.h && !ok; y++) {
                for (let x = room.x; x < room.x + room.w && !ok; x++) {
                    if (this.levelData[y] && this.levelData[y][x] === 0 && reached.has(`${x},${y}`)) ok = true
                }
            }
            if (!ok) return false
        }
        return true
    }

    // Wide BSP corridors sometimes pass through neighbor rooms. Skip
    // candidates that fall inside one — a door floating inside a room
    // reads as a bug. Source room is excluded by construction (candidates
    // are always one step outside source.room).
    _isInsideAnotherRoom(cand, sourceRoom) {
        for (const r of this.regions) {
            if (r === sourceRoom) continue
            if (cand.x >= r.x && cand.x < r.x + r.w
                && cand.y >= r.y && cand.y < r.y + r.h) {
                return true
            }
        }
        return false
    }

    // A locked door at a corridor tile "guards" the room whose perimeter
    // it sits on. Used to keep keys from spawning behind their own door.
    _isOnRoomPerimeter(tile, room) {
        const onTop = tile.y === room.y - 1 && tile.x >= room.x && tile.x < room.x + room.w
        const onBottom = tile.y === room.y + room.h && tile.x >= room.x && tile.x < room.x + room.w
        const onLeft = tile.x === room.x - 1 && tile.y >= room.y && tile.y < room.y + room.h
        const onRight = tile.x === room.x + room.w && tile.y >= room.y && tile.y < room.y + room.h
        return onTop || onBottom || onLeft || onRight
    }
}
