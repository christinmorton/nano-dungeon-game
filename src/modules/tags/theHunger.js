import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import shield from "./shield.js"

// The Hunger — Void path (§19.6): the devouring maw. A foe that dies is CONSUMED — the
// end takes it in, and the bearer swells: healed, and wrapped in a void-shield of the
// consumed essence. Deliberately COSMIC, per-DEATH consumption — distinct from Demonic's
// per-hit Devour lifesteal. The longer a fight runs, the more the void has eaten. Rank
// scales both the heal and the shield; read live off `affinityPaths.hunger.rank`.

const HEAL_PER_RANK = 4
const SHIELD_PER_RANK = 4
const rankOf = e => e.affinityPaths?.hunger?.rank || 1

const theHunger = defineStatus({
    name: "The Hunger",
    category: "buff",
    valence: "positive",
    duration: null,
    onKill: function (ret, victim) {
        const rank = rankOf(this)
        const heal = rank * HEAL_PER_RANK
        if (this.healthPoints > 0) {
            this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + heal)
        }
        // Grow the void-shield. addTag dedupes by name, so bump the pool directly if a
        // shield is already up (same stacking workaround as applyAcid).
        const pool = rank * SHIELD_PER_RANK
        if (this._tags?.includes("Shield")) this._shieldPool = (this._shieldPool || 0) + pool
        else this.addTag(shield, pool)
        gameLog.log(`${this.name} consumes the fallen — +${heal} HP, +${pool} void-shield.`)
        return ret
    },
})

export function hungerReadout(entity, rank = 1) {
    const r = rank || 1
    return `consume a kill: +${r * HEAL_PER_RANK} HP · +${r * SHIELD_PER_RANK} shield`
}

export default theHunger
