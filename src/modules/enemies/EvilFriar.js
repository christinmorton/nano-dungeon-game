import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"

export default class EvilFriar extends BaseEnemy {
    static tier = 2
    static rarity = "rare"
    static archetypePool = ["hunter", "patrolling", "goingSomewhere"]

    constructor(x, y) {
        super(x, y)
        this.name = "Dark Friar"
        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 2,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 469
        this.weapon.name = "mace"

        dungeon.initializeEntity(this)
    }
}
