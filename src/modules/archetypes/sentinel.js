import Phaser from "phaser"
import mapState from "../MapState.js"
import { targetFor, cheby } from "../Targeting.js"
import { castSpell, resolveDamage } from "../abilities/universals.js"

// Sentinel archetype — a STATIONARY construct / turret (Stone Sentinel, and the
// future element golems: arcane/fire/ice familiars). It never moves: each round it
// picks the nearest hostile within `shootRange` that it has a clear projectile
// path to, and fires a bolt for `shootDamageMin..Max`. No kiting, no chasing — a
// placed turret that holds its tile until its lifespan runs out (a temporary
// summon auto-fades via BaseEnemy.refresh).
//
// Config (set on the construct by the summon's constructParams): shootRange,
// shootDamageMin/Max, shootType, shootCastType, shootProjectile { attackTile, tint }.
// Element variants are just different params + identity (tint/art/name) on the same
// brain — that's the "different types of summoned constructs" framework.

function turn(construct) {
    if (construct.moving) return

    const range = construct.shootRange ?? 5
    const foe = targetFor(construct)   // nearest enemy via the targeting seam (taunt-aware)
    if (construct.actionPoints > 0 && foe
        && cheby(construct, foe) <= range
        && mapState.hasProjectilePath(construct, foe, construct, false)) {
        const dmg = Phaser.Math.Between(construct.shootDamageMin ?? 4, construct.shootDamageMax ?? 7)
        castSpell(construct, foe, {
            castType: construct.shootCastType ?? 'arcane',
            projectile: construct.shootProjectile ?? null,
            onImpact: (v) => {
                const result = resolveDamage(v, dmg, construct.shootType ?? 'magic', { attacker: construct })
                // Element rider: a fire golem Burns, an ice familiar Slows, etc.
                // `shootStatus` is a tag template (or array) set in constructParams.
                if (construct.shootStatus && !result.killed) {
                    for (const s of [].concat(construct.shootStatus)) v.addTag(s)
                }
            },
        })
    }
    // Stationary — spend everything so the round resolves (over() becomes true).
    construct.movementPoints = 0
    construct.actionPoints = 0
}

export default {
    turn,
    // No statTemplate / hpFormula — sentinels are summoned with explicit stats + hp
    // (like the ally archetype), never rolled by an enemy spawn.
}
