import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Ghast extends BaseEnemy {
    static tier = 1
    static archetype = "brute"

    constructor(x, y) {
        super(x, y)
        this.name = "Ghast"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 321
        this.weapon.name = "wail"

        dungeon.initializeEntity(this)
    }
}
