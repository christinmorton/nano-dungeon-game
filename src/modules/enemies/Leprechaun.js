import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class Leprechaun extends BaseEnemy {
    static tier = 1
    static rarity = "rare"
    static archetype = "skirmisher"

    constructor(x, y) {
        super(x, y)
        this.name = "Leprechaun"
        this.movementPoints = 1
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 1,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 467
        this.weapon.name = "trick"

        dungeon.initializeEntity(this)
    }
}
