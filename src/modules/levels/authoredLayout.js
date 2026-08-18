// authoredLayout.js — the SHARED, engine-free geometry generator for the
// dungeon-designer skeleton (design doc §15.3: "one build path, two callers").
//
// The designer's fill preview and the in-game AuthoredLevel MUST produce the
// same geometry or the author is tuning against a lie. So the corridor/proc-room
// math lives here as pure functions, called by BOTH:
//   - DesignerScene.generateFill()  (preview overlay)
//   - AuthoredLevel.generate()      (the playable floor)
//
// This module has NO Phaser and NO DOM dependency — it reads plain data
// (voidSize, areas, routePoints) plus a seed and a style object, and returns
// plain data (a Set of corridor tiles, the procedural rooms, a status string).
// The two seams the designer keeps to itself are the seed-lock UI and the
// style-knob UI (it passes their resolved values in) and the drawing.
//
// The algorithm is a straight extraction of the designer's generateFill:
//   Phase 1 route the authored skeleton (rooms + route-point links + door-to-door
//           + connectivity), Phase 2 place procedural rooms clear of that, Phase 3
//           integrate them, then a width dilation post-pass. See the designer's
//           project log (memory project_v3_dungeon_archetype_system) for history.

import RNG, { hashSeed } from './rng.js'

// ---- tile-key codecs (mirror DesignerScene's module helpers) ---------------
const key = (x, y) => `${x},${y}`
const parseCell = (k) => { const i = k.indexOf(","); return [+k.slice(0, i), +k.slice(i + 1)] }
const openKey = (x, y, side) => `${x},${y},${side}`
const parseOpen = (k) => { const p = k.split(","); return { x: +p[0], y: +p[1], side: p[2] } }
const SIDE_STEP = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }

// Style defaults when a skeleton omits corridorStyle (matches the designer's
// UI fallbacks in corridorStyle()).
export const DEFAULT_STYLE = { straight: 40, wander: 30, width: 1, rooms: false, roomCount: 6 }

// Keep procedural fill (corridors + proc-room width dilation + opening exits)
// this many tiles off the void boundary, so the outermost ring always stays
// wall. A corridor flush to the edge has no wall beyond it and reads as a
// "cut off" map. Authored areas are the author's own responsibility and are
// NOT clamped here — this only constrains the generated fill.
const EDGE_MARGIN = 1

// Binary min-heap keyed on `.cost` — the router's priority queue. Copied from
// DesignerScene (module-level, already pure).
class MinHeap {
    constructor() { this.a = [] }
    get size() { return this.a.length }
    push(item) {
        const a = this.a; a.push(item); let i = a.length - 1
        while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= a[i].cost) break;[a[p], a[i]] = [a[i], a[p]]; i = p }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop()
        if (a.length) {
            a[0] = last; let i = 0; const n = a.length
            for (; ;) {
                const l = i * 2 + 1, r = l + 1; let s = i
                if (l < n && a[l].cost < a[s].cost) s = l
                if (r < n && a[r].cost < a[s].cost) s = r
                if (s === i) break;[a[s], a[i]] = [a[i], a[s]]; i = s
            }
        }
        return top
    }
}

// Every tile in a rect area, as [x,y] pairs.
function rectCells(a) {
    const out = []
    for (let y = a.y; y < a.y + a.h; y++)
        for (let x = a.x; x < a.x + a.w; x++) out.push([x, y])
    return out
}

// Recompute a freeform area's bounding box (x/y/w/h) from its `cells` Set.
function recomputeBBox(a) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of a.cells) {
        const [cx, cy] = parseCell(c)
        if (cx < minX) minX = cx; if (cy < minY) minY = cy
        if (cx > maxX) maxX = cx; if (cy > maxY) maxY = cy
    }
    a.x = minX; a.y = minY; a.w = maxX - minX + 1; a.h = maxY - minY + 1
}

// Weighted router (Dijkstra) over void tiles — cheapest orthogonal path from any
// start tile to the first tile where goal(x,y) is true. Cost to ENTER a tile is
// 1 + jitter(tile) + (turnPenalty if the path changes direction). State is
// direction-aware so the turn cost is meaningful. Returns the path (goal-first),
// or null if unreachable. `voidSize` supplies the bounds.
function routePathWeighted(voidSize, starts, goal, isBlocked, jitter, turnPenalty = 0) {
    const V = voidSize
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    const dist = new Map(), prev = new Map(), done = new Set()
    const heap = new MinHeap()
    const skey = (k, d) => `${k}|${d}`   // state = tile + incoming direction
    for (const s of starts) {
        if (s.x < EDGE_MARGIN || s.y < EDGE_MARGIN || s.x >= V.w - EDGE_MARGIN || s.y >= V.h - EDGE_MARGIN) continue
        if (isBlocked(s.x, s.y)) continue
        const sk = skey(key(s.x, s.y), -1)
        if (dist.has(sk)) continue
        dist.set(sk, 0); heap.push({ cost: 0, x: s.x, y: s.y, dir: -1, sk })
    }
    while (heap.size) {
        const t = heap.pop()
        if (done.has(t.sk)) continue
        done.add(t.sk)
        if (goal(t.x, t.y)) {
            const path = []; let sk = t.sk
            while (sk !== undefined) { const b = sk.lastIndexOf("|"); const [x, y] = parseCell(sk.slice(0, b)); path.push({ x, y }); sk = prev.get(sk) }
            return path
        }
        for (let d = 0; d < 4; d++) {
            const nx = t.x + DIRS[d][0], ny = t.y + DIRS[d][1]
            if (nx < EDGE_MARGIN || ny < EDGE_MARGIN || nx >= V.w - EDGE_MARGIN || ny >= V.h - EDGE_MARGIN) continue
            if (isBlocked(nx, ny)) continue
            const nsk = skey(key(nx, ny), d)
            if (done.has(nsk)) continue
            const turn = (t.dir !== -1 && d !== t.dir) ? turnPenalty : 0
            const nd = t.cost + 1 + jitter(nx, ny) + turn
            if (nd < (dist.has(nsk) ? dist.get(nsk) : Infinity)) {
                dist.set(nsk, nd); prev.set(nsk, t.sk); heap.push({ cost: nd, x: nx, y: ny, dir: d, sk: nsk })
            }
        }
    }
    return null
}

// Give a rect room 1–2 openings on random perimeter edges.
function autoOpenings(r, rng) {
    const n = rng.between(1, 2)
    for (let i = 0; i < n; i++) {
        const side = rng.pick(["n", "s", "e", "w"])
        let x, y
        if (side === "n") { x = rng.between(r.x, r.x + r.w - 1); y = r.y }
        else if (side === "s") { x = rng.between(r.x, r.x + r.w - 1); y = r.y + r.h - 1 }
        else if (side === "w") { x = r.x; y = rng.between(r.y, r.y + r.h - 1) }
        else { x = r.x + r.w - 1; y = rng.between(r.y, r.y + r.h - 1) }
        r.openings.add(openKey(x, y, side))
    }
}

// Rejection-sample up to `count` non-overlapping rect rooms into empty void,
// clear of authored areas, already-carved corridors, and each other (1-tile
// buffer). Each gets 1–2 auto openings so it connects through the same
// opening-anchored router. `avoidTiles` = corridor tiles to keep clear of.
function genProcRooms(voidSize, areas, rng, count, avoidTiles) {
    const V = voidSize
    const MINSZ = 4, MAXSZ = 8, BUF = 1
    const occ = new Set()
    const block = (x, y) => { for (let dy = -BUF; dy <= BUF; dy++) for (let dx = -BUF; dx <= BUF; dx++) occ.add(key(x + dx, y + dy)) }
    for (const a of areas) {
        const cells = a.shape === "free" ? [...a.cells].map(parseCell) : rectCells(a)
        for (const [x, y] of cells) block(x, y)
    }
    if (avoidTiles) for (const k of avoidTiles) { const [x, y] = parseCell(k); block(x, y) }
    const fits = (x, y, w, h) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (occ.has(key(xx, yy))) return false
        return true
    }
    const out = []
    let attempts = Math.max(40, count * 40)
    while (out.length < count && attempts-- > 0) {
        const w = rng.between(MINSZ, MAXSZ), h = rng.between(MINSZ, MAXSZ)
        if (w + 2 * BUF >= V.w || h + 2 * BUF >= V.h) continue
        const x = rng.between(BUF, V.w - w - BUF), y = rng.between(BUF, V.h - h - BUF)
        if (!fits(x, y, w, h)) continue
        const room = { id: -(out.length + 1), name: `Room ${out.length + 1}`, kind: "", shape: "rect", walled: true, x, y, w, h, openings: new Set() }
        autoOpenings(room, rng)
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) block(xx, yy)
        out.push(room)
    }
    return out
}

// The shared generator. Produces the corridor tiles + procedural rooms for an
// authored skeleton. A verbatim port of DesignerScene.generateFill with the DOM
// (seed lock + style knobs) and drawing lifted out: the seed and style come in
// as arguments, and instead of calling drawFill()/setFillStatus() it RETURNS the
// data + a status string. `areas` and `routePoints` are the in-memory shape
// (openings/cells as Sets — see hydrateSkeleton). authored `areas` are read, not
// mutated; the returned `procRooms` are freshly made here.
export function generateLayout({ voidSize, areas, routePoints = [], seed = 0, style = DEFAULT_STYLE }) {
    const V = voidSize
    const rng = new RNG(seed)
    const turnPenalty = style.straight / 100 * 3.0
    const JITTER = style.wander / 100 * 3.0
    const jcache = new Map()
    const jitter = (x, y) => {
        const k = key(x, y); let v = jcache.get(k)
        if (v === undefined) { v = (hashSeed(`${seed}:${k}`) >>> 0) / 4294967296 * JITTER; jcache.set(k, v) }
        return v
    }

    const interior = new Set(), owner = new Map()   // "x,y" -> room object
    const inInterior = (x, y) => interior.has(key(x, y))
    const addInterior = (r) => {
        const cells = r.shape === "free" ? [...r.cells] : rectCells(r).map(([x, y]) => key(x, y))
        for (const c of cells) { interior.add(c); owner.set(c, r) }
    }
    const parent = new Map()
    const find = (n) => {
        if (!parent.has(n)) { parent.set(n, n); return n }
        let root = n; while (parent.get(root) !== root) root = parent.get(root)
        while (parent.get(n) !== root) { const nx = parent.get(n); parent.set(n, root); n = nx }
        return root
    }
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
    const RID = (room) => "R" + room.id, PID = (id) => "P" + id

    let carved = new Set(), routed = 0
    const avoidCarved = (x, y) => interior.has(key(x, y)) || carved.has(key(x, y))
    const connect = (starts, goal) => {
        let path = routePathWeighted(V, starts, goal, avoidCarved, jitter, turnPenalty)
        if (!path) path = routePathWeighted(V, starts, goal, inInterior, jitter, turnPenalty)
        if (!path) return null
        for (const t of path) carved.add(key(t.x, t.y))
        return path[0]
    }
    const carveSeg = (from, to) => {
        const goal = (x, y) => x === to.x && y === to.y
        const path = routePathWeighted(V, [from], goal, inInterior, jitter, turnPenalty)
        if (!path) return false
        for (const t of path) carved.add(key(t.x, t.y))
        return true
    }

    const openingTiles = new Map(), roomOpen = new Map()
    let unusableOpenings = 0, roomsNoOpenings = 0
    const registerOpenings = (roomList) => {
        const added = []
        for (const r of roomList) {
            if (!roomOpen.has(r)) roomOpen.set(r, [])
            if (!r.openings || !r.openings.size) { roomsNoOpenings++; continue }
            for (const k of r.openings) {
                const o = parseOpen(k), step = SIDE_STEP[o.side]
                if (!step) { unusableOpenings++; continue }
                const ox = o.x + step[0], oy = o.y + step[1]
                if (ox < EDGE_MARGIN || oy < EDGE_MARGIN || ox >= V.w - EDGE_MARGIN || oy >= V.h - EDGE_MARGIN) { unusableOpenings++; continue }
                const tk = key(ox, oy)
                if (interior.has(tk)) {                 // faces into a room
                    const other = owner.get(tk)
                    if (other && other !== r) union(RID(r), RID(other))   // shared doorway
                    else unusableOpenings++
                    continue
                }
                if (!openingTiles.has(tk)) openingTiles.set(tk, new Set())
                openingTiles.get(tk).add(r)
                roomOpen.get(r).push({ x: ox, y: oy })
                added.push({ room: r, openStr: k, x: ox, y: oy })
            }
        }
        return added
    }
    const routeOpenings = (list, skip) => {
        let ok = 0, fail = 0
        for (const op of rng.shuffle(list.slice())) {
            if (skip && skip(op)) continue
            const r = op.room
            const goal = (x, y) => { const s = openingTiles.get(key(x, y)); if (!s) return false; for (const other of s) if (other !== r) return true; return false }
            const g = connect([{ x: op.x, y: op.y }], goal)
            if (g) { ok++; const s = openingTiles.get(key(g.x, g.y)); for (const other of s) if (other !== r) { union(RID(r), RID(other)); break } }
            else fail++
        }
        return { ok, fail }
    }
    const connectivity = (roomList) => {
        let ok = 0, guard = roomList.length + 2
        while (guard-- > 0) {
            if (new Set(roomList.map(r => find(RID(r)))).size <= 1) break
            let pick = null
            for (let a = 0; a < roomList.length; a++) for (let b = a + 1; b < roomList.length; b++) {
                const ra = roomList[a], rb = roomList[b], oa = roomOpen.get(ra), ob = roomOpen.get(rb)
                if (find(RID(ra)) === find(RID(rb)) || !oa || !oa.length || !ob || !ob.length) continue
                for (const pa of oa) for (const pb of ob) {
                    const d = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y)
                    if (!pick || d < pick.d) pick = { a, b, d }
                }
            }
            if (!pick) break
            const ra = roomList[pick.a], rb = roomList[pick.b]
            const bTiles = new Set(roomOpen.get(rb).map(t => key(t.x, t.y)))
            if (connect(roomOpen.get(ra), (x, y) => bTiles.has(key(x, y)))) ok++
            union(RID(ra), RID(rb))
        }
        return ok
    }

    // === PHASE 1: route the AUTHORED skeleton (rooms + route points) ========
    const authored = areas
    for (const r of authored) addInterior(r)
    const authoredOpenings = registerOpenings(authored)

    const linkedDoors = new Set()
    let failedLinks = 0
    for (const p of routePoints) {
        const from = { x: p.x, y: p.y }
        for (const l of p.links) {
            let to, toNode, doorKey = null
            if (l.point != null) {
                const tp = routePoints.find(rp => rp.id === l.point)
                if (!tp) continue
                to = { x: tp.x, y: tp.y }; toNode = PID(l.point)
            } else {
                const area = authored.find(a => a.id === l.area)
                if (!area || !area.openings || !area.openings.has(l.opening)) continue   // dangling
                const o = parseOpen(l.opening), step = SIDE_STEP[o.side]
                to = { x: o.x + step[0], y: o.y + step[1] }; toNode = RID(area)
                doorKey = `${l.area},${l.opening}`
            }
            if (carveSeg(from, to)) { routed++; union(PID(p.id), toNode); if (doorKey) linkedDoors.add(doorKey) }
            else failedLinks++
        }
    }
    const r1 = routeOpenings(authoredOpenings, op => linkedDoors.has(`${op.room.id},${op.openStr}`))
    routed += r1.ok
    let failedOpenings = r1.fail
    routed += connectivity(authored)

    // === PHASE 2: place procedural rooms clear of rooms AND corridors =======
    const procRooms = style.rooms ? genProcRooms(V, authored, rng, style.roomCount, carved) : []
    if (authored.length + procRooms.length < 2) {
        return {
            corridors: (authored.length + procRooms.length) ? carved : null,
            procRooms, routed, status: "",
            stats: { components: authored.length + procRooms.length, roomsNoOpenings, failedLinks, failedOpenings, unusableOpenings },
        }
    }

    // === PHASE 3: integrate the procedural rooms into the network ===========
    if (procRooms.length) {
        for (const r of procRooms) addInterior(r)
        const procOpenings = registerOpenings(procRooms)
        const r3 = routeOpenings(procOpenings, null)
        routed += r3.ok; failedOpenings += r3.fail
        routed += connectivity([...authored, ...procRooms])
    }

    // Width post-pass: dilate the 1-wide carve to `width` tiles, never eating a
    // room interior. Odd widths grow symmetrically; even widths grow one extra
    // tile toward +x/+y (unavoidable on a grid).
    const w = style.width
    if (w > 1) {
        const lo = -Math.floor((w - 1) / 2), hi = Math.ceil((w - 1) / 2)
        const grown = new Set(carved)
        for (const k of carved) {
            const [x, y] = parseCell(k)
            for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
                const nx = x + dx, ny = y + dy
                if (nx < EDGE_MARGIN || ny < EDGE_MARGIN || nx >= V.w - EDGE_MARGIN || ny >= V.h - EDGE_MARGIN) continue
                if (interior.has(key(nx, ny))) continue
                grown.add(key(nx, ny))
            }
        }
        carved = grown
    }

    const allRooms = [...authored, ...procRooms]
    const components = new Set(allRooms.map(r => find(RID(r)))).size
    const parts = [`${routed} corridor${routed === 1 ? "" : "s"}   seed ${seed}`]
    if (procRooms.length) parts.push(`${procRooms.length} procedural room${procRooms.length === 1 ? "" : "s"}`)
    if (components > 1) parts.push(`${components} disconnected group${components === 1 ? "" : "s"}`)
    if (roomsNoOpenings) parts.push(`${roomsNoOpenings} room${roomsNoOpenings === 1 ? "" : "s"} with no openings`)
    if (failedLinks) parts.push(`${failedLinks} link${failedLinks === 1 ? "" : "s"} couldn't route`)
    if (failedOpenings) parts.push(`${failedOpenings} opening${failedOpenings === 1 ? "" : "s"} couldn't route`)
    if (unusableOpenings) parts.push(`${unusableOpenings} opening${unusableOpenings === 1 ? "" : "s"} invalid`)

    return {
        corridors: carved, procRooms, routed, status: parts.join("\n"),
        stats: { components, roomsNoOpenings, failedLinks, failedOpenings, unusableOpenings },
    }
}

// Synthesize the game's 0/1 wall/floor grid (row-major grid[y][x]; 1 = wall,
// 0 = floor) from the authored skeleton + generated corridors. Start all wall,
// then carve every area interior (rect or freeform cells), every procedural-room
// interior, and every corridor tile. Openings need no special handling — the
// area rect edge is already floor and the corridor carves up to it, so room and
// corridor meet. Anything left uncarved is the surrounding wall.
export function buildGrid({ voidSize, areas, procRooms = [], corridors }) {
    const { w, h } = voidSize
    const grid = Array.from({ length: h }, () => new Array(w).fill(1))
    const carve = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = 0 }
    for (const a of [...areas, ...procRooms]) {
        if (a.shape === "free" && a.cells) {
            for (const c of a.cells) { const [x, y] = parseCell(c); carve(x, y) }
        } else {
            for (let yy = a.y; yy < a.y + a.h; yy++) for (let xx = a.x; xx < a.x + a.w; xx++) carve(xx, yy)
        }
    }
    if (corridors) for (const k of corridors) { const [x, y] = parseCell(k); carve(x, y) }
    return grid
}

// Convert an exported designer JSON skeleton into the in-memory shape the
// generator expects: openings/cells become Sets, freeform bboxes are recomputed,
// and the style + seed are resolved with defaults. Mirrors the normalization in
// DesignerScene.deserialize so an exported file and the live editor generate the
// same floor. Unknown/invalid fields are dropped, not fatal.
export function hydrateSkeleton(json) {
    const g = json.grid || {}
    const voidSize = { w: Math.max(3, g.w | 0) || 48, h: Math.max(3, g.h | 0) || 32 }

    const areas = []
    for (const o of (Array.isArray(json.areas) ? json.areas : [])) {
        const area = {
            id: o.id | 0,
            name: typeof o.name === "string" ? o.name : `Area ${areas.length + 1}`,
            kind: typeof o.kind === "string" ? o.kind : "",
            enemyTheme: typeof o.enemyTheme === "string" ? o.enemyTheme : "",
            enemyMix: Array.isArray(o.enemyMix) ? o.enemyMix.filter(x => typeof x === "string") : [],
            enemyCount: Number.isFinite(o.enemyCount) ? (o.enemyCount | 0) : null,
            stance: typeof o.stance === "string" ? o.stance : "",
            encounter: typeof o.encounter === "string" ? o.encounter : "",
            walled: o.walled !== false,
            shape: o.shape === "free" ? "free" : "rect",
            x: o.x | 0, y: o.y | 0, w: Math.max(1, o.w | 0), h: Math.max(1, o.h | 0),
        }
        if (area.shape === "free") {
            const cells = Array.isArray(o.cells) ? o.cells : []
            area.cells = new Set(cells.map(c => key(c[0] | 0, c[1] | 0)))
            if (area.cells.size === 0) area.shape = "rect"
            else recomputeBBox(area)
        }
        if (Array.isArray(o.openings) && o.openings.length) {
            area.openings = new Set(o.openings
                .filter(op => op && SIDE_STEP[op.side])
                .map(op => openKey(op.x | 0, op.y | 0, op.side)))
        }
        areas.push(area)
    }

    const routePoints = []
    for (const p of (Array.isArray(json.routePoints) ? json.routePoints : [])) {
        if (!p) continue
        const links = Array.isArray(p.links) ? p.links
            .filter(l => l && (l.point != null || (l.area != null && typeof l.opening === "string")))
            .map(l => l.point != null ? { point: l.point | 0 } : { area: l.area | 0, opening: l.opening })
            : []
        routePoints.push({ id: p.id | 0, x: p.x | 0, y: p.y | 0, links })
    }
    // Drop links whose target no longer exists (mirrors deserialize).
    const areaIds = new Set(areas.map(a => a.id))
    const ptIds = new Set(routePoints.map(p => p.id))
    for (const p of routePoints) {
        p.links = p.links.filter(l => l.point != null ? ptIds.has(l.point) : areaIds.has(l.area))
    }

    // Connections / portals (design §15.9). A connection = { source:{x,y},
    // dest:{ floor:'same'|index, room?:areaId, tile?:{x,y} }, hidden }.
    //   - SAME-FLOOR: dest.room must resolve on THIS floor; AuthoredLevel turns it
    //     into a concrete tile.
    //   - CROSS-FLOOR (dest.floor is an index, slice 2b): the room lives on another
    //     floor, so it's kept unvalidated and resolved on arrival; the floor index
    //     alone is a valid destination (lands at that floor's start room).
    // Parsing stays pure — no geometry here.
    const connections = []
    for (const c of (Array.isArray(json.connections) ? json.connections : [])) {
        if (!c || !c.source) continue
        const src = { x: c.source.x | 0, y: c.source.y | 0 }
        const d = c.dest || {}
        const dest = {
            floor: (d.floor === undefined || d.floor === "same") ? "same" : (d.floor | 0),
            room: d.room != null ? (d.room | 0) : null,
            tile: (d.tile && typeof d.tile.x === "number") ? { x: d.tile.x | 0, y: d.tile.y | 0 } : null,
        }
        if (dest.floor === "same") {
            // A same-floor dest room must point at a real area on this floor, and
            // the connection needs some destination to be useful.
            if (dest.room != null && !areaIds.has(dest.room)) continue
            if (dest.room == null && !dest.tile) continue
        }
        connections.push({ id: c.id | 0, source: src, dest, hidden: c.hidden !== false })
    }

    const cs = json.corridorStyle || {}
    const style = {
        straight: typeof cs.straight === "number" ? cs.straight : DEFAULT_STYLE.straight,
        wander: typeof cs.wander === "number" ? cs.wander : DEFAULT_STYLE.wander,
        width: cs.width ? Math.max(1, Math.min(10, cs.width | 0)) : DEFAULT_STYLE.width,
        rooms: typeof cs.rooms === "boolean" ? cs.rooms : DEFAULT_STYLE.rooms,
        roomCount: typeof cs.roomCount === "number" ? Math.max(0, Math.min(40, cs.roomCount | 0)) : DEFAULT_STYLE.roomCount,
    }

    // Reproducible seed: the pinned fillSeed when the author locked one, else a
    // stable hash of the skeleton's shape so the same design always plays the
    // same floor (no Date/random — keeps it deterministic).
    const seed = json.fillSeedLocked
        ? (json.fillSeed | 0) >>> 0
        : hashSeed(JSON.stringify({ v: voidSize, a: areas.map(a => [a.id, a.x, a.y, a.w, a.h]) }))

    return { voidSize, areas, routePoints, connections, style, seed }
}
