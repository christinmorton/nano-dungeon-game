// patterns.js — composable ability DELIVERY patterns (Layer 2 of the ability
// stack). The three layers:
//   1. verbs (universals.js)      — irreducible physics: resolveDamage, beam, ...
//   2. patterns (this file)       — the SHAPE of an ability: which tiles/entities
//                                    it reaches and how the payload lands on each.
//   3. declarative payload        — the fields on Ability.js (damageMin/Max/Stat/
//                                    Type, appliesStatus, shape) read via rollDamage.
//
// An ability's activate() collapses to "pick a pattern, pass `this`": the
// pattern reads the ability's declarative fields, so the rank-up / augment
// system tunes behavior by editing data (extend a shape, scale damage, inject a
// status) instead of rewriting imperative activate() bodies.
//
// These are the GENRE ARCHETYPES, pitched at "reusable component" — not one
// pattern per ability. A nova is shapeStrike + a circle shape; a charm and a
// slow both flow through afflict; Charge and Lunge are gapCloseStrike with
// different riders. Grouped below as ATTACK / DEFENSE / SUPPORT, but they're
// flat exports — an ability composes whichever it needs.

import mapState from '../MapState.js'
import gameLog from '../GameLog.js'
import dungeon from '../Dungeon.js'
import tm from '../TurnManager.js'
import { playCast, playBurst, playSplash, playSlashArc, playBeam, playLunge, playTrail } from '../Animations.js'
import {
    resolveDamage, castSpell, knockback, glide, teleport, heal, drain, absorb, cleanse, dispel,
} from './universals.js'
import { shapeOffsets } from './shapes.js'
import { wall, wallLineTiles } from '../hazards/Wall.js'
import ZoneEffect from '../hazards/ZoneEffect.js'
import { hazardsAt } from '../hazards/Hazards.js'
import { applyCounter } from '../tags/counter.js'
import { applyMark } from '../tags/mark.js'
import { applyAura } from '../tags/aura.js'
import { applyTransform } from '../tags/transform.js'
import { applyStun } from '../tags/stun.js'
import { applyDaze } from '../tags/daze.js'

// --- The payload applier ----------------------------------------------------

// Land one ability's declarative payload on a single victim: roll its damage
// (Ability.rollDamage reads damageMin/Max/Stat), resolve it through the armor/
// shield/death path, and apply appliesStatus to a survivor. The ONE place the
// "roll -> resolve -> status" block lived copy-pasted in every bolt; every
// pattern below routes its per-target hit through here. Returns resolveDamage's
// { applied, killed } so a pattern can branch (e.g. don't arc off a corpse).
//
// Zero-damage abilities (a pure debuff / control — Enfeeble, Curse, a charm)
// skip the damage path entirely and just apply the status: this is what lets
// `afflict` be "a bolt whose payload is a status" with no special-casing.
export function dealHit(ability, caster, victim, { mult = 1, bonus = 0, aoe = false } = {}) {
    if (!victim?.sprite) return { applied: 0, killed: false }
    const damaging = ability.damageMin || ability.damageMax || ability.damageStat
    if (!damaging) {
        if (ability.appliesStatus) for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
        return { applied: 0, killed: false }
    }
    // bonus = flat add (e.g. Conductive); mult = scale (e.g. a chain's per-hop falloff).
    let raw = ability.rollDamage(caster) + bonus
    if (mult !== 1) raw = Math.round(raw * mult)
    // aoe lets an area pattern (shapeStrike/areaStrike) reach a burrowed target when
    // it's magic — single-target dealHit (bolt) leaves it false. See resolveDamage.
    // attacker threads the caster so ability kills/hits fire onKill/onDamaged.
    // baseFlavor lets the caster's affinity AMPLIFY a matching-element ability
    // (Fire affinity + a fire ability) rather than just layer onto it (§14).
    const result = resolveDamage(victim, raw, ability.damageType, { aoe, attacker: caster, baseFlavor: ability.damageFlavor })
    if (!result.killed && ability.appliesStatus) {
        for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
    }
    return result
}

// =============================================================================
// ATTACK patterns
// =============================================================================

// Paint the ability's `shape` from an arbitrary origin and land its payload on
// every enemy in the footprint. The shared core of shapeStrike (origin =
// caster) and areaStrike (origin = a clicked tile). Directional shapes
// (cone/line/arc/bar) emanate along (dx, dy); radial shapes (circle/square/
// ring/polygon/...) ignore direction and center on the origin.
//
// Occlusion: tiles are processed near->far. A wall in a directional shape's
// column shadows farther tiles in that column (so a line stops at the first
// wall, a cone doesn't spray through pillars). Radial shapes only clip per-tile.
// Enemies do NOT block — a spray/beam pierces every body in its area.
//
// FX (tint = fx.tint ?? ability.fxColor drives the whole effect):
//   fx.splash — paint a splat on EVERY footprint tile (a spray/AOE telegraph,
//               e.g. Acid Spray's green cone). Otherwise a single area burst.
function paintShape(ability, caster, originX, originY, dx, dy, fx = {}) {
    // fx.shape lets a caller override the ability's declared shape for THIS cast
    // without mutating the field (so progression's base snapshot stays pristine)
    // — e.g. a charged beam that widens its `beamLine` per overcharge stack.
    const spec = fx.shape ?? ability.shape ?? { kind: 'cone' }
    const offsets = shapeOffsets(spec, dx, dy).slice().sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))

    const tint = fx.tint ?? ability.fxColor
    playCast(caster, { type: fx.castType ?? 'arcane', tint })

    const blockedColumns = new Set()
    const footprint = []   // every valid tile the shape covers (for the splash FX)
    const victims = []
    let maxReach = 0       // farthest along-aim distance reached (for the beam FX)
    for (const offset of offsets) {
        if (offset.col != null && blockedColumns.has(offset.col)) continue
        const tx = originX + offset.dx
        const ty = originY + offset.dy
        // Occlusion is TERRAIN-only: a spray flows over and coats entities (so an
        // enemy's tile is part of the footprint and the splash lands on it), and
        // is stopped only by a real wall (level grid !== 0 = solid) or a blocking
        // structure. NOT isWalkableTile — that also rejects occupied tiles.
        const row = mapState.level[ty]
        const wallBlocks = !row || row[tx] === undefined || row[tx] !== 0
            || mapState.blockingStructureAt(tx, ty, caster)
        if (wallBlocks) {
            if (offset.col != null) blockedColumns.add(offset.col)   // shadow the lane behind a wall
            continue
        }
        footprint.push({ x: tx, y: ty })
        if ((offset.dist ?? 0) > maxReach) maxReach = offset.dist ?? 0
        const victim = mapState.entityAtTile(tx, ty)
        if (victim && victim.type === 'enemy') victims.push(victim)
    }

    if (fx.beam) {
        // A continuous BEAM through the footprint — one bar from the origin to the
        // farthest tile reached (stops at the wall that clipped it), as wide as the
        // shape. Replaces the row-of-circles look for piercing beams.
        const endX = originX + dx * maxReach
        const endY = originY + dy * maxReach
        // 0.72 of a lane per tile-width — "partly fills" each square rather than a
        // solid block, while a multi-lane beam still spans its lanes.
        playBeam(originX, originY, endX, endY, { color: tint, width: (spec.width ?? 1) * 0.72 })
    } else if (fx.splash) {
        for (const tile of footprint) playSplash(tile.x, tile.y, { color: tint, residue: fx.residue })
    } else {
        // Area flourish — a forward burst for directional shapes, centered for radial.
        const isDirectional = dx !== 0 || dy !== 0
        const focusReach = isDirectional ? Math.min(spec.length ?? 2, 2) : 0
        playBurst(originX + dx * focusReach, originY + dy * focusReach, { color: tint })
    }

    // fx.bonus = a flat damage add on every tile of THIS cast (charged-beam
    // overcharge folds in here without touching the ability's base damage).
    const results = victims.map(victim => ({ entity: victim, result: dealHit(ability, caster, victim, { bonus: fx.bonus ?? 0, aoe: true }) }))
    return { footprint, victims, results }
}

// SHAPE strike — paint the ability's `shape` from the CASTER along (dx, dy).
// The everyday area ability: a cone spray, a line pierce, a self-centered nova
// (shape {kind:'circle'}, dx=dy=0), a cleave arc. See paintShape for occlusion.
export function shapeStrike(ability, caster, dx = 0, dy = 0, fx = {}) {
    const { results } = paintShape(ability, caster, caster.x, caster.y, dx, dy, fx)
    const hit = results.length
    gameLog.log(hit
        ? `${caster.name}'s ${ability.name} hits ${hit} ${hit === 1 ? 'enemy' : 'enemies'}.`
        : `${caster.name} unleashes ${ability.name}.`)
    return results
}

// AREA strike — the SKILLSHOT twin of shapeStrike: paint the ability's `shape`
// centered on a remote `tile` (the aoeTile click target), oriented along the
// caster->tile direction for directional shapes. Lobbed Fireball-at-an-area,
// Arrow Storm, an area ultimate. `tile` is the resolved { x, y }.
export function areaStrike(ability, caster, tile, fx = {}) {
    const dx = Math.sign(tile.x - caster.x)
    const dy = Math.sign(tile.y - caster.y)
    const { results } = paintShape(ability, caster, tile.x, tile.y, dx, dy, fx)
    const hit = results.length
    gameLog.log(hit
        ? `${caster.name}'s ${ability.name} blasts ${hit} ${hit === 1 ? 'enemy' : 'enemies'}.`
        : `${caster.name} hurls ${ability.name}.`)
    return results
}

// BOLT — the everyman single-target attack: a projectile (or instant strike) at
// one enemy that lands the declarative payload (damage and/or status) via
// dealHit. Mana Dart, Rime Lance, Poison Bolt, Edict, Ice Shard all collapse to
// this. A zero-damage bolt IS the `afflict` archetype (see below). opts:
//   castType   — the cast-pulse preset ('arcane','fire',...); null skips it.
//   projectile — { attackTile, tint } for playProjectile; omit for a hitscan.
//   instant    — true = no projectile, apply immediately (an adjacent strike).
//   onImpact(victim, result) — extra rider after the payload lands.
export function bolt(ability, caster, victim, opts = {}) {
    const { castType = 'arcane', projectile, instant = false, onImpact, delay = 0 } = opts
    const land = () => {
        const result = dealHit(ability, caster, victim)
        if (result.applied) {
            gameLog.log(`${caster.name}'s ${ability.name} hits ${victim.name} for ${result.applied}.`)
        } else {
            gameLog.log(`${caster.name}'s ${ability.name} strikes ${victim.name}.`)
        }
        onImpact?.(victim, result)
        return result
    }
    if (instant) {
        if (castType) playCast(caster, { type: castType, tint: ability.fxColor })
        return land()
    }
    castSpell(caster, victim, { castType, projectile, onImpact: () => land(), delay })
}

// CHAIN — fire a projectile at `first`, deal the payload, then BOUNCE: from each
// struck enemy hop to the nearest not-yet-hit enemy within `chainRadius`
// (Chebyshev), up to `maxArcs` jumps. A true TRAVELING chain (walks across a
// pack), not a cluster around the first hit. Each hop is weakened by `falloff`
// (^hop), and `ability.bonusDamage` is added to every link (dealHit carries the
// per-link mult/bonus). The path is built up front — positions fixed for an
// instant cast.
export function chain(ability, caster, first, opts = {}) {
    const { castType = 'arcane', projectile, chainRadius = 2, maxArcs = 1, falloff = 1 } = opts
    const bonus = ability.bonusDamage || 0

    const hitSet = new Set([first])
    const path = []
    let current = first
    for (let i = 0; i < maxArcs; i++) {
        const next = nearestUnhitEnemy(current, chainRadius, hitSet)
        if (!next) break
        hitSet.add(next)
        path.push(next)
        current = next
    }

    castSpell(caster, first, {
        castType,
        projectile,
        onImpact: () => {
            const result = dealHit(ability, caster, first, { bonus })
            gameLog.log(`${ability.name} hits ${first.name} for ${result.applied}.`)
            // Arc through the path, each hop weaker than the last by `falloff`.
            let source = first.sprite ? first : caster
            let mult = falloff
            for (const next of path) {
                const linkMult = mult
                const linkSource = source
                castSpell(caster, next, {
                    castType: null,
                    projectile,
                    chainFromTile: linkSource,
                    onImpact: () => {
                        if (!next.sprite) return
                        const arcResult = dealHit(ability, caster, next, { mult: linkMult, bonus })
                        gameLog.log(`${ability.name} arcs to ${next.name} for ${arcResult.applied}.`)
                    },
                })
                source = next.sprite ? next : source
                mult *= falloff
            }
        },
    })
}

// Nearest not-yet-hit enemy within `radius` (Chebyshev) of `from`, scanning ring
// by ring (nearest first). Returns null if the chain dead-ends. The bounce
// searches from the LAST struck enemy, so the chain travels across a group.
function nearestUnhitEnemy(from, radius, hitSet) {
    for (let r = 1; r <= radius; r++) {
        for (let oy = -r; oy <= r; oy++) {
            for (let ox = -r; ox <= r; ox++) {
                if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue   // ring at distance r
                const entity = mapState.entityAtTile(from.x + ox, from.y + oy)
                if (!entity || entity.type !== 'enemy' || !entity.sprite) continue
                if (hitSet.has(entity)) continue
                return entity
            }
        }
    }
    return null
}

// VOLLEY — fire MANY discrete projectiles instead of one area sweep: the
// "stencil" reading of a shape (vs shapeStrike's "footprint" reading — one
// payload over a whole area). Two source modes:
//   mode 'enemies' — pick up to `count` enemies NEAREST `origin` within
//                    `ability.range`, one projectile + payload at each
//                    (multi-Mana-Dart, Splitshot, a seeking barrage).
//   mode 'tiles'   — the ability's `shape` becomes a set of LANDING POINTS
//                    (pass shape `fill:false` for just the rim/points); one
//                    projectile arcs to each open tile and lands the payload on
//                    any enemy there (arrow storm down a cone, meteors at a
//                    polygon's points).
// count defaults to `ability.projectiles`. perImpact(tileOrVictim, result) is an
// optional rider per landing (e.g. drop a groundZone at each point). All
// projectiles fire from one cast pulse.
export function volley(ability, caster, opts = {}) {
    const {
        mode = 'enemies',
        count = ability.projectiles || 3,
        origin = caster,
        castType = 'arcane',
        projectile,
        perImpact,
    } = opts
    playCast(caster, { type: castType, tint: ability.fxColor })

    if (mode === 'tiles') {
        const ox = origin.x ?? caster.x
        const oy = origin.y ?? caster.y
        const dx = Math.sign(ox - caster.x)
        const dy = Math.sign(oy - caster.y)
        const offsets = shapeOffsets(ability.shape ?? { kind: 'cone' }, dx, dy)
        let fired = 0
        for (const offset of offsets) {
            const tx = ox + offset.dx
            const ty = oy + offset.dy
            if (mapState.level?.[ty]?.[tx] !== 0) continue            // skip walls / out-of-bounds
            fired++
            castSpell(caster, { x: tx, y: ty }, {
                castType: null,
                projectile,
                onImpact: () => {
                    const victim = mapState.entityAtTile(tx, ty)
                    const result = (victim && victim.type === 'enemy')
                        ? dealHit(ability, caster, victim)
                        : { applied: 0, killed: false }
                    perImpact?.({ x: tx, y: ty }, result)
                },
            })
        }
        gameLog.log(`${caster.name}'s ${ability.name} rains down ${fired} strikes.`)
        return fired
    }

    // mode 'enemies' — nearest-first selection within range.
    const victims = enemiesNear(origin, ability.range || 5, count)
    for (const victim of victims) {
        castSpell(caster, victim, {
            castType: null,
            projectile,
            onImpact: () => {
                if (!victim.sprite) return
                const result = dealHit(ability, caster, victim)
                perImpact?.(victim, result)
            },
        })
    }
    gameLog.log(victims.length
        ? `${caster.name}'s ${ability.name} strikes ${victims.length} ${victims.length === 1 ? 'enemy' : 'enemies'}.`
        : `${caster.name}'s ${ability.name} finds no targets.`)
    return victims.length
}

// Up to `max` enemies nearest `origin` within `radius` (Chebyshev), scanned ring
// by ring so the closest come first. The selection pool for volley's 'enemies' mode.
function enemiesNear(origin, radius, max = Infinity) {
    const found = []
    for (let r = 1; r <= radius && found.length < max; r++) {
        for (let dy = -r; dy <= r && found.length < max; dy++) {
            for (let dx = -r; dx <= r && found.length < max; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue   // ring at distance r
                const entity = mapState.entityAtTile(origin.x + dx, origin.y + dy)
                if (entity && entity.type === 'enemy' && entity.sprite) found.push(entity)
            }
        }
    }
    return found
}

// COMBO STRIKE — land the payload on ONE target `hits` times in a single turn
// (Combo Strike, a flurry, a 5-hit finisher). `ramp` scales each successive hit
// (1 = flat, 1.25 = escalating). Stops early if the target drops. Two damage
// models: `weaponAttack: true` rolls the equipped weapon each hit (the melee
// default — full attack roll); otherwise the declarative dealHit payload. The
// "different kinds of the same attack" knob the design called for: hit count,
// ramp, and which model are all config.
export function comboStrike(ability, caster, victim, opts = {}) {
    const { hits = 3, ramp = 1, weaponAttack = false, fxArc = true } = opts
    let mult = 1
    let landed = 0
    for (let i = 0; i < hits; i++) {
        if (!victim?.sprite) break
        if (fxArc) playSlashArc(victim.x, victim.y)
        const result = weaponAttack
            ? resolveDamage(victim, caster.attack(), ability.damageType || 'physical', { attacker: caster })
            : dealHit(ability, caster, victim, { mult })
        landed++
        gameLog.log(`${caster.name}'s ${ability.name} hit ${i + 1} deals ${result.applied} to ${victim.name}.`)
        if (result.killed) break
        mult *= ramp
    }
    return landed
}

// GAP-CLOSE STRIKE — glide toward (dx, dy) up to `maxSteps`, then strike the
// first enemy the path runs into (+ optional knockback / status riders). Charge,
// Lunge, a dashing attack. `weaponAttack` (default) routes the hit through the
// full Combat pipeline (dungeon.attackEntity); set false to use the declarative
// dealHit. Returns false (no cost paid) when there's nowhere to go.
export function gapCloseStrike(ability, caster, dx, dy, opts = {}) {
    const { maxSteps = ability.range || 3, knockbackTiles = 0, statuses = [], weaponAttack = true } = opts
    const result = glide(caster, dx, dy, maxSteps)
    const victim = result.blockedByEntity?.type === 'enemy' ? result.blockedByEntity : null

    if (result.steps === 0 && !victim) {
        gameLog.log(`${caster.name}'s ${ability.name} has nowhere to go.`)
        return false
    }
    if (victim) {
        // No room to dash (the target was already adjacent) — the glide played no
        // body movement, so reproduce the charge read at point-blank range: thrust
        // the charger forward into the victim AND streak the same dash trail glide
        // would have drawn, from the charger into the target's tile.
        if (result.steps === 0) {
            playTrail(caster.x, caster.y, victim.x, victim.y)
            playLunge(caster, dx, dy)
        }
        if (weaponAttack) {
            const weapon = caster.currentWeapon?.()
            if (weapon) dungeon.attackEntity(caster, victim, weapon)
            else resolveDamage(victim, caster.attack?.() ?? 0, ability.damageType || 'physical')
        } else {
            dealHit(ability, caster, victim)
        }
        if (victim.sprite) {
            if (knockbackTiles) knockback(victim, dx, dy, knockbackTiles)
            for (const status of [].concat(statuses)) victim.addTag(status)
        }
    }
    return { steps: result.steps, victim }
}

// DRAIN STRIKE — damage a target and transfer a fraction back to the caster (the
// `drain` verb): resource 'hp' = lifesteal, 'mp' = sap movement. Siphon,
// Disjunction, a vampiric bolt. Also applies appliesStatus to a survivor. Works
// as a one-shot or, for a channel, called each tick from Ability.tick().
export function drainStrike(ability, caster, victim, opts = {}) {
    const { resource = 'hp', ratio = 0.5, castType = 'arcane', projectile, instant = false } = opts
    const land = () => {
        const r = drain(caster, victim, ability.rollDamage(caster), {
            damageType: ability.damageType, resource, ratio,
        })
        if (!r.killed && ability.appliesStatus) {
            for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
        }
        gameLog.log(`${caster.name}'s ${ability.name} drains ${r.applied} from ${victim.name}`
            + (r.gained ? ` (+${r.gained} ${resource})` : '') + '.')
        return r
    }
    if (instant) {
        if (castType) playCast(caster, { type: castType, tint: ability.fxColor })
        return land()
    }
    castSpell(caster, victim, { castType, projectile, onImpact: () => land() })
}

// =============================================================================
// MOVEMENT / POSITIONING patterns (mobility WITHOUT a strike — the positioning
// cousins of gapCloseStrike; all compose the glide/teleport verbs, all in-combat)
// =============================================================================

// REPOSITION — the dash-step: move the CASTER to a tile computed RELATIVE to a
// target (or a clicked tile). Pure positioning, no attack (vs gapCloseStrike).
//   placement 'toTile'    — go to the resolved { tile } directly.
//   placement 'toAdjacent'— the open tile next to the target nearest the caster.
//   placement 'behind'    — the tile on the FAR side of the target (flank/shadowstep).
// mode 'teleport' (default — a blink-step, ignores the path) or 'glide' (a dash
// along the line, stops at obstacles). Returns the landing tile, or false.
export function reposition(ability, caster, target, opts = {}) {
    const { placement = 'toTile', mode = 'teleport', castType } = opts
    const dest = repositionDest(caster, target, placement)
    if (!dest) {
        gameLog.log(`${ability.name}: no open tile to step to.`)
        return false
    }
    if (mode === 'glide') {
        const dx = Math.sign(dest.x - caster.x)
        const dy = Math.sign(dest.y - caster.y)
        glide(caster, dx, dy, Math.max(Math.abs(dest.x - caster.x), Math.abs(dest.y - caster.y)))
    } else {
        teleport(caster, dest.x, dest.y)
    }
    if (castType) playCast(caster, { type: castType, tint: ability.fxColor })
    gameLog.log(`${caster.name} repositions.`)
    return dest
}

// Resolve reposition's destination tile from the placement rule. Returns a
// walkable, UNOCCUPIED { x, y } (isWalkableTile already excludes occupied tiles)
// or null when there's nowhere valid.
function repositionDest(caster, target, placement) {
    const entity = target?.entity
    if (placement === 'behind' && entity) {
        const dx = Math.sign(entity.x - caster.x)
        const dy = Math.sign(entity.y - caster.y)
        const tx = entity.x + dx
        const ty = entity.y + dy
        return mapState.isWalkableTile(tx, ty) ? { x: tx, y: ty } : null
    }
    if (placement === 'toAdjacent' && entity) {
        let best = null
        let bestDist = Infinity
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                const tx = entity.x + dx
                const ty = entity.y + dy
                if (!mapState.isWalkableTile(tx, ty)) continue
                const dist = Math.max(Math.abs(tx - caster.x), Math.abs(ty - caster.y))
                if (dist < bestDist) { bestDist = dist; best = { x: tx, y: ty } }
            }
        }
        return best
    }
    // 'toTile' — a clicked / resolved tile.
    const tile = target?.tile || target
    if (tile && mapState.isWalkableTile(tile.x, tile.y)) return { x: tile.x, y: tile.y }
    return null
}

// SWAP — trade places with a target (teleport-other). Save an ally by pulling it
// to safety as you take its spot, or rip an enemy out of formation. Positions
// are captured before either move so the exchange is clean.
export function swap(ability, caster, target, opts = {}) {
    const entity = target?.entity || target
    if (!entity?.sprite) return false
    if (entity.x === caster.x && entity.y === caster.y) return false
    const cx = caster.x
    const cy = caster.y
    teleport(caster, entity.x, entity.y)
    teleport(entity, cx, cy)
    if (opts.castType) playCast(caster, { type: opts.castType, tint: ability.fxColor })
    gameLog.log(`${caster.name} swaps places with ${entity.name}.`)
    return true
}

// LEAP — jump to a destination tile OVER intervening terrain (vs glide, which
// stops at the first wall). The traversal cousin of reposition: the value is
// ignoring the path + an optional landing payload. `onLand(tile)` composes a
// nova for a leap-slam (leap + shapeStrike circle). Lands only on open floor.
export function leap(ability, caster, target, opts = {}) {
    const dest = target?.tile || target
    if (mapState.level?.[dest.y]?.[dest.x] !== 0 || mapState.entityAtTile(dest.x, dest.y)) {
        gameLog.log(`${ability.name}: can't land there.`)
        return false
    }
    teleport(caster, dest.x, dest.y)
    playBurst(dest.x, dest.y, { color: ability.fxColor })   // landing puff
    opts.onLand?.(dest)
    gameLog.log(`${caster.name} leaps.`)
    return dest
}

// =============================================================================
// SUPPORT / CONTROL patterns
// =============================================================================

// AFFLICT — apply a status to a single target with no required damage: the
// debuff / crowd-control / mind-control archetype (Enfeeble=Weaken, Curse, Slow,
// a Stun, a Charm). Mechanically it's a `bolt` whose payload is a status, so it
// just delegates — pass the status via the ability's `appliesStatus` field (and
// optionally a small damage payload too).
//
// NOTE — MIND control (Charm / Confuse / Fear / Berserk) applies its tag here
// today, but the BEHAVIOR (AI taking the new orders) is blocked on the AI
// control-override hook (see v3_ability_encyclopedia.md §4 blocked clusters).
// Hard CC (Stun / Root / Freeze / Sleep / Silence) already works. The pattern is
// the same; only the downstream wiring differs.
export function afflict(ability, caster, victim, opts = {}) {
    return bolt(ability, caster, victim, opts)
}

// IMBUE — graft a DURABLE status onto a target, valence-aware: 'enchant'
// (beneficial) or 'curse' (malign) — two sides of one coin, the way
// cleanse/dispel are one removal verb split by valence. Distinct from
// selfBuff/afflict in INTENT: imbue's statuses are meant to PERSIST (no short
// combat timer — they're removed by cleanse/dispel or a condition) and can
// carry a conditional rider (effectively a temporary attached trait). That
// durability/condition lives in the STATUS template; this pattern is the
// valence-aware applier + the home for the (future) item/tile targets.
//
// NOTE — today it grafts onto a CREATURE. Enchanting an ITEM (weapon affix) or a
// TILE is stubbed: it needs the item-affix consumer (affixes are inert metadata
// today) and a tile-status holder. Flagged rather than faked.
export function imbue(ability, caster, target, opts = {}) {
    const {
        valence = 'enchant',
        statuses = ability.appliesStatus,
        castType = valence === 'curse' ? 'arcane' : 'heal',
    } = opts
    const entity = target?.entity || target?.hero || target || caster
    if (entity?.type === 'item' || entity?.type === 'tile') {
        gameLog.log(`${ability.name}: imbuing objects isn't wired yet.`)
        return false
    }
    const tags = [].concat(statuses || []).filter(Boolean)
    for (const status of tags) entity.addTag(status)
    if (castType) playCast(entity, { type: castType, tint: ability.fxColor })
    gameLog.log(`${caster.name} ${valence === 'curse' ? 'curses' : 'enchants'} ${entity.name}.`)
    return tags.length > 0
}

// CONTROL — apply a mind-control / hard-CC status to a target, passing the
// caster as the control SOURCE. The charm/disorient archetype (distinct from
// afflict's debuffs): Charm flips the target to YOUR side, Stun/Root/Freeze/
// Sleep lock it down. The source matters for Charm (whose side to join), so it's
// stamped on the victim as `_controlSource` before the tag applies — Taggable
// init-args can't carry an object cleanly. `turns` overrides the status's
// default duration. instant by default (a touch/gaze); pass a projectile to make
// it a ranged hex.
//
// NOTE — Charm + hard CC (Stun/Root/Freeze/Sleep) work today. Fear/Confuse/
// Berserk-lock apply their tag but their full behavior is still being wired
// (turn-cycle hooks) — see tags/{fear,confuse,berserk}.js.
export function control(ability, caster, victim, opts = {}) {
    const { status = ability.appliesStatus, turns, castType = 'arcane', projectile, instant = true } = opts
    if (!victim?.sprite) return false
    const apply = () => {
        if (!victim.sprite) return
        victim._controlSource = caster
        for (const tag of [].concat(status || [])) victim.addTag(tag, turns)
        gameLog.log(`${caster.name}'s ${ability.name} grips ${victim.name}.`)
    }
    if (instant) {
        if (castType) playCast(caster, { type: castType, tint: ability.fxColor })
        apply()
    } else {
        castSpell(caster, victim, { castType, projectile, onImpact: apply })
    }
    return true
}

// TRANSFORM — temporarily swap a target's FORM (art/tint + optional stats/hp).
// Self transform = a rage/mist form (the hero keeps control); target polymorph =
// morph an enemy into a harmless critter (form swap + `harmless`, so the enemy
// stumbles idly via archetypes/mindControl.js — no captain/squad-AI edits).
// `harmless` defaults true when targeting an enemy, false for self. (Backend:
// tags/transform.js.)
export function transform(ability, caster, target, opts = {}) {
    const entity = target?.entity || target?.hero || target || caster
    if (!entity?.sprite) return false
    applyTransform(entity, {
        turns: opts.turns ?? 3,
        art: opts.art ?? null,
        tint: opts.tint ?? null,
        stats: opts.stats ?? null,
        hp: opts.hp ?? null,
        harmless: opts.harmless ?? (entity.type === 'enemy'),
    })
    if (opts.castType) playCast(caster, { type: opts.castType, tint: ability.fxColor })
    return true
}

// DISPLACE — shove a target relative to the caster (the `knockback` verb).
// mode 'push' hurls it away, 'pull' drags it closer (Gale / Force Push /
// Grapple). Applies appliesStatus as a rider. Returns knockback's { moved, collided }.
export function displace(ability, caster, victim, opts = {}) {
    const { distance = 1, mode = 'push' } = opts
    if (!victim?.sprite) return { moved: 0, collided: false }
    let dx = Math.sign(victim.x - caster.x)
    let dy = Math.sign(victim.y - caster.y)
    if (mode === 'pull') { dx = -dx; dy = -dy }
    const result = knockback(victim, dx, dy, distance)
    if (ability.appliesStatus) for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
    gameLog.log(`${caster.name}'s ${ability.name} ${mode === 'pull' ? 'drags in' : 'hurls back'} ${victim.name}.`)
    return result
}

// SLAM — knockback WITH CONSEQUENCES. Shove `victim` back `distance` tiles along
// (dx, dy); if it COLLIDES with a wall, a blocking structure, or another entity
// (knockback reports this), the impact STUNS the victim — it loses the rest of
// this turn AND is stunned next turn (applyStun) — and whatever it crashed INTO,
// if an enemy, is DAZED (collateral). Shoved into open space it just slides: no
// stun, since aiming a target into a wall is the skill. The reusable "launch into
// a wall" primitive — any knockback ability can swap plain knockback for this.
// Returns { moved, collided, into } (into = the entity it slammed into, or null).
export function slam(victim, dx, dy, distance = 1) {
    if (!victim?.sprite) return { moved: 0, collided: false, into: null }
    const result = knockback(victim, dx, dy, distance)
    if (!result.collided) return { ...result, into: null }
    // The obstacle sits on the tile just past where the victim stopped.
    const into = mapState.entityAtTile(victim.x + dx, victim.y + dy)
    applyStun(victim)
    if (into && into.type === 'enemy') applyDaze(into)
    return { ...result, into: into ?? null }
}

// SELF BUFF — apply one or more status tags to the caster (Barrier, Bless,
// Haste, Toughness). `castType` plays the matching cast pulse.
export function selfBuff(caster, statuses, opts = {}) {
    for (const status of [].concat(statuses)) caster.addTag(status)
    if (opts.castType) playCast(caster, { type: opts.castType })
}

// REACTIVE — arm a counter/riposte stance on the caster (the Counter tag): while
// active, the caster strikes back at any attacker that lands a non-fatal hit
// (the retaliation fires from Combat.attack via tryCounter). `damage` null =
// retaliate for the caster's live attackPower; `charges` null = unlimited for
// the duration, else a fixed number of counters. Thorns/Retaliate is the same
// pattern with charges null and a small flat damage.
export function reactive(ability, caster, opts = {}) {
    const damaging = ability.damageMin || ability.damageMax || ability.damageStat
    applyCounter(caster, {
        turns: opts.turns ?? 3,
        damage: opts.damage ?? (damaging ? ability.rollDamage(caster) : null),
        charges: opts.charges ?? null,
        type: ability.damageType,
        reflect: opts.reflect ?? null,
        status: opts.status ?? ability.appliesStatus ?? null,   // debuff attackers (e.g. Rime Ward = Slow)
    })
    if (opts.castType) playCast(caster, { type: opts.castType, tint: ability.fxColor })
    return true
}

// SHIELD SELF — grant the caster a depletable absorb pool (the `absorb` verb;
// the Shield tag, spent before HP). The active-mitigation cousin of selfBuff's
// flat-resistance Barrier. Aegis, Cinder Ward, a shield spell. Returns the pool.
export function shieldSelf(caster, amount, opts = {}) {
    const pool = absorb(caster, amount)
    if (opts.castType) playCast(caster, { type: opts.castType, tint: opts.tint })
    gameLog.log(`${caster.name} raises a shield (${pool}).`)
    return pool
}

// SUPPORT ALLY — heal / shield / buff a single targeted ally (or the caster).
// The pickAlly counterpart of afflict: Heal (healAmount), an ally Bless
// (statuses), a shield grant (shieldAmount) — or any mix. `ally` is the resolved
// entity ({ entity } from pickAlly); falls back to the caster. Returns whether
// anything took effect (an ability can refund a wasted cast on false).
export function supportAlly(ability, caster, ally, opts = {}) {
    const target = ally || caster
    const {
        healAmount = 0,
        shieldAmount = 0,
        statuses = ability.appliesStatus,
        castType = 'heal',
    } = opts
    let did = false
    if (healAmount > 0 && heal(target, healAmount) > 0) did = true
    if (shieldAmount > 0) { absorb(target, shieldAmount); did = true }
    for (const status of [].concat(statuses || [])) if (status) { target.addTag(status); did = true }
    if (castType) playCast(target, { type: castType, tint: ability.fxColor })
    return did
}

// BUFF AURA — apply a status to every friendly unit within `radius` (Chebyshev)
// of the caster, the caster included. A party War Cry / group Haste. `team`
// defaults to the caster's team, so the same pattern serves an enemy captain
// rallying its squad. Returns the number of units buffed.
export function buffAura(ability, caster, opts = {}) {
    const {
        radius = ability.radius || 2,
        statuses = ability.appliesStatus,
        team = caster.team,
        includeSelf = true,
        castType,
    } = opts
    const tags = [].concat(statuses || [])
    let count = 0
    for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
            const isSelf = ox === 0 && oy === 0
            if (isSelf && !includeSelf) continue
            const entity = isSelf ? caster : mapState.entityAtTile(caster.x + ox, caster.y + oy)
            if (!entity || !entity.sprite || entity.team !== team) continue
            for (const status of tags) entity.addTag(status)
            count++
        }
    }
    if (castType) playCast(caster, { type: castType, tint: ability.fxColor })
    return count
}

// PURGE — strip status tags off a target (the cleanse / dispel verbs). mode
// 'cleanse' removes NEGATIVE statuses from an ally (Lustration), 'dispel'
// removes POSITIVE statuses from an enemy (strip its buffs). `target` accepts a
// resolved { entity } / { hero } / a raw entity; defaults to the caster.
// Returns the removed names, or false when there was nothing to strip.
export function purge(ability, caster, target, opts = {}) {
    const entity = target?.entity || target?.hero || target || caster
    const { mode = 'cleanse', count = Infinity, castType = 'heal' } = opts
    const removed = mode === 'dispel' ? dispel(entity, count) : cleanse(entity, count)
    if (castType) playCast(entity, { type: castType, tint: ability.fxColor })
    if (!removed.length) {
        gameLog.log(`${ability.name}: nothing to ${mode}.`)
        return false
    }
    gameLog.log(`${ability.name} ${mode === 'dispel' ? 'strips' : 'cleanses'} ${removed.length} effect(s) from ${entity.name}.`)
    return removed
}

// MARK — stamp a DELAYED detonation on a target (the combo enabler): after
// `turns` rounds it blows up in an AoE (`radius`) for the ability's rolled
// damage. Mark now, cash the payoff later. (Backend: tags/mark.js.)
export function mark(ability, caster, victim, opts = {}) {
    if (!victim?.sprite) return false
    applyMark(victim, {
        turns: opts.turns ?? 3,
        radius: opts.radius ?? ability.radius ?? 1,
        damage: opts.damage ?? ability.rollDamage(caster),
        type: ability.damageType,
        status: opts.status ?? ability.appliesStatus ?? null,   // e.g. Pyre Mark ignites survivors
    })
    if (opts.castType) playCast(caster, { type: opts.castType, tint: ability.fxColor })
    gameLog.log(`${caster.name}'s ${ability.name} marks ${victim.name}.`)
    return true
}

// AURA — a SUSTAINED emanation around the caster: each round it applies damage
// and/or a status to nearby units (`affects` 'enemy' | 'ally' | 'all') within
// `radius`. The continuous counterpart to the one-shot buffAura — a damage field,
// a slow field, a regen field. Persists until removed (or `turns`, if given).
// (Backend: tags/aura.js.)
export function aura(ability, caster, opts = {}) {
    const damaging = ability.damageMin || ability.damageMax || ability.damageStat
    applyAura(caster, {
        radius: opts.radius ?? ability.radius ?? 1,
        damage: opts.damage ?? (damaging ? ability.rollDamage(caster) : 0),
        type: ability.damageType,
        status: opts.status ?? ability.appliesStatus,
        affects: opts.affects ?? 'enemy',
        turns: opts.turns ?? null,
    })
    if (opts.castType) playCast(caster, { type: opts.castType, tint: ability.fxColor })
    gameLog.log(`${caster.name}'s ${ability.name} radiates.`)
    return true
}

// =============================================================================
// TERRAIN patterns
// =============================================================================

// TERRAIN WALL — lay a perpendicular wall line of `ability.wallLength` tiles
// across the cast direction at the chosen tile. Wraps the `wall` hazard verb;
// `wallOpts` carries the per-ability flavor (kind/duration/blocksSight). Returns
// the placed segments, or false (with a log) when there's no room.
export function terrainWall(ability, caster, tile, wallOpts = {}) {
    const tiles = wallLineTiles(caster, tile, ability.wallLength)
    const { segments } = wall(tiles, { blocks: true, blocksSight: false, duration: 4, ...wallOpts })
    if (!segments.length) {
        gameLog.log('There is no room to raise a wall there.')
        return false
    }
    return segments
}

// ENCLOSE — the CAGE: ring the target in wall segments to trap it (or a group).
// The `wall` verb applied to a RING/box outline around a remote `tile` instead
// of terrainWall's line in front of the caster — the stencil idea applied to
// walls. `radius` 1 boxes in a single enemy (the 8 adjacent tiles); a wider
// radius encircles a cluster. Skips occupied/solid tiles so the trapped unit
// keeps its center tile. Reads { x, y } or a resolved { tile }.
export function enclose(ability, caster, target, opts = {}) {
    const center = target?.tile || target
    const { radius = 1, kind = 'ring', blocksSight = false, duration = 3 } = opts
    const offsets = shapeOffsets({ kind, radius }, 0, 0)
    const tiles = offsets
        .map(o => ({ x: center.x + o.dx, y: center.y + o.dy }))
        .filter(t => mapState.level?.[t.y]?.[t.x] === 0 && !mapState.entityAtTile(t.x, t.y))
    const { segments } = wall(tiles, { blocks: true, blocksSight, duration })
    if (!segments.length) {
        gameLog.log('There is no room to raise a cage there.')
        return false
    }
    gameLog.log(`${caster.name}'s ${ability.name} encases the area.`)
    return segments
}

// GROUND ZONE — lay a lingering hazard/effect field over a set of `tiles` (the
// ZoneEffect primitive): an Acid Pool, Noxious Cloud, Hallowed Ground, oil
// slick. Reads ability.appliesStatus as the default per-tick rider and
// ability.damageType as the flavor; opts override (kind/duration/damage/onTick/
// onEnter/onEnterFn/affects). Filters to open floor tiles; false if none remain.
export function groundZone(ability, caster, tiles, opts = {}) {
    const zoneTiles = (tiles || []).filter(t => mapState.level?.[t.y]?.[t.x] === 0)
    if (!zoneTiles.length) {
        gameLog.log('There is no open ground there.')
        return false
    }
    const zone = new ZoneEffect(zoneTiles, {
        kind: opts.kind ?? 'default',
        duration: opts.duration ?? 3,
        damage: opts.damage ?? null,
        damageFlavor: opts.damageFlavor ?? ability.damageType ?? 'physical',
        onTick: opts.onTick ?? ability.appliesStatus,
        onEnter: opts.onEnter ?? null,
        onEnterFn: opts.onEnterFn ?? null,
        onTickFn: opts.onTickFn ?? null,
        affects: opts.affects ?? 'enemy',
    })
    gameLog.log(`${caster.name}'s ${ability.name} blankets the ground.`)
    return zone
}

// =============================================================================
// INTERACTION patterns (act on a tile's CONTENTS or a unit's INVENTORY — the
// non-HP targets; the bridge toward non-combat utility)
// =============================================================================

// INTERACT TILE — act on whatever interactable sits on a tile, via the shared
// interactPrompt/onInteract contract (chests, doors, levers — anything that
// implements onInteract). The generic seam; specialized verbs (break/light/
// disarm) compose their own behavior on top. `target` is a resolved { tile } /
// { x, y }. (The combat-context "non-combat only" gate is a separate, parked system.)
export function interactTile(ability, caster, target, opts = {}) {
    const tile = target?.tile || target
    const entity = tile && mapState.entityAtTile(tile.x, tile.y)
    if (!entity || typeof entity.onInteract !== 'function') {
        gameLog.log(`There's nothing to interact with there.`)
        return false
    }
    entity.onInteract(caster)
    return true
}

// TELEKINESIS — the move-object verb (Arcane world-interaction). Act on whatever
// occupies an AIMED tile (aoeTile, so the tile MAY be occupied), dispatching by
// what's there. Everything is shoved one step AWAY from the caster (the "force"
// reading); interactables are triggered in place instead. REFUSES immovable
// terrain — sturdy walls + locked/blocking doors (the Breach precedent) — and
// never grabs traps (parked, by design). Dispatch priority: interactable → enemy
// → prop → hazard zone. `ability.distance` sets the shove length.
export function telekinesis(ability, caster, target, opts = {}) {
    const tile = target?.tile || target
    if (!tile) return false
    const { x, y } = tile
    const dist = ability.distance ?? opts.distance ?? 1
    const castType = opts.castType ?? 'arcane'
    const fx = () => playCast(caster, { type: castType, tint: ability.fxColor })

    // Refuse immovable terrain (mirror Breach's gates); traps are out of scope.
    if (mapState.isSturdyWallAt?.(x, y)) { gameLog.log(`Telekinesis can't budge a sturdy wall.`); return false }
    if (mapState.isBlockingDoorAt?.(x, y)) { gameLog.log(`Telekinesis can't force a locked door.`); return false }

    const dx = Math.sign(x - caster.x)
    const dy = Math.sign(y - caster.y)
    const entity = mapState.entityAtTile(x, y)

    // Interactable (chest / lever / unlocked door / loot bag) — trigger in place,
    // honoring its own prompt (so a locked/inert one is skipped, not forced).
    if (entity && typeof entity.onInteract === 'function'
        && (typeof entity.interactPrompt !== 'function' || entity.interactPrompt(caster))) {
        entity.onInteract(caster)
        fx()
        return true
    }

    // Enemy — hurl it away (knockback halts on walls / structures / actors).
    if (entity && entity.type === 'enemy') {
        const r = knockback(entity, dx, dy, dist)
        fx()
        gameLog.log(`${caster.name} telekinetically hurls ${entity.name}.`)
        return r.moved > 0 || r.collided
    }

    // Movable prop — shove a tile if there's open floor to receive it.
    if (entity && entity.type === 'prop') {
        const tx = x + dx * dist
        const ty = y + dy * dist
        if (mapState.isWalkableTile(tx, ty)) {
            entity.x = tx; entity.y = ty
            dungeon.moveEntityTo(entity, tx, ty)
            fx()
            gameLog.log(`${caster.name} telekinetically shoves the ${entity.name || 'object'}.`)
            return true
        }
        gameLog.log(`No room to shove it.`)
        return false
    }

    // Hazard zone (no .sprite, so entityAtTile misses it) — drag the cloud aside.
    const zones = hazardsAt(x, y).filter(h => typeof h.relocate === 'function')
    let moved = false
    for (const z of zones) if (z.relocate(dx * dist, dy * dist)) moved = true
    if (moved) {
        fx()
        gameLog.log(`${caster.name} telekinetically drags the hazard aside.`)
        return true
    }

    gameLog.log(`Nothing there to move.`)
    return false
}

// STEAL — lift an item off an enemy and give it to the caster (pickpocket /
// theft). Prefers a quest item, then a real (non-virtual) equipped item. Hands
// off like Container.onInteract (push to items + register with the turn manager).
// Gold isn't a field — it rides as Gem items, so coins steal like any item. Full
// inventory-pick + cap checks are a later refinement on the loot system.
export function steal(ability, caster, victim, opts = {}) {
    const target = victim?.entity || victim
    if (!target?.sprite) return false
    const item = pickStealable(target)
    if (!item) {
        gameLog.log(`${target.name} has nothing to steal.`)
        return false
    }
    detachItem(target, item)
    if (Array.isArray(caster.items)) {
        caster.items.push(item)
        tm.addEntity(item)
    }
    gameLog.log(`${caster.name} steals ${item.name || 'an item'} from ${target.name}.`)
    return item
}

function pickStealable(target) {
    if (Array.isArray(target.quest_items) && target.quest_items.length) return target.quest_items[0]
    const slots = target.equippedSlots || {}
    for (const key of Object.keys(slots)) {
        const item = slots[key]
        if (item && !item.virtual) return item
    }
    return null
}

function detachItem(target, item) {
    if (Array.isArray(target.quest_items)) {
        const i = target.quest_items.indexOf(item)
        if (i >= 0) { target.quest_items.splice(i, 1); return }
    }
    const slots = target.equippedSlots || {}
    for (const key of Object.keys(slots)) {
        if (slots[key] === item) { slots[key] = null; return }
    }
}

// =============================================================================
// SUMMON / DECOY — live in companions/, NOT here (by design)
// =============================================================================
// The summon family pulls the Follower → BaseEnemy chain, which can't be
// imported into broadly-loaded patterns.js/universals.js without a circular-
// import TDZ (see companions/summon.js's header). So they live in companions/
// and abilities import them DIRECTLY:
//   summon(caster, { tile, summonKind, cap, lifespan, name, stats, hp, art, ... })
//       companions/summon.js — spawn a controlled, acting Follower (Stone Golem,
//       Primal Hound, Grave Call). Already used by PrimalHound / SummonAlly.
//   decoy(caster, { tile, ... })
//       companions/decoy.js — a NON-acting copy (clone/illusion) that soaks hits
//       and splits targeting (flagged `_decoy`; the ally brain leaves it standing).
//   convertToAlly(entity, leader) / revertAllegiance — companions/allegiance.js
//       the tame / temporary-charm seam (see tags/charm.js).
// True acting clones = summon with the normal ally brain (no extra system needed).
