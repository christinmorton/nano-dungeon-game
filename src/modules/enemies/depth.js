import Phaser from "phaser"
import archetypes from "../archetypes/index.js"
import gameLog from "../GameLog.js"
import { applyPoison } from "../tags/poison.js"
import { applyCorruption } from "../tags/corrupted.js"

// Depth — what the descent does to an enemy (scope doc §10.15).
//
// Until 2026-10-03 nothing did. Stats were rolled from the archetype template
// and HP from its formula on every floor alike, so a floor-5 orc was a floor-1
// orc standing somewhere darker. The user's playtest put it plainly: "the
// enemies do not get stronger or more threatening in the lower levels."
//
// Two things happen here, both at spawn, both after finalizeSpawn has rolled
// the archetype and its stats (see Enemies.buildEnemy):
//
//   applyDepth(enemy, floor)  — the floor index scales the rolled stats and
//                               recomputes HP through the archetype's own formula.
//   rollTitle(enemy, floor)   — from floor 3, a rising chance of ONE title trait:
//                               a Taggable tag that prefixes the name ("High Orc",
//                               "Savage Ogre") and changes one thing.
//
// Every title is built on a hook or status the game already ships — eliteEnrager
// is the reference for the hook shape — so neither the enemy cap nor the status
// cap moves. A TAG TEMPLATE IS A MAP OF HOOK NAMES ONLY (name / initialize /
// cleanup plus methods the entity actually has: attack, turn, onDealtDamage,
// statContribution…). Helpers live at module scope. Taggable calls a handler
// with (previousResult, ...originalArgs), so `attack(base)` returns the new
// damage and `statContribution(running, name)` returns the new running total.

// --- depth -------------------------------------------------------------------

// Per floor INDEX (floor 1 = 0, so the first floor is untouched). At these
// numbers a floor-5 brute rolls STR 21-23 against floor 1's 13-15 and carries
// about 2.3x the HP once the CON bump and the multiplier compound.
export const DEPTH_STAT_STEP = 2
export const DEPTH_STATS = ["STR", "DEX", "CON", "Magic"]
export const DEPTH_HP_STEP = 0.15

export function applyDepth(enemy, floor) {
    if (!enemy || !enemy.stats || floor == null || floor <= 0) return enemy
    for (const name of DEPTH_STATS) {
        enemy.stats[name] = (enemy.stats[name] ?? 0) + DEPTH_STAT_STEP * floor
    }
    // Through the archetype's own formula so the CON bump counts, then the
    // multiplier on top. Max first, current derived from it.
    const arche = archetypes[enemy.archetype]
    const base = arche && arche.hpFormula ? arche.hpFormula(enemy.stats) : (enemy.maxHealthPoints || 1)
    enemy.maxHealthPoints = Math.round(base * (1 + DEPTH_HP_STEP * floor))
    enemy.healthPoints = enemy.maxHealthPoints
    enemy._depth = floor
    return enemy
}

// --- titles ------------------------------------------------------------------

// Chance of a title by floor index. Nothing on the first two floors, so the
// player learns the plain roster before it starts wearing adjectives.
export const TITLE_CHANCE_BY_FLOOR = [0, 0, 0.15, 0.30, 0.45]

// Shared: prefix the name once, remember the title, and tint lightly so a
// titled enemy reads as different before its name is hovered. The elite tint is
// re-applied by eliteEnrager every turn, so an elite that also carries a title
// stays elite-red — the name carries both words.
function entitle(enemy, title, tint) {
    enemy.name = `${title} ${enemy.name}`
    enemy._title = title
    if (tint && !enemy._elite) {
        enemy.tint = tint
        if (enemy.sprite) {
            enemy.sprite.tint = tint
            enemy.sprite.tintFill = false
        }
    }
}

// Savage — the brute that hits harder the more it bleeds. Same shape as the
// elite rage, smaller, and the +STR is on from the start.
const savage = {
    name: "Savage",
    initialize: function () {
        if (this.type !== "enemy") return
        if (this.stats) this.stats.STR += 3
        entitle(this, "Savage", 0xffb070)
    },
    attack: function (base) {
        if (this.healthPoints < this.maxHealthPoints * 0.5) {
            if (!this._savageRoused) {
                this._savageRoused = true
                gameLog.log(`${this.name} fights like something cornered!`)
            }
            return base + 3
        }
        return base
    },
}

// High — the officer. Armour it did not have, and a second action a round:
// TurnManager keeps calling turn() until the enemy is over, and every melee
// archetype spends one action per call, so +1 AP is a second swing.
const high = {
    name: "High",
    initialize: function () {
        if (this.type !== "enemy") return
        this.actionPoints += 1
        if (this.refreshRates) this.refreshRates.actionPoints += 1
        entitle(this, "High", 0xf0d890)
    },
    statContribution: function (running, name) {
        return name === "armor" ? running + 2 : running
    },
}

// Venomous — every hit poisons. Scaled off the hit so a floor-5 bite is not
// the floor-1 potion-tier trickle; applyPoison refreshes an existing poison
// rather than stacking a second timer.
const venomous = {
    name: "Venomous",
    initialize: function () {
        if (this.type !== "enemy") return
        entitle(this, "Venomous", 0x9ee07a)
    },
    onDealtDamage: function (ret, victim, dealt) {
        if (victim && victim.healthPoints > 0) {
            applyPoison(victim, Math.max(2, Math.floor(dealt / 4)), 5)
        }
        return ret
    },
}

// Blighted — every hit corrupts (the arcane DoT from §10.8). The undead's
// answer to the spider's venom.
const blighted = {
    name: "Blighted",
    initialize: function () {
        if (this.type !== "enemy") return
        entitle(this, "Blighted", 0xb08cf0)
    },
    onDealtDamage: function (ret, victim, dealt) {
        if (victim && victim.healthPoints > 0) {
            applyCorruption(victim, Math.max(3, Math.floor(dealt / 3)), 3)
        }
        return ret
    },
}

// Hulking — twice the HP, nothing else. Applied AFTER applyDepth, so it doubles
// the already-scaled pool. Drawn a little larger so the word is visible.
const hulking = {
    name: "Hulking",
    initialize: function () {
        if (this.type !== "enemy") return
        this.maxHealthPoints = (this.maxHealthPoints || 1) * 2
        this.healthPoints = this.maxHealthPoints
        if (this.sprite) this.sprite.setScale(this.sprite.scaleX * 1.15, this.sprite.scaleY * 1.15)
        entitle(this, "Hulking", null)
    },
}

// Swift — one more move a round. The fast roster gets faster; the thing that
// used to be kiteable now keeps up.
const swift = {
    name: "Swift",
    initialize: function () {
        if (this.type !== "enemy") return
        this.movementPoints += 1
        if (this.refreshRates) this.refreshRates.movementPoints += 1
        entitle(this, "Swift", 0xa8e8ff)
    },
}

// Which species may wear which title. Keyed by CLASS NAME, like enemyKinds.js
// and the stronghold art maps, with the same caveat: a new enemy class is
// invisible here until named.
export const TITLES = [
    { tag: savage, species: ["Orc", "Ogre"] },
    { tag: high, species: ["Orc", "Goblin", "GoblinArcher", "DarkSorcerer"] },
    { tag: venomous, species: ["Spider", "Scorpion"] },
    { tag: blighted, species: ["Skeleton", "Ghost"] },
    { tag: hulking, species: ["Ogre", "Orc", "Slime"] },
    { tag: swift, species: ["Bat", "Goblin", "Spider", "Ghost"] },
]

// Maybe give `enemy` one title. At most one: two adjectives on a goblin reads
// as a joke, and the point of a title is that one thing about this enemy is
// different.
export function rollTitle(enemy, floor) {
    if (!enemy || enemy._title || floor == null) return enemy
    const chance = TITLE_CHANCE_BY_FLOOR[Math.min(floor, TITLE_CHANCE_BY_FLOOR.length - 1)] || 0
    if (Math.random() >= chance) return enemy
    const species = enemy.constructor && enemy.constructor.name
    const eligible = TITLES.filter(t => t.species.includes(species))
    if (!eligible.length) return enemy
    const pick = Phaser.Utils.Array.GetRandom(eligible)
    enemy.addTag(pick.tag)
    return enemy
}
