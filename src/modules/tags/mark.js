import mapState from "../MapState.js"
import gameLog from "../GameLog.js"
import { resolveDamage } from "../abilities/universals.js"
import { defineStatus } from "./Status.js"

// Mark — a DELAYED detonation (the combo enabler). applyMark stamps the payload
// on the entity; each round counts down (guarded like Burning's DoT tick); at 0
// it DETONATES a circular AoE blast centered on the marked entity. Single
// instance per entity (Taggable name-dedupe); re-marking via applyMark refreshes
// the payload + timer.
//
// Display name is "Primed" (primed to detonate) — NOT "Marked", which is the
// distinct Hunter's Mark vulnerability debuff (tags/marked.js). Sharing the name
// silently overwrote one in the status registry (defineStatus keys by name).

const mark = defineStatus({
    name: "Primed",
    category: "debuff",
    valence: "negative",
    fx: "arcane",
    duration: 3,
    initialize: function (turns = 3) {
        if (this._markTurns == null) this._markTurns = turns
        gameLog.log(`${this.name} is primed to detonate.`)
    },
    turn() {
        if (this.type === "item") return
        if (this._markActivated) return        // once per round (Burning convention)
        this._markActivated = true
        this._markTurns -= 1
        if (this._markTurns <= 0) detonate(this)
    },
    refresh() { this._markActivated = false },
})

function detonate(entity) {
    const radius = entity._markRadius ?? 1
    const damage = entity._markDamage ?? 0
    const type = entity._markType ?? "magic"
    const status = entity._markStatus ?? null   // optional rider on blast survivors (e.g. Burning)
    const cx = entity.x
    const cy = entity.y
    entity.removeTag(mark)                      // clear before the blast (it may die in it)
    gameLog.log(`The mark on ${entity.name} detonates!`)
    const r2 = radius * radius
    const reach = Math.ceil(radius)
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            if (dx * dx + dy * dy > r2) continue
            const victim = mapState.entityAtTile(cx + dx, cy + dy)
            if (victim && victim.type === "enemy") {
                const result = resolveDamage(victim, damage, type, { aoe: true })
                if (status && !result.killed) for (const s of [].concat(status)) victim.addTag(s)
            }
        }
    }
}

export function applyMark(entity, { turns = 3, radius = 1, damage = 0, type = "magic", status = null } = {}) {
    entity._markTurns = turns
    entity._markRadius = radius
    entity._markDamage = damage
    entity._markType = type
    entity._markStatus = status
    entity.addTag(mark, turns)
}

export default mark
