// Tile-native maze-carving components, ported from the v1/v2 maze library
// (code/v1|v2/src/algorithms). Each algorithm carves a maze into the WALL space
// of a tile grid on the odd-coordinate lattice — passages at odd cells, walls
// between them — matching how the roguelike stores levels (0 = floor, 1 = wall).
//
// The archive algorithms operate on a Cell/Grid graph where a cell is "visited"
// once it has a link. The tile-native mapping is direct: "visited" == "carved
// (floor)"; a cell's linkable neighbours == the 2-away lattice cells still walled
// and not blocked; link(a, b) == carve the wall between + carve b.
//
// Region assignment is intentionally NOT done here — the caller flood-fills the
// carved tiles into regions afterwards. That keeps every algorithm region-
// agnostic and reusable for both between-room corridor fill (BSPLevel) and a
// future whole-floor maze level.
//
// Every algorithm fills EVERY reachable pocket of available lattice cells and is
// robust to the irregular negative space around BSP rooms (it only touches tiles
// flagged available via the `blocked` mask). Grid-oriented algorithms that assume
// a full rectangular grid (Binary Tree, Sidewinder, Eller's) are deliberately not
// here yet — they can strand isolated cells in irregular space and better suit a
// whole-floor maze level.

const DIRS = [[0, -2], [0, 2], [-2, 0], [2, 0]]

// A thin view over a level's tile grid that exposes the lattice operations the
// maze algorithms need. `grid` is the 0/1 tile array (mutated in place); `blocked`
// is a same-shape boolean mask of tiles the maze must not touch (room interiors +
// their one-tile border ring).
export class MazeGrid {
    constructor(grid, blocked, rng) {
        this.grid = grid
        this.blocked = blocked
        this.rng = rng
        this.rows = grid.length
        this.cols = grid[0].length
        // Available lattice cells (odd coords, not blocked), precomputed once so
        // Hunt-and-Kill's repeated scans don't rebuild the list.
        this.seeds = []
        for (let y = 1; y < this.rows; y += 2) {
            for (let x = 1; x < this.cols; x += 2) {
                if (!this.blocked[y][x]) this.seeds.push({ x, y })
            }
        }
    }

    inBounds(x, y) { return y >= 0 && y < this.rows && x >= 0 && x < this.cols }
    isCarved(x, y) { return this.grid[y][x] === 0 }

    // 2-away lattice neighbours still WALL and carveable (neighbour + the wall
    // between are not blocked).
    uncarvedNeighbors(x, y) {
        const out = []
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, wx = x + dx / 2, wy = y + dy / 2
            if (!this.inBounds(nx, ny)) continue
            if (this.grid[ny][nx] !== 1 || this.blocked[ny][nx]) continue
            if (this.blocked[wy][wx]) continue
            out.push({ x: nx, y: ny })
        }
        return out
    }

    // 2-away lattice neighbours already CARVED and reachable (wall between
    // carveable) — used by Hunt-and-Kill's hunt phase to rejoin the maze.
    carvedNeighbors(x, y) {
        const out = []
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, wx = x + dx / 2, wy = y + dy / 2
            if (!this.inBounds(nx, ny)) continue
            if (this.grid[ny][nx] !== 0 || this.blocked[ny][nx]) continue
            if (this.blocked[wy][wx]) continue
            out.push({ x: nx, y: ny })
        }
        return out
    }

    // 2-away lattice neighbours that are AVAILABLE (not blocked, wall between
    // carveable) regardless of carved state — for edge enumeration (Kruskal's).
    availableNeighbors(x, y) {
        const out = []
        for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, wx = x + dx / 2, wy = y + dy / 2
            if (!this.inBounds(nx, ny)) continue
            if (this.blocked[ny][nx]) continue
            if (this.blocked[wy][wx]) continue
            out.push({ x: nx, y: ny })
        }
        return out
    }

    carveCell(x, y) { this.grid[y][x] = 0 }

    // Carve the wall between two adjacent (2-away) lattice cells.
    carveWall(ax, ay, bx, by) {
        this.grid[(ay + by) / 2][(ax + bx) / 2] = 0
    }

    // Link a -> b: carve the wall between + b itself.
    link(ax, ay, bx, by) {
        this.carveWall(ax, ay, bx, by)
        this.grid[by][bx] = 0
    }
}

// --- Growing Tree (the meta-algorithm) --------------------------------------
// The cell picked from the active set decides the character: newest = Recursive
// Backtracker (long winding corridors, few junctions), random = Prim's (short,
// bushy, many junctions), oldest = a radial feel, mix = a blend of the two.
function pickIndex(active, mode, rng) {
    if (mode === 'newest') return active.length - 1
    if (mode === 'oldest') return 0
    const rand = rng.between(0, active.length - 1)
    if (mode === 'mix') return rng.chance(0.5) ? active.length - 1 : rand
    return rand // 'random'
}

function growingTree(mg, rng, mode) {
    for (const seed of mg.seeds) {
        if (mg.isCarved(seed.x, seed.y)) continue
        mg.carveCell(seed.x, seed.y)
        const active = [seed]
        while (active.length) {
            const i = pickIndex(active, mode, rng)
            const cell = active[i]
            const nbrs = mg.uncarvedNeighbors(cell.x, cell.y)
            if (nbrs.length) {
                const n = rng.pick(nbrs)
                mg.link(cell.x, cell.y, n.x, n.y)
                active.push(n)
            } else {
                active.splice(i, 1)
            }
        }
    }
}

export function recursiveBacktracker(mg, rng) { growingTree(mg, rng, 'newest') }
export function prims(mg, rng) { growingTree(mg, rng, 'random') }
export function growingTreeMix(mg, rng) { growingTree(mg, rng, 'mix') }

// --- Hunt and Kill ----------------------------------------------------------
// Walk carving until boxed in, then "hunt" the grid for the first uncarved cell
// adjacent to the carved maze and resume there. Long corridors like Recursive
// Backtracker but with a distinct, less spiral texture.
export function huntAndKill(mg, rng) {
    for (const seed of mg.seeds) {
        if (mg.isCarved(seed.x, seed.y)) continue
        let current = seed
        mg.carveCell(current.x, current.y)
        while (current) {
            const nbrs = mg.uncarvedNeighbors(current.x, current.y)
            if (nbrs.length) {
                const n = rng.pick(nbrs)
                mg.link(current.x, current.y, n.x, n.y)
                current = n
            } else {
                current = null
                for (const cell of mg.seeds) {
                    if (mg.isCarved(cell.x, cell.y)) continue
                    const carved = mg.carvedNeighbors(cell.x, cell.y)
                    if (carved.length) {
                        current = cell
                        mg.carveCell(cell.x, cell.y)
                        const n = rng.pick(carved)
                        mg.carveWall(cell.x, cell.y, n.x, n.y)
                        break
                    }
                }
            }
        }
    }
}

// --- Kruskal's --------------------------------------------------------------
// Edge-based: shuffle every wall between adjacent cells, knock a wall down only
// when it joins two not-yet-connected regions (union-find). Produces a UNIFORM
// spanning tree — a very even, "no personality" maze with a distinctive texture
// vs the growing family. (Wilson's and Aldous-Broder produce the SAME uniform
// distribution, just slower, so this one algorithm represents that whole family.)
// Cells never linked stay walls, so it leaves no isolated one-tile islands.
export function kruskals(mg, rng) {
    const parent = new Map()
    for (const c of mg.seeds) parent.set(`${c.x},${c.y}`, `${c.x},${c.y}`)
    const find = (k) => {
        while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k) }
        return k
    }
    const edges = []
    for (const c of mg.seeds) {
        const ak = `${c.x},${c.y}`
        for (const n of mg.availableNeighbors(c.x, c.y)) {
            const bk = `${n.x},${n.y}`
            if (ak < bk) edges.push([c, n])   // dedupe each undirected edge
        }
    }
    rng.shuffle(edges)
    for (const [a, b] of edges) {
        const ra = find(`${a.x},${a.y}`), rb = find(`${b.x},${b.y}`)
        if (ra === rb) continue
        mg.carveCell(a.x, a.y)
        mg.carveCell(b.x, b.y)
        mg.carveWall(a.x, a.y, b.x, b.y)
        parent.set(ra, rb)
    }
}

// --- True Prim's ------------------------------------------------------------
// Prim's with per-cell random costs: always expand from the lowest-cost frontier
// cell to its lowest-cost unvisited neighbour. Gives a more ORGANIC, meandering
// branch pattern than Simplified Prim's (the random-pick `prims` above).
export function truePrims(mg, rng) {
    const cost = new Map()
    for (const c of mg.seeds) cost.set(`${c.x},${c.y}`, rng.between(0, 99))
    const costOf = (c) => cost.get(`${c.x},${c.y}`)
    for (const seed of mg.seeds) {
        if (mg.isCarved(seed.x, seed.y)) continue
        mg.carveCell(seed.x, seed.y)
        const active = [seed]
        while (active.length) {
            let best = 0
            for (let i = 1; i < active.length; i++) if (costOf(active[i]) < costOf(active[best])) best = i
            const cell = active[best]
            const nbrs = mg.uncarvedNeighbors(cell.x, cell.y)
            if (nbrs.length) {
                let n = nbrs[0]
                for (const cand of nbrs) if (costOf(cand) < costOf(n)) n = cand
                mg.link(cell.x, cell.y, n.x, n.y)
                active.push(n)
            } else {
                active.splice(best, 1)
            }
        }
    }
}

// Registry — the names BSPLevel / MapState select by. Add new algorithms here.
export const MAZE_ALGORITHMS = {
    recursiveBacktracker,
    prims,
    huntAndKill,
    growingTreeMix,
    kruskals,
    truePrims,
}

export const MAZE_ALGORITHM_KEYS = Object.keys(MAZE_ALGORITHMS)
