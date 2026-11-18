import GenericItem from "./GenericItem";
import dungeon from "../Dungeon";
import { playCast } from "../Animations.js"
import gameLog from "../GameLog.js"

export default class Potion extends GenericItem {
    constructor(x, y) {
        super(x, y, 670, null, { sheet: "32rogues-items", name: "greenPotion" })
        this.name = "Cure Potion"
        this.description = "Drink to remove all cursed items stuck to you. Cleansed cursed gems convert to coins."
    }

    equip(itemNumber) {
        const player = dungeon.player
        gameLog.log(`A healing wave passes through your body and removes all cursed items.`)
        // Effect resolves NOW rather than in playCast's onComplete, which never
        // fires while the World scene is paused. See HealthPotion for the full
        // reasoning. Ordering matters here: the tally conversion reads the carry
        // list, so it has to run before either removal empties it.
        const cursedItems = player.items.filter(i => i.cursed)
        for (const it of cursedItems) {
            if (it.tallyKey) {
                const v = it.value?.() ?? 1
                player.tallies[it.tallyKey] = (player.tallies[it.tallyKey] || 0) + v
                gameLog.log(`Cleansed ${it.name} converts to ${v} ${it.tallyKey}.`)
            }
        }
        player.removeItem(itemNumber)
        player.removeItemByProperty("cursed", true)
        playCast(player, { type: 'arcane' })
    }
}
