import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class CaveBear extends BaseEnemy {
    static tier = 3
    static rarity = "rare"
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Cave Bear"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 422
        this.weapon.name = "claws"

        dungeon.initializeEntity(this)
    }
}
