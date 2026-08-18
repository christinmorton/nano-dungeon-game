import { defineStatus } from "./Status.js"

// Momentum — a triggered passive that RAMPS while in combat: each round the bearer
// is fighting, it gains a stack (up to a cap) of +attack; the moment it drops out
// of combat the stacks reset. A single permanent tag holds the stack counter —
// refresh ramps/resets it (reading the host's combat-state), statContribution
// turns stacks into attackPower. Reads `inCombat()` (the hero's combat-recency
// signal) and falls back to `isEngaged()` so a champion enemy can carry it too.
const MOMENTUM_ATK_PER_STACK = 2
const MOMENTUM_MAX_STACKS = 4

const momentum = defineStatus({
    name: "Momentum",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    initialize: function () { this._momentumStacks = 0 },
    refresh: function (baseResult) {
        const engaged = this.inCombat?.() ?? this.isEngaged?.() ?? false
        if (engaged) {
            this._momentumStacks = Math.min(MOMENTUM_MAX_STACKS, (this._momentumStacks || 0) + 1)
        } else {
            this._momentumStacks = 0
        }
        return baseResult
    },
    statContribution: function (running, name) {
        if (name === "attackPower") {
            return (running || 0) + MOMENTUM_ATK_PER_STACK * (this._momentumStacks || 0)
        }
        return running
    }
})

export default momentum
