import mapState from '../MapState.js'
import gameLog from '../GameLog.js'
import dungeon from '../Dungeon.js'
import { playTrail, playLunge, playCast } from '../Animations.js'
import { resolveDamage, castSpell, knockback, glide, teleport } from './universals.js'
import { applyStun } from '../tags/stun.js'
import { empowerFor, empowerOnHit } from './empower.js'

// Delivery patterns — the middle layer of the ability stack: verbs (universals)
// below, declarative Ability subclasses above.
//
// v3's patterns.js is 1034 lines carrying roughly thirty patterns, and imports
// six modules v5 cuts (Wall, counter, mark, aura, transform, daze). v5's twelve
// abilities use FOUR of them, so this file is written rather than pruned:
//
//   bolt           — FrostBolt
//   chain          — ArcLightning
//   gapCloseStrike — Charge
//   reposition     — Blink
//
// Each is v3's implementation verbatim; only the affinity commentary in dealHit
// is trimmed, since resolveDamage no longer carries an affinity rider. Adding a
// fifth pattern means porting that one function, not this whole file back.

// Land one ability's declarative payload on a single victim: roll its damage
// (Ability.rollDamage reads damageMin/Max/Stat), resolve it through the armor/
// shield/death path, and apply appliesStatus to a survivor. The ONE place the
// "roll -> resolve -> status" block lives; every pattern routes its per-target
// hit through here. Returns resolveDamage's { applied, killed } so a pattern can
// branch (e.g. don't arc off a corpse).
//
// Zero-damage abilities (a pure debuff / control) skip the damage path entirely
// and just apply the status.
export function dealHit(ability, caster, victim, { mult = 1, bonus = 0, aoe = false } = {}) {
    if (!victim?.sprite) return { applied: 0, killed: false }
    const damaging = ability.damageMin || ability.damageMax || ability.damageStat
    if (!damaging) {
        if (ability.appliesStatus) for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
        return { applied: 0, killed: false }
    }
    // bonus = flat add; mult = scale (e.g. a chain's per-hop falloff).
    let raw = ability.rollDamage(caster) + bonus
    if (mult !== 1) raw = Math.round(raw * mult)
    // aoe lets an area pattern reach targets single-target dealHit would not.
    // attacker threads the caster so ability kills/hits fire onKill/onDamaged.
    const result = resolveDamage(victim, raw, ability.damageType, { aoe, attacker: caster, baseFlavor: ability.damageFlavor })
    if (!result.killed && ability.appliesStatus) {
        for (const status of [].concat(ability.appliesStatus)) victim.addTag(status)
    }
    // The caster's weapon may add a chance-status to spells of this element
    // (a lightning scroll's stun, a fire scroll's burn) — §10.16.
    if (!result.killed) empowerOnHit(ability, caster, victim)
    return result
}

// BOLT — a single-target projectile (or instant strike) carrying the payload.
// A zero-damage bolt is a pure affliction. opts:
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
// (^hop), and `ability.bonusDamage` is added to every link. The path is built up
// front — positions fixed for an instant cast.
export function chain(ability, caster, first, opts = {}) {
    const { castType = 'arcane', projectile, chainRadius = 2, maxArcs = 1, falloff = 1 } = opts
    const bonus = ability.bonusDamage || 0

    // MULTI-STRIKE (§10.16): an empowering weapon makes the chain hit EACH target
    // this many times — the lightning scroll's "hit the same target twice, and if
    // there are two targets, each twice". One projectile per link still; the
    // extra strikes are extra rolls on impact, stopping on a kill.
    const strikes = 1 + (empowerFor(ability, caster)?.extraHits ?? 0)
    const strike = (victim, mult) => {
        let total = 0
        let landed = 0
        for (let i = 0; i < strikes; i++) {
            if (!victim.sprite) break
            const r = dealHit(ability, caster, victim, { mult, bonus })
            total += r.applied
            landed += 1
            if (r.killed) break
        }
        return { total, landed }
    }
    const strikeText = (landed) => landed > 1 ? ` (${landed} strikes)` : ''

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
            const result = strike(first, 1)
            gameLog.log(`${ability.name} hits ${first.name} for ${result.total}${strikeText(result.landed)}.`)
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
                        const arcResult = strike(next, linkMult)
                        gameLog.log(`${ability.name} arcs to ${next.name} for ${arcResult.total}${strikeText(arcResult.landed)}.`)
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
                const entity = mapState.combatantAtTile(from.x + ox, from.y + oy)
                if (!entity || entity.type !== 'enemy' || !entity.sprite) continue
                if (hitSet.has(entity)) continue
                return entity
            }
        }
    }
    return null
}

// GAP-CLOSE STRIKE — glide toward (dx, dy) up to `maxSteps`, then strike the
// first enemy the path runs into (+ optional knockback / status riders).
// `weaponAttack` (default) routes the hit through the full Combat pipeline
// (dungeon.attackEntity); set false to use the declarative dealHit. Returns
// false (no cost paid) when there's nowhere to go.
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

// REPOSITION — move the caster to a resolved destination.
//   placement 'toTile'    — go to the resolved { tile } directly.
//   placement 'toAdjacent'— the open tile next to the target nearest the caster.
//   placement 'behind'    — the tile on the FAR side of the target (flank/shadowstep).
// mode 'teleport' (default — a blink-step, ignores the path) or 'glide' (a dash
// along the line, stops at obstacles). Returns the landing tile, or false.
// SLAM — drive a victim back along (dx, dy) and punish the collision. Plain
// knockback in open space; if the victim hits a wall, an object or another body
// it is STUNNED. Aiming a target into terrain is the whole skill of it.
//
// v3's version also dazed whatever the victim was slammed into. `daze` is not
// among v5's statuses and adding it would have moved a second cap for one
// rider — the same call The Reaving made about `bleed` (scope doc §10.5/§10.6).
// The stun on the shoved enemy is the part that changes a fight.
//
// Returns { moved, collided } straight from knockback.
export function slam(victim, dx, dy, distance = 1) {
    if (!victim?.sprite) return { moved: 0, collided: false }
    const result = knockback(victim, dx, dy, distance)
    if (result.collided) applyStun(victim)
    return result
}

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
