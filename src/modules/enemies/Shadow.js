import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Shadow extends BaseEnemy {
    static tier = 1
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Shadow"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 367
        this.weapon.name = "claws"

        dungeon.initializeEntity(this)
    }
}
