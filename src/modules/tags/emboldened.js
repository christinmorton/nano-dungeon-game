import { defineStatus } from "./Status.js"

// Emboldened — a confidence buff applied to an enemy roster the player breaks
// off from (see EncounterManager._concede). +EMBOLDENED_BONUS attackPower for
// EMBOLDENED_TURNS turns, so re-engaging a group you abandoned is harder.
//
// Flows through the enemy stat path via the statContribution shim parity fix
// on BaseEnemy (enemies previously ran no tag statContribution chain, so a
// might-style buff silently no-op'd on them). Decays on the bearer's refresh —
// loose, fled-from enemies still refresh each round, so it ticks down on the
// floor. Stacking is a deferred knob: addTag dedupes by name, so re-fleeing
// the same group neither stacks the bonus nor resets the timer.
//
// See documents/v3_objective_driven_encounters.md (universal flee → player
// flee leaves the abandoned roster Emboldened).

const EMBOLDENED_TURNS = 15
const EMBOLDENED_BONUS = 2

const emboldened = defineStatus({
    name: "Emboldened",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: EMBOLDENED_TURNS,
    initialize: function () {
        this._emboldenedTurns = EMBOLDENED_TURNS
    },
    refresh: function (baseResult) {
        this._emboldenedTurns -= 1
        if (this._emboldenedTurns <= 0) this.removeTag(emboldened)
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === 'attackPower') return (running || 0) + EMBOLDENED_BONUS
        return running
    }
})

export default emboldened
