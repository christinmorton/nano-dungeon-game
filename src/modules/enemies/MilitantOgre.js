import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class MilitantOgre extends BaseEnemy {
    static tier = 3
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Militant Ogre"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 466
        this.weapon.name = "greataxe"

        dungeon.initializeEntity(this)
    }
}
