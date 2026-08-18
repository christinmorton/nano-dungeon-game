import BaseLevel from './BaseLevel.js'
import Room from './Room.js'
import RNG from './rng.js'
import { MazeGrid, MAZE_ALGORITHMS } from './mazes.js'
import spawnFromTable, { rollElite } from './spawnFromTable.js'
import { assignRoomKinds as stampSpecialRoomKinds, fortressSelector, normalizeRoomKindMix } from './roomKinds.js'

// MazeLevel (design §17, the pure-labyrinth pole of §17.4) — a maze carved across
// the WHOLE floor with no BSP rooms, so the focus is corridors, not rooms. The
// up/down stairs sit in far-apart 3x3 pockets; a handful of small "pocket" rooms
// opened along the maze give spawnFromTable somewhere to place enemies and loot
// (a 1-wide corridor is a poor spawn tile). Reuses the proven mazes.js core
// (MazeGrid + MAZE_ALGORITHMS) — the same carving BSPLevel's rooms-and-mazes mode
// uses, but over the entire grid instead of only the space between rooms.
//
// Contrast with BSPLevel corridorStyle:'maze' (rooms-and-mazes / Nystrom): that
// places a room in EVERY BSP leaf and mazes the gaps — a roomy dungeon with
// twisty halls. MazeLevel is the opposite end (room-density = 0): labyrinth
// first, rooms none. A future room-density knob (§17.4) selects between the two.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Round a dimension down to an ODD size (min 7). Odd dims keep every outer-ring
// cell on an even coordinate, and the maze lattice only carves odd coordinates,
// so the border stays solid wall with no passage flush to the floor's edge.
function toOdd(n) {
    n = n | 0
    if (n < 7) n = 7
    return n % 2 === 0 ? n - 1 : n
}

export default class MazeLevel extends BaseLevel {
    constructor(config) {
        super(config)
        // Tileset theme (§14.2/§15.10) MapState.bind reads to paint this floor,
        // and the furnisher's prop palette (§14.5) — both threaded in by MapState.
        this.theme = config.theme || null
        this.propPalette = config.propPalette || null
        // Doorless (parity with the BSP/authored default while door placement is
        // reworked); the maze guarantees connectivity so no doors are needed.
        this.doorsEnabled = false
        // Not a BSP level — getTree() returns null; World's spawn path uses rooms
        // (kind === "starting"), not the tree, so null is safe (see AuthoredLevel).
        this.tree = null
        this.rng = new RNG(config.seed != null ? config.seed : 'maze')
        // Fraction of dead-ends to soften into loops. 0 = a perfect maze (every
        // dead-end kept — the most labyrinthine); higher = loopier / faster to
        // traverse. Default LOW so it reads as a real labyrinth (the whole point).
        this.braid = config.braid != null ? config.braid : 0.15
        this.algorithm = config.mazeAlgorithm || 'recursiveBacktracker'
        // Rooms threaded THROUGH the maze (§17 slice 2). 0 = pure labyrinth (just
        // a couple of small spawn alcoves); higher = more and larger chambers
        // carved into the maze — "rooms in a maze" without leaving this generator
        // (the BSPLevel rooms-and-mazes look is deliberately not used). 0..100.
        const rd = Number(config.roomDensity)
        this.roomDensity = Number.isFinite(rd) ? Math.max(0, Math.min(100, rd)) : 0
        // Enemy population (§17 follow-up): the designer's dungeon-wide enemy pool
        // + mode + this floor's default stance, mirrored onto the maze's rooms so
        // spawnFromTable draws the authored species / disposition (same seam as
        // AuthoredLevel._toProcRoom). See _applyPopulation for the one deliberate
        // divergence (an empty pool does NOT force-empty a maze floor).
        this.dungeonPool = Array.isArray(config.dungeonPool)
            ? config.dungeonPool.filter(x => typeof x === 'string') : []
        this.poolMode = config.poolMode === 'random' ? 'random' : 'authored'
        this.defaultStance = config.defaultStance || ''
        // Authored special-room mix (levels/roomKinds.js); absent = table defaults.
        this.roomKindMix = normalizeRoomKindMix(config.roomKinds)
        this.width = toOdd((config.width | 0) || 41)
        this.height = toOdd((config.height | 0) || 31)
        this.generate()
    }

    inBounds(x, y) { return y >= 0 && y < this.height && x >= 0 && x < this.width }

    generate() {
        // 1. All-wall grid, then carve a maze across the whole thing (no blocked
        //    cells — the border stays wall because odd dims keep it off-lattice).
        const grid = Array.from({ length: this.height }, () => Array(this.width).fill(1))
        const blocked = Array.from({ length: this.height }, () => Array(this.width).fill(false))
        const mg = new MazeGrid(grid, blocked, this.rng)
        const algo = MAZE_ALGORITHMS[this.algorithm] || MAZE_ALGORITHMS.recursiveBacktracker
        algo(mg, this.rng)
        // 2. Braid: soften some dead-ends into loops (low by default).
        this._braid(grid)
        this.levelData = grid

        // 3. Carved cells in the safe interior (room for a 3x3 pocket without
        //    touching the border ring).
        const inset = []
        for (let y = 2; y <= this.height - 3; y++) {
            for (let x = 2; x <= this.width - 3; x++) {
                if (grid[y][x] === 0) inset.push({ x, y })
            }
        }
        // Degenerate tiny-floor guard: ensure at least one interior cell exists.
        if (!inset.length) {
            const x = Math.floor(this.width / 2), y = Math.floor(this.height / 2)
            grid[y][x] = 0
            inset.push({ x, y })
        }

        // 4. Start near the top-left, end near the bottom-right (far apart), each
        //    a 3x3 pocket so the stairs sit in a small chamber (a 1x1 "ending"
        //    would spawn its 2-3 guards on top of the down-stair).
        const start = this._nearest(inset, 2, 2)
        let end = this._nearest(inset, this.width - 3, this.height - 3)
        if (end.x === start.x && end.y === start.y) {
            end = this._nearest(inset.filter(c => c.x !== start.x || c.y !== start.y), this.width - 3, this.height - 3) || start
        }

        this.regions = []
        this._carvePocket(grid, start.x, start.y)
        this._carvePocket(grid, end.x, end.y)
        this.regions.push(new Room(start.x - 1, start.y - 1, 3, 3, 'starting'))
        this.regions.push(new Room(end.x - 1, end.y - 1, 3, 3, 'ending'))

        // 5. 'combat' rooms carved along the maze so enemies/loot spawn in
        //    chambers instead of 1-wide halls. Count + size scale with roomDensity
        //    (0 = a couple of small alcoves = pure labyrinth).
        this._addRooms(grid, inset, start, end)

        // 5b. Roll the dungeon's special-room mix over the carved chambers, so a
        //     maze floor can hold a treasure vault or a rest camp like any other
        //     floor. Only 'combat' chambers are eligible — the start/end pockets
        //     are stairs. Without this the designer's room-kind knobs would
        //     silently do nothing on maze floors.
        stampSpecialRoomKinds({
            rooms: this.regions,
            rng: this.rng,
            mix: this.roomKindMix,
            isEligible: (room) => room.kind === 'combat',
            selectors: { fortress: fortressSelector(this.width, this.height) },
        })

        // 6. Wire the designer's enemy pool + stance onto the populated rooms
        //    (every room except the player's start). See _applyPopulation.
        for (const r of this.regions) {
            if (r.kind === 'starting') continue   // player spawn — never populate
            this._applyPopulation(r)
        }

        // 7. Stairs at the pocket centers (edge-awareness — no up on floor 0, no
        //    down on the last floor — is applied by LevelManager.getStairs).
        this.spawnPoints = {
            stairsUp: { x: start.x, y: start.y },
            stairsDown: { x: end.x, y: end.y },
        }
    }

    populate(tm) {
        spawnFromTable(this.regions)
        rollElite()
    }

    // Mirror the designer's dungeon-wide enemy pool + this floor's default stance
    // onto a room so spawnFromTable draws the authored species/disposition — the
    // same fields AuthoredLevel._toProcRoom sets (enemyMix/authoredPool/stance).
    // DELIBERATE DIVERGENCE from AuthoredLevel: an EMPTY pool does NOT force the
    // room empty (no `authoredPool`/`enemyCount=0`), so a maze with no authored
    // pool keeps the default spawn-table enemies. A maze has no per-room enemy
    // authoring to fall back on, so force-emptying it would just make it barren.
    _applyPopulation(room) {
        if (this.defaultStance) room.stance = this.defaultStance
        if (this.poolMode === 'authored' && this.dungeonPool.length) {
            room.enemyMix = this.dungeonPool.slice()
            room.authoredPool = true   // draw only from the pool, no random fill
        }
    }

    // ---- helpers -----------------------------------------------------------

    // The cell in `cells` closest (Manhattan) to (tx, ty).
    _nearest(cells, tx, ty) {
        let best = cells[0], bestD = Infinity
        for (const c of cells) {
            const d = Math.abs(c.x - tx) + Math.abs(c.y - ty)
            if (d < bestD) { bestD = d; best = c }
        }
        return best
    }

    // Open a 3x3 block of floor centered on (cx, cy). The center is already a maze
    // passage, so the pocket stays connected; carving only adds floor.
    _carvePocket(grid, cx, cy) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                grid[cy + dy][cx + dx] = 0
            }
        }
    }

    // Carve 'combat' chambers along the maze, centered on random interior cells,
    // spaced from the start/end pockets and each other. Count and size scale with
    // roomDensity (§17 slice 2): 0 = a couple of small 3x3 alcoves (pure
    // labyrinth); 100 = many rooms up to ~7x7 threaded through the maze. Each
    // chamber's center is already a maze passage, so carving only adds floor and
    // never disconnects the labyrinth.
    _addRooms(grid, inset, start, end) {
        const area = this.width * this.height
        const d = this.roomDensity   // 0..100
        const base = Math.max(2, Math.min(6, Math.floor(area / 400)))
        const bonus = Math.floor((d / 100) * (area / 250))
        const target = Math.min(base + bonus, Math.floor(area / 120))
        const maxHalf = Math.round((d / 100) * 3)   // half-extent bonus: 0..3 → up to 7x7
        const centers = [start, end]   // keep new chambers clear of these
        const far = (c, p, min) => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) >= min
        let tries = 0
        while (this.regions.length - 2 < target && tries < target * 40) {
            tries++
            const c = this.rng.pick(inset)
            const hx = 1 + (maxHalf > 0 ? this.rng.between(0, maxHalf) : 0)
            const hy = 1 + (maxHalf > 0 ? this.rng.between(0, maxHalf) : 0)
            // Fit inside the wall ring + stay spaced from existing rooms.
            if (c.x - hx < 1 || c.y - hy < 1 || c.x + hx > this.width - 2 || c.y + hy > this.height - 2) continue
            const spacing = Math.max(hx, hy) + 3
            if (!centers.every(p => far(c, p, spacing))) continue
            for (let dy = -hy; dy <= hy; dy++) {
                for (let dx = -hx; dx <= hx; dx++) grid[c.y + dy][c.x + dx] = 0
            }
            this.regions.push(new Room(c.x - hx, c.y - hy, hx * 2 + 1, hy * 2 + 1, 'combat'))
            centers.push(c)
        }
    }

    // Braid: for each dead-end (a passage with one carved neighbour), with `braid`
    // probability open a wall to a passage 2 cells out, turning it into a loop.
    // Mirrors BSPLevel._braidMaze but over the whole grid (no room ring to avoid),
    // and never touches the outer ring (guards keep it in [1, dim-2]).
    _braid(grid) {
        if (!(this.braid > 0)) return
        const deadEnds = []
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (grid[y][x] !== 0) continue
                let n = 0
                for (const [dx, dy] of DIRS) if (grid[y + dy][x + dx] === 0) n++
                if (n === 1) deadEnds.push({ x, y })
            }
        }
        for (const d of deadEnds) {
            if (!this.rng.chance(this.braid)) continue
            for (const [dx, dy] of this.rng.shuffle(DIRS.slice())) {
                const wx = d.x + dx, wy = d.y + dy, fx = d.x + dx * 2, fy = d.y + dy * 2
                if (wx < 1 || wy < 1 || wx >= this.width - 1 || wy >= this.height - 1) continue
                if (grid[wy][wx] === 1 && this.inBounds(fx, fy) && grid[fy][fx] === 0) {
                    grid[wy][wx] = 0
                    break
                }
            }
        }
    }
}
