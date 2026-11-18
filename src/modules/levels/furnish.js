import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import Prop from "../items/Prop.js"
import { frameForName } from "../assetLoader.js"

// furnish — dress a room with the realm's own scenery so a floor reads as a
// place rather than a corridor diagram. The v5 cut of v3's furnish.js (322
// lines: prop palettes, authored scenes per room kind, multi-tile footprints).
// This keeps the one behaviour that matters for the look: a few blocking
// pieces against the walls, a sprinkle of walk-over litter across the floor.
//
// What the theme supplies (see recipes.js normalizeTheme):
//   propSheet / props     — blocking furniture, placed on floor tiles that touch
//                           a wall, never where it would split the room.
//   debrisSheet / debris  — walk-over litter, scattered anywhere open.
// A theme that declares neither is left exactly as it was.

// Blocking pieces per room, and the ceiling on how much open floor they may
// take — small rooms stay open, big rooms get more than the flat count allows.
const SCENERY_PER_ROOM = 3
const BLOCKER_FLOOR_FRACTION = 0.15
const DEBRIS_PER_ROOM = 5

const key = (x, y) => `${x},${y}`

// Floor tiles of the room, as the passability grid sees them (0 = floor).
function floorTiles(room) {
    const out = []
    for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
            if (mapState.level[y] && mapState.level[y][x] === 0) out.push({ x, y })
        }
    }
    return out
}

function touchesWall(x, y) {
    const g = mapState.level
    return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => !g[y + dy] || g[y + dy][x + dx] !== 0)
}

// Connectivity used to be checked here with a BFS over the ROOM's own tiles. That
// could not see a corridor mouth — the mouth is the tile one step OUTSIDE the
// room rectangle — so a crate on the room tile just inside a corner doorway
// passed the check and sealed the corridor. The check is now the floor-wide
// mapState.wouldSplitFloor, shared with chest and camp placement.

function shuffled(list) {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

function titleCase(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// Build one decor prop from a named frame on a sheet, or null when the name is
// not on the sheet — a renamed frame drops the piece, it does not crash the floor.
function makeProp(sheet, name, x, y, walkable) {
    const frame = frameForName(sheet, name)
    if (frame == null) {
        console.warn(`[furnish] '${name}' is not a frame on sheet '${sheet}' — skipped`)
        return null
    }
    return new Prop(x, y, { name: titleCase(name), art: { sheet, frame }, walkable })
}

export default function furnish(room) {
    const theme = mapState.theme
    if (!theme) return
    const tiles = floorTiles(room)
    if (!tiles.length) return
    // Tiles something already stands on (stairs, the hero's start tile…).
    const occupied = new Set()
    for (const e of tm.entities) {
        if (e.x != null && e.y != null && e.x >= room.x && e.x < room.x + room.w && e.y >= room.y && e.y < room.y + room.h) {
            occupied.add(key(e.x, e.y))
        }
    }

    // Walk-over litter first, independent of furniture: a room with no wall
    // space for a crate still gets its bones and rubble.
    if (theme.debrisSheet && theme.debris.length) {
        const taken = new Set()
        for (const t of shuffled(tiles)) {
            if (taken.size >= DEBRIS_PER_ROOM) break
            if (occupied.has(key(t.x, t.y))) continue
            const name = theme.debris[Math.floor(Math.random() * theme.debris.length)]
            const prop = makeProp(theme.debrisSheet, name, t.x, t.y, true)
            if (!prop) continue
            tm.addEntity(prop)
            taken.add(key(t.x, t.y))
        }
    }

    if (!theme.propSheet || !theme.props.length) return
    let budget = Math.min(SCENERY_PER_ROOM, Math.floor(tiles.length * BLOCKER_FLOOR_FRACTION))
    if (budget <= 0) return
    const blocked = new Set(occupied)
    const names = shuffled(theme.props)
    let n = 0
    for (const t of shuffled(tiles)) {
        if (budget <= 0) break
        if (blocked.has(key(t.x, t.y))) continue
        if (!touchesWall(t.x, t.y)) continue
        // Never on a choke: a piece that would cut the floor in two is skipped,
        // whatever it would have looked like against that wall.
        if (mapState.wouldSplitFloor(t.x, t.y)) continue
        const prop = makeProp(theme.propSheet, names[n % names.length], t.x, t.y, false)
        n += 1
        if (!prop) continue
        tm.addEntity(prop)
        blocked.add(key(t.x, t.y))
        budget -= 1
    }
}
