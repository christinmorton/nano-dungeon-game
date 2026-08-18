import mapState from "../MapState.js"

// Arrangement primitives (design doc §14.5) — the small, shared vocabulary the
// furnisher (furnish.js) uses to place decor so a room reads as a composed
// PLACE, not a single object in an empty box. Each primitive is pure geometry:
// given a room + an occupancy set, it returns the tiles it claims (and marks
// them occupied). WHAT prop lands on those tiles is the furnisher's job (via
// the recipe's prop palette); the arrangement only decides WHERE.
//
// Occupancy is tracked EXPLICITLY as a Set of "x,y" keys rather than through
// isWalkableTile, because during populate() the just-spawned entities are still
// spriteless and isWalkableTile only counts entities with a live sprite (see
// WorldQueries.isWalkableTile + the settlement scatter gotcha). The furnisher
// seeds the set from the room's existing occupants before calling us.
//
// Slice 1 ships three: centerpiece, flanking, scatter. ring / edgeLine / rubble
// are the documented next additions and slot in the same way.

const key = (x, y) => `${x},${y}`

// A tile is placeable if it's inside the room, an actual floor cell in the raw
// level grid (0 = floor), not a doorway (keep the opening clear), and not
// already claimed. The grid read is authoritative for terrain; `occupied`
// covers the spriteless populate-time entities the grid can't see yet.
function isFree(x, y, room, occupied) {
    if (x < room.x || x >= room.x + room.w) return false
    if (y < room.y || y >= room.y + room.h) return false
    const row = mapState.level && mapState.level[y]
    if (!row || row[x] !== 0) return false
    if (mapState.isDoorAt && mapState.isDoorAt(x, y)) return false
    return !occupied.has(key(x, y))
}

function claim(x, y, occupied, out) {
    occupied.add(key(x, y))
    out.push({ x, y })
}

function roomCenter(room) {
    return {
        x: Math.floor(room.x + room.w / 2),
        y: Math.floor(room.y + room.h / 2),
    }
}

// centerpiece — a single tile at (or nearest to) the room center. Falls back by
// spiralling outward in Chebyshev rings so a taken center still yields a spot.
// The featured object of a scene (an altar, a chest, a campfire) sits here.
function centerpiece(room, occupied, opts = {}) {
    const out = []
    const c = opts.anchor || roomCenter(room)
    if (isFree(c.x, c.y, room, occupied)) {
        claim(c.x, c.y, occupied, out)
        return out
    }
    const maxR = Math.max(room.w, room.h)
    for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                const x = c.x + dx, y = c.y + dy
                if (!isFree(x, y, room, occupied)) continue
                claim(x, y, occupied, out)
                return out
            }
        }
    }
    return out
}

// flanking — up to `count` tiles arranged symmetrically around an anchor (the
// scene's centerpiece by default), at distance `gap`. Priority is left/right,
// then up/down, then the diagonals, so a pair reads as "flanking" the feature.
function flanking(room, occupied, opts = {}) {
    const out = []
    const anchor = opts.anchor || roomCenter(room)
    const count = opts.count != null ? opts.count : 2
    const gap = opts.gap != null ? opts.gap : 1
    const offsets = [
        [-gap, 0], [gap, 0], [0, -gap], [0, gap],
        [-gap, -gap], [gap, -gap], [-gap, gap], [gap, gap],
    ]
    for (const [dx, dy] of offsets) {
        if (out.length >= count) break
        const x = anchor.x + dx, y = anchor.y + dy
        if (!isFree(x, y, room, occupied)) continue
        claim(x, y, occupied, out)
    }
    return out
}

// scatter — up to `count` random free floor tiles, inset from the walls by
// `margin` so decor doesn't hug the perimeter. Attempt-capped (like the
// settlement scatter) so a full room fails gracefully instead of looping.
function scatter(room, occupied, opts = {}) {
    const out = []
    const count = opts.count != null ? opts.count : 3
    const margin = opts.margin != null ? opts.margin : 1
    const attemptsPer = opts.attempts != null ? opts.attempts : 16
    const x0 = room.x + margin, x1 = room.x + room.w - 1 - margin
    const y0 = room.y + margin, y1 = room.y + room.h - 1 - margin
    if (x1 < x0 || y1 < y0) return out   // room too small once inset
    for (let placed = 0; placed < count; placed++) {
        for (let attempt = 0; attempt < attemptsPer; attempt++) {
            const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1))
            const y = y0 + Math.floor(Math.random() * (y1 - y0 + 1))
            if (!isFree(x, y, room, occupied)) continue
            claim(x, y, occupied, out)
            break
        }
    }
    return out
}

// edges — up to `count` free tiles that sit AGAINST A WALL, i.e. orthogonally
// adjacent to a non-floor cell. Furniture pushed to the walls reads as a
// furnished room; the same furniture dropped mid-floor reads as clutter someone
// abandoned, which is what plain `scatter` produced for realm scenery.
//
// Doorway-adjacent tiles are skipped on top of the usual isFree check, so a
// well or a column doesn't end up squeezed beside an opening people walk through.
// Candidates are shuffled so a room doesn't fill its perimeter clockwise from
// the top-left every time. Falls back to nothing when the room has no free
// wall-adjacent tile; the caller then simply places less.
function edges(room, occupied, opts = {}) {
    const out = []
    const count = opts.count != null ? opts.count : 1
    const touchesWall = (x, y) => {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const row = mapState.level && mapState.level[y + dy]
            if (!row || row[x + dx] !== 0) return true       // wall or off-grid
        }
        return false
    }
    const candidates = []
    for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
            if (!isFree(x, y, room, occupied)) continue
            if (!touchesWall(x, y)) continue
            if (nearDoor(x, y)) continue
            candidates.push({ x, y })
        }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    for (const c of candidates) {
        if (out.length >= count) break
        claim(c.x, c.y, occupied, out)
    }
    return out
}

// Is a doorway on or beside (x, y)? Keeps decor clear of the tiles people
// actually move through — the arrangement equivalent of the furnisher's
// connectivity guard, applied before a candidate is ever offered.
function nearDoor(x, y) {
    if (!mapState.isDoorAt) return false
    for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (mapState.isDoorAt(x + dx, y + dy)) return true
    }
    return false
}

// Registry the furnisher looks arrangements up in by name (from a scene's
// `arrangement` field). Adding a primitive = add it here.
export const ARRANGEMENTS = { centerpiece, flanking, scatter, edges }

export { roomCenter }
