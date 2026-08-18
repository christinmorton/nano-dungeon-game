import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

// Shares tile 171 with Troll by design (see tileReference.json — no
// dedicated troll sprite exists in the kenney pack). Stats are tuned
// distinct from Troll: faster but lighter HP, leans more "humanoid
// raider" than "monster."
export default class MarauderBrute extends BaseEnemy {
    static tier = 3
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Brute"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 171
        this.weapon.name = "great club"

        dungeon.initializeEntity(this)
    }
}
