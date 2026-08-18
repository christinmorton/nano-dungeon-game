import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Shield — a depletable pool that absorbs incoming damage of ANY type before it
// reaches HP, distinct from Barrier (a flat per-hit stat reduction). The pool
// lives on entity._shieldPool; the victim-side hook this status was stubbed
// waiting for now exists — modules/damage.js applyDamage spends the pool inside
// both Combat.attack and the ability-side resolveDamage. Granted by the `absorb`
// universal verb. No timer: it lasts until spent, then breaks.

const shield = defineStatus({
    name: "Shield",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: null,
    initialize: function (pool = 10) {
        this._shieldPool = (this._shieldPool || 0) + pool
        gameLog.log(`${this.name} gains a ${pool}-point shield.`)
    },
    // Tick: once the pool is spent (applyDamage drove it to 0), drop the status
    // so the badge clears. No time limit otherwise — a shield lasts until broken.
    refresh: function (baseResult) {
        if ((this._shieldPool || 0) <= 0) {
            this.removeTag(shield)
            gameLog.log(`${this.name}'s shield breaks.`)
        }
        return baseResult
    },
    // Removed early (Dispel) or on break: clear the pool so no stale absorb lingers,
    // and the leech ratio (Void Shroud) so a later plain shield never drains.
    cleanup: function () {
        this._shieldPool = 0
        this._shieldDrainRatio = 0
    }
})

export default shield
