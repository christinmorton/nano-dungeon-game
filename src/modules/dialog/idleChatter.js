// Ambient flavor: humanoid enemies who HAVEN'T noticed the hero yet
// occasionally mutter to themselves or trade a quick joke with a nearby
// buddy. Pure seasoning — no state machine, no relationships, no choices.
// Just pick a line and say it, hard-throttled so it never becomes noise.
//
// Driven from BaseEnemy.turn() via maybeChatter(enemy). Only fires for an
// on-screen, idle/patrolling, unalerted humanoid that's off cooldown.

import tm from "../TurnManager.js"
import speech from "../SpeechBubble.js"
import { kindOf } from "../enemies/enemyKinds.js"

// --- tuning (turns are "ticks"; chatter only rolls while idle + visible) ---
const CHATTER_COOLDOWN = 30   // an enemy stays quiet this many ticks after speaking
const CHATTER_CHANCE = 0.04   // per eligible tick
const BANTER_RATIO = 0.5      // when a buddy is nearby, odds of a joke vs a solo emote
const PARTNER_RADIUS = 4      // tiles (Chebyshev) to find a banter buddy
const BANTER_DELAY = 900      // ms before the buddy delivers the punchline

// Solo one-liners — bored dungeon guards muttering to themselves.
const SOLO_EMOTES = [
    "*yawn*",
    "...so bored.",
    "I hate the night shift.",
    "*scratches*",
    "My feet are killing me.",
    "When's the relief coming?",
    "*mutters*",
    "Quiet down there...",
    "*sniff* ...smells like trouble.",
]

// Two-part exchanges: speaker says `a`, the buddy answers `b` a beat later.
const BANTER = [
    { a: "Did you hear something?",                  b: "It's always something. Relax." },
    { a: "Think there's treasure down here?",        b: "If there was, we wouldn't be guarding it." },
    { a: "I miss the surface.",                       b: "You and me both." },
    { a: "What's for dinner?",                        b: "Rat. Again." },
    { a: "Bet you a gold piece nothing happens.",     b: "You're on." },
    { a: "Is it just me, or is it cold down here?",   b: "It's a dungeon. It's always cold." },
    { a: "I think I saw something move.",             b: "That's what the last guy said." },
    { a: "Why do WE always get the deep floors?",     b: "We drew the short straw." },
    { a: "*snores*",                                  b: "Wake up! ...idiot." },
]

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}

// Can this enemy chatter right now? On-screen idle humanoid, not in/near a
// fight, off cooldown. Also used to vet a banter buddy.
function eligible(enemy) {
    if (!enemy || enemy.type !== "enemy") return false
    if (kindOf(enemy) !== "humanoid") return false
    if (enemy.alerted || enemy.phased) return false
    if (enemy.isEngaged && enemy.isEngaged()) return false
    if (enemy.state !== "idle" && enemy.state !== "patrolling") return false
    // Only chatter when the player can actually see them — no talking to fog.
    if (!enemy.sprite || !enemy.sprite.visible) return false
    const last = enemy._lastChatterTick ?? -Infinity
    return tm.tickCount - last >= CHATTER_COOLDOWN
}

function findBuddy(enemy) {
    for (const other of tm.entities) {
        if (other === enemy || !eligible(other)) continue
        const dx = Math.abs(other.x - enemy.x)
        const dy = Math.abs(other.y - enemy.y)
        if (Math.max(dx, dy) <= PARTNER_RADIUS) return other
    }
    return null
}

export function maybeChatter(enemy) {
    // One roll per enemy per tick, regardless of how many times turn() runs
    // while it walks — keeps patrolling enemies from rolling once per step.
    if (enemy._chatterTriedTick === tm.tickCount) return
    enemy._chatterTriedTick = tm.tickCount

    if (!eligible(enemy)) return
    if (Math.random() >= CHATTER_CHANCE) return

    const buddy = findBuddy(enemy)
    if (buddy && Math.random() < BANTER_RATIO) {
        const { a, b } = pick(BANTER)
        speech.say(enemy, a)
        speech.say(buddy, b, { delay: BANTER_DELAY })
        enemy._lastChatterTick = tm.tickCount
        buddy._lastChatterTick = tm.tickCount
    } else {
        speech.say(enemy, pick(SOLO_EMOTES))
        enemy._lastChatterTick = tm.tickCount
    }
}
