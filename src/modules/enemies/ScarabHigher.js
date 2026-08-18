import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class ScarabHigher extends BaseEnemy {
    static tier = 2
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Giant Scarab"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 275
        this.weapon.name = "bite"

        dungeon.initializeEntity(this)
    }
}
