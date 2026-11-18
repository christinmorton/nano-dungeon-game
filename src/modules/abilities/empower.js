import { getStatusTemplate } from '../tags/Status.js'

// Empower — how a caster's WEAPON changes the caster's SPELLS (scope doc §10.16).
//
// The user's framing, 2026-10-04: a scroll or tome is a spell amplifier, not just
// an attack. "The lightning scroll should also empower the chain lightning
// ability… hit the same target 2-3 times… lightning spells have a chance to stun…
// a tome for ice that can empower the rime lance… maybe we could empower all the
// wizard's abilities too."
//
// Every spell declares an `element` ('fire' | 'ice' | 'lightning' | 'arcane'),
// and a weapon profile may declare:
//
//   empower: {
//     lightning: { extraHits: 1, onHitStatus: { name: 'Stun', chance: 0.2 } },
//     all:       { damageBonus: 2, damageMult: 1.1, onHitStatus: {...} },
//   }
//
// keyed by element, plus `all` for every damaging spell. The two entries MERGE:
// bonuses add, multipliers multiply, extraHits takes the larger, statuses stack.
//
//   damageBonus  — flat, added to the spell's roll
//   damageMult   — multiplier on the roll (after the bonus)
//   extraHits    — the chain pattern strikes each target this many more times
//   onHitStatus  — { name, chance } rolled on every spell hit that lands; the
//                  name is the status's REGISTERED name (Stun, Burning, Rooted…)
//
// And for the Wizard's WARD (Barrier declares element 'ward'; user's ask,
// 2026-10-04: "empowerment for barrier as well"), read by Barrier.activate:
//   wardBonus    — extra flat resist on top of the caster's spell power
//   wardTurns    — extra turns the barrier holds
//   wardShield   — an absorb pool (the Shield status) raised with the barrier
//
// Three seams read this and no spell knows it exists: Ability.rollDamage (the
// numbers), patterns.dealHit (the status, for bolt/chain), and the onHit
// callbacks of the beam and shockwave verbs (the status, for Mana Beam and The
// Unraveling). The chain pattern reads extraHits itself.
//
// Leaf module: imports only the status registry, so Ability.js can import it
// without touching the entity init chain.

const EMPTY = Object.freeze({
    damageBonus: 0, damageMult: 1, extraHits: 0, statuses: [],
    wardBonus: 0, wardTurns: 0, wardShield: 0,
})

// The merged empowerment the caster's current weapon grants `ability`, or null
// when the weapon grants nothing that applies.
export function empowerFor(ability, caster) {
    const weapon = caster?.currentWeapon?.()
    const table = weapon && weapon.empower
    if (!table) return null
    const parts = []
    if (ability?.element && table[ability.element]) parts.push(table[ability.element])
    if (table.all) parts.push(table.all)
    if (!parts.length) return null
    const out = { ...EMPTY, statuses: [] }
    for (const p of parts) {
        out.damageBonus += p.damageBonus ?? 0
        out.damageMult *= p.damageMult ?? 1
        out.extraHits = Math.max(out.extraHits, p.extraHits ?? 0)
        if (p.onHitStatus) out.statuses.push(p.onHitStatus)
        out.wardBonus += p.wardBonus ?? 0
        out.wardTurns += p.wardTurns ?? 0
        out.wardShield += p.wardShield ?? 0
    }
    return out
}

// Apply the empowerment's numbers to a rolled spell damage.
export function empowerDamage(ability, caster, raw) {
    const e = empowerFor(ability, caster)
    if (!e) return raw
    return Math.round((raw + e.damageBonus) * e.damageMult)
}

// Roll the empowerment's on-hit statuses against a surviving victim. Each entry
// rolls independently; an unknown name warns once per weapon rather than
// failing silently, because applyStatuses' silent skip is how a typo cost the
// Dark Priest a whole move.
export function empowerOnHit(ability, caster, victim) {
    if (!victim || !victim.sprite || victim.healthPoints <= 0) return
    const e = empowerFor(ability, caster)
    if (!e || !e.statuses.length) return
    for (const rider of e.statuses) {
        if (Math.random() >= (rider.chance ?? 1)) continue
        const template = getStatusTemplate(rider.name)
        if (template) {
            victim.addTag(template)
        } else if (!rider._warned) {
            rider._warned = true
            console.warn(`[empower] '${rider.name}' is not a registered status`)
        }
    }
}

// Short label for the Character screen and the shop: what this weapon does to
// the caster's spells. "" for a weapon with no empowerment.
export function empowerText(table) {
    if (!table) return ""
    const parts = []
    for (const [key, p] of Object.entries(table)) {
        const bits = []
        if (p.extraHits) bits.push(`x${1 + p.extraHits} hits`)
        if (p.damageBonus) bits.push(`${p.damageBonus > 0 ? "+" : ""}${p.damageBonus} dmg`)
        if (p.damageMult && p.damageMult !== 1) bits.push(`${p.damageMult > 1 ? "+" : ""}${Math.round((p.damageMult - 1) * 100)}% dmg`)
        if (p.onHitStatus) bits.push(`${Math.round((p.onHitStatus.chance ?? 1) * 100)}% ${String(p.onHitStatus.name).toLowerCase()}`)
        if (p.wardBonus) bits.push(`+${p.wardBonus} resist`)
        if (p.wardTurns) bits.push(`+${p.wardTurns} turns`)
        if (p.wardShield) bits.push(`${p.wardShield} shield`)
        if (bits.length) parts.push(`${key === "all" ? "spells" : key === "ward" ? "barrier" : key} ${bits.join(" ")}`)
    }
    return parts.join(" · ")
}
