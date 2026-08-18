import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class GoblinHigher extends BaseEnemy {
    static tier = 2
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Goblin Veteran"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 124
        this.weapon.name = "spear"

        dungeon.initializeEntity(this)
    }
}
