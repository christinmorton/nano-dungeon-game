// The hero reacting out loud to things that happen to them: catching a
// nasty status, dropping to low HP, or finding a notable piece of loot.
// Gives the five classes a voice without any state machine. Each function
// self-gates (hero only) and is a no-op when it shouldn't speak.

import tm from "../TurnManager.js"
import speech from "../SpeechBubble.js"
import { getStatusMeta } from "../tags/Status.js"
import { motivationLine } from "./motivationBarks.js"

const REACT_COOLDOWN = 4          // ticks between status/low-HP reactions
const LOW_HP_RATIO = 0.3          // bark once when HP first dips to/below this
const NOTABLE_SLOTS = ["mainhand", "offhand", "head", "body", "accessory"]

// Per-affliction lines (only negative-valence statuses ever reach here).
const STATUS_LINES = {
    Stun:    ["Ngh— can't move!", "Dazed!"],
    Poison:  ["Poison! Ugh.", "I feel sick..."],
    Burning: ["I'm on fire!", "Burning!"],
    Freeze:  ["S-so cold!", "Frozen!"],
    Bleed:   ["I'm bleeding!", "Argh — a deep cut!"],
    Cursed:  ["A curse!", "Something's wrong..."],
    Rooted:  ["My feet — stuck!", "I can't move my legs!"],
    Slow:    ["So... sluggish.", "Everything's slowing..."],
}
const STATUS_DEFAULT = ["What's happening to me?", "That can't be good."]

const LOW_HP_LINES = ["I'm in trouble!", "I can't take much more!", "Almost done for!", "I need healing — now!"]

const LOOT_LINES = {
    weapon:    ["Now we're talking.", "A fine blade!", "This'll do nicely."],
    armor:     ["Some protection!", "This should help."],
    accessory: ["Hmm, useful.", "Interesting..."],
}
const LOOT_DEFAULT = ["Nice find!", "Could be useful."]

function pick(list) {
    return list[Math.floor(Math.random() * list.length)]
}

function canReact(hero) {
    return tm.tickCount - (hero._lastReactTick ?? -Infinity) >= REACT_COOLDOWN
}
function mark(hero) {
    hero._lastReactTick = tm.tickCount
}

// Called from BaseHero.addTag when a NEW tag lands. Only barks for true
// negative statuses (skips buffs, materials, role tags — getStatusMeta
// returns null for non-statuses).
export function reactHeroStatus(hero, statusName) {
    if (!hero || hero.type !== "hero") return
    const meta = getStatusMeta(statusName)
    if (!meta || meta.valence !== "negative") return
    if (!canReact(hero)) return
    speech.say(hero, pick(STATUS_LINES[statusName] || STATUS_DEFAULT), { combat: true })
    mark(hero)
}

// Called after the hero takes damage. Fires once on the downward crossing
// below LOW_HP_RATIO; re-arms when HP climbs back above it. Marks the
// reaction cooldown so it wins over a same-tick status bark.
export function reactHeroLowHp(hero) {
    if (!hero || hero.type !== "hero") return
    const ratio = hero.healthPoints / (hero.maxHealthPoints || 1)
    if (ratio > LOW_HP_RATIO) { hero._lowHpBarked = false; return }
    if (hero._lowHpBarked) return
    hero._lowHpBarked = true
    // Prefer a motivation-flavored line when the hero has a motivation (Phase 6 sets
    // hero.motivation from the run's chosen Character); null-safe fallback to generic.
    const line = motivationLine(hero.motivation, "lowHp") || pick(LOW_HP_LINES)
    speech.say(hero, line, { combat: true })
    mark(hero)
}

// Called when the hero picks up an item. Only notable (equippable) gear
// gets a line — consumables, gems, keys stay quiet.
export function reactHeroLoot(hero, item) {
    if (!hero || hero.type !== "hero" || !item) return
    if (!NOTABLE_SLOTS.includes(item.slot)) return
    const group = item.slot === "mainhand" || item.slot === "offhand" ? "weapon"
        : item.slot === "accessory" ? "accessory" : "armor"
    // Prefer a motivation-flavored line when the hero has a motivation (Phase 6 sets
    // hero.motivation from the run's chosen Character); null-safe fallback to generic.
    const line = motivationLine(hero.motivation, "loot") || pick(LOOT_LINES[group] || LOOT_DEFAULT)
    speech.say(hero, line)
}
