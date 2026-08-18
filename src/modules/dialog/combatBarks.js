// Combat-side enemy barks: a captain shouting an order, and an enemy
// crying out as its morale breaks and it flees. Both fire DURING combat,
// so they're said with { combat: true } — that exempts them from the
// engaged-bubble clear in SpeechBubble.sync() (the bubble still renders
// below HP bars + damage numbers, so combat stays readable).

import tm from "../TurnManager.js"
import speech from "../SpeechBubble.js"
import { kindOf, isUndead } from "../enemies/enemyKinds.js"

// Captain order lines keyed by the command string issued in captain.js /
// the playbooks. Unknown commands fall back to ORDER_DEFAULT.
const ORDERS = {
    "advance":      ["Advance!", "Push forward!", "Move up!"],
    "focus-player": ["Focus the intruder!", "All on the hero!", "Bring them down!"],
    "protect-me":   ["Protect me, you fools!", "Guard your captain!", "To me!"],
    "defend":       ["Defend!", "Hold your ground!", "Shields up!"],
    "box-in":       ["Surround them!", "Cut off the exits!", "Box them in!"],
    "flank-left":   ["Flank left!", "Take their flank!"],
    "flank-right":  ["Flank right!", "Take their flank!"],
    "form-up":      ["Form up!", "On me — ranks!"],
    "hold":         ["Hold the line!", "Steady!", "Hold!"],
    "break":        ["Break and engage!", "At them!", "Charge!"],
    "stall":        ["Stall them!", "Keep them busy!"],
    "go-to":        ["Move out!", "This way!"],
}
const ORDER_DEFAULT = ["Orders!", "Move!"]

// Morale-break cries, varied by kind with an undead override (a skeleton
// doesn't shout "every man for himself").
const MORALE = {
    humanoid: ["Retreat!", "I'm out of here!", "Too strong — run!", "Every man for himself!"],
    animal:   ["*whimpers*", "*yelps*", "*bolts*"],
    insect:   ["*skitters away*", "*retreats*"],
    spirit:   ["It cannot be...", "*recoils*", "*fades*"],
    creature: ["*recoils*", "*flees*"],
    undead:   ["The dead... retreat?", "*rattles away*"],
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}

export function captainOrderBark(captain, command) {
    if (!captain) return
    speech.say(captain, pick(ORDERS[command] || ORDER_DEFAULT), { combat: true })
}

export function moraleBreakBark(enemy) {
    if (!enemy) return
    const key = isUndead(enemy) ? "undead" : kindOf(enemy)
    speech.say(enemy, pick(MORALE[key] || MORALE.creature), { combat: true })
}

// Battle cries / taunts that rank-and-file enemies shout while fighting —
// the parallel to a captain's orders, so a fight isn't only the leader's
// voice. Kind-varied, with an undead override.
const TAUNTS = {
    humanoid: ["Take this!", "Die!", "You're finished!", "Come here!", "Is that all?"],
    animal:   ["*snarls*", "GRRR!", "*snaps*"],
    insect:   ["*hiss*", "*clicks*"],
    spirit:   ["Join us...", "*wails*"],
    creature: ["RAAGH!", "*gurgles*"],
    undead:   ["*groans*", "Flesh...", "*rattles*"],
}

const TAUNT_CHANCE = 0.05     // per eligible tick
const TAUNT_COOLDOWN = 8      // ticks an enemy stays quiet after a taunt

// Throttled combat taunt. Eligible = an on-screen, engaged, non-captain,
// non-fleeing enemy off cooldown. One roll per enemy per tick (the
// _tauntTriedTick guard stops a multi-step turn from rolling repeatedly).
export function maybeCombatTaunt(enemy) {
    if (!enemy || enemy.type !== "enemy") return
    if (enemy._tauntTriedTick === tm.tickCount) return
    enemy._tauntTriedTick = tm.tickCount

    if (enemy.archetype === "captain" || enemy.fleeing || enemy.phased) return
    if (!enemy.isEngaged || !enemy.isEngaged()) return
    if (!enemy.sprite || !enemy.sprite.visible) return
    if (tm.tickCount - (enemy._lastTauntTick ?? -Infinity) < TAUNT_COOLDOWN) return
    if (Math.random() >= TAUNT_CHANCE) return

    const key = isUndead(enemy) ? "undead" : kindOf(enemy)
    speech.say(enemy, pick(TAUNTS[key] || TAUNTS.creature), { combat: true })
    enemy._lastTauntTick = tm.tickCount
}
