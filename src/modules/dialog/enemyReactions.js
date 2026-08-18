// Enemies reacting out loud to things that happen to them — catching a bad
// status or dropping to low HP. The enemy-side counterpart to
// heroReactions.js. Each function self-gates (enemy only, on-screen) and is
// a no-op otherwise.

import tm from "../TurnManager.js"
import speech from "../SpeechBubble.js"
import { getStatusMeta } from "../tags/Status.js"

const REACT_COOLDOWN = 4
// Below the 0.3 fleeThreshold of the fleeing archetypes (skirmisher/archer):
// those break morale and cry out via moraleBreakBark BEFORE reaching this,
// so only non-fleeing holdouts (brutes, etc.) ever low-HP bark. No double-up.
const LOW_HP_RATIO = 0.25

const STATUS_LINES = {
    Stun:    ["Ngh!", "*reels*"],
    Poison:  ["*coughs*", "Poison...!"],
    Burning: ["Aagh! Fire!", "*burns*"],
    Freeze:  ["C-cold!", "*shivers*"],
    Bleed:   ["*bleeds*", "Augh!"],
    Cursed:  ["*shudders*", "What magic...?"],
    Rooted:  ["Stuck!", "Can't move!"],
    Slow:    ["So slow...", "*sluggish*"],
}
const STATUS_DEFAULT = ["Argh!", "What's this?!"]

const LOW_HP_LINES = ["I'm hurt!", "Augh!", "*staggers*", "No more...!"]

// Inhalant reaction — the enemy hacks and wheezes instead of its usual hit-yell
// (Blinding Powder, choking gas, spores…). Reusable for any "breathed something
// in" effect. Reads as an EMOTE via the same speech bubble the other reactions
// use. Call it as the cloud lands; it also claims the react-cooldown slot so the
// generic status bark (addTag -> reactEnemyStatus) stays quiet and this owns the
// moment — call it BEFORE the status is applied for the suppression to take.
const COUGH_LINES = ["*cough cough*", "*hack!*", "*choking*", "C-can't breathe!", "*wheeze*"]
export function reactCough(enemy) {
    if (!enemy || enemy.type !== "enemy" || !visible(enemy)) return
    enemy._lastReactTick = tm.tickCount          // claim the slot -> suppress the default bark
    speech.say(enemy, pick(COUGH_LINES), { combat: true })
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}
function canReact(enemy) {
    return tm.tickCount - (enemy._lastReactTick ?? -Infinity) >= REACT_COOLDOWN
}
function visible(enemy) {
    return enemy && enemy.sprite && enemy.sprite.visible
}

// Called from BaseEnemy.addTag when a NEW tag lands. Only barks for true
// negative statuses on a visible enemy.
export function reactEnemyStatus(enemy, statusName) {
    if (!enemy || enemy.type !== "enemy" || !visible(enemy)) return
    const meta = getStatusMeta(statusName)
    if (!meta || meta.valence !== "negative") return
    if (!canReact(enemy)) return
    speech.say(enemy, pick(STATUS_LINES[statusName] || STATUS_DEFAULT), { combat: true })
    enemy._lastReactTick = tm.tickCount
}

// Called after an enemy takes damage. Fires once on the downward crossing
// below LOW_HP_RATIO; re-arms when HP climbs back. Skipped while fleeing
// (the morale-break cry owns that moment).
export function reactEnemyLowHp(enemy) {
    if (!enemy || enemy.type !== "enemy" || enemy.fleeing || !visible(enemy)) return
    const ratio = enemy.healthPoints / (enemy.maxHealthPoints || 1)
    if (ratio > LOW_HP_RATIO) { enemy._lowHpBarked = false; return }
    if (enemy._lowHpBarked) return
    enemy._lowHpBarked = true
    speech.say(enemy, pick(LOW_HP_LINES), { combat: true })
    enemy._lastReactTick = tm.tickCount
}
