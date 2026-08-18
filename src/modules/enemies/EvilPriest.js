import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class EvilPriest extends BaseEnemy {
    static tier = 2
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dark Priest"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 470
        this.weapon.name = "smite"

        dungeon.initializeEntity(this)
    }
}
