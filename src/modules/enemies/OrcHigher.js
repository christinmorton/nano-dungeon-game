import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class OrcHigher extends BaseEnemy {
    static tier = 2
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Orc Champion"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 174
        this.weapon.name = "iron club"

        dungeon.initializeEntity(this)
    }
}
