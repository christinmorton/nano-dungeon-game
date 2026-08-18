import gameLog from '../../GameLog.js'

// Base class for passive abilities — the passive counterpart to Ability.
// A passive is never hotkeyed or activated; granting it attaches its trait
// tag(s) to the host entity (bridge-to-tags), and the behavior lives
// entirely in the Taggable pipeline (statContribution / refresh / etc.),
// exactly like the warriorEnrage / clericRegen tags it wraps.
//
// Entity-agnostic on purpose: the host is any Taggable — a hero today,
// an enemy or item tomorrow. The ticking-resource mechanics (enrage,
// regen, ...) are reusable, so a future champion enemy or relic can carry
// the same passive by listing its subclass in its own `passives` array.
//
// Lifecycle: profile.passives lists subclasses; the host instantiates and
// apply()s them at construction. The future ability-selection screen calls
// apply() on equip and remove() on swap-out.
//
// Concrete passives subclass this and declare `tags` (trait tag templates)
// plus display metadata.

export default class Passive {
    name = 'Unnamed Passive'
    icon = 0
    description = ''
    passive = true
    tags = []

    constructor(entity) {
        this.entity = entity
    }

    apply() {
        for (const tag of this.tags) this.entity.addTag(tag)
        gameLog.log(`${this.entity.name} gains ${this.name}.`)
    }

    remove() {
        for (const tag of this.tags) this.entity.removeTag(tag)
        gameLog.log(`${this.entity.name} loses ${this.name}.`)
    }
}
