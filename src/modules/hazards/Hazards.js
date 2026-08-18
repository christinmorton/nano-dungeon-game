import Phaser from "phaser"
import mapState from "../MapState.js"
import { resolveDamage } from "../abilities/universals.js"
import { playBurst } from "../Animations.js"
import { getStatusTemplate } from "../tags/Status.js"

// Hazards.js — the shared hazard primitive. Two consumers today and tomorrow:
//   - Throwables (items/ThrowableItem.js) detonate a footprint + drop a zone.
//   - Traps (#47.2, next) will register a Trap entity in the same tile registry
//     and fire on-step via triggerHazardsAt — generator-placed dungeon traps
//     that threaten the player (and any wandering actor), not just deployables.
// VoidRift floor corruption is also a candidate to re-home onto ZoneEffect.
//
// Everything here is direction-agnostic: a hazard damages whatever stands in /
// steps onto it (hero OR enemy), gated only by an `affects` filter. See
// documents/v3_known_issues.md #47.

// Status names that the catalog spells differently from the registered tag.
const STATUS_ALIASES = { Root: "Rooted" }

// Resolve one-or-many status-name strings to templates and apply them. Tolerant
// by design: names with no registered status (e.g. "blocks line-of-sight",
// "cleanse/sear") are skipped so the hazard's damage + visual still play. The
// status's own hooks own its duration/tick — we just stamp it on.
export function applyStatuses(entity, statusNames) {
    if (!entity || !statusNames) return
    const names = Array.isArray(statusNames) ? statusNames : [statusNames]
    for (const raw of names) {
        // Entries are a plain name string, or { name, turns } to apply a custom
        // duration (e.g. a 1-turn Root from a fire wall).
        const isObj = raw && typeof raw === "object"
        const rawName = isObj ? raw.name : raw
        const turns = isObj ? raw.turns : undefined
        const name = STATUS_ALIASES[rawName] ?? rawName
        const template = getStatusTemplate(name)
        if (!template) continue
        if (turns !== undefined) entity.addTag(template, turns)
        else entity.addTag(template)
    }
}

// True if a hazard should act on this entity. Only actors (hero / enemy) take
// hazard effects; props, items, containers on the tile are ignored. `affects`
// narrows further: "all" (default), "enemy", or "hero".
export function affectsEntity(entity, affects = "all") {
    if (!entity || (entity.type !== "hero" && entity.type !== "enemy")) return false
    if (affects === "all") return true
    return entity.type === affects
}

// Walkable tiles within a chebyshev `radius` of a center, INCLUDING the center.
// Zones only cover floor (no fire painted onto walls).
export function footprintTiles(centerX, centerY, radius = 1) {
    const tiles = []
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const x = centerX + dx
            const y = centerY + dy
            if (mapState.isWalkableTile(x, y)) tiles.push({ x, y })
        }
    }
    return tiles
}

function rollDamage(damage) {
    if (damage == null) return null
    if (typeof damage === "number") return damage
    return Phaser.Math.Between(damage.min, damage.max)
}

// Instant area burst at a center tile — damage + status across the footprint,
// INCLUDING the center (unlike universals.shockwave, which is caster-centered
// and skips its origin). The shared "impact" used by thrown flasks now and
// trap detonations next. Returns the list of actors hit.
export function detonate(centerX, centerY, opts = {}) {
    const {
        radius = 1,
        damage = null,
        damageFlavor = "physical",
        statuses = null,
        affects = "all",
        color = 0xffe6a8,
    } = opts

    playBurst(centerX, centerY, { radius: Math.max(1, radius), color })

    const hits = []
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const victim = mapState.entityAtTile(centerX + dx, centerY + dy)
            if (!affectsEntity(victim, affects)) continue
            if (damage != null) resolveDamage(victim, rollDamage(damage), damageFlavor)
            if (statuses) applyStatuses(victim, statuses)
            hits.push(victim)
        }
    }
    return hits
}

// --- on-step tile registry ------------------------------------------------
// Keyed "x,y" -> Set<hazard>. A hazard implementing onEnter(entity) registers
// the tiles it covers; Dungeon.moveEntityTo consults this when any entity lands
// on a tile. The registry is a module-level Map that survives scene.restart, so
// it MUST be cleared per floor (Dungeon.initialize calls clearHazards).

const hazardsByTile = new Map()
const keyOf = (x, y) => `${x},${y}`

export function registerHazardTile(x, y, hazard) {
    const k = keyOf(x, y)
    let set = hazardsByTile.get(k)
    if (!set) { set = new Set(); hazardsByTile.set(k, set) }
    set.add(hazard)
}

export function unregisterHazardTile(x, y, hazard) {
    const k = keyOf(x, y)
    const set = hazardsByTile.get(k)
    if (!set) return
    set.delete(hazard)
    if (set.size === 0) hazardsByTile.delete(k)
}

// Fire every hazard covering (x, y) for the arriving entity. The shared trigger
// seam — thrown zones today, generator-placed + deployed traps next. Copies the
// set first: a single-fire trap may unregister itself from inside onEnter.
export function triggerHazardsAt(entity, x, y) {
    // Levitating actors (Wind Levitate) FLOAT over ground hazards + traps — the
    // on-step trigger is skipped entirely while aloft.
    if (entity?._tags?.includes("Levitate")) return
    const set = hazardsByTile.get(keyOf(x, y))
    if (!set || set.size === 0) return
    for (const hazard of [...set]) hazard.onEnter?.(entity)
}

// All hazards covering (x, y) — the READ side of the tile registry. Zones carry
// no .sprite, so entityAtTile can't find them; this is how an ability (e.g. the
// telekinesis verb) inspects / grabs a cloud on a tile. Returns a fresh array.
export function hazardsAt(x, y) {
    const set = hazardsByTile.get(keyOf(x, y))
    return set ? [...set] : []
}

// Drop all registered tiles. Called on floor build (Dungeon.initialize); the
// zone graphics themselves are destroyed by scene.restart.
export function clearHazards() {
    hazardsByTile.clear()
}
