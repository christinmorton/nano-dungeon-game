import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import inputMap from "../InputMap.js"
import router from "../SceneRouter.js"
import { rollStock } from "./shopStock.js"

// Shopkeeper — the merchant half of a Camp room (scope doc §10.11).
//
// Rides GenericItem because that is what dungeon.initializeEntity knows how to
// put on the map, but it is deliberately NOT loot: type "npc" keeps it out of
// HeroController's bump dispatch (which keys on type == "item"), so walking into
// it just stops, and onDestroy is a no-op so it can never drop into a bag.
//
// Interaction goes through the generic adjacent-interact scan that Container,
// Door, HiddenPassage and Trap already use — interactPrompt() + onInteract() on
// an entity in tm.entities, found by tile. No HeroController changes were needed.
//
// Stock is rolled ONCE in the constructor and owned by this instance, so it
// survives re-opening the shop screen: buying three things and stepping away
// does not restock. v5 has one-way descent (§6) so there is no revisit to
// persist across, which is what let v3's stock-re-roll exploit be skipped
// entirely rather than fixed.
export default class Shopkeeper extends GenericItem {
    constructor(x, y) {
        super(x, y, 224, null, { sheet: "npcs", file: "shopkeeper_south.png" })
        this.type = "npc"
        this.name = "Shopkeeper"
        this.slot = null
        this.blocksPath = true
        // Never roll material/effect tags onto an NPC — it is not gear.
        this.tagPolicy = { materials: false, effects: false }
        const key = inputMap.keyLabel('interact')
        this.description = `A merchant sheltering by the fire. Press ${key} to trade.`
        // Rolled against the hero's CLASS, so a Wizard is offered wands and robes
        // rather than v3's flat pick over the whole registry. See shopStock.js.
        this.stock = rollStock(dungeon.hero)
    }

    interactPrompt() {
        return `[${inputMap.keyLabel('interact')}] Trade with the shopkeeper`
    }

    onInteract() {
        // Bind before routing: the router needs a live scene to reach the scene
        // manager, and the World scene is the one that owns this entity.
        router.bind(dungeon.scene)
        router.openShop(this)
    }

    // An NPC is not loot — never auto-pick-up, never drop into a bag.
    onDestroy() {}
}
