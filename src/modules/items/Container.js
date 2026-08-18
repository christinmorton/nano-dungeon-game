import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import { chestReveals } from "../dialog/environmentBarks.js"
import mapState from "../MapState.js"
import { themeArt } from "../levels/themeRoles.js"
import { roleArt, drawRegionExtras } from "../components/regionArt.js"

// Kenney fallbacks — used by any theme that names no chest/bag role.
const TILE_BAG = 241
const TILE_CHEST = 302
export const INVENTORY_CAP = 10

export default class Container extends GenericItem {
    constructor(x, y, kind, contents) {
        const tile = kind === "chest" ? TILE_CHEST : TILE_BAG
        // Themed art if the realm supplies it (levels/themeRoles.js). mapState is
        // read HERE, inside the constructor, not at module scope — this file sits
        // in a chain that MapState also reaches, and a module-evaluation-time read
        // would be the TDZ trap this codebase keeps hitting.
        //
        // roleArt resolves the descriptor: a REGION name is looked up in the
        // label store and reduced to its top-left frame plus the rest of its
        // grid. Without that step a region name misses resolveArt's index and
        // renders tile 0 of the sheet — an arbitrary wrong tile.
        const themed = roleArt(themeArt(mapState.theme, kind === "chest" ? "chest" : "bag"))
        super(x, y, tile, null, themed ? themed.art : null)
        if (themed && themed.frames) {
            this._regionFrames = themed.frames
            this.footprint = themed.footprint
            this.region = themed.region
        }
        this.kind = kind
        this.contents = contents || []
        this.type = "container"
        this.name = kind === "chest" ? "Treasure Chest" : "Bag"
        this.description = kind === "chest"
            ? "A wooden chest. Press E to open."
            : "A bag of items left behind. Press E to take from it."
        // Paint the rest of a multi-tile region. Last, so the anchor sprite that
        // initializeEntity made during super() already exists — onSpriteCreated
        // fires inside super() and is too early (same ordering Prop settled on).
        drawRegionExtras(this)
    }

    interactPrompt(actor) {
        if (this.contents.length === 0) return null

        // When the actor's inventory is full, only tally items (gems, keys)
        // can still transfer. If the container has none, decline the prompt
        // so other interactables on the same tile (e.g., an open door
        // underneath a dropped bag) can win the priority scan instead.
        if (actor.items && actor.items.length >= INVENTORY_CAP) {
            const hasTally = this.contents.some(item => item.tallyKey && !item.cursed)
            if (!hasTally) return null
        }

        return this.kind === "chest" ? "[E] Open chest" : "[E] Take from bag"
    }

    onInteract(actor) {
        if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
            gameLog.log(`No movement left this turn.`)
            return
        }
        if (this.contents.length === 0) {
            dungeon.removeEntity(this)
            return
        }

        const remaining = []
        let took = 0

        for (const item of this.contents) {
            if (item.tallyKey && !item.cursed) {
                const value = item.value?.() ?? 1
                actor.tallies[item.tallyKey] = (actor.tallies[item.tallyKey] || 0) + value
                const valueText = value > 1 ? ` (+${value})` : ""
                gameLog.log(`${actor.name} takes a ${item.name}${valueText}.`)
                took++
            } else if (actor.items.length < INVENTORY_CAP) {
                actor.items.push(item)
                tm.addEntity(item)
                gameLog.log(`${actor.name} takes ${item.name}.`)
                took++
            } else {
                remaining.push(item)
            }
        }

        this.contents = remaining

        if (took > 0 && typeof actor.movementPoints === "number") {
            actor.movementPoints -= 1
        }

        // A chest reacts the first time it's opened. It's removed below once
        // emptied, so the line rides the hero's bubble (chest face + name).
        if (took > 0 && this.kind === "chest" && actor.type === "hero") {
            chestReveals(actor, this)
        }

        if (this.contents.length === 0) {
            dungeon.removeEntity(this)
        } else if (took > 0) {
            gameLog.log(`Some items remain in the ${this.kind}.`)
        } else {
            gameLog.log(`Your inventory is full.`)
        }
    }

    onDestroy() {}
}
