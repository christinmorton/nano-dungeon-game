import GenericItem from "./GenericItem.js"
import dungeon from "../Dungeon.js"
import tm from "../TurnManager.js"
import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import inputMap from "../InputMap.js"
import { themeArt } from "../levels/themeRoles.js"
import { roleArt, drawRegionExtras } from "../components/regionArt.js"
import { resolveArt } from "../assetLoader.js"

// Kenney fallbacks — used when a tier names no art and the theme names no role.
const TILE_BAG = 241
const TILE_CHEST = 302
export const INVENTORY_CAP = 10

// Chest TIERS (scope doc §10.12). The sprite is the signal: a player who sees an
// ornate chest across a room knows before opening it that it is worth crossing
// for. Tier is chosen at spawn by floor depth — see rollChestTier in
// levels/spawnFromTable.js.
//
// `common` deliberately names NO art, so it falls through to the realm's own
// crate via the theme-role path below. That keeps the ordinary chest looking
// like the biome it sits in, which is what furnish.js already does for scenery.
const CHEST_TIERS = {
    common: { art: null, openArt: null },
    uncommon: {
        art: { sheet: "containers", file: "chest_wood_closed.png" },
        openArt: { sheet: "containers", file: "chest_wood_open.png" },
        name: "Wooden Chest",
    },
    rare: {
        art: { sheet: "containers", file: "chest_rare_closed.png" },
        openArt: { sheet: "containers", file: "chest_rare_open.png" },
        name: "Ornate Chest",
    },
}

// The dropped loot bag, rendered smaller than a tile so it reads as something
// lying on the floor rather than something standing in the room. 0.7 of the tile
// — small enough to be clearly an object, large enough to spot among the debris
// furnish.js scatters. Applied on top of the normal tileSize/nativeSize scale.
const BAG_SCALE = 0.7
const BAG_ART = { sheet: "containers", file: "sack.png" }

export default class Container extends GenericItem {
    constructor(x, y, kind, contents, tier = "common") {
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
        // Art precedence, highest first:
        //   1. the TIER's own sprite (uncommon / rare chests) — the loot signal
        //   2. the bag's sack sprite
        //   3. the realm's themed role art (what `common` falls through to)
        //   4. the Kenney tile passed to super()
        // A tier that names no art deliberately reaches (3), so an ordinary chest
        // keeps looking like the biome it stands in.
        const tierDef = (kind === "chest" && CHEST_TIERS[tier]) || CHEST_TIERS.common
        const themed = roleArt(themeArt(mapState.theme, kind === "chest" ? "chest" : "bag"))
        const chosenArt = (kind === "chest" ? tierDef.art : BAG_ART)
            || (themed ? themed.art : null)
        super(x, y, tile, null, chosenArt)
        // Multi-tile region frames belong to the THEMED art only. A tier or bag
        // sprite is a single 32px image, so painting a region's extra frames
        // around it would stamp tiles that sprite never had.
        if (themed && themed.frames && chosenArt === themed.art) {
            this._regionFrames = themed.frames
            this.footprint = themed.footprint
            this.region = themed.region
        }
        this.kind = kind
        this.tier = kind === "chest" ? (CHEST_TIERS[tier] ? tier : "common") : null
        this._openArt = tierDef.openArt || null
        this.contents = contents || []
        this.type = "container"
        this.name = kind === "chest" ? (tierDef.name || "Treasure Chest") : "Bag"
        const interactKey = inputMap.keyLabel('interact')
        this.description = kind === "chest"
            ? `${this.name}. Press ${interactKey} to open.`
            : `A bag of items left behind. Press ${interactKey} to take from it.`
        // A dropped bag renders smaller than a tile so it reads as litter on the
        // floor rather than an object standing in the room. initializeEntity has
        // already made the sprite inside super(), so this scales what exists.
        if (kind !== "chest" && this.sprite) {
            this.sprite.setScale(this.sprite.scaleX * BAG_SCALE, this.sprite.scaleY * BAG_SCALE)
        }
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
            // A full pack can still take tally items (gems, keys) — and, since
            // stacking, anything that merges into a stack already carried.
            const hasTally = this.contents.some(item => item.tallyKey && !item.cursed)
            const hasMergeable = actor.inventory
                ? this.contents.some(item => actor.inventory.canAccept(item))
                : false
            if (!hasTally && !hasMergeable) return null
        }

        const key = inputMap.keyLabel('interact')
        return this.kind === "chest" ? `[${key}] Open chest` : `[${key}] Take from bag`
    }

    onInteract(actor) {
        if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
            gameLog.log(`No movement left this turn.`)
            return
        }
        if (this.contents.length === 0) {
            this._markEmptied()
            return
        }

        const remaining = []
        let took = 0

        for (const item of this.contents) {
            if (item.tallyKey && !item.cursed) {
                // Fortune (§10.17): coins multiply by 1 + the wearer's `fortune`.
                const fortune = item.tallyKey === 'coins' ? (actor.stat?.('fortune') ?? 0) : 0
                const value = Math.round((item.value?.() ?? 1) * (1 + fortune))
                actor.tallies[item.tallyKey] = (actor.tallies[item.tallyKey] || 0) + value
                const valueText = value > 1 ? ` (+${value})` : ""
                gameLog.log(`${actor.name} takes a ${item.name}${valueText}.`)
                took++
            } else if (actor.inventory?.canAccept(item) ?? actor.items.length < INVENTORY_CAP) {
                // Through inventory.add so a stackable item merges into a stack
                // already carried; canAccept lets a full pack still take one that
                // merges. Falls back to the raw push for any actor without a
                // HeroInventory (enemies carry a plain array).
                if (actor.inventory) actor.inventory.add(item)
                else actor.items.push(item)
                tm.addEntity(item)
                const count = item.stackable && item.count > 1 ? ` x${item.count}` : ''
                gameLog.log(`${actor.name} takes ${item.name}${count}.`)
                took++
            } else {
                remaining.push(item)
            }
        }

        this.contents = remaining

        if (took > 0 && typeof actor.movementPoints === "number") {
            actor.movementPoints -= 1
        }

        if (this.contents.length === 0) {
            this._markEmptied()
        } else if (took > 0) {
            gameLog.log(`Some items remain in the ${this.kind}.`)
        } else {
            gameLog.log(`Your inventory is full.`)
        }
    }

    // An emptied container. A BAG has nothing left to say, so it goes. A CHEST
    // with an opened sprite stays as an open, empty chest: the room then shows
    // which chests have been looted, which matters more now that the sprite is a
    // loot signal — an ornate chest vanishing entirely would erase the memory of
    // having found one. It keeps no contents, so interactPrompt returns null and
    // it stops competing in the adjacent-interact scan.
    _markEmptied() {
        if (this.kind !== "chest" || !this._openArt) {
            dungeon.removeEntity(this)
            return
        }
        const art = resolveArt(this._openArt)
        if (!art || !this.sprite || !this.sprite.scene?.textures.exists(art.key)) {
            dungeon.removeEntity(this)
            return
        }
        this.art = this._openArt
        this.sprite.setTexture(art.key)
        this.sprite.setAlpha(0.85)
        this.blocksPath = false
        this.description = `An emptied ${this.name.toLowerCase()}.`
    }

    onDestroy() {}
}
