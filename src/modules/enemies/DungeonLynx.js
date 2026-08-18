import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class DungeonLynx extends BaseEnemy {
    static tier = 1
    static canBeCrafty = false
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dungeon Lynx"
        this.movementPoints = 4
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 4,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 373
        this.weapon.name = "claws"

        dungeon.initializeEntity(this)
    }
}
