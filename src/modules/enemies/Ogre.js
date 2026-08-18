import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Ogre extends BaseEnemy {
    static tier = 3
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Ogre"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 324
        this.weapon.name = "greatclub"

        dungeon.initializeEntity(this)
    }
}
