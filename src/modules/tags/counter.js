import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"
import { resolveDamage } from "../abilities/universals.js"

// Counter — a reactive stance: while active, the wearer strikes back at any
// attacker that lands a non-fatal hit (Counter / Riposte / Thorns). Armed by the
// `reactive` pattern via applyCounter(); the retaliation is fired from
// Combat.attack through tryCounter() after the wearer takes a surviving hit.
//
// Config stored on the entity: _counterDamage (flat; null = use live
// attackPower), _counterCharges (null = unlimited while the tag lasts; else
// spent per counter), _counterType (damage channel), _counterReflect (a fraction
// 0..1 — when set, retaliate for that fraction of the damage just TAKEN instead
// of a flat amount: the Reflect stance bounces part of every hit back).

const counter = defineStatus({
    name: "Counter",
    category: "buff",
    valence: "positive",
    fx: "arcane",
    duration: 3,
    initialize: function (turns = 3) {
        this._counterTurns = turns
        gameLog.log(`${this.name} takes a counter stance.`)
    },
    refresh: function (baseResult) {
        this._counterTurns -= 1
        if (this._counterTurns <= 0) this.removeTag(counter)
        return baseResult
    },
})

// Retaliate if `victim` has an armed Counter. Called from Combat.attack after a
// surviving hit lands. Spends a charge if charges are limited; deals the counter
// damage to the attacker through the ability-side damage path. Guarded against a
// counter triggering a counter (no infinite recursion).
export function tryCounter(victim, attacker, dealt = 0) {
    if (!victim?._tags?.includes("Counter")) return
    if (!attacker?.sprite || attacker._isCountering) return
    if (victim._counterCharges != null && victim._counterCharges <= 0) return

    // Reflect mode bounces a fraction of the damage just taken back at the
    // attacker; otherwise retaliate for a flat amount (or live attackPower).
    const damage = victim._counterReflect
        ? Math.max(1, Math.round((dealt || 0) * victim._counterReflect))
        : (victim._counterDamage || victim.stat?.("attackPower") || 1)
    attacker._isCountering = true                  // block counter-of-a-counter
    gameLog.log(`${victim.name} ${victim._counterReflect ? 'reflects the blow onto' : 'counters'} ${attacker.name}!`)
    const result = resolveDamage(attacker, damage, victim._counterType || "physical")
    // Optional rider: a debuff on the attacker (e.g. Rime Ward chills/slows them).
    if (victim._counterStatus && !result?.killed && attacker.sprite) {
        for (const s of [].concat(victim._counterStatus)) attacker.addTag(s)
    }
    attacker._isCountering = false

    if (victim._counterCharges != null) {
        victim._counterCharges -= 1
        if (victim._counterCharges <= 0) victim.removeTag(counter)   // out of charges
    }
}

// Arm the counter stance on an entity (the `reactive` pattern's backend).
export function applyCounter(entity, { turns = 3, damage = null, charges = null, type = "physical", reflect = null, status = null } = {}) {
    entity._counterDamage = damage
    entity._counterCharges = charges
    entity._counterType = type
    entity._counterReflect = reflect
    entity._counterStatus = status      // optional debuff applied to each countered attacker
    entity.addTag(counter, turns)
}

export default counter
