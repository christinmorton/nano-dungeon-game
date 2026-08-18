import cursed from "./cursed.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"

// "Cursed" personality (rare, dangerous) — the contagion variant. A cursed
// enemy lays the `cursed` status on whatever it strikes, and its curse SPREADS:
// each eligible turn it has a small chance to infect ONE nearby non-cursed
// enemy, up to a per-carrier cap (so it seeds a pocket of danger, not a
// floor-wide plague). This is the personality layer — deliberately DISTINCT from
// the `curse` AFFINITY (an advanced elemental attunement, parked for enemies):
// same lore root, different system. See project_v3_enemy_generation_rebuild.
//
// Applied as a Taggable tag so its turn / onDealtDamage handlers chain AFTER the
// archetype's own (the middleware runs the original first, then tag handlers).
const INFECT_CHANCE = 0.2
const INFECT_RANGE = 2       // Chebyshev tiles
const INFECT_CAP = 3         // how many others one carrier will infect

const cursedCarrier = {
    name: "Cursed",
    initialize: function () {
        if (this.type !== "enemy") return
        this._curseInfections = 0
    },
    // Attacker-side on-hit: curse the struck victim. Handler signature is
    // (ret, ...originalArgs) — the wrapped onDealtDamage(victim, dealt).
    onDealtDamage: function (ret, victim) {
        if (victim && victim.healthPoints > 0 && typeof victim.addTag === "function") {
            victim.addTag(cursed)
        }
        return ret
    },
    // Spread: one nearby non-cursed enemy per eligible turn, capped. Doesn't
    // spend the carrier's points — it acts normally first (original turn ran),
    // this just seeds the contagion.
    turn: function (ret) {
        if (this.type !== "enemy") return ret
        if ((this._curseInfections || 0) >= INFECT_CAP) return ret
        if (Math.random() >= INFECT_CHANCE) return ret
        for (const other of tm.entities) {
            if (other === this || other.type !== "enemy") continue
            if (other._tags && other._tags.includes("Cursed")) continue
            const dist = Math.max(Math.abs(other.x - this.x), Math.abs(other.y - this.y))
            if (dist > INFECT_RANGE) continue
            other.addTag(cursedCarrier)
            this._curseInfections = (this._curseInfections || 0) + 1
            gameLog.log(`The curse spreads to the ${other.name}!`)
            break
        }
        return ret
    }
}

export default cursedCarrier
