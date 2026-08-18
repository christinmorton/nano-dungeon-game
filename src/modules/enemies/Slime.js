import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Slime extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Slime"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 419
        this.weapon.name = "acid"

        dungeon.initializeEntity(this)
    }
}
