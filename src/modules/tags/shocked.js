import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Shocked — the lightning element's status rider (affinity-only for now; see
// abilities/affinities.js §14). The target is charged with static: while shocked
// it takes a little MORE damage from every source (the "conductive" read that
// makes lightning amp builds shine) AND each of its turns has a chance to
// DISCHARGE — a jolt that costs it the rest of that turn (AP/MP zeroed in place,
// the slow.js pattern). A soft, intermittent take on the doc's lightning→Stun
// mapping: balanced to apply on EVERY hit because Taggable.addTag dedupes by
// name (a re-hit while already shocked is a no-op), so it runs its short window,
// expires, and only then can a later hit re-arm it — never a perma-stun.
//
// Vulnerability wraps damageTakenMult() — the same reusable "vulnerable"
// primitive as Marked/Conductive, but a DISTINCT status so it reads as lightning
// and doesn't collide in the registry. The discharge skip runs in refresh()
// (after BaseHero/BaseEnemy.refresh has refilled points), mirroring how Slow
// shaves MP each round.

const SHOCKED_TINT = 0xfff14d

const shocked = defineStatus({
    name: "Shocked",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "lightning",
    duration: 3,
    initialize: function (turns = 3, vuln = 1.2, dischargeChance = 0.3) {
        this._shockTurns = turns
        this._shockVuln = vuln
        this._shockDischarge = dischargeChance
        this._shockPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.tint = SHOCKED_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} is shocked — crackling with static.`)
    },
    // Vulnerable primitive: amplify ALL incoming damage while charged.
    damageTakenMult: function (mult) {
        return mult * (this._shockVuln ?? 1)
    },
    refresh: function (baseResult) {
        // Static discharge — a chance each round to lose the turn outright. Zero
        // both pools AFTER refresh refilled them, exactly like Slow trims MP.
        if (this._shockTurns > 0 && Math.random() < (this._shockDischarge ?? 0)) {
            this.movementPoints = 0
            this.actionPoints = 0
            gameLog.log(`${this.name} is jolted by static and loses its footing!`)
        }
        this._shockTurns -= 1
        if (this._shockTurns <= 0) {
            this.removeTag(shocked)
            gameLog.log(`${this.name} shrugs off the static.`)
        }
        return baseResult
    },
    // Teardown — restore tint. Fires on natural expiry above AND on an early
    // cleanse/dispel, via Taggable.removeTag's cleanup hook.
    cleanup: function () {
        if (this.sprite) {
            if (this._shockPrevTint !== undefined) {
                this.sprite.tint = this._shockPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default shocked
