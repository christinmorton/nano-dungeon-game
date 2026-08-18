import tm from "../../TurnManager.js"
import mapState from "../../MapState.js"
import gameLog from "../../GameLog.js"
import { findAlliesInRange, issueOrder } from "../captain.js"

// Formation playbook — three-phase state machine: gather (allies path
// to slots around the captain), hold (allies stand at slots and
// threaten if the player closes), break (allies abandon slots and
// charge). Loops back to gather.
//
// Slot positions are the 8 tiles adjacent to the captain (3x3 minus
// captain center). Each gather phase re-rolls assignments so the
// formation drifts with the captain if it moves between cycles.
//
// During gather / hold, allies carry a persistent `go-to` order
// with targetX/targetY embedded. brute and skirmisher branch on
// the command to path to the target instead of the player; both
// archetypes still attack if the player happens to be adjacent.

const GATHER_DURATION = 6
const HOLD_DURATION = 8
const BREAK_DURATION = 4

const SLOT_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
]

function enterGather(captain, state, tick) {
    state.phase = "gather"
    state.phaseStartTick = tick

    const allies = findAlliesInRange(captain)
    if (allies.length === 0) return

    const candidateSlots = SLOT_OFFSETS
        .map(([dx, dy]) => ({ x: captain.x + dx, y: captain.y + dy }))
        .filter(s => mapState.isWalkableTile(s.x, s.y))

    // Greedy assignment: shortest-distance allies pick first.
    const sortedAllies = allies.slice().sort((a, b) => {
        const da = Math.abs(a.x - captain.x) + Math.abs(a.y - captain.y)
        const db = Math.abs(b.x - captain.x) + Math.abs(b.y - captain.y)
        return da - db
    })

    const assigned = new Set()
    const availableAt = tick + 1
    for (const ally of sortedAllies) {
        let bestIdx = -1
        let bestDist = Infinity
        for (let i = 0; i < candidateSlots.length; i++) {
            if (assigned.has(i)) continue
            const s = candidateSlots[i]
            const d = Math.abs(ally.x - s.x) + Math.abs(ally.y - s.y)
            if (d < bestDist) {
                bestDist = d
                bestIdx = i
            }
        }
        if (bestIdx === -1) continue
        assigned.add(bestIdx)
        const slot = candidateSlots[bestIdx]
        ally.currentOrder = {
            command: "go-to",
            source: captain,
            availableAt,
            expireAt: null,
            persistent: true,
            targetX: slot.x,
            targetY: slot.y
        }
    }

    captain.lastCommand = "form-up"
    gameLog.log(`The ${captain.name} orders: Form up!`)
}

function enterHold(captain, state, tick) {
    state.phase = "hold"
    state.phaseStartTick = tick
    // Allies still hold their persistent go-to orders from gather. No
    // re-issue needed; they'll naturally sit at the slot once arrived.
    captain.lastCommand = "hold"
    gameLog.log(`The ${captain.name} orders: Hold the line!`)
}

function enterBreak(captain, state, tick) {
    state.phase = "break"
    state.phaseStartTick = tick
    const allies = findAlliesInRange(captain)
    // Cancel any active formation orders before issuing the charge so
    // brute/skirmisher don't keep pathing back to their slot.
    for (const ally of allies) {
        if (ally.currentOrder && ally.currentOrder.command === "go-to") {
            ally.currentOrder = null
        }
    }
    if (allies.length > 0) {
        issueOrder(captain, allies, "advance", true)
    }
    captain.lastCommand = "break"
    gameLog.log(`The ${captain.name} orders: Break formation, attack!`)
}

export default function formation(captain, player) {
    const state = captain.playbookState
    const tick = tm.tickCount

    if (!state.phase) {
        enterGather(captain, state, tick)
        return
    }

    const elapsed = tick - state.phaseStartTick

    if (state.phase === "gather" && elapsed >= GATHER_DURATION) {
        enterHold(captain, state, tick)
    } else if (state.phase === "hold" && elapsed >= HOLD_DURATION) {
        enterBreak(captain, state, tick)
    } else if (state.phase === "break" && elapsed >= BREAK_DURATION) {
        enterGather(captain, state, tick)
    }
}
