import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import mapState from "../MapState.js"
import { playCast } from "../Animations.js"
import gameLog from "../GameLog.js"

export default class ScrollOfTeleport extends GenericItem {
    constructor(x, y) {
        super(x, y, 767, 0x44dd66)
        this.name = "A Scroll of Teleport"
        this.description = "Read to teleport to a random location on this floor."
    }

    equip(itemNumber) {
        const player = dungeon.player
        const dest = mapState.getRandomFloorTile()
        gameLog.log(`A burst of light carries you to a new place.`)
        playCast(player, {
            type: 'arcane',
            onComplete: () => {
                player.x = dest.x
                player.y = dest.y
                if (player.sprite) {
                    player.sprite.x = mapState.map.tileToWorldX(dest.x)
                    player.sprite.y = mapState.map.tileToWorldY(dest.y)
                }
                player.removeItem(itemNumber)
                // Replay the cast at the destination so the player visually
                // sees "vanish here, appear there" rather than just snapping.
                playCast(player, { type: 'arcane' })
            }
        })
    }
}
