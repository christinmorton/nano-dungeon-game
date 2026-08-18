import { defineStatus } from "./Status.js"

// Taunt — a target-forcing marker carried by the TAUNTER (a player-team
// combatant: the hero, an ally, or a summon). While it's active, hostile enemies
// within _tauntRadius of the bearer are FORCED to target it over their default
// nearest-hostile pick — the read happens in the targeting seam
// (Targeting.tauntTargetFor); this tag just carries the radius and a
// self-ticking duration (the emboldened.js pattern). v1 is a hard force.
//
// It's a party-protection tool: a tank taunts to pull enemies off a squishier
// teammate, so it's only meaningful once enemies route through the seam (the
// targeting-system build, 2026-06-20) and there are multiple player-team targets
// to choose between. Applied by classes/abilities/Taunt.js.
//
// Valence is "mixed": it's protective for the team but deliberately draws danger
// onto the bearer, so it shouldn't be swept up by a blanket Cleanse (negative)
// or Dispel (positive).

const TAUNT_TURNS = 3
const TAUNT_RADIUS = 4

const taunt = defineStatus({
    name: "Taunt",
    category: "cc",
    valence: "mixed",
    icon: null,
    duration: TAUNT_TURNS,
    initialize: function (turns = TAUNT_TURNS, radius = TAUNT_RADIUS) {
        this._tauntTurns = turns
        this._tauntRadius = radius
    },
    refresh: function (baseResult) {
        this._tauntTurns -= 1
        if (this._tauntTurns <= 0) this.removeTag(taunt)
        return baseResult
    },
})

export default taunt
