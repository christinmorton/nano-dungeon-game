import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Blind — the target can't see to aim. Headline effect: its OWN next few attacks
// have a high chance to MISS (powder in the eyes / a blinding flash). Charge-
// based: each of the blinded entity's next `charges` attacks rolls `missChance`
// to whiff and spends a charge; once the charges run out (or a turn safety-cap
// elapses so it can't linger forever on a passive foe) the blind clears. While
// blinded it also dodges a little less — it can't see incoming blows either.
//
// The miss roll runs in Combat.attack, which calls the attacker's attackHits()
// shim that Taggable wraps with the handler below (returns false = this swing
// misses). Applied by Blinding Powder (powder burst) and Blinding Flash (radial).

const blind = defineStatus({
    name: "Blind",
    category: "debuff",
    valence: "negative",
    icon: null,
    duration: 3,
    initialize: function (charges = 3, missChance = 0.6, dodgeAmount = 5) {
        this._blindCharges = charges
        this._blindMiss = missChance
        this._blindAmount = dodgeAmount
        this._blindTurnCap = 8           // safety: never permanent if it never attacks
        gameLog.log(`${this.name} is blinded.`)
    },
    // Wraps attackHits(): the base shim returns true, we may flip it to false.
    // One charge per attack attempt; rolls the miss chance.
    attackHits: function (hits) {
        if (hits === false) return false             // already a miss for another reason
        if (this._blindCharges > 0) {
            this._blindCharges -= 1
            if (Math.random() < this._blindMiss) return false
        }
        return hits
    },
    refresh: function (baseResult) {
        this._blindTurnCap -= 1
        if (this._blindCharges <= 0 || this._blindTurnCap <= 0) {
            this.removeTag(blind)
            gameLog.log(`${this.name} can see again.`)
        }
        return baseResult
    },
    // Dodge penalty only while charges remain (the blind is "active").
    statContribution: function (running, name) {
        if (name === 'dodge' && this._blindCharges > 0) return (running || 0) - (this._blindAmount ?? 0)
        return running
    }
    // TODO (unchanged): also shrink the blinded entity's perception radius —
    // needs a hook in Perception.detects (reads a fixed detectionRadius).
})

export default blind
