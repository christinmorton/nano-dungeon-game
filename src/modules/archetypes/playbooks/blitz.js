import { findAlliesInRange, issueOrder } from "../captain.js"

// Blitz playbook — issue advance / focus / flank commands on a 3-5 turn
// cadence, no positional discipline. The "always pressing" captain
// experience. One of three playbooks; the others (formation, freeform)
// own different cadences and behaviors.
//
// Called every engaged tick; the playbook gates on its own cooldown.

const BLITZ_COOLDOWN_MIN = 3
const BLITZ_COOLDOWN_MAX = 5

function rollBlitzCooldown() {
    return BLITZ_COOLDOWN_MIN + Math.floor(Math.random() * (BLITZ_COOLDOWN_MAX - BLITZ_COOLDOWN_MIN + 1))
}

function pickAndIssue(captain, allies, player) {
    let adjCount = 0
    let engagedCount = 0
    for (const a of allies) {
        const dx = a.x - player.x
        const dy = a.y - player.y
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        if (dist <= 1) adjCount += 1
        if (a.isEngaged()) engagedCount += 1
    }

    const captainLowHp = captain.healthPoints / (captain.maxHealthPoints || 1) <= 0.5
    let choice
    if (captainLowHp) {
        // Wounded captains either pull bodyguards in (protect-me) or
        // signal the whole squad to brace (defend). Equal weight; both
        // are persistent until the captain reissues something else.
        choice = Math.random() < 0.5
            ? { command: "protect-me", persistent: true }
            : { command: "defend", persistent: true }
    } else if (adjCount >= 2) {
        choice = { command: "focus-player", persistent: false }
    } else if (allies.length >= 3 && engagedCount >= 2) {
        // Big squad already in the fight — squeeze the perimeter so
        // the player can't peel off and recover. Persistent: keep
        // the box in place until a new command lands.
        choice = { command: "box-in", persistent: true }
    } else if (allies.length >= 2 && engagedCount >= 1) {
        choice = { command: Math.random() < 0.5 ? "flank-left" : "flank-right", persistent: false }
    } else {
        choice = { command: "advance", persistent: true }
    }

    issueOrder(captain, allies, choice.command, choice.persistent)
}

export default function blitz(captain, player) {
    if ((captain.commandCooldownRemaining ?? 0) > 0) {
        captain.commandCooldownRemaining -= 1
        return
    }

    const allies = findAlliesInRange(captain)
    if (allies.length === 0) {
        captain.commandCooldownRemaining = 1
        return
    }

    const commandsToIssue = captain.commandsPerTick ?? 1
    for (let i = 0; i < commandsToIssue; i++) {
        pickAndIssue(captain, allies, player)
    }
    captain.commandCooldownRemaining = rollBlitzCooldown()
}
