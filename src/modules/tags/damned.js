import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Damned — the Demonic affinity's rider (advanced/pact). Demons are Void given
// hunger and horns; their touch is TORMENT. The victim's will withers in despair,
// multiplicatively sapping the damage IT deals (outgoingDamageMult). Distinct from
// Weaken (a flat -attackPower): Damned is a proportional choke that scales with how
// hard the target hits. The flip side of Holy's Smitten — where Holy judges, the
// Demonic corrupts. (The attacker's own benefit — the Devour lifesteal — rides the
// Demonic affinity's PASSIVE, not this victim status.)

const DAMNED_TINT = 0x882233

const damned = defineStatus({
    name: "Damned",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "demonic",
    duration: 3,
    initialize: function (turns = 3, sap = 0.7) {
        this._damnedTurns = turns
        this._damnedSap = sap
        this._damnedPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = DAMNED_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is damned — its strength withers in despair.`)
    },
    // Wraps the attacker-side outgoing mult (base shim returns 1, passed the victim);
    // here the DAMNED entity is the attacker, so its blows land softer.
    outgoingDamageMult: function (running, victim) {
        return (running ?? 1) * (this._damnedSap ?? 1)
    },
    refresh: function (baseResult) {
        this._damnedTurns -= 1
        if (this._damnedTurns <= 0) {
            this.removeTag(damned)
            gameLog.log(`${this.name} shakes off the despair.`)
        }
        return baseResult
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._damnedPrevTint !== undefined) {
                this.sprite.tint = this._damnedPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default damned
