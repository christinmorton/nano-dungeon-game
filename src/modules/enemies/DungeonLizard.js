import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class DungeonLizard extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dungeon Lizard"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 421
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }
}
