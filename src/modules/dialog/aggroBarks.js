// Growls / roars / shouts an enemy lets out the moment it first spots the
// hero. Data, not a class hierarchy — lines are keyed by enemy kind (see
// enemyKinds.js), with an `undead` override that crosses kinds so a
// Skeleton rattles instead of barking orders like a living humanoid.
//
// Used by BaseEnemy.updatePerception at the not-alerted -> alerted edge,
// rendered as a floating speech bubble (SpeechBubble.js). Extending: add a
// line to a kind below, or a new kind key. Per-species overrides (a Goblin
// vs a generic humanoid) can layer on later by name if wanted.

import { kindOf, isUndead } from "../enemies/enemyKinds.js"

const BARKS = {
    humanoid: ["Intruder!", "There — get them!", "Halt!", "You shouldn't have come here.", "Kill it!"],
    animal:   ["GRRRAAAH!", "*growls*", "Rrrrr...", "ROOOAR!", "*snarls*"],
    insect:   ["*hiss*", "Skreee!", "*chitters*", "Kssssss!"],
    spirit:   ["Wooo...", "You disturb the dead...", "*wails*", "Leave this place..."],
    creature: ["GRAAAH!", "Hssss...", "*gurgles*"],
    undead:   ["The dead do not rest...", "*rattles*", "Join usss...", "Flesh...!"],
}

// Pick a bark line for an enemy. Undead takes precedence over biological
// kind so an undead humanoid (Skeleton) doesn't shout living-soldier lines.
export function aggroBark(enemy) {
    const key = isUndead(enemy) ? "undead" : kindOf(enemy)
    const lines = BARKS[key] || BARKS.creature
    return lines[Math.floor(Math.random() * lines.length)]
}
