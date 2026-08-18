import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// The stats Ascension lifts: the six core stats (gate-relevant) + the main derived
// combat stats (damage/defense).
const ASCENDED_STATS = new Set([
    'STR', 'DEX', 'CON', 'SPD', 'INT', 'Magic',
    'attackPower', 'magicPower', 'rangedAttackPower', 'armor',
])

// Ascended — the God / Ascension buff (§6.8). A rule-breaking power spike: a huge
// bonus to ALL CORE STATS at once (STR/DEX/CON/SPD/INT/Magic) plus the derived
// combat stats — the "infinite core stats" fantasy in lite form (per the God-tree
// vision: ascending grants near-infinite wisdom/intelligence/magic/any core stat).
// Because `requires` gates read `hero.stat('Magic')` (which includes this), an
// ASCENDED caster's core Magic spikes enough to wield the god-tier abilities
// (Cataclysm et al.). Granted by the **Ascend** ability (temporary god-mode) or, in
// the full vision, by an Ascension ITEM (permanent — pass turns = null). Entity-
// agnostic. The seed of the God/Ascended tree; deepen (true uncapping/immunities)
// later. (The true infinite-power entities are the Principles — the TheLight /
// TheVoid cosmic beings in data/cosmicBeings.js — which carry infinite BASE stats.)

const ascended = defineStatus({
    name: "Ascended",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: 8,
    initialize: function (turns = 8, bonus = 20) {
        this._ascendedTurns = turns        // null/0 = permanent (the item grant)
        this._ascendedBonus = bonus
        gameLog.log(`${this.name} ASCENDS — overwhelming power floods in.`)
    },
    refresh: function (baseResult) {
        if (this._ascendedTurns == null) return baseResult   // permanent grant
        this._ascendedTurns -= 1
        if (this._ascendedTurns <= 0) {
            this.removeTag(ascended)
            gameLog.log(`${this.name}'s ascension fades — mortal once more.`)
        }
        return baseResult
    },
    statContribution: function (running, name) {
        const b = this._ascendedBonus ?? 0
        // CORE stats (so `requires` gates + everything that scales off them lift) AND
        // the derived combat stats (so damage/defense lift directly too).
        if (ASCENDED_STATS.has(name)) return (running || 0) + b
        return running
    }
})

export default ascended
