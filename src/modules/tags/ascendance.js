import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Ascendance — the Seraphic "unbound escalation" path (§19). A free seraph answers to
// no hierarchy, so its power isn't capped by an order the way a bound angel's is:
// each KILL adds a stack of radiant might (outgoing damage), toward a soft cap that
// RISES with the path's rank. Persists for the run (like Curse Corruption's CL) —
// freedom expressed as growth. Attached by the Ascendance path passive; the tag reads
// its rank live off `entity.affinityPaths.ascendance.rank`, so DEEPENING just bumps
// that number (no re-attach) and the cap grows.

const PER_STACK = 0.06        // +6% outgoing damage per stack
const CAP_PER_RANK = 3        // soft cap on stacks = rank * 3

function rankOf(entity) { return entity.affinityPaths?.ascendance?.rank || 1 }

const ascendance = defineStatus({
    name: "Ascendance",
    category: "buff",
    valence: "positive",
    duration: null,
    initialize: function () {
        if (this._ascendStacks == null) this._ascendStacks = 0
    },
    // Feeds on death — each kill deepens the radiance, up to the rank's soft cap.
    onKill: function (ret, victim) {
        const cap = rankOf(this) * CAP_PER_RANK
        if ((this._ascendStacks || 0) < cap) {
            this._ascendStacks = (this._ascendStacks || 0) + 1
            gameLog.log(`${this.name} ascends — radiance builds (${this._ascendStacks}/${cap}).`)
        }
        return ret
    },
    // The escalation itself: outgoing damage scales with accrued stacks.
    outgoingDamageMult: function (running, victim) {
        return (running ?? 1) * (1 + (this._ascendStacks || 0) * PER_STACK)
    },
})

// Live state for the Skillbook path readout: current stacks / cap + the bonus they
// grant right now. (Screen is paused when open, so this is a stable snapshot.)
export function ascendanceReadout(entity, rank = 1) {
    const stacks = entity?._ascendStacks || 0
    const cap = (rank || 1) * CAP_PER_RANK
    return `${stacks}/${cap} stacks · +${Math.round(stacks * PER_STACK * 100)}% outgoing damage`
}

export default ascendance
