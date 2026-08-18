import { findAlliesInRange, issueOrder } from "../captain.js"

// Freeform playbook — long quiet stretches between captain commands.
// Allies live on their default archetype behavior most of the time
// (path to player when engaged, idle wander when not), and the
// captain interjects with a one-shot group command every 10-15 turns.
// Player experience: pressure with monotony, occasional coordinated
// burst — opposite of blitz's constant variety.

const FREEFORM_COOLDOWN_MIN = 10
const FREEFORM_COOLDOWN_MAX = 15

function rollFreeformCooldown() {
    return FREEFORM_COOLDOWN_MIN
        + Math.floor(Math.random() * (FREEFORM_COOLDOWN_MAX - FREEFORM_COOLDOWN_MIN + 1))
}

export default function freeform(captain, player) {
    if ((captain.commandCooldownRemaining ?? 0) > 0) {
        captain.commandCooldownRemaining -= 1
        return
    }

    const allies = findAlliesInRange(captain)
    if (allies.length === 0) {
        captain.commandCooldownRemaining = 5
        return
    }

    // Short vocabulary on purpose — freeform commands punctuate, they
    // don't choreograph. advance lasts a few ally turns; focus-player
    // is a sharper interrupt; stall is the "everyone freeze, captain
    // is thinking" beat that fits the loose feel of this playbook.
    const roll = Math.random()
    let choice
    if (roll < 0.4) {
        choice = { command: "advance", persistent: true }
    } else if (roll < 0.7) {
        choice = { command: "focus-player", persistent: false }
    } else {
        choice = { command: "stall", persistent: true }
    }

    issueOrder(captain, allies, choice.command, choice.persistent)
    captain.commandCooldownRemaining = rollFreeformCooldown()
}
