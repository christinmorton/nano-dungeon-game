import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import { SCENES } from "./scenes.js"
import { ARRANGEMENTS, roomCenter } from "./arrangements.js"
import { Hut, Tree, CastleStatue } from "../components/decor.js"
import Prop from "../components/Prop.js"
import { footprintOf } from "../WorldQueries.js"

// Furnisher (design doc §14.5) — the populate-time stage that turns a labelled
// room into a furnished SCENE. Given a room, it looks up the scene for its
// kind, resolves each placement's abstract role to a concrete Prop class via
// the active recipe's PROP PALETTE, and places them through the named
// arrangement primitive. Rooms with no scene (the common case) are left exactly
// as they were — the furnisher is purely additive dressing on top of the
// functional feature that spawnFromTable already dropped.
//
// scene (WHAT the room is) x palette (WHICH realm) -> furnishing: the same
// "rest" scene furnishes with a realm's shelter/foliage props, so a future
// demon realm dresses the same camp differently just by swapping the palette
// key on its recipe — no new furnisher code. See §14.2/§14.5.
//
// TRAVERSABILITY: decor props block their tile (every Prop stops the player;
// Hut/Tree also stamp the pathfinding grid), so naive placement in a small room
// can wall it off — an early bug lined props into an impassable barrier. Two
// guards prevent it: a per-room BUDGET scales the blocker count to the open
// floor (a tiny room gets one or two), and a CONNECTIVITY CHECK rejects any
// placement that would split the room's walkable space or seal an exit.

// Prop palettes: role -> Prop class, keyed by the recipe's `propPalette` string.
// Kept here (not on the recipe object) so recipes.js stays import-free — the
// recipe carries only the palette KEY, mirroring how it carries theme.sheet as
// a key. Slice 1 has one palette reusing already-verified decor tiles (Hut 980,
// Tree 50), so no test.html tile pick is needed to prove the pipeline.
const PALETTES = {
    wilderness: {
        shelter: Hut,    // decor.js Hut — a rough hide tent (tentRed 980)
        foliage: Tree,   // decor.js Tree — a gnarled tree (tree2 50)
        // First MULTI-TILE role. A statue is 2x3, so it exercises the whole
        // footprint path: placement vets all six tiles, the room's connectivity
        // is checked with all six blocked at once, and it costs six from the
        // room's decor budget.
        monument: CastleStatue,
    },
}

const DEFAULT_PALETTE = "wilderness"

// At most this fraction of a room's open floor may become blocking decor, so a
// furnished room always stays mostly walkable regardless of what the scene asks
// for. The connectivity check is the hard safety net; this keeps rooms from
// merely FEELING cramped.
const BLOCKER_FLOOR_FRACTION = 0.15

const key = (x, y) => `${x},${y}`

// Explicit occupancy for the room: the "x,y" of every entity currently sitting
// inside it. Built from tm.entities (not isWalkableTile) because populate-time
// entities are still spriteless and invisible to the spatial queries — the same
// reason the settlement scatter tracks occupancy by hand. Doubles as the seed
// for the connectivity check's `blocked` set (the tent/campfire already block).
function occupiedTilesInRoom(room) {
    const occupied = new Set()
    for (const e of tm.entities) {
        if (e.x == null || e.y == null) continue
        if (!room.contains(e.x, e.y)) continue
        occupied.add(key(e.x, e.y))
    }
    return occupied
}

// Count the room's currently-open floor tiles (grid floor cells not already
// blocked). Drives the blocker budget.
function openFloorCount(room, blocked) {
    let n = 0
    for (let y = room.y; y < room.y + room.h; y++) {
        const row = mapState.level[y]
        if (!row) continue
        for (let x = room.x; x < room.x + room.w; x++) {
            if (row[x] === 0 && !blocked.has(key(x, y))) n++
        }
    }
    return n
}

// The tiles a prop covers, anchored top-left (WorldQueries.footprintOf). A 1x1
// prop yields its own tile, so single-tile placement is unchanged.
function footprintTiles(prop) {
    const { w, h } = footprintOf(prop)
    const out = []
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) out.push({ x: prop.x + dx, y: prop.y + dy })
    }
    return out
}

// Undo a probe placement. The prop built its sprite in its constructor (via
// GenericItem -> dungeon.initializeEntity), so a rejected candidate has to tear
// that down or it stays painted on the floor with no entity behind it.
function removeProp(prop) {
    prop.destroyExtraSprites?.()
    if (prop.sprite) { prop.sprite.destroy(); delete prop.sprite }
}

// Is (x, y) inside the room, real floor, not a doorway, and unclaimed? Mirrors
// arrangements.isFree, which only vets the ANCHOR tile the arrangement chose —
// the other tiles of a multi-tile prop have to clear the same bar.
function isPlaceable(x, y, room, blocked) {
    if (x < room.x || x >= room.x + room.w) return false
    if (y < room.y || y >= room.y + room.h) return false
    const row = mapState.level && mapState.level[y]
    if (!row || row[x] !== 0) return false
    if (mapState.isDoorAt && mapState.isDoorAt(x, y)) return false
    return !blocked.has(key(x, y))
}

// Connectivity with ALL of a prop's tiles blocked at once. Checking them one at
// a time is not equivalent: two tiles can each be individually harmless and
// together cut the room in half.
function staysConnectedAll(tiles, blocked, room) {
    const trial = new Set(blocked)
    for (const t of tiles) trial.add(key(t.x, t.y))
    // Re-run the flood with the whole footprint already blocked, using any one
    // of its tiles as the "candidate" (it's in `trial`, so the choice is moot).
    return staysConnected(tiles[0].x, tiles[0].y, trial, room)
}

// Would placing a blocker at (cx, cy) keep the room traversable? Flood-fills the
// open floor over the room expanded by 1 (so doorway/corridor mouths are pulled
// in and must stay reachable), 4-connected (movement is orthogonal — AStarFinder
// runs with diagonals off), treating `blocked` ∪ {(cx,cy)} as impassable. If any
// currently-open tile becomes unreachable, the placement would split the space
// or seal an exit → reject.
function staysConnected(cx, cy, blocked, room) {
    const x0 = room.x - 1, x1 = room.x + room.w
    const y0 = room.y - 1, y1 = room.y + room.h
    const isOpen = (x, y) => {
        if (x < x0 || x > x1 || y < y0 || y > y1) return false
        if (x === cx && y === cy) return false
        const row = mapState.level[y]
        if (!row || row[x] !== 0) return false
        return !blocked.has(key(x, y))
    }

    // Collect open tiles + a seed to flood from.
    let total = 0
    let seed = null
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (!isOpen(x, y)) continue
            total++
            if (!seed) seed = { x, y }
        }
    }
    if (total <= 1) return true   // nothing meaningful left to disconnect

    const seen = new Set([key(seed.x, seed.y)])
    const stack = [seed]
    let reached = 0
    while (stack.length) {
        const t = stack.pop()
        reached++
        const nbrs = [[t.x - 1, t.y], [t.x + 1, t.y], [t.x, t.y - 1], [t.x, t.y + 1]]
        for (const [nx, ny] of nbrs) {
            const k = key(nx, ny)
            if (seen.has(k) || !isOpen(nx, ny)) continue
            seen.add(k)
            stack.push({ x: nx, y: ny })
        }
    }
    return reached === total
}

// The active recipe's palette name, threaded onto the level instance in
// MapState (like theme). Non-BSP levels (arena/training) carry none — those
// have no furnished scenes anyway, so the default is a harmless fallback.
function activePaletteName() {
    const level = mapState.levelManager && mapState.levelManager.getCurrent()
    return (level && level.propPalette) || DEFAULT_PALETTE
}

// Title-case a region name for the tooltip: "stone-well" -> "Stone Well". The
// label store is the only name these have, and it reads fine once cased.
function titleCase(regionName) {
    return regionName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// The theme's scenery as placements, or [] when the realm declares none. Each
// prop is a plain region-backed Prop — no class, no palette entry, because
// scenery is CONTENT: which regions dress this realm is a property of the
// dungeon type, not of any code path.
// How many DISTINCT scenery pieces one room may draw from the realm's set. One
// placement per region would put one of everything in every room — a well, a
// crate, a barrel, a lamppost and a bush in each — which reads as a warehouse
// rather than a place. A small random subset per room makes rooms differ from
// each other while staying recognisably the same realm.
const SCENERY_PER_ROOM = 3

function themePlacements() {
    const theme = mapState.theme
    if (!theme || !theme.propSheet || !theme.props.length) return []
    // Shuffle a copy (Fisher-Yates) and take a few. Math.random is fine here:
    // populate() runs ONCE per floor and FloorMemory restores it afterwards, so
    // nothing re-rolls on revisit — unlike the tilemap paint, which is seeded
    // precisely because it repaints on every entry.
    const pool = [...theme.props]
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, SCENERY_PER_ROOM).map(name => ({
        make: (x, y) => {
            const prop = new Prop(x, y, null, {
                name: titleCase(name),
                type: "decor",
                region: { sheet: theme.propSheet, name },
            })
            prop.blocksPath = true
            return prop
        },
        // Against the walls, not strewn across the floor — see arrangements.edges.
        arrangement: "edges",
        count: 1,
    }))
}

// How many walk-over pieces a room may take. Higher than the blocking count —
// debris is free (it costs no traversable space), and a sparse sprinkle is what
// makes a floor look lived-in rather than swept.
const DEBRIS_PER_ROOM = 6

// Scatter the realm's walk-over dressing. Deliberately NOT part of the scene /
// budget loop below: debris blocks nothing, so it needs no connectivity check
// and must not eat the blocker budget that keeps rooms open. It also isn't
// added to `occupied`, so furniture and enemies can share a tile with flowers.
function scatterDebris(room, occupied) {
    const theme = mapState.theme
    if (!theme || !theme.debrisSheet || !theme.debris.length) return
    // Its own occupancy set: debris avoids landing on ITSELF, but is happy to
    // sit under anything else.
    const taken = new Set()
    const arrange = ARRANGEMENTS.scatter
    for (let i = 0; i < DEBRIS_PER_ROOM; i++) {
        const name = theme.debris[Math.floor(Math.random() * theme.debris.length)]
        const tiles = arrange(room, taken, { count: 1, margin: 0 })
        if (!tiles.length) break                 // room is full of debris already
        const t = tiles[0]
        // Skip tiles already holding real furniture, so a crate doesn't sprout
        // flowers out of its lid.
        if (occupied.has(key(t.x, t.y))) continue
        tm.addEntity(new Prop(t.x, t.y, null, {
            name: titleCase(name),
            type: "decor",
            region: { sheet: theme.debrisSheet, name },
            walkable: true,
        }))
    }
}

export default function furnish(room) {
    // A room's KIND selects a hand-authored scene when it has one (a rest camp,
    // a treasure vault). Everything else — which is almost every room, and EVERY
    // room in an authored dungeon, where rooms carry no kind — falls back to the
    // realm's own scenery. Before this, no kind meant no decoration at all.
    const scene = SCENES[room.kind] || themePlacements()
    const palette = PALETTES[activePaletteName()] || PALETTES[DEFAULT_PALETTE]
    const occupied = occupiedTilesInRoom(room)
    // Walk-over dressing goes down FIRST and independently of the scene, so a
    // room with no furniture at all still gets its flowers and pebbles.
    scatterDebris(room, occupied)
    if (!scene.length) return
    // `blocked` mirrors the tiles that stop movement (existing occupants +
    // decor committed so far); it drives the connectivity check and grows as we
    // place. `occupied` drives arrangement dedupe (it also grows via claim()).
    const blocked = new Set(occupied)
    const anchor = roomCenter(room)

    // Budget: cap blocking decor at a fraction of the open floor so small rooms
    // stay open. The connectivity check still guards each individual placement.
    let budget = Math.floor(openFloorCount(room, blocked) * BLOCKER_FLOOR_FRACTION)
    if (budget <= 0) return

    for (const placement of scene) {
        // A placement supplies EITHER an abstract role resolved through the
        // realm's palette (scene entries) or its own factory (theme scenery).
        const make = placement.make || (palette[placement.role] && ((x, y) => new palette[placement.role](x, y)))
        if (!make) continue                               // realm doesn't stock this role
        const arrange = ARRANGEMENTS[placement.arrangement]
        if (!arrange) continue                            // unknown arrangement — skip, don't crash

        const candidates = arrange(room, occupied, { anchor, count: placement.count })
        for (const t of candidates) {
            if (budget <= 0) break
            // A prop may cover several tiles (a statue, a cottage), and its size
            // comes from its region, so it isn't known until it's built. Building
            // is side-effect-free apart from the sprite, so construct, measure,
            // and discard if it doesn't fit — the alternative is duplicating every
            // prop's footprint in the palette, where it would drift from the art.
            const prop = make(t.x, t.y)
            const tiles = footprintTiles(prop)
            // Every covered tile must be free floor AND the room must survive
            // losing all of them at once. Checking only the anchor let a 2x3
            // statue straddle a doorway or seal a corner.
            // The budget is checked against the prop's AREA, not just ">0" — a
            // 2x3 statue dropped on a budget of 1 would blow past the cap that
            // keeps small rooms open. A room too tight for a big prop gets none
            // rather than a cramped one.
            const fits = tiles.length <= budget
                && tiles.every(p => isPlaceable(p.x, p.y, room, blocked))
                && staysConnectedAll(tiles, blocked, room)
            if (!fits) {
                removeProp(prop)
                continue
            }
            tm.addEntity(prop)
            for (const p of tiles) { blocked.add(key(p.x, p.y)); occupied.add(key(p.x, p.y)) }
            // Charge the budget by AREA, so one big prop costs what it actually
            // takes out of the room rather than counting the same as a pebble.
            budget -= tiles.length
        }
        if (budget <= 0) break
    }
}
