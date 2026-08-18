import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Crab extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Crab"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 270
        this.weapon.name = "pincers"

        dungeon.initializeEntity(this)
    }
}
