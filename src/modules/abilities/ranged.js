import dungeon from '../Dungeon.js'
import mapState from '../MapState.js'
import gameLog from '../GameLog.js'
import tm from '../TurnManager.js'
import { resolveDamage, knockback } from './universals.js'
import { shapeOffsets } from './shapes.js'
import { playArrowRain, playProjectile, playProjectileTrail, playImpact } from '../Animations.js'

// The RANGED (bow) combat style's delivery helpers — the archer's counterpart to
// throwing.js. Where the throwing style rolls its OWN gear-gated damage via
// resolveDamage, bow abilities are WEAPON-DELEGATED: each shot runs through the
// full Combat pipeline (dungeon.attackEntity -> Combat.attack), so dodge / block /
// crit / armor / the bow's damageFlavor AND the weapon's own projectile sprite all
// apply per arrow — exactly like a basic bow click. Damage IS the bow's; abilities
// add only riders (extra flat damage, status, knockback) and a damageMult.
//
// This also keeps the future "special arrows" coating free: it would ride on the
// same Combat.attack damageFlavor path every shot already flows through.

// The equipped mainhand if it's a projectile (ranged) weapon, else null. A bow /
// crossbow / spell-scroll carries an `attackTile` (the projectile frame); a melee
// weapon doesn't. This is the gate for every bow ability — "you need something
// that shoots."
export function equippedRangedWeapon(hero) {
    const mh = hero?.currentWeapon?.()
    return (mh && mh.attackTile != null) ? mh : null
}

// Apply an ability's declarative RIDERS to a struck victim, after the
// weapon-delegated hit. Mirrors the Bash (weapon + rider) template: a flat
// bonusDamage add, status tags, and knockback. Reads ability.bonusDamage /
// appliesStatus / knockbackTiles / damageType. Guarded against a corpse. `mult`
// scales the flat bonus the same way a pierce falloff scales the weapon hit, so a
// ladder-added bonus weakens down the lane too (status/knockback stay binary).
export function applyRangedRiders(ability, hero, victim, dx, dy, mult = 1) {
    if (!victim?.sprite) return
    if (ability.bonusDamage > 0) {
        const bonus = Math.max(1, Math.round(ability.bonusDamage * mult))
        const result = resolveDamage(victim, bonus, ability.damageType || 'physical', { attacker: hero })
        if (result.killed) return
    }
    for (const status of [].concat(ability.appliesStatus || [])) victim.addTag(status)
    if (ability.knockbackTiles > 0) knockback(victim, dx, dy, ability.knockbackTiles)
}

// PIERCING LINE — loose one arrow from the hero THROUGH `target` and keep going:
// strike EVERY enemy along that line (the pierce), out to the ability's reach,
// until a wall stops the shot. Each enemy takes a full weapon-delegated hit plus
// the ability's riders. Returns the number pierced.
//   reach    defaults to ability.range; damageMult scales each hit (weapon-delegated).
//   falloff  (ability.falloff, default 1 = none) MULTIPLIES the damage per enemy
//            already pierced: the 1st takes full, the 2nd ×falloff, the 3rd
//            ×falloff^2, ... — lining shots up still pays, but it's not free AoE.
//
// THE LINE RUNS THROUGH THE CLICKED TILE, and that is the whole fix here. This
// used to reduce the target to `Math.sign(target - hero)` and walk one of the 8
// straight rays. Its caller (PiercingLoose) targets 'pickEnemy', which lets the
// player click ANY enemy within range 7 — 224 tiles, of which only 56 sit on one
// of those rays. So about three quarters of legal targets loosed an arrow down a
// different lane, hit nothing, and still spent the AP and the cooldown. An enemy
// three across and one up got a diagonal shot that sailed past it.
//
// Parameterising by CHEBYSHEV distance instead: step i from 1..reach and take the
// point i/m of the way along the hero->target vector, where m is the target's own
// chebyshev distance. At i === m that lands exactly on the target, so a clicked
// enemy is always struck; beyond m it continues along the same slope. Integer
// rounding does the rasterising, and stepping the dominant axis by exactly one
// per i means no tile is skipped or visited twice.
export function rangedLine(ability, hero, target, opts = {}) {
    const weapon = equippedRangedWeapon(hero)
    if (!weapon) {
        gameLog.log(`${ability.name} needs a ranged weapon.`)
        return false
    }
    const vx = target.x - hero.x
    const vy = target.y - hero.y
    const m = Math.max(Math.abs(vx), Math.abs(vy))
    if (m === 0) return false

    const reach = opts.reach ?? ability.range ?? 7
    const falloff = opts.falloff ?? ability.falloff ?? 1
    // Facing for knockback riders: still the 8-way sign, which is what "shoved
    // away from the shooter" means regardless of the arrow's exact slope.
    const dx = Math.sign(vx)
    const dy = Math.sign(vy)

    // Walk the lane first, collecting what the arrow passes through, so the
    // visuals can be fired ONCE for the whole flight instead of per victim.
    const struck = []
    let endX = hero.x
    let endY = hero.y
    for (let i = 1; i <= reach; i++) {
        const tx = hero.x + Math.round(vx * i / m)
        const ty = hero.y + Math.round(vy * i / m)
        if (!mapState.level[ty] || mapState.level[ty][tx] === undefined) break
        if (mapState.level[ty][tx] === 1) break              // a wall stops the arrow
        endX = tx
        endY = ty
        const entity = mapState.combatantAtTile(tx, ty)
        if (!entity || entity.type !== 'enemy' || !entity.sprite) continue
        struck.push(entity)
    }

    // ONE arrow down the whole lane, with a motion streak riding along with it.
    //
    // THE ARROW IS THE EFFECT. An earlier version drew a glowing playBeam down
    // the lane, which read as an energy beam — wrong for a bow. playTrail was no
    // better: it paints the whole path at once, which is right for a dash (the
    // movement IS instant) and wrong for something in flight. The streak used
    // here travels with the arrow and fades, so it is motion blur rather than a
    // line drawn across the floor, and its timing matches playProjectile's 180ms.
    //
    // Without any of this the ability was visually indistinguishable from a
    // basic shot: each victim went through Combat, and Combat fires its own
    // projectile from the hero, so a single-target pierce played the exact
    // auto-attack animation and a two-target one played it twice. skipFx below
    // is the seam Combat documents for precisely this case ("an ability that
    // supplies its OWN impact visuals").
    //
    // Guarded: a wall right against the hero leaves the lane empty, and drawing
    // an arrow that tweens from the hero's tile to the hero's tile is a stray
    // sprite sitting on top of them.
    if (endX !== hero.x || endY !== hero.y) {
        playProjectile(hero, { x: endX, y: endY }, weapon)
        // Starts one tile out, where playProjectile puts the arrow itself.
        playProjectileTrail(hero.x + dx, hero.y + dy, endX, endY)
    }

    let pierced = 0
    for (const entity of struck) {
        const mult = (ability.damageMult || 1) * Math.pow(falloff, pierced)
        // skipFx: the arrow above is the visual for every one of these hits.
        dungeon.attackEntity(hero, entity, weapon, { damageMult: mult, skipFx: true })
        // Same pale wood tone as the trail — a golden flash here pulled the
        // whole effect back toward looking magical.
        playImpact(entity.x, entity.y, { color: 0xd8cfc0 })
        applyRangedRiders(ability, hero, entity, dx, dy, mult)
        pierced++
    }
    gameLog.log(pierced
        ? `${hero.name}'s ${ability.name} pierces ${pierced} ${pierced === 1 ? 'enemy' : 'enemies'}.`
        : `${hero.name}'s ${ability.name} flies wide.`)
    return pierced
}

// SINGLE SHOT — one weapon-delegated arrow at a picked enemy, then the ability's
// riders. The everyman bow shot the rider-carrying attacks share (Deadeye, Snare
// Shot, Crippling Loose, Barbed Arrow, Concussive Shot). `ability.forceCrit`
// guarantees the crit (Deadeye's precision); `ability.damageMult` scales it.
export function rangedShot(ability, hero, victim) {
    const weapon = equippedRangedWeapon(hero)
    if (!weapon) {
        gameLog.log(`${ability.name} needs a ranged weapon.`)
        return false
    }
    if (!victim?.sprite) return false
    const dx = Math.sign(victim.x - hero.x)
    const dy = Math.sign(victim.y - hero.y)
    dungeon.attackEntity(hero, victim, weapon, {
        damageMult: ability.damageMult || 1,
        forceCrit: ability.forceCrit === true,
    })
    applyRangedRiders(ability, hero, victim, dx, dy)
    return true
}

// SCATTER VOLLEY — one weapon-delegated arrow at each of the N nearest enemies in
// range (Splitshot). `ability.targets` (default 2) is the count; each struck enemy
// also takes the ability's riders. Selection is nearest-first (ring scan), so the
// closest threats are picked. Returns the number hit.
export function rangedVolley(ability, hero, opts = {}) {
    const weapon = equippedRangedWeapon(hero)
    if (!weapon) {
        gameLog.log(`${ability.name} needs a ranged weapon.`)
        return false
    }
    const count = opts.count ?? ability.targets ?? 2
    const victims = nearestEnemies(hero, ability.range || 6, count)
    for (const victim of victims) {
        if (!victim.sprite) continue
        const dx = Math.sign(victim.x - hero.x)
        const dy = Math.sign(victim.y - hero.y)
        dungeon.attackEntity(hero, victim, weapon, { damageMult: ability.damageMult || 1 })
        applyRangedRiders(ability, hero, victim, dx, dy)
    }
    gameLog.log(victims.length
        ? `${hero.name}'s ${ability.name} scatters at ${victims.length} ${victims.length === 1 ? 'enemy' : 'enemies'}.`
        : `${hero.name}'s ${ability.name} finds no targets.`)
    return victims.length
}

// RAPID FLURRY — loose `ability.hits` (default 3) weapon-delegated arrows at ONE
// target in a single turn, stopping early if it drops (Rapid Shot). Riders land
// once, on the survivor, like a combo finisher. Returns the number of arrows that
// actually loosed.
export function rangedFlurry(ability, hero, victim) {
    const weapon = equippedRangedWeapon(hero)
    if (!weapon) {
        gameLog.log(`${ability.name} needs a ranged weapon.`)
        return false
    }
    const dx = Math.sign(victim.x - hero.x)
    const dy = Math.sign(victim.y - hero.y)
    const hits = ability.hits || 3
    let landed = 0
    for (let i = 0; i < hits; i++) {
        if (!victim?.sprite) break
        dungeon.attackEntity(hero, victim, weapon, { damageMult: ability.damageMult || 1 })
        landed++
    }
    if (victim?.sprite) applyRangedRiders(ability, hero, victim, dx, dy)
    gameLog.log(`${hero.name}'s ${ability.name} looses ${landed} ${landed === 1 ? 'arrow' : 'arrows'}.`)
    return landed
}

// ARROW RAIN — loose arrows across a footprint (`ability.shape`, default circle
// r2) centered on a clicked tile; every enemy under it takes a weapon-delegated
// hit + riders (Arrow Storm). The bow counterpart to volley's tiles-mode, but
// weapon-delegated. Skips walls/out-of-bounds. Empty tiles aren't painted (a
// cosmetic-only rain-on-empty-ground pass is a future refinement). Returns the
// number hit.
export function rangedRain(ability, hero, tile) {
    const weapon = equippedRangedWeapon(hero)
    if (!weapon) {
        gameLog.log(`${ability.name} needs a ranged weapon.`)
        return false
    }
    const dx = Math.sign(tile.x - hero.x)
    const dy = Math.sign(tile.y - hero.y)
    // Center-inclusive footprint: circleOffsets EXCLUDES the center tile, so add it
    // back — the tile you aimed at must be in the storm (otherwise the very enemy
    // under the cursor never gets hit). circle never re-includes center, so no dup.
    const offsets = [{ dx: 0, dy: 0 }, ...shapeOffsets(ability.shape ?? { kind: 'circle', radius: 2 }, dx, dy)]
    let hitCount = 0
    let drop = 0
    for (const offset of offsets) {
        const tx = tile.x + offset.dx
        const ty = tile.y + offset.dy
        if (mapState.level?.[ty]?.[tx] !== 0) continue            // skip walls / out-of-bounds
        // Cosmetic arrow on EVERY valid tile (staggered) so the volley reads as a
        // rain over the whole area, not just where enemies happen to stand.
        playArrowRain(tx, ty, { delay: drop++ * 30, color: ability.fxColor })
        const entity = mapState.combatantAtTile(tx, ty)
        if (!entity || entity.type !== 'enemy' || !entity.sprite) continue
        // skipFx: the falling arrow above IS the visual — suppress the weapon's
        // own horizontal projectile so the storm doesn't read as a double shot.
        dungeon.attackEntity(hero, entity, weapon, { damageMult: ability.damageMult || 1, skipFx: true })
        applyRangedRiders(ability, hero, entity, dx, dy)
        hitCount++
    }
    gameLog.log(hitCount
        ? `${hero.name}'s ${ability.name} rains down on ${hitCount} ${hitCount === 1 ? 'enemy' : 'enemies'}.`
        : `${hero.name}'s ${ability.name} rains down on empty ground.`)
    return hitCount
}

// LINGERING RAIN — keep an arrow storm raining over the same area for `rounds`
// more rounds, re-running rangedRain each round (so whoever still stands there
// keeps getting hit, with the falling-arrow visual). A lightweight TurnManager
// ticker — no logical tile / sprite, like ZoneEffect. It PRIME-SKIPS its first
// refresh: the cast already rained this round, so the linger starts next round
// (no back-to-back double volley). Stops early if the hero is gone. `border` is an
// optional graphics handle (the zone outline) destroyed when the storm ends.
export function lingeringRain(ability, hero, tile, rounds, border = null) {
    if (!rounds || rounds <= 0) { border?.destroy?.(); return }
    let left = rounds
    let primed = false
    const finish = (storm) => { border?.destroy?.(); tm.removeEntity(storm) }
    const storm = {
        type: 'hazard',
        refresh() {
            if (!primed) { primed = true; return }       // skip the cast round
            if (!hero?.sprite) { finish(this); return }
            rangedRain(ability, hero, tile)
            left -= 1
            if (left <= 0) finish(this)
        },
        over() { return true },
        turn() {},
    }
    tm.addEntity(storm)
}

// Up to `max` enemies nearest `origin` within `radius` (Chebyshev), scanned ring
// by ring so the closest come first — the selection pool for rangedVolley. Local
// to keep this module self-contained (mirrors patterns.js's enemiesNear).
function nearestEnemies(origin, radius, max = Infinity) {
    const found = []
    for (let r = 1; r <= radius && found.length < max; r++) {
        for (let dy = -r; dy <= r && found.length < max; dy++) {
            for (let dx = -r; dx <= r && found.length < max; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue   // ring at distance r
                const entity = mapState.combatantAtTile(origin.x + dx, origin.y + dy)
                if (entity && entity.type === 'enemy' && entity.sprite) found.push(entity)
            }
        }
    }
    return found
}
