import dungeon from '../Dungeon.js'
import mapState from '../MapState.js'
import gameLog from '../GameLog.js'
import { spawnDamageNumber, spawnHealNumber, spawnBlockNumber, playCast, playProjectile, playHitReaction, playImpact, playBurst, playTrail } from '../Animations.js'
import { getStatusMeta, getStatusTemplate } from '../tags/Status.js'
import { applyDamage } from '../damage.js'
import shield from '../tags/shield.js'

// universals.js — engine-level mechanical verbs that class-signature
// abilities (and future enemy AI / scrolls / level-up unlocks) compose
// against. Per documents/v3_abilities.md these are NOT directly
// invocable from a default keybind — class abilities call into them
// as their backend.
//
// What's here today (slice 7 — extract pass):
//   resolveDamage           ability-side damage application
//   knockback               displace a victim (with collision detect)
//   glide                   probe + snap-move an actor in a direction
//   castSpell               cast pulse + projectile + on-impact callback
//   teleport                snap-move helper
//   heal                    clamped HP restore + heal-number
//   cleanse / dispel        remove status tags by valence
//   shockwave               radial AOE damage around an origin tile
//   beam                    straight-line pierce damage in a direction
//
// What's NOT here yet (next slices):
//   Counter / Riposte       no current consumer (Dwarf 5th candidate)
//   Channel / Interrupt     multi-turn, no current consumer
//   Push/Pull (as verb)     covered by knockback for now
//   Escape / Blink (verb)   no current consumer
//   Drain / Sap / Absorb    no current consumer

// Apply N damage to a victim through the ability-side damage path.
// Bypasses Combat.attack's dodge/block/crit pipeline (intentional —
// ability damage is "guaranteed hit by design") but respects
// victim.protection(damageType) so armor and barrier still mitigate.
// Floors at 1, spawns the damage number, removes the victim on death.
// Returns { applied, killed } so callers can branch on whether to
// follow up (e.g., knockback only if not killed).
export function resolveDamage(victim, rawDamage, damageType = 'physical', opts = {}) {
    if (!victim || !victim.sprite) return { applied: 0, killed: false }
    // Attacker penetration (Arcane Spell Pierce) shaves the victim's protection,
    // floored at 0. Only when an attacker is threaded through this path.
    const protection = Math.max(0, (victim.protection?.(damageType) ?? 0) - (opts.attacker?.armorPen?.(damageType) ?? 0))
    // Marked (Hunter's Mark) and other "vulnerable" statuses amplify damage taken;
    // Opportunist etc. add an attacker-side bonus (only when an attacker is threaded).
    const takenMult = victim.damageTakenMult?.() ?? 1
    const outMult = opts.attacker?.outgoingDamageMult?.(victim) ?? 1
    const final = Math.max(1, Math.round((rawDamage - protection) * takenMult * outMult))
    // Spend any Shield pool before HP (absorb). `dealt` is the actual HP loss;
    // a fully-absorbed hit deals 0 and shows a block-style number instead.
    const { dealt, revived } = applyDamage(victim, final)
    if (dealt > 0) spawnDamageNumber(victim, dealt)
    else spawnBlockNumber(victim)
    if (revived) gameLog.log(`${victim.name} should have fallen — the Revenant Mail refuses it!`)
    // Combat recency (Momentum): any damage that involves the hero marks it
    // in combat. markCombat only exists on the hero, so the guards no-op for
    // enemies. opts.attacker is threaded by the ability-damage patterns.
    opts.attacker?.markCombat?.()
    victim.markCombat?.()
    // Attacker on-hit procs (Devour lifesteal) — fires on any HP dealt, before the
    // kill branch, so a lethal blow still feeds the attacker. Only when threaded.
    if (dealt > 0 && opts.attacker) opts.attacker.onDealtDamage?.(victim, dealt)
    if (victim.healthPoints <= 0) {
        dungeon.removeEntity(victim)
        // Ability-side kill credit (Bloodthirst etc.) — only when the caller
        // threaded an attacker (diffuse sources like zones/auras don't).
        if (opts.attacker) opts.attacker.onKill?.(victim)
        return { applied: dealt, killed: true }
    }
    // No attacker threaded through this path — playHitReaction falls back to
    // an upward jolt rather than a directional recoil.
    playHitReaction(victim, { damageType })
    // Ability-side on-damaged (Thorns etc.). The reflect call doesn't thread an
    // attacker, so it won't re-enter here — no retaliation loop.
    if (opts.attacker) victim.onDamaged?.(opts.attacker, dealt)
    return { applied: dealt, killed: false }
}

// Grant `target` a damage-absorbing Shield pool of `amount` — a depletable
// buffer that soaks incoming damage of ANY type before HP (spent by
// modules/damage.js applyDamage). The defensive counterpart to `drain`. Tops up
// an existing pool rather than no-op'ing on the dedup'd Shield tag (Taggable
// skips a re-add of the same status name). Returns the resulting pool size.
export function absorb(target, amount, opts = {}) {
    if (!target || amount <= 0) return 0
    if (target._tags && target._tags.includes('Shield')) {
        target._shieldPool = (target._shieldPool || 0) + amount
    } else {
        target.addTag(shield, amount)
    }
    return target._shieldPool || 0
}

// Shove `victim` up to `distance` tiles in (dx, dy). Halts silently on
// the first wall or other entity. Path is probed synchronously from the
// victim's origin position to sidestep the iterate-while-tweening bug
// (entity.x doesn't update until dungeon.moveEntityTo's onComplete).
// No-op if victim has no sprite (already died from a prior step).
//
// Returns { moved, collided } — `moved` is the actual tiles displaced
// (0..distance) and `collided` is true if the probe stopped early
// because of a wall, entity, or out-of-bounds tile. Force Push uses
// the collided flag for impact damage; Charge / Stomp ignore the
// return value.
export function knockback(victim, dx, dy, distance = 1) {
    if (!victim || !victim.sprite) return { moved: 0, collided: false }
    const originX = victim.x
    const originY = victim.y
    let landedX = originX
    let landedY = originY
    let collided = false
    for (let i = 1; i <= distance; i++) {
        const tx = originX + dx * i
        const ty = originY + dy * i
        if (!mapState.isWalkableTile(tx, ty)) { collided = true; break }
        if (mapState.entityAtTile(tx, ty)) { collided = true; break }
        // Faction walls carry no sprite (so the caster passes), so isWalkableTile /
        // entityAtTile miss them — collide the shoved victim here instead of
        // letting it land on the wall.
        if (mapState.blockingStructureAt(tx, ty, victim)) { collided = true; break }
        landedX = tx
        landedY = ty
    }
    const moved = Math.max(Math.abs(landedX - originX), Math.abs(landedY - originY))
    if (moved > 0) {
        victim.x = landedX
        victim.y = landedY
        dungeon.moveEntityTo(victim, landedX, landedY)
    }
    // Slam punctuation — only when the shove actually hit something (a wall or
    // another entity), not when it slides to a free stop at max distance.
    if (collided) playImpact(landedX, landedY)
    return { moved, collided }
}

// Synchronous probe + snap-move an actor up to `maxSteps` in (dx, dy).
// Stops on the first wall, entity, or out-of-bounds tile. Returns
// { steps, landed, blockedByEntity } so callers can decide what to do
// at the stop condition — Charge attacks first enemy hit; Dash just
// stops. Same probe-from-origin pattern as knockback.
export function glide(actor, dx, dy, maxSteps) {
    if (!actor) return { steps: 0, landed: { x: 0, y: 0 }, blockedByEntity: null }
    const originX = actor.x
    const originY = actor.y
    let landedX = originX
    let landedY = originY
    let blockedByEntity = null
    for (let i = 1; i <= maxSteps; i++) {
        const tx = originX + dx * i
        const ty = originY + dy * i
        if (!mapState.level[ty] || mapState.level[ty][tx] === undefined) break
        const blocker = mapState.entityAtTile(tx, ty)
        if (blocker) { blockedByEntity = blocker; break }
        if (!mapState.isWalkableTile(tx, ty)) break
        // Sprite-less faction walls: an enemy charging/gliding collides with the
        // wall, but the caster's own side glides through (friendly === type).
        if (mapState.blockingStructureAt(tx, ty, actor)) break
        landedX = tx
        landedY = ty
    }
    const steps = Math.max(Math.abs(landedX - originX), Math.abs(landedY - originY))
    if (steps > 0) {
        actor.x = landedX
        actor.y = landedY
        dungeon.moveEntityTo(actor, landedX, landedY)
        // Motion trail along the glide path (Charge / Lunge / Dash).
        playTrail(originX, originY, landedX, landedY)
    }
    return { steps, landed: { x: landedX, y: landedY }, blockedByEntity }
}

// Cast pulse (optional) + projectile + on-impact callback. The canonical
// "ranged ability" shape — Smite, Frost Bolt, Arc Lightning, Hurl
// Hammer all collapse to this. When castType is null, the cast pulse
// is skipped (Hurl Weapon is a thrown weapon, not a spell). For
// chained casts (Arc Lightning's hero->first then first->chain), pass
// `chainFromTile` to override the projectile source position.
//
// onImpact(target) fires after the projectile lands. Damage / status /
// chain logic lives there — the helper doesn't impose a model.
export function castSpell(caster, target, opts = {}) {
    const {
        castType = null,
        projectile,
        onImpact,
        chainFromTile = null,
        delay = 0
    } = opts

    const source = chainFromTile ?? caster
    const fireProjectile = () => {
        playProjectile(source, target, projectile, {
            onComplete: () => onImpact?.(target),
            delay
        })
    }

    if (castType) {
        playCast(caster, { type: castType, onComplete: fireProjectile })
    } else {
        fireProjectile()
    }
}

// Snap-move an actor to (x, y). Wrapper for symmetry with the verb
// catalog — Breach uses this for its wall-phase; ScrollOfBlink could
// migrate. Sets actor.x / actor.y synchronously THEN issues the
// moveEntityTo tween, same pattern as glide / knockback to keep the
// logical position consistent with subsequent queries.
export function teleport(actor, x, y) {
    actor.x = x
    actor.y = y
    dungeon.moveEntityTo(actor, x, y)
}

// Restore HP to `target`, clamped to maxHealthPoints per
// [[feedback-max-is-canonical-stat]]. Spawns the floating +Nhp number.
// Returns the actual amount healed (0 if already at full HP). Callers
// log + branch on the return.
export function heal(target, amount) {
    // Anti-heal statuses (Unmaking) scale the incoming heal on the recipient; the
    // Void's "denies restoration". Base shim returns 1 (full healing).
    const mult = target.incomingHealMult?.() ?? 1
    amount = Math.round(amount * mult)
    const actual = Math.min(amount, target.maxHealthPoints - target.healthPoints)
    if (actual <= 0) return 0
    target.healthPoints += actual
    spawnHealNumber(target, actual)
    return actual
}

// Drain — deal `amount` damage to `victim` and transfer a fraction back to the
// `source`. The composable "lifesteal / sap" verb (Void Siphon, arcane mana
// drain). `resource: 'hp'` heals the source via the clamped heal() above;
// `resource: 'mp'` saps the victim's movement points this turn instead (denial —
// there's no mana pool to refill). The gain is floored at 1 whenever any damage
// landed, so a connecting drain always returns something. Returns
// { applied, killed, gained } so callers can log the heal/sap amount.
export function drain(source, victim, amount, opts = {}) {
    const { damageType = 'magic', resource = 'hp', ratio = 0.5 } = opts
    const result = resolveDamage(victim, amount, damageType, { attacker: source })
    let gained = 0
    if (result.applied > 0) {
        const take = Math.max(1, Math.floor(result.applied * ratio))
        if (resource === 'mp') {
            const before = victim.movementPoints ?? 0
            victim.movementPoints = Math.max(0, before - take)
            gained = before - victim.movementPoints
        } else {
            gained = heal(source, take)
        }
    }
    return { ...result, gained }
}

// Remove status tags from an entity by valence. cleanse() strips negative
// statuses (debuffs / DoT / CC) — the "cure" verb; dispel() strips positive
// statuses (buffs) — "purge an enemy's blessings". Both default to removing
// every match; pass `count` to cap it. Returns the removed names so callers
// log + branch (an ability returns false / refunds when nothing was removed).
//
// NOTE: Taggable.removeTag fires no cleanup hook, so a status that applies a
// sprite tint / alpha in initialize and restores it only in its own expiry
// branch (Slow, Rooted, Freeze, Petrify, Underground, Invisible) will leave
// that visual artifact behind when removed this way. Functional state — stat
// contributions, duration counters, MP/AP effects — is removed correctly.
// Adding a `cleanup` hook to removeTag is the proper fix; wire it before
// these verbs are slotted into a reachable ability.
export function cleanse(entity, count = Infinity) {
    return removeStatusesByValence(entity, 'negative', count)
}

export function dispel(entity, count = Infinity) {
    return removeStatusesByValence(entity, 'positive', count)
}

function removeStatusesByValence(entity, valence, count) {
    const names = (entity._tags || [])
        .filter(name => getStatusMeta(name)?.valence === valence)
        .slice(0, count)
    for (const name of names) {
        const template = getStatusTemplate(name)
        if (template) entity.removeTag(template)
    }
    return names
}

// Radial AOE damage in a circle around an origin tile — the composable
// "shockwave" base. Any ability can call this to add an area blast (Stomp,
// the standalone Shockwave, future earth abilities all collapse to it). The
// footprint is a true circle: a tile is included when its offset satisfies
// dx² + dy² ≤ radius² (Euclidean), so larger blasts round off the corners
// instead of filling a square. Use radius 1.5 to take in the 8 adjacent
// tiles (diagonals sit at ~1.41). Applies resolveDamage to each enemy found
// and fires onHit(victim, dx, dy) for survivors so the caller can add a
// rider (knockback, status). The blast doesn't care whether anything is in
// range — callers wanting a no-target refund check the returned list.
// Returns [{ entity, result }].
export function shockwave(origin, { radius = 1, damage = 1, type = 'physical', onHit, fxColor } = {}) {
    // Expanding ring radiating from the origin — the shared AOE flourish. Color
    // defaults by damage type; callers (e.g. elemental novas) pass fxColor.
    playBurst(origin.x, origin.y, { radius, color: fxColor ?? (type === 'magic' ? 0xb98bff : 0xffe6a8) })

    const hits = []
    const reach = Math.ceil(radius)
    const r2 = radius * radius
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            if (dx === 0 && dy === 0) continue
            if (dx * dx + dy * dy > r2) continue
            // combatantAtTile, not entityAtTile: an enemy standing on a dropped
            // item or a loot bag would otherwise be masked by it and take nothing.
            const victim = mapState.combatantAtTile(origin.x + dx, origin.y + dy)
            if (!victim || victim.type !== 'enemy') continue
            const result = resolveDamage(victim, damage, type, { aoe: true })
            hits.push({ entity: victim, result })
            if (!result.killed) onHit?.(victim, dx, dy)
        }
    }
    return hits
}

// Straight-line "beam" attack from an origin in a cardinal direction — the
// composable beam base. Scans up to `length` cells along (dx, dy), stops at
// the first wall / out-of-bounds tile, and pierces every enemy in the line
// (resolveDamage each, onHit(victim, distance) for survivors). Pair with a
// target: 'direction' ability so the player aims it. Returns
// [{ entity, result }].
export function beam(origin, dx, dy, { length = 5, damage = 1, type = 'magic', onHit } = {}) {
    const hits = []
    for (let i = 1; i <= length; i++) {
        const tx = origin.x + dx * i
        const ty = origin.y + dy * i
        if (!mapState.level[ty] || mapState.level[ty][tx] === undefined) break
        // Stop at TERRAIN only. This used to call isWalkableTile, which counts
        // entity occupancy as non-walkable — so the beam broke on the first enemy
        // it met instead of piercing it, and an enemy standing adjacent along the
        // aim ended the beam at i=1 for ZERO hits. A beam is stopped by rock, not
        // by the people standing in it; piercing is the whole promise of the verb.
        if (mapState.level[ty][tx] === 1) break
        // combatantAtTile, not entityAtTile: loot on the floor must not mask the
        // enemy standing on it.
        const victim = mapState.combatantAtTile(tx, ty)
        if (victim && victim.type === 'enemy') {
            const result = resolveDamage(victim, damage, type, { aoe: true })
            hits.push({ entity: victim, result })
            if (!result.killed) onHit?.(victim, i)
        }
    }
    return hits
}
