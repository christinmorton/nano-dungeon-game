import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class FlyWasp extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Wasp"
        this.movementPoints = 5
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 5,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 271
        this.weapon.name = "sting"

        dungeon.initializeEntity(this)
    }
}
