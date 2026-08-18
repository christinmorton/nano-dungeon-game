import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Devour — the Demonic affinity's PASSIVE trait tag (attached by the Devour
// passive, granted with the affinity). Demons are "Void given hunger": every blow
// the attuned entity lands FEEDS it, healing a fraction of the HP dealt. Wraps the
// onDealtDamage attacker hook fired by Combat.attack + resolveDamage.
//
// Heals DIRECT (clamped to maxHP, the damage.js shield-leech pattern) rather than
// via universals.heal — keeping this a LEAF tag so the affinity registry, which
// references the Devour passive, never threads an affinities→universals→affinities
// import cycle. Permanent; valence 'mixed' so it isn't a dispellable buff.

const devour = defineStatus({
    name: "Devour",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    initialize: function (ratio = 0.25) {
        this._devourRatio = ratio
    },
    onDealtDamage: function (ret, victim, dealt) {
        const leech = Math.floor((dealt || 0) * (this._devourRatio ?? 0.25))
        if (leech > 0) {
            const cap = this.maxHealthPoints ?? (this.healthPoints + leech)
            const before = this.healthPoints
            this.healthPoints = Math.min(cap, this.healthPoints + leech)
            const gained = this.healthPoints - before
            if (gained > 0) gameLog.log(`${this.name} devours ${gained} HP from the wound.`)
        }
        return ret
    }
})

export default devour
