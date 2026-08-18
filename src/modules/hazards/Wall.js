import mapState from "../MapState.js"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import ZoneEffect from "./ZoneEffect.js"

// Wall.js — the "wall" universal: a short, TEMPORARY barrier of tiles that
// blocks enemies but lets the caster (and future allies) pass through freely.
// Built from the same entity-layer + TurnManager pattern as ZoneEffect and the
// settlement structures. Two halves, combinable per element:
//
//   - Blocking (Earth / Rime / Arcane Wall): a WallSegment per tile carrying
//     `blocksPath` (enemy pathfinding routes around it; melee adjacency broken
//     via distanceBetweenEntities) and optional `blocksSight`. It deliberately
//     carries NO `.sprite`, so the faction-blind isWalkableTile / entityAtTile
//     checks do NOT block it — the hero walks straight through. Enemies avoid it
//     because gridForEntity stamps every `blocksPath` tile as wall. (When the
//     follower system lands, allied pathers get the same pass via `friendly`.)
//
//   - Hazard (Fire Wall): a line-shaped ZoneEffect that only `affects: enemy`,
//     so the caster's side crosses it unharmed.
//
// Geometry: wallLineTiles() lays the segment perpendicular to the cast
// direction, so the wall stands across the lane between caster and target.

// blocksProjectile — stops PHYSICAL shots (arrows/bolts/thrown) crossing the tile.
// blocksMagic       — additionally stops SPELL projectiles (fireballs, bolts). Only
//                     the arcane wall contains magic — its "idealized protection"
//                     niche; solid stone/ice stop arrows but a spell sails through.
//                     (Flip earth/rime blocksMagic to true if you'd rather stone
//                     also stop fireballs.)
const WALL_STYLE = {
    earth:   { color: 0x9c7b4f, alpha: 0.85, blocksSight: true,  blocksProjectile: true, blocksMagic: false },
    rime:    { color: 0xa8e0ff, alpha: 0.70, blocksSight: false, blocksProjectile: true, blocksMagic: false },
    arcane:  { color: 0xb98bff, alpha: 0.60, blocksSight: false, blocksProjectile: true, blocksMagic: true },
    default: { color: 0x9a9a9a, alpha: 0.80, blocksSight: true,  blocksProjectile: true, blocksMagic: false },
}

export class WallSegment {
    constructor(x, y, opts = {}) {
        this.type = "wall"
        this.x = x
        this.y = y
        this.duration = opts.duration ?? 4
        const style = WALL_STYLE[opts.kind] ?? WALL_STYLE.default
        // Blocks ENEMY pathfinding + adjacency (gridForEntity / distanceBetween
        // read blocksPath). No `.sprite` on purpose, so the caster passes through.
        this.blocksPath = true
        this.blocksSight = opts.blocksSight ?? style.blocksSight
        // Projectile occlusion (read by WorldQueries.hasProjectilePath). A wall
        // stops what FLIES through its tile, separate from blocksSight so a
        // see-through ice/force wall can still halt an arrow. friendly side passes.
        this.blocksProjectile = opts.blocksProjectile ?? style.blocksProjectile ?? true
        this.blocksMagic = opts.blocksMagic ?? style.blocksMagic ?? false
        this.friendly = opts.friendly ?? "hero"   // future: allied pathers pass too
        this.gfx = null
        this._draw(style, opts.color, opts.riseDelay ?? 0)
        tm.addEntity(this)
    }

    _draw(style, colorOverride, riseDelay = 0) {
        const scene = dungeon.scene
        if (!scene || !mapState.map) return
        const ts = mapState.tileSize || 16
        const color = colorOverride ?? style.color
        const x = mapState.map.tileToWorldX(this.x)
        const y = mapState.map.tileToWorldY(this.y)
        const cx = x + ts / 2

        // The slab is anchored at the tile's BOTTOM edge (origin 0.5,1), so scaling
        // its height grows it UPWARD — a wall heaving up out of the ground (the
        // 2.5D trick in a top-down view). Depth 9: above floor zones (8), below
        // actors (10). Starts flat (scaleY 0) and rises with a little overshoot.
        const slab = scene.add.rectangle(cx, y + ts, ts, ts, color, style.alpha)
            .setOrigin(0.5, 1).setDepth(9)
        slab.scaleY = 0
        this.gfx = slab
        scene.tweens.add({
            targets: slab,
            scaleY: 1,
            duration: 220,
            delay: riseDelay,        // segments unfurl in sequence along the line
            ease: 'Back.easeOut',    // overshoot, then settle into the tile
        })

        // Dust/energy kicked up at the base as it erupts — a quick expanding,
        // fading puff in the wall's own colour (stone=brown, ice=blue, arcane=violet).
        const puff = scene.add.ellipse(cx, y + ts, ts * 0.75, ts * 0.32, color, 0.5).setDepth(8)
        puff.scale = 0.3
        scene.tweens.add({
            targets: puff,
            scale: 1.4,
            alpha: 0,
            duration: 320,
            delay: riseDelay,
            ease: 'Cubic.easeOut',
            onComplete: () => puff.destroy(),
        })
    }

    // Once per round (TurnManager.refresh): count down, self-expire.
    refresh() {
        this.duration -= 1
        if (this.duration <= 0) this._expire()
    }

    _expire() {
        if (this.gfx) { this.gfx.destroy(); this.gfx = null }
        tm.removeEntity(this)
    }

    // TurnManager contract: over() true means it never gates the round / takes a turn.
    over() { return true }
    turn() {}
}

// Tiles for a wall of `length` laid perpendicular to the caster→center axis,
// centered on the target tile. Floor tiles only.
export function wallLineTiles(from, center, length = 3) {
    const dx = center.x - from.x
    const dy = center.y - from.y
    // Cast mostly along X -> the wall stands vertical (varies Y), and vice versa.
    const horizontalCast = Math.abs(dx) >= Math.abs(dy)
    const half = Math.floor(length / 2)
    const tiles = []
    for (let i = -half; i <= half; i++) {
        const x = horizontalCast ? center.x : center.x + i
        const y = horizontalCast ? center.y + i : center.y
        if (mapState.level?.[y]?.[x] === 0) tiles.push({ x, y })
    }
    return tiles
}

// The wall universal. `tiles` is the barrier footprint (see wallLineTiles).
//   opts.blocks   -> spawn blocking WallSegments (skips occupied / non-floor tiles)
//   opts.damage / opts.statuses -> spawn a hazard ZoneEffect over the tiles,
//                    enemy-only by default so the caster's side passes unharmed.
// Returns { segments, zone }.
export function wall(tiles, opts = {}) {
    const {
        blocks = true,
        blocksSight,
        kind = "default",
        color,
        duration = 4,
        damage = null,
        damageFlavor = "physical",
        onEnter = null,        // status name(s) / {name,turns} applied on step-in
        onTick = null,         // status name(s) applied each round to standers
        onEnterFn = null,      // custom on-step hook, e.g. Gale Wall's knockback
        affects = "enemy",
    } = opts

    const floorTiles = tiles.filter(t => mapState.level?.[t.y]?.[t.x] === 0)
    const segments = []
    if (blocks) {
        for (let i = 0; i < floorTiles.length; i++) {
            const t = floorTiles[i]
            if (mapState.entityAtTile(t.x, t.y)) continue   // don't wall over a standing actor
            // riseDelay staggers the rise so the wall unfurls along the line.
            segments.push(new WallSegment(t.x, t.y, { kind, color, duration, blocksSight, riseDelay: i * 45 }))
        }
    }

    // Hazard half: a line-shaped ZoneEffect (damage / statuses / custom on-enter
    // hook). Enemy-only by default so the caster's side passes through unharmed.
    let zone = null
    if (damage != null || onEnter || onTick || onEnterFn) {
        zone = new ZoneEffect(floorTiles, {
            kind, duration, damage, damageFlavor,
            onEnter, onTick, onEnterFn, affects,
        })
    }

    return { segments, zone }
}
