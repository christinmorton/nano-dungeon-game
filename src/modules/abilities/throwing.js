import Phaser from 'phaser'
import { getStatusTemplate } from '../tags/Status.js'
import { castSpell, resolveDamage, knockback, shockwave } from './universals.js'
import { shapeStrike } from './patterns.js'
import { flavorStatus } from '../Combat.js'

// The THROWING combat style's gear coupling. A self-contained throw (Throw Knives
// / Hatchets) is always usable, but it's only EFFECTIVE when you wield a real
// throwing weapon: with a non-throwing weapon (or unarmed) the throw is a weak
// improvised toss; equip a throwable weapon and it scales with attackPower AND
// gains that weapon's special trait. "Equip the right tool to be a thrower."

// The equipped mainhand, if it's a throwable weapon (else null). This is the
// gate for BOTH the damage scaling (armed vs improvised) and the empower trait.
export function equippedThrowWeapon(hero) {
    const mh = hero?.currentWeapon?.()
    const throwable = mh?.throwable ?? mh?.profile?.throwable
    return throwable ? mh : null
}

// Layer the equipped throwing weapon's `throwEmpower` spec onto the ability's
// declarative fields (called from Ability.rebuild() via applyEmpowerments). The
// spec names which ability it boosts; rebuild()'s base-reset keeps it from
// compounding, and switching weapons updates it on the next rebuild.
//   throwEmpower: { ability, label, fields?: {field:+delta}, status?: 'Name' }
export function applyThrowEmpowerments(ability) {
    const weapon = equippedThrowWeapon(ability.hero)
    if (!weapon) return
    const spec = weapon.throwEmpower ?? weapon.profile?.throwEmpower
    if (!spec || spec.ability !== ability.name) return
    if (spec.fields) {
        for (const [field, delta] of Object.entries(spec.fields)) {
            // Only bump fields the ability actually has as numbers, so an empower
            // meant for a different throw (knives vs hatchets) no-ops.
            if (typeof ability[field] === 'number') ability[field] += delta
        }
    }
    if (spec.status) {
        const tag = getStatusTemplate(spec.status)
        if (tag) ability.appliesStatus = [].concat(ability.appliesStatus || []).concat(tag)
    }
}

// The shared throw for self-contained throwing abilities (Throw Knives /
// Hatchets). Fires `count` staggered projectiles at the victim, each landing the
// ability's GEAR-GATED per-hit damage + rider statuses + optional knockback:
//   - improvised (no throwable equipped): flat ability.unarmedMin..unarmedMax.
//   - armed (throwable equipped): round(attackPower * ability.armedScale) + the
//     equipped weapon's own damage roll (a better weapon throws harder).
// Reads ability.projectileTile / projectileScale / armedScale / unarmedMin/Max /
// damageType. Returns the equipped throwing weapon (or null) so callers can log
// "improvised". Damage is re-rolled per projectile.
// One gear-gated per-hit damage roll: improvised flat (no throwable equipped) or
// attackPower-scaled + the equipped weapon's own roll. Re-rolled per call so a
// multi-projectile throw varies. Reads ability.armedScale / unarmedMin / unarmedMax.
function gearGatedHit(ability, hero, weapon) {
    return weapon
        ? Math.round(hero.stat('attackPower') * ability.armedScale) + weapon.damage()
        : Phaser.Math.Between(ability.unarmedMin, ability.unarmedMax)
}

export function throwSalvo(ability, hero, victim, opts = {}) {
    const { count = 1, statuses = [], knockbackTiles = 0 } = opts
    const weapon = equippedThrowWeapon(hero)
    // Fold in the equipped weapon's magic trait (damageFlavor -> status), the same
    // way a melee hit would — so a poison-flavored knife poisons on throw too.
    const flavor = flavorStatus(weapon?.damageFlavor)
    const allStatuses = flavor ? [...statuses, flavor] : statuses
    // projectileTile set -> the ability's own sprite (Throw Knives/Hatchets carry
    // their own ammo). projectileTile null -> throw the EQUIPPED weapon's own
    // sprite (Hurl Weapon hurls your actual weapon).
    const projectile = ability.projectileTile != null
        ? { attackTile: ability.projectileTile, attackScale: ability.projectileScale }
        : {
            attackTile: weapon?.attackTile ?? weapon?.tile,
            attackTexture: weapon?.attackTexture,
            attackScale: weapon?.attackScale ?? ability.projectileScale,
            attackAngle: weapon?.attackAngle,
            tint: weapon?.tint,
        }
    const dx = Math.sign(victim.x - hero.x)
    const dy = Math.sign(victim.y - hero.y)

    for (let i = 0; i < count; i++) {
        castSpell(hero, victim, {
            castType: null,
            projectile,
            delay: i * 90,   // stagger so the projectiles read as separate
            onImpact: (v) => {
                if (!v?.sprite) return
                const result = resolveDamage(v, gearGatedHit(ability, hero, weapon), ability.damageType)
                if (!result.killed) {
                    for (const s of allStatuses) v.addTag(s)
                    if (knockbackTiles) knockback(v, dx, dy, knockbackTiles)
                }
            },
        })
    }
    return weapon
}

// THROW NOVA — a gear-gated thrown burst in a ring around the caster (Whirling
// Knives). Reuses the shockwave verb (flat damage + per-victim onHit), with the
// throwing damage model + the weapon's flavor + the ability's rider statuses.
// Reads ability.radius / damageType / appliesStatus.
export function throwNova(ability, hero, opts = {}) {
    const weapon = equippedThrowWeapon(hero)
    const flavor = flavorStatus(weapon?.damageFlavor)
    const statuses = [].concat(ability.appliesStatus || [])
    if (flavor) statuses.push(flavor)
    const hits = shockwave(hero, {
        radius: ability.radius ?? 1.5,
        damage: gearGatedHit(ability, hero, weapon),
        type: ability.damageType,
        fxColor: opts.fxColor ?? 0xd0d0d0,
        onHit: (v) => { for (const s of statuses) v.addTag(s) },
    })
    return { weapon, hits }
}

// THROW SHAPE — a gear-gated thrown spray over a directional footprint (cone/line:
// Blade Storm Strike, Impaling Throw). Delivers via shapeStrike, injecting the
// gear-gated damage as a flat per-hit value (shapeStrike's dealHit reads
// damageMin/Max/Stat) + folding in the weapon flavor. The ability MUST call
// rebuild() first each cast, so this per-cast field write never compounds.
export function throwShape(ability, hero, dx, dy, fx = {}) {
    const weapon = equippedThrowWeapon(hero)
    const flavor = flavorStatus(weapon?.damageFlavor)
    const dmg = gearGatedHit(ability, hero, weapon)
    ability.damageMin = dmg
    ability.damageMax = dmg
    ability.damageStat = null
    if (flavor) ability.appliesStatus = [].concat(ability.appliesStatus || []).concat(flavor)
    shapeStrike(ability, hero, dx, dy, { splash: true, ...fx })
    return weapon
}
