import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Unmaking — the Void affinity's rider (advanced/pact). The Void is entropy, the
// dark that eats; here it unravels the target two ways:
//   - -barrier (statContribution('barrier')): the MAGIC-axis mirror of Acid's
//     -armor. Acid melts physical defense; the Void frays magical defense.
//   - reduced incoming healing (incomingHealMult): the unmaking "denies
//     restoration" — wounds dealt while Unmade are harder to mend.
//
// A flat shred (unlike Corrosion's escalation); pairs with cosmic-tier damage.

const UNMAKING_TINT = 0x5a3a7a

const unmaking = defineStatus({
    name: "Unmaking",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "void",
    duration: 3,
    initialize: function (turns = 3, barrierShred = 3, healMult = 0.5) {
        this._unmakeTurns = turns
        this._unmakeShred = barrierShred
        this._unmakeHeal = healMult
        this._unmakePrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = UNMAKING_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is unmade — defenses fray and wounds refuse to close.`)
    },
    statContribution: function (running, name) {
        if (name === 'barrier') return (running || 0) - (this._unmakeShred ?? 0)
        return running
    },
    // Anti-heal: scale any heal landing on this entity (wraps the base 1 shim).
    incomingHealMult: function (mult) {
        return mult * (this._unmakeHeal ?? 1)
    },
    refresh: function (baseResult) {
        this._unmakeTurns -= 1
        if (this._unmakeTurns <= 0) {
            this.removeTag(unmaking)
            gameLog.log(`${this.name} knits back together.`)
        }
        return baseResult
    },
    cleanup: function () {
        if (this.sprite) {
            if (this._unmakePrevTint !== undefined) {
                this.sprite.tint = this._unmakePrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default unmaking
