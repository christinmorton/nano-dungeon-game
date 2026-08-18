import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class HumanoidMarauder extends BaseEnemy {
    static tier = 2
    static archetype = "brute"

    constructor(x, y) {
        super(x, y)
        this.name = "Marauder"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 126
        this.weapon.name = "sword"

        dungeon.initializeEntity(this)
    }
}
