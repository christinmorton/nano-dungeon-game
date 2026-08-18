import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Mana Siphon — permanent trait behind the passive: the bearer siphons a little life
// from each blow it lands (the onDealtDamage hook). A modest Arcane echo of Demonic's
// Devour. Heals DIRECT (clamped to maxHP, the damage.js shield-leech pattern) to stay
// a leaf tag — no universals import.
const manaSiphon = defineStatus({
    name: "Mana Siphon",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (ratio = 0.15) { this._siphonRatio = ratio },
    onDealtDamage: function (ret, victim, dealt) {
        const leech = Math.max(1, Math.round((dealt || 0) * (this._siphonRatio ?? 0.15)))
        const cap = this.maxHealthPoints ?? (this.healthPoints + leech)
        const before = this.healthPoints
        this.healthPoints = Math.min(cap, this.healthPoints + leech)
        const gained = this.healthPoints - before
        if (gained > 0) gameLog.log(`${this.name} siphons ${gained} HP.`)
        return ret
    }
})

export default manaSiphon
