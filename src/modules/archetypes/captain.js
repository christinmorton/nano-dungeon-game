import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import playbooks from "./playbooks/index.js"
import activities from "./activities/index.js"
import { captainOrderBark } from "../dialog/combatBarks.js"
import { updateVoidChannel } from "../settlements/voidChannel.js"

// Captain archetype — Phase 2 of v3_ai_behavior_system.md. A Captain is a
// coordinator, not a fighter: it hangs back, dispatches to a playbook for
// command decisions, and never moves toward the player. Allies pick up
// the command on their *next* turn (availableAt = issueTick + 1)
// regardless of TurnManager iteration order. Killing the Captain ends
// the coordination — and the Captain's deathOutcome decides what its
// squad does about it.
//
// The decision matrix for which command to issue lives in the captain's
// chosen playbook (blitz / formation / freeform). The archetype here
// just handles state transitions, cooldown timing, retreat, and turn
// economy — it asks the playbook what to issue.

export function findAlliesInRange(captain, radius = null) {
    const r = radius ?? (captain.commandRadius ?? 5)
    const allies = []
    for (const e of tm.entities) {
        if (e === captain) continue
        if (e.type !== "enemy") continue
        // Captains don't command other captains — keeps coordination
        // bounded and avoids order loops when two captains share a room.
        if (e.archetype === "captain") continue
        const dx = e.x - captain.x
        const dy = e.y - captain.y
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        if (dist > r) continue
        allies.push(e)
    }
    return allies
}

// Each playbook manages its own cooldown (blitz uses 3-5 turns; freeform
// 10-15; formation runs on phase timing). issueOrder just writes the
// order onto each ally and logs. The optional extras object is spread
// onto every order — formation uses it to attach targetX/targetY for
// per-ally slot positions.
export function issueOrder(captain, allies, command, persistent, extras = {}) {
    const issueTurn = tm.tickCount
    const availableAt = issueTurn + 1
    const expireAt = persistent ? null : availableAt + 1

    for (const ally of allies) {
        ally.currentOrder = {
            command,
            source: captain,
            availableAt,
            expireAt,
            persistent,
            ...extras
        }
    }

    // Bark the order out loud — but only when it's a NEW command, so a
    // persistent order re-issued each tick doesn't repeat the shout.
    if (command !== captain.lastCommand) captainOrderBark(captain, command)
    captain.lastCommand = command
    gameLog.log(`The ${captain.name} orders ${command}!`)
}

function turn(enemy) {
    if (enemy.moving) return

    const player = dungeon.player
    enemy.updatePerception(player)

    // Void captains whose rift was destroyed channel a new one into being —
    // this overrides all normal command/activity behavior while it runs, and
    // consumes the turn. No-op for any other captain. See voidChannel.js.
    if (updateVoidChannel(enemy)) return

    if (!enemy.isEngaged()) {
        // Out-of-combat: dispatch to the captain's current activity
        // (idle / scouting / patrolling / hunting / scavenging). The
        // activity owns its own pacing, sub-group dispatch, and turn
        // economy. Falls back to idle if the field references an
        // activity that hasn't been registered yet.
        const activityFn = activities[enemy.activity] || activities.idle
        activityFn(enemy, player)
        return
    }

    // Dispatch to the captain's playbook every engaged tick. The
    // playbook owns its own pacing (cooldowns, phase timers, etc.);
    // we don't gate here. Elite captains get commandsPerTick > 1; the
    // playbook decides whether to honor it as multiple commands or as
    // a state-machine advancement.
    const playbookFn = playbooks[enemy.playbook] || playbooks.blitz
    playbookFn(enemy, player)

    // Captain doesn't bump-attack and won't close the gap on the player.
    // If the player gets adjacent, step away one tile if possible.
    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    if (distance <= 1 && enemy.movementPoints > 0) {
        const retreatX = enemy.x - Math.sign(dx)
        const retreatY = enemy.y - Math.sign(dy)
        if (mapState.isWalkableTile(retreatX, retreatY)) {
            dungeon.stepEntityTo(enemy, retreatX, retreatY)
        }
    }
    enemy.movementPoints = 0
    enemy.actionPoints = 0
}

// Tier-3 coordinator. Tactical (high INT), tanky (high CON), moderate
// combat numbers — captains lead, they don't bruise.
export default {
    turn,
    statTemplate: {
        STR: [10, 13],
        DEX: [8, 11],
        CON: [13, 15],
        SPD: [8, 11],
        INT: [12, 15],
        Magic: [5, 9]
    },
    hpFormula: (s) => 60 + s.CON * 10
}

