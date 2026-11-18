import Phaser from "phaser"
import tm from "../TurnManager.js"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { resolveDamage } from "../abilities/universals.js"
import {
    registerHazardTile,
    unregisterHazardTile,
    applyStatuses,
    affectsEntity,
} from "./Hazards.js"

// ZoneEffect — a lingering ground effect over a set of tiles (oil slick, gas
// cloud, web, fire patch, caltrops, smoke). The "linger" half of the hazard
// primitive; the instant impact is Hazards.detonate. Spawned by thrown flasks
// today; traps will reuse it for spreading hazards.
//
// Asset-free: drawn from one Phaser graphics object tinted by `kind`. Stored as
// this.gfx (NOT this.sprite) on purpose — entityAtTile only returns entities
// with a .sprite, so a zone never registers as a blocker / bump target on a
// tile actors must be able to walk onto. It carries no logical x/y for the same
// reason: it occupies a tile SET, scanned each round.
//
// Lifecycle: registered with TurnManager so refresh() ticks it once per round
// (apply onTick to standers, count down, self-expire). onEnter fires via the
// Hazards tile registry the moment an actor steps in. Floor teardown
// (scene.restart) destroys the graphics; Dungeon.initialize clears the registry.

const ZONE_STYLE = {
    fire:     { color: 0xff6b2b, alpha: 0.34 },
    oil:      { color: 0x2e2620, alpha: 0.45 },
    smoke:    { color: 0x9aa0a6, alpha: 0.48 },
    gas:      { color: 0x7cb342, alpha: 0.34 },
    acid:     { color: 0xaaff00, alpha: 0.38 },
    web:      { color: 0xe8e8e8, alpha: 0.42 },
    caltrops: { color: 0x8d8d8d, alpha: 0.32 },
    wind:     { color: 0xcfe8ff, alpha: 0.28 },
    default:  { color: 0xb98bff, alpha: 0.32 },
}

export default class ZoneEffect {
    constructor(tiles, opts = {}) {
        this.type = "hazard"
        this.tiles = tiles                          // [{x, y}], walkable only
        this.kind = opts.kind ?? "default"
        this.duration = opts.duration ?? 3          // rounds
        this.damage = opts.damage ?? null           // number | {min,max} per tick
        this.damageFlavor = opts.damageFlavor ?? "physical"
        this.onTickStatuses = opts.onTick ?? null
        this.onEnterStatuses = opts.onEnter ?? null
        // Optional custom on-step hook (entity) => void — for effects that aren't
        // a status, e.g. Gale Wall shoving the crosser back. Runs after the
        // affects filter, so it only fires for the intended side.
        this.onEnterFn = opts.onEnterFn ?? null
        // Optional custom per-round hook (entity) => void — the tick-time twin of
        // onEnterFn, for effects that aren't flat damage or a status: e.g. Hallowed
        // Ground HEALING an ally and SEARING an enemy from one zone (branching on
        // entity.type). Runs each round for every affected stander, after the
        // affects filter and after the flat damage/status are applied.
        this.onTickFn = opts.onTickFn ?? null
        this.affects = opts.affects ?? "all"
        this.gfx = null

        for (const t of this.tiles) registerHazardTile(t.x, t.y, this)
        this._draw()
        tm.addEntity(this)
    }

    _draw() {
        const scene = dungeon.scene
        if (!scene) return
        const ts = mapState.tileSize || 16
        const style = ZONE_STYLE[this.kind] ?? ZONE_STYLE.default
        const g = scene.add.graphics().setDepth(8)   // above floor (0), below actors (10)
        g.fillStyle(style.color, style.alpha)
        for (const t of this.tiles) {
            g.fillRect(mapState.map.tileToWorldX(t.x), mapState.map.tileToWorldY(t.y), ts, ts)
        }
        this.gfx = g
    }

    // Once per round (TurnManager.refresh). Apply the lingering effect to anyone
    // standing in the cloud, then count down and expire.
    refresh() {
        for (const t of this.tiles) {
            // combatantAtTile, not entityAtTile: the latter returns the FIRST
            // entity on a tile and stops, so an enemy standing on a dropped item
            // or a loot bag was masked by it and the zone skipped that tile
            // entirely. affectsEntity would then reject the item and the actor
            // underneath took nothing. Same fault fixed in the ability layer on
            // 2026-09-20; zones have it for the same reason.
            const entity = mapState.combatantAtTile(t.x, t.y)
            if (!affectsEntity(entity, this.affects)) continue
            if (this.damage != null) {
                const dmg = typeof this.damage === "number"
                    ? this.damage
                    : Phaser.Math.Between(this.damage.min, this.damage.max)
                // Zones are area effects: a magic-flavored zone reaches a burrowed
                // (Dig) target; a physical one doesn't (see resolveDamage).
                resolveDamage(entity, dmg, this.damageFlavor, { aoe: true })
            }
            if (this.onTickStatuses) applyStatuses(entity, this.onTickStatuses)
            if (this.onTickFn) this.onTickFn(entity)
        }
        this.duration -= 1
        if (this.duration <= 0) this._expire()
    }

    // Stepped into mid-round (Hazards.triggerHazardsAt). Applies the on-enter
    // rider (Root from a web, Poison from gas, Slow+Bleed from caltrops).
    onEnter(entity) {
        if (!affectsEntity(entity, this.affects)) return
        if (this.onEnterStatuses) applyStatuses(entity, this.onEnterStatuses)
        if (this.onEnterFn) this.onEnterFn(entity)
    }

    // Shift the whole zone by (dx, dy) — the telekinesis "shove the cloud" hook.
    // Unregister old tiles, move to the new FLOOR tiles (terrain check, NOT
    // isWalkableTile, so a cloud can be dragged onto an actor-occupied floor tile —
    // e.g. shove fire onto an enemy), re-register, and redraw. Returns true if it
    // landed on at least one floor tile.
    relocate(dx, dy) {
        const moved = this.tiles
            .map(t => ({ x: t.x + dx, y: t.y + dy }))
            .filter(t => mapState.level?.[t.y]?.[t.x] === 0)
        if (moved.length === 0) return false
        for (const t of this.tiles) unregisterHazardTile(t.x, t.y, this)
        this.tiles = moved
        for (const t of this.tiles) registerHazardTile(t.x, t.y, this)
        if (this.gfx) { this.gfx.destroy(); this.gfx = null }
        this._draw()
        return true
    }

    // Smothered/frozen by frost (Frost Tomb's world-interaction): the zone is
    // snuffed out (a fire/gas field freezes solid). Same teardown as expiry.
    freeze() {
        this._expire()
    }

    _expire() {
        for (const t of this.tiles) unregisterHazardTile(t.x, t.y, this)
        if (this.gfx) { this.gfx.destroy(); this.gfx = null }
        tm.removeEntity(this)
    }

    // TurnManager contract: over() true means it never gates the round or gets a
    // turn() — all its work happens in refresh().
    over() { return true }
    turn() {}
}
