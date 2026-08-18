// Ally command / instruction system — the PLAYER-side party coordination channel.
// A party leader OR any party member can issue a standing instruction to an
// allied party member; the ally stores it as `allyCommand` and the ally brain
// (archetypes/ally.js) acts on it each turn. This is the organizing layer on top
// of the follower component (the parked "Party" concept) — deliberately distinct
// from the enemy captain/squad order system (`currentOrder`), which is untouched.
//
// An ally with no command defaults to FOLLOW (the original bodyguard behavior),
// so existing followers/summons/tamed beasts behave exactly as before until
// commanded.

export const ALLY_COMMANDS = {
    FOLLOW: "follow",          // trail the leader, fight foes threatening it (default)
    STAY: "stay",              // hold this tile; only strike a foe that comes adjacent
    ATTACK: "attack",          // focus-fire { target } until it dies, then revert to follow
    GUARD: "guard",            // hold { tile } and fight foes near it
    PASSIVE: "passive",        // follow but HOLD FIRE — never attack
    AGGRESSIVE: "aggressive",  // hunt any enemy within leash, not just leader-threats
    RECALL: "recall",          // one-shot: return to the leader, then revert to follow
    USE_ABILITY: "useAbility", // fire { ability, target } on the ally's next turn
}

const COMMAND_VALUES = new Set(Object.values(ALLY_COMMANDS))

// Give one ally a standing command. `by` is the commander (leader or a party
// member) — recorded for context/future authority rules; the order takes effect
// regardless today. opts carries the order's parameters: { target, tile, ability }.
// Returns the stored command object.
export function commandAlly(ally, type, opts = {}) {
    if (!ally) return null
    const kind = COMMAND_VALUES.has(type) ? type : ALLY_COMMANDS.FOLLOW
    ally.allyCommand = {
        type: kind,
        target: opts.target ?? null,
        tile: opts.tile ?? null,
        ability: opts.ability ?? null,
        by: opts.by ?? null,
    }
    return ally.allyCommand
}

// Clear an ally's command — back to the default FOLLOW behavior. Used by one-shot
// orders (recall / useAbility) once they complete, or to dismiss any order.
export function clearCommand(ally) {
    if (ally) ally.allyCommand = null
}

// Issue the same command to EVERY ally on a commander's party roster (a party-
// wide order: "everyone, attack!" / "all hold"). Returns how many were commanded.
export function commandParty(commander, type, opts = {}) {
    if (!commander || !Array.isArray(commander.party)) return 0
    let n = 0
    for (const ally of commander.party) {
        commandAlly(ally, type, { ...opts, by: opts.by ?? commander })
        n++
    }
    return n
}
