import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"
import { makeItem } from "../items/itemProfiles.js"

// The roster's physical ranged threat.
//
// v3 has no ranged enemy CLASS — it makes archers by applying tags/archer.js to
// an ordinary enemy through the recipe applier, and recipes are cut. So rather
// than restore that whole layer, the role is baked into a class here: the same
// two lines the tag performs (archetype + a real bow), done at construction.
//
// The weapon must be a REAL RangedWeapon instance, not the renamed virtual stub
// most humanoids carry, because archetypes/archer.js reads weapon.range() and
// weapon.minRange() to decide when to shoot, close, or kite. makeItem is called
// without coordinates so GenericItem skips sprite creation — the bow is a logical
// handle, not a pickup lying on the floor.
export default class GoblinArcher extends BaseEnemy {
    static tier = 1
    static archetype = "archer"

    constructor(x, y) {
        super(x, y)
        this.name = "Goblin Archer"
        this.movementPoints = 3
        this.actionPoints = 1
        this.refreshRates = {
            movementPoints: 3,
            actionPoints: 1,
            healthPoints: 0
        }

        this.tile = 320
        this.weapon = makeItem('bow')

        dungeon.initializeEntity(this)
    }
}
