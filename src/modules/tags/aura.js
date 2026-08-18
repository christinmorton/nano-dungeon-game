import mapState from "../MapState.js"
import { resolveDamage } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Aura — a SUSTAINED emanation around the wearer: each round it applies damage
// and/or a status to nearby units matching `affects` ('enemy' | 'ally' | 'all')
// within `radius`. The continuous counterpart to the one-shot buffAura /
// shockwave (a damage field, a slow field, a regen field). applyAura sets the
// config; it ticks on the standard tag-turn path (guarded like Burning) and
// persists until removed (cleanse/dispel) or an optional `turns` runs out.

const aura = defineStatus({
    name: "Aura",
    category: "buff",
    valence: "positive",
    fx: "arcane",
    duration: null,
    turn() {
        if (this.type === "item") return
        if (this._auraActivated) return
        this._auraActivated = true
        if (this._auraTurns != null) {
            this._auraTurns -= 1
            if (this._auraTurns <= 0) { this.removeTag(aura); return }
        }
        emit(this)
    },
    refresh() { this._auraActivated = false },
})

function factionOf(e) {
    return e.team || (e.type === "enemy" ? "monster" : "player")
}

function matches(source, target, affects) {
    if (affects === "all") return true
    const same = factionOf(source) === factionOf(target)
    return affects === "ally" ? same : !same        // 'enemy' = opposing faction
}

function emit(source) {
    const radius = source._auraRadius ?? 1
    const damage = source._auraDamage ?? 0
    const type = source._auraType ?? "magic"
    const status = source._auraStatus ?? null
    const affects = source._auraAffects ?? "enemy"
    const reach = Math.ceil(radius)
    const r2 = radius * radius
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            if (dx === 0 && dy === 0) continue
            if (dx * dx + dy * dy > r2) continue
            const target = mapState.entityAtTile(source.x + dx, source.y + dy)
            if (!target || !target.sprite) continue
            if (!matches(source, target, affects)) continue
            if (damage > 0) resolveDamage(target, damage, type, { aoe: true })
            if (status && target.sprite) target.addTag(status)
        }
    }
}

export function applyAura(entity, {
    radius = 1, damage = 0, type = "magic", status = null, affects = "enemy", turns = null,
} = {}) {
    entity._auraRadius = radius
    entity._auraDamage = damage
    entity._auraType = type
    entity._auraStatus = status
    entity._auraAffects = affects
    entity._auraTurns = turns
    entity.addTag(aura)
}

export default aura
