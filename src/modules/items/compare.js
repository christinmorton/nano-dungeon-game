// Item comparison — the numbers behind "is this better than what I have on?"
//
// Until 2026-10-03 the only place an item's stats appeared was its prose
// description, and the hero's derived numbers (attack, armor, dodge, block,
// barrier) were computed in BaseHero and shown nowhere. A player holding two
// cuirasses, or a legendary and a sword, had no way to tell them apart except
// by reading sentences. This module is what the Character screen and the
// Shop read.
//
// THE HONEST COMPARISON IS A SIMULATED SWAP. Every equipment effect already
// flows through one reducer, hero.stat(name): base stats + equipped-item
// contributions + passives. So instead of re-deriving what each item type
// "means", sheetWith() puts the candidate into its slot on the inventory map,
// reads the sheet, and puts the old item back. That is a pure read on a plain
// object — no equip() side effects, no log lines, no HUD refresh — and it
// catches everything, including a bow's +1 dodge rider that a damage-only
// comparison would miss.
//
// Pure functions over a hero and an item. Only import is the empower label
// helper (itself a leaf), so any screen can use this without touching the
// BaseEnemy/GenericItem init chain.
import { empowerText } from "../abilities/empower.js"

// What the sheet reports, in display order. `pct` values are already 0-100.
export const SHEET_ROWS = [
    { key: "attack", label: "Attack", hint: "average hit before the target's armor" },
    { key: "spell", label: "Spell power", hint: "every spell scales from this" },
    { key: "range", label: "Range", hint: "tiles" },
    { key: "armor", label: "Armor", hint: "taken off every physical hit" },
    { key: "barrier", label: "Barrier", hint: "taken off every magic hit" },
    { key: "dodge", label: "Dodge", pct: true },
    { key: "block", label: "Block", pct: true },
    { key: "crit", label: "Crit", pct: true },
    { key: "sight", label: "Sight", hint: "extra tiles of light from a held torch" },
]

// The hero's derived numbers as they stand right now.
export function heroSheet(hero) {
    const weapon = hero.currentWeapon?.() || hero.unarmed?.() || null
    const profile = weapon?.profile || {}
    const powerStat = weapon?.attackPowerStat ?? "attackPower"
    const min = profile.damageMin ?? 0
    const max = profile.damageMax ?? min
    const power = hero.stat(powerStat)
    // Mirrors BaseHero.attack(): an enchanted weapon on a non-magic scaling
    // stat adds the Magic-derived flavor bonus on top.
    const flavor = (weapon?.damageFlavor && powerStat !== "magicPower") ? hero.stat("magicPower") : 0
    const off = hero.inventory?.equippedSlots?.offhand
    return {
        attack: power + (min + max) / 2 + flavor,
        attackMin: power + min + flavor,
        attackMax: power + max + flavor,
        powerStat,
        spell: hero.stat("magicPower"),
        range: weapon?.range?.() ?? 1,
        armor: hero.stat("armor"),
        barrier: hero.stat("barrier"),
        dodge: Math.round((hero.dodgeChance?.() ?? 0) * 100),
        block: Math.round((hero.blockChance?.() ?? 0) * 100),
        crit: Math.round((hero.stat("critChance") ?? 0) * 100),
        // Held torch plus worn light (the `sight` stat, §10.17) — the same sum
        // FogOfWar makes.
        sight: (off?.isLightSource ? (off.currentLight?.() ?? 0) : 0) + (hero.stat("sight") ?? 0),
    }
}

// The sheet as it WOULD read with `item` equipped in its slot. Null for an
// item with no slot (a potion changes no stat by being carried).
export function sheetWith(hero, item) {
    const slots = hero.inventory?.equippedSlots
    if (!item || !item.slot || !slots || !(item.slot in slots)) return null
    const previous = slots[item.slot]
    slots[item.slot] = item
    try {
        return heroSheet(hero)
    } finally {
        slots[item.slot] = previous
    }
}

// What equipping `item` changes, as [{ key, label, from, to, delta, pct }],
// non-zero rows only. Empty array = identical to what is worn; null = not
// equippable. An item that is ALREADY in its slot compares against nothing.
export function equipDeltas(hero, item) {
    const after = sheetWith(hero, item)
    if (!after) return null
    const before = heroSheet(hero)
    const out = []
    for (const row of SHEET_ROWS) {
        const from = before[row.key] ?? 0
        const to = after[row.key] ?? 0
        const delta = to - from
        if (Math.abs(delta) < 0.05) continue
        out.push({ key: row.key, label: row.label, from, to, delta, pct: !!row.pct })
    }
    return out
}

// One short line of what the item itself contributes, read off its profile:
//   "1–5 dmg · range 2 · fire"      a weapon
//   "+2 armor · +1 dodge"           armor with a rider
//   "+3 sight · 40 turns"           a light
//   ""                              a consumable (its description says it all)
// Numbers only — the delta is what says whether they are good.
export function itemStatLine(item) {
    if (!item) return ""
    const p = item.profile || {}
    const parts = []
    if (item.weapon) {
        const min = p.damageMin ?? 0
        const max = p.damageMax ?? min
        parts.push(min === max ? `${min} dmg` : `${min}–${max} dmg`)
        const range = item.range?.()
        if (range != null) parts.push(`range ${range}`)
        if (p.minRange) parts.push(`min ${p.minRange}`)
        if (item.damageFlavor) parts.push(item.damageFlavor)
        // Weapon riders (scope doc §10.16): the AoE and the chance-status a
        // higher-tier weapon carries, so the shelf says what the shot does.
        if (item.splash) parts.push(`splash ${item.splash.radius ?? 1}`)
        if (item.onHitStatus) {
            const pct = Math.round((item.onHitStatus.chance ?? 1) * 100)
            parts.push(`${pct}% ${String(item.onHitStatus.name).toLowerCase()}`)
        }
        // What a caster weapon does to the caster's SPELLS (§10.16).
        const empowered = empowerText(item.empower)
        if (empowered) parts.push(empowered)
        // Legendary weapon procs (§10.17).
        if (item.lifesteal) parts.push(`${Math.round(item.lifesteal * 100)}% lifesteal`)
        if (item.executeBelow) parts.push(`x${item.executeBelow.mult ?? 2} under ${Math.round((item.executeBelow.fraction ?? 0.25) * 100)}% hp`)
        if (item.bonusVs?.undead) parts.push(`x${item.bonusVs.undead} vs undead`)
    } else if (item.isLightSource) {
        parts.push(`+${item.lightBonus ?? 0} sight`)
        parts.push(item.duration == null ? "steady" : `${item.burnsLeft ?? item.duration} turns`)
    } else if (typeof item.protection === "function" && item.slot) {
        parts.push(`+${item.protection()} armor`)
    }
    for (const [stat, value] of Object.entries(p.statContribution || {})) {
        if (!value) continue
        parts.push(statLabel(stat, value))
    }
    // Dynamic accessory contributions (§10.17).
    if (p.statPerFloor) {
        const stats = Object.keys(p.statPerFloor).join("/")
        parts.push(`+${Object.values(p.statPerFloor)[0]} ${stats} per floor`)
    }
    if (p.statWhenBloodied) {
        const bits = Object.entries(p.statWhenBloodied).map(([s, v]) => statLabel(s, v))
        parts.push(`below half hp: ${bits.join(" ")}`)
    }
    return parts.join(" · ")
}

// A stat contribution as the shelf should read it. The §10.17 keys are words,
// not numbers: a player does not know what "+1 fortune" means and does know
// what "coins x2" means.
function statLabel(stat, value) {
    const sign = value > 0 ? "+" : ""
    switch (stat) {
        case "critChance": return `${sign}${Math.round(value * 100)}% crit`
        case "thorns": return `thorns ${value}`
        case "fortune": return `coins x${1 + value}`
        case "sight": return `${sign}${value} sight`
        case "lastBreath": return "survives death once"
        case "attackPower": return `${sign}${value} power`
        case "rangedAttackPower": return `${sign}${value} ranged power`
        case "magicPower": return `${sign}${value} spell power`
        default: return `${sign}${value} ${stat}`
    }
}

// Format a delta list as two strings: what goes up and what goes down. Two
// strings rather than one because Phaser text is one colour per object, and
// green-for-better / red-for-worse is the whole point.
export function deltaText(deltas) {
    if (!deltas) return { up: "", down: "" }
    const fmt = (d) => {
        const n = Math.abs(d.delta)
        const num = Number.isInteger(n) ? `${n}` : n.toFixed(1)
        return `${d.label} ${d.delta > 0 ? "+" : "−"}${num}${d.pct ? "%" : ""}`
    }
    return {
        up: deltas.filter(d => d.delta > 0).map(fmt).join("  "),
        down: deltas.filter(d => d.delta < 0).map(fmt).join("  "),
    }
}
