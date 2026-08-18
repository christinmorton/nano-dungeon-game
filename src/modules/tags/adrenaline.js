import { defineStatus } from "./Status.js"

// Adrenaline — a triggered passive: each successful DODGE arms a short window of
// raised attack (the onDodge hook). A SINGLE permanent tag holds a charge counter —
// onDodge (re)arms it, refresh ticks it down, statContribution grants +attack while
// it's live — so repeated dodges refresh the window cleanly, without the addTag
// name-dedup that a separate temporary buff tag would hit. The skirmisher's reward
// for evading: turn near-misses into ferocity. Permanent; valence 'mixed'.
const ADRENALINE_ATK = 3
const ADRENALINE_WINDOW = 2

const adrenaline = defineStatus({
    name: "Adrenaline",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    initialize: function () { this._adrenalineCharge = 0 },
    onDodge: function (ret, attacker) {
        this._adrenalineCharge = ADRENALINE_WINDOW   // (re)arm on each dodge
        return ret
    },
    refresh: function (baseResult) {
        if (this._adrenalineCharge > 0) this._adrenalineCharge -= 1
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === "attackPower" && this._adrenalineCharge > 0) {
            return (running || 0) + ADRENALINE_ATK
        }
        return running
    }
})

export default adrenaline
