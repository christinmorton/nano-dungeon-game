// shapes.js — the geometric footprint library for ability delivery (§ the
// composable ability components). A *shape* is pure geometry: given a spec
// ({ kind, length, spread, radius, ... }) and a unit direction (dx, dy), a
// generator returns the list of tile OFFSETS the shape covers, relative to an
// origin. No game state, no FX, no damage — just which tiles. The `patterns.js`
// delivery layer translates these offsets to world tiles, clips them against
// walls, and runs an effect on each.
//
// Why offsets and not world tiles: keeping shapes origin-relative makes them
// trivially testable and lets the rank-up / augment system tune a shape by
// editing its spec (extend `length`, widen `spread`, swap `kind`) without
// touching the ability that wields it. Acid Spray's "line vs cone at rank-up"
// is just spread 0 vs spread 1 on the SAME generator. And it lets ONE delivery
// pattern (shapeStrike / areaStrike) serve a nova, a cleave, a beam, a
// hexagonal blast — the difference is data, not new code.
//
// Each offset is { dx, dy, dist, col }:
//   dist — forward distance from origin (drives near->far occlusion ordering).
//   col  — occlusion column id for DIRECTIONAL shapes: once a wall is hit in a
//          column, farther tiles in the same column are shadowed. Radial shapes
//          (square/ring/circle/polygon/...) set col = null — they don't
//          self-occlude, just clip per-tile against walls.
//
// Directions are unit steps (-1/0/1) incl. diagonals. Cardinal shapes are
// exact; diagonal orientation is a best-estimate (perpendicular rounding leaves
// small gaps on diagonals — acceptable per the design call).
//
// Two families:
//   DIRECTIONAL (take dx, dy) — cone, line, arc, bar. Emanate along the aim.
//   RADIAL      (ignore dir)  — square, ring, ringDot, circle, diamond, cross,
//                               ex, star, polygon (+ pentagon/hexagon/...).
// A radial shape centered on the caster IS a nova; centered on a clicked tile
// (areaStrike) it's a lobbed blast — same generator, different origin.

// =============================================================================
// DIRECTIONAL shapes (emanate along the aim direction dx, dy)
// =============================================================================

// Filled directional fan. spread 0 => a straight line (concentrated jet);
// spread 1 => ~90° cone; higher => wider. Half-width grows by floor((f-1)*spread)
// each forward step f, so length 3 / spread 1 paints a 1-3-5 tile triangle.
function coneOffsets({ length = 3, spread = 1 } = {}, dx = 0, dy = 1) {
    const perpX = -dy
    const perpY = dx
    const out = []
    for (let f = 1; f <= length; f++) {
        const halfWidth = Math.floor((f - 1) * spread)
        for (let w = -halfWidth; w <= halfWidth; w++) {
            out.push({
                dx: dx * f + perpX * w,
                dy: dy * f + perpY * w,
                dist: f,
                col: w,            // lateral column — the occlusion lane
            })
        }
    }
    return dedupe(out)
}

// A straight pierce line: cone with no spread. Kept as its own kind for
// vocabulary (abilities read clearer as kind:'line') — it delegates so the two
// can never drift apart.
function lineOffsets({ length = 5 } = {}, dx = 0, dy = 1) {
    return coneOffsets({ length, spread: 0 }, dx, dy)
}

// A uniform-width beam: `length` tiles forward along the aim, `width` tiles
// across it — a filled RECTANGLE, not a fan. Unlike a cone (whose half-width
// grows with distance), the width stays constant the whole length, so it reads
// as a laser / energy beam rather than a wedge. width 1 collapses to a plain
// line; width 3 is a three-lane beam. Each perpendicular lane is its own
// occlusion column, so a wall stops only the lane(s) it actually blocks. Odd
// width straddles the center lane. The shape a charged beam (chargedCast) widens
// as it overcharges.
function beamLineOffsets({ length = 5, width = 1 } = {}, dx = 0, dy = 1) {
    const perpX = -dy
    const perpY = dx
    const half = Math.floor(width / 2)
    const out = []
    for (let f = 1; f <= length; f++) {
        for (let w = -half; w <= half; w++) {
            out.push({
                dx: dx * f + perpX * w,
                dy: dy * f + perpY * w,
                dist: f,
                col: w,            // perpendicular lane — its own occlusion column
            })
        }
    }
    return dedupe(out)
}

// Forward swing — every tile within `radius` (Chebyshev) that sits in the
// FRONT hemisphere relative to the aim (dot product with the aim > 0). A melee
// arc / cleave-fan in front of the caster; radius 1 is the classic 3-tile swing,
// radius 2 a wide reaving sweep. Lateral column = signed perpendicular offset so
// a wall still shadows the lane behind it.
function arcOffsets({ radius = 1 } = {}, dx = 0, dy = 1) {
    const perpX = -dy
    const perpY = dx
    const out = []
    for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
            if (ox === 0 && oy === 0) continue
            if (Math.max(Math.abs(ox), Math.abs(oy)) > radius) continue
            if (ox * dx + oy * dy <= 0) continue            // behind / beside — drop
            const col = ox * perpX + oy * perpY             // lateral lane
            out.push({ dx: ox, dy: oy, dist: Math.max(Math.abs(ox), Math.abs(oy)), col })
        }
    }
    return out
}

// Perpendicular bar — a line of `length` tiles laid ACROSS the aim, `reach`
// tiles out in front. The footprint a Wall lays on (the geometry twin of
// hazards/Wall.wallLineTiles), usable as an attack shape too (a wide frontal
// slash). Odd length straddles the center lane.
function barOffsets({ length = 3, reach = 1 } = {}, dx = 0, dy = 1) {
    const perpX = -dy
    const perpY = dx
    const half = Math.floor(length / 2)
    const out = []
    for (let w = -half; w <= half; w++) {
        out.push({
            dx: dx * reach + perpX * w,
            dy: dy * reach + perpY * w,
            dist: reach,
            col: w,
        })
    }
    return dedupe(out)
}

// =============================================================================
// RADIAL shapes (direction-agnostic — centered on the origin)
// =============================================================================

// Filled box (Chebyshev disk) around the origin, origin excluded.
function squareOffsets({ radius = 1 } = {}) {
    const out = []
    for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
            if (ox === 0 && oy === 0) continue
            out.push({ dx: ox, dy: oy, dist: Math.max(Math.abs(ox), Math.abs(oy)), col: null })
        }
    }
    return out
}

// Hollow Chebyshev ring outline at exactly `radius` (the "circle outline").
function ringOffsets({ radius = 2 } = {}) {
    const out = []
    for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue
            out.push({ dx: ox, dy: oy, dist: radius, col: null })
        }
    }
    return out
}

// Ring outline PLUS the center tile — "circle outline with a dot in the middle".
function ringDotOffsets(spec = {}) {
    return [{ dx: 0, dy: 0, dist: 0, col: null }, ...ringOffsets(spec)]
}

// Filled EUCLIDEAN disk — a tile is in when dx² + dy² ≤ radius² (rounded
// corners), matching the universal `shockwave` footprint. The canonical NOVA
// shape (centered on the caster) and lobbed blast (centered on a target tile).
// `fill: false` returns just the rim (an inside tile with an outside neighbor).
function circleOffsets({ radius = 2, fill = true } = {}) {
    const r2 = radius * radius
    const inside = (ox, oy) => ox * ox + oy * oy <= r2
    const reach = Math.ceil(radius)
    const out = []
    for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
            if (ox === 0 && oy === 0) continue
            if (!inside(ox, oy)) continue
            if (!fill && isInterior(ox, oy, inside)) continue
            out.push({ dx: ox, dy: oy, dist: Math.round(Math.hypot(ox, oy)), col: null })
        }
    }
    return out
}

// Filled MANHATTAN disk — |dx| + |dy| ≤ radius. A diamond / rhombus footprint
// (a 45°-rotated square). `fill: false` returns just the rim (|dx|+|dy| == r).
function diamondOffsets({ radius = 2, fill = true } = {}) {
    const out = []
    for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
            const m = Math.abs(ox) + Math.abs(oy)
            if (m === 0) continue
            if (fill ? m > radius : m !== radius) continue
            out.push({ dx: ox, dy: oy, dist: m, col: null })
        }
    }
    return out
}

// Cardinal arms — the PLUS (+) shape: `length` tiles out along each of the 4
// cardinal directions from the origin.
function crossOffsets({ length = 2 } = {}) {
    const out = []
    for (let i = 1; i <= length; i++) {
        out.push(
            { dx: i, dy: 0, dist: i, col: null },
            { dx: -i, dy: 0, dist: i, col: null },
            { dx: 0, dy: i, dist: i, col: null },
            { dx: 0, dy: -i, dist: i, col: null },
        )
    }
    return out
}

// Diagonal arms — the SALTIRE (×) shape: `length` tiles out along each diagonal.
function exOffsets({ length = 2 } = {}) {
    const out = []
    for (let i = 1; i <= length; i++) {
        out.push(
            { dx: i, dy: i, dist: i, col: null },
            { dx: i, dy: -i, dist: i, col: null },
            { dx: -i, dy: i, dist: i, col: null },
            { dx: -i, dy: -i, dist: i, col: null },
        )
    }
    return out
}

// Eight-pointed star — cardinal + diagonal arms (cross ∪ ex).
function starOffsets({ length = 2 } = {}) {
    return dedupe([...crossOffsets({ length }), ...exOffsets({ length })])
}

// Regular n-gon rasterized on the grid. Vertices sit on a circle of circumradius
// `radius`; a tile is in when its center lies inside the convex polygon
// (`fill`), or on its grid rim (`fill: false`). `rotation` (radians) spins it;
// the default points one vertex "up" (-y). The general creativity engine behind
// the named *-gons below — pentagon/hexagon/heptagon/octagon are just presets.
function polygonOffsets({ sides = 6, radius = 2, rotation = 0, fill = true } = {}) {
    const safeSides = Math.max(3, Math.round(sides))
    const verts = []
    for (let i = 0; i < safeSides; i++) {
        const ang = rotation - Math.PI / 2 + (Math.PI * 2 * i) / safeSides
        verts.push({ x: radius * Math.cos(ang), y: radius * Math.sin(ang) })
    }
    const inside = (ox, oy) => pointInConvex(ox, oy, verts)
    const reach = Math.ceil(radius)
    const out = []
    for (let oy = -reach; oy <= reach; oy++) {
        for (let ox = -reach; ox <= reach; ox++) {
            if (ox === 0 && oy === 0) continue
            if (!inside(ox, oy)) continue
            if (!fill && isInterior(ox, oy, inside)) continue
            out.push({ dx: ox, dy: oy, dist: Math.max(Math.abs(ox), Math.abs(oy)), col: null })
        }
    }
    return out
}

// Named regular-polygon presets — pass the same { radius, rotation, fill }.
function trigonOffsets(spec = {}) { return polygonOffsets({ ...spec, sides: 3 }) }
function pentagonOffsets(spec = {}) { return polygonOffsets({ ...spec, sides: 5 }) }
function hexagonOffsets(spec = {}) { return polygonOffsets({ ...spec, sides: 6 }) }
function heptagonOffsets(spec = {}) { return polygonOffsets({ ...spec, sides: 7 }) }
function octagonOffsets(spec = {}) { return polygonOffsets({ ...spec, sides: 8 }) }

// =============================================================================
// helpers
// =============================================================================

// True when (px, py) is inside (or on the edge of) a convex polygon whose
// vertices are in winding order — consistent sign of the edge cross product.
function pointInConvex(px, py, verts) {
    let sign = 0
    for (let i = 0; i < verts.length; i++) {
        const a = verts[i]
        const b = verts[(i + 1) % verts.length]
        const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
        if (cross === 0) continue
        const s = Math.sign(cross)
        if (sign === 0) sign = s
        else if (s !== sign) return false
    }
    return true
}

// A tile is "interior" (so the outline mode drops it) when all 4 of its cardinal
// neighbors also pass the membership test — i.e. it isn't on the rim.
function isInterior(ox, oy, inside) {
    return inside(ox + 1, oy) && inside(ox - 1, oy) && inside(ox, oy + 1) && inside(ox, oy - 1)
}

function dedupe(offsets) {
    const seen = new Set()
    const out = []
    for (const o of offsets) {
        const key = `${o.dx},${o.dy}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(o)
    }
    return out
}

// The registry — `kind` strings an ability's `shape` spec selects. Add a
// generator here and every shapeStrike / areaStrike ability can use it
// immediately.
export const SHAPES = {
    // directional
    cone: coneOffsets,
    line: lineOffsets,
    triangle: coneOffsets,   // alias — a filled wedge IS the cone
    beamLine: beamLineOffsets,
    laser: beamLineOffsets,  // alias — a uniform-width beam
    arc: arcOffsets,
    bar: barOffsets,
    // radial — boxes & rings
    square: squareOffsets,
    ring: ringOffsets,
    ringDot: ringDotOffsets,
    // radial — disks
    circle: circleOffsets,
    disc: circleOffsets,     // alias
    diamond: diamondOffsets,
    rhombus: diamondOffsets, // alias
    // radial — arms
    cross: crossOffsets,     // the + shape
    plus: crossOffsets,      // alias
    ex: exOffsets,           // the × shape
    saltire: exOffsets,      // alias
    star: starOffsets,
    // radial — regular polygons
    polygon: polygonOffsets,
    trigon: trigonOffsets,
    pentagon: pentagonOffsets,
    hexagon: hexagonOffsets,
    heptagon: heptagonOffsets,
    octagon: octagonOffsets,
}

// Resolve a shape spec to its tile offsets. Unknown kinds fall back to cone so a
// typo degrades to a sane shape rather than throwing mid-cast.
export function shapeOffsets(spec, dx = 0, dy = 0) {
    const generator = SHAPES[spec?.kind] ?? SHAPES.cone
    return generator(spec ?? {}, dx, dy)
}
