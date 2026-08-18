import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Imp extends BaseEnemy {
    static tier = 1
    static archetype = "skirmisher"

    constructor(x, y) {
        super(x, y)
        this.name = "Imp"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 276
        this.weapon.name = "spark"

        dungeon.initializeEntity(this)
    }
}
