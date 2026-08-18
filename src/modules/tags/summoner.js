import Goblin from "../enemies/Goblin.js"
import mapState from "../MapState.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"

// Summoner — Captain variant that periodically spawns a Goblin scout in
// an adjacent tile. NOT registered in Tags.js: it imports an enemy class
// which transitively pulls through BaseEnemy, and the registry chain
// (Taggable -> Tags) makes that cycle resolve incorrectly. Captain.js
// imports this template directly and applies it via addTag.

const SUMMON_COOLDOWN = 6

const summoner = {
    name: "Summoner",
    initialize: function () {
        if (this.archetype !== "captain") return
        this.name = `Summoner ${this.name}`
        this._summonCooldown = SUMMON_COOLDOWN
    },
    turn: function () {
        if (this.archetype !== "captain") return
        if (this.moving) return
        if (!this.isEngaged()) return
        if (this._summonCooldown == null) this._summonCooldown = SUMMON_COOLDOWN
        this._summonCooldown -= 1
        if (this._summonCooldown > 0) return

        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1]
        ]
        for (const [dx, dy] of offsets) {
            const sx = this.x + dx
            const sy = this.y + dy
            if (mapState.isWalkableTile(sx, sy)) {
                const summon = new Goblin(sx, sy)
                summon.finalizeSpawn()
                tm.addEntity(summon)
                gameLog.log(`The ${this.name} summons a scout!`)
                this._summonCooldown = SUMMON_COOLDOWN
                return
            }
        }
        // No walkable tile available — retry next turn rather than waste
        // a full cooldown.
        this._summonCooldown = 1
    }
}

export default summoner
