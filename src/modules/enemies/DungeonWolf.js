import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class DungeonWolf extends BaseEnemy {
    static tier = 2
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dungeon Wolf"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 374
        this.weapon.name = "fangs"

        dungeon.initializeEntity(this)
    }
}
