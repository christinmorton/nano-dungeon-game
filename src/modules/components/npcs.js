import Prop from "./Prop.js"
import dungeon from "../Dungeon.js"
import router from "../SceneRouter.js"
import speech from "../SpeechBubble.js"
import { getRandomItem } from "../Items.js"

// NPC factories — non-hostile characters the player talks to. Each builds on
// the Prop primitive (placeable, blocks its tile, interactable) and adds a
// social behavior. The shopkeeper is the first; oracle / captive / quest-giver
// slot in here as those rooms land.

// tileReference.json regions.people.shopManager (224) — "Shop manager /
// shopkeeper." Single constant so it's easy to confirm in test.html and swap
// if the sprite reads as something else.
const TILE_SHOPKEEPER = 224
const DEFAULT_STOCK_SIZE = 5

export class Shopkeeper extends Prop {
    constructor(x, y, { stockSize = DEFAULT_STOCK_SIZE } = {}) {
        super(x, y, TILE_SHOPKEEPER, {
            name: "Shopkeeper",
            description: "A merchant who buys and sells. Press F to trade.",
            type: "npc",
            art: { sheet: "npcs", file: "shopkeeper_south.png" },
        })
        this.greeted = false
        // Stock is rolled once and owned by this instance, so it persists
        // across re-visits to the shop screen within the same floor.
        this.stock = rollStock(stockSize)
    }

    interactPrompt() {
        return "[F] Trade with shopkeeper"
    }

    onInteract() {
        // dungeon.scene is the live World scene; bind so the router's scene
        // manager calls land, then hand this shopkeeper to the shop screen.
        router.bind(dungeon.scene)
        router.openShop(this)
    }

    // NPCs aren't loot — never auto-pick-up or drop into a bag.
    onDestroy() {}
}

// Build N stock items off-grid (no x/y → no world sprite). They live inside
// the shopkeeper until bought, then materialize into the hero's carry.
//
// A shop sells real carry items only — skip currency/tally pickups (gems,
// keys: buying coins with coins is nonsense) and cursed items (a merchant
// foisting a cursed item is a different, hostile design). Re-roll past them
// with a bounded attempt budget so a run of bad rolls can't loop forever.
function rollStock(n) {
    const stock = []
    let attempts = 0
    const maxAttempts = n * 8
    while (stock.length < n && attempts < maxAttempts) {
        attempts++
        const item = getRandomItem(undefined, undefined)
        if (!item) continue
        if (item.tallyKey || item.cursed) continue
        stock.push(item)
    }
    return stock
}

export function makeShopkeeper(x, y, opts) {
    return new Shopkeeper(x, y, opts)
}

// Neutral-settlement townsfolk. Non-hostile NPCs (Props, not enemies): the
// player can't attack them, only talk (F) — a flavor line via the speech-bubble
// system. They carry `faction` + `disposition`, the seam the future faction
// system reads. See documents/v3_settlement_disposition_village.md.

function pickLine(list) {
    return list[Math.floor(Math.random() * list.length)]
}

// Orc townsfolk reuse the orc sprites (173 / 174); they read as orcs but are
// peaceful here — the disposition, not the look, is what makes them neutral.
const TILE_VILLAGER = 173 // Orc
const TILE_ELDER = 174    // OrcHigher — a notable clan figure

const VILLAGER_LINES = [
    "Well met, outsider. Keep your blade sheathed and you keep your teeth.",
    "We trade, we forge, we feast — we are not all war-bands.",
    "The camps on the deep floors? Savages. We don't speak for them.",
    "Mind the standard-ground. It is the clan's.",
    "Hungry? The cookfires here are always lit.",
]
const ELDER_LINES = [
    "You have the look of one who solves problems. The clan may have one for you... in time.",
    "Sit, outsider. There is a matter we would ask of you. Not yet — but soon.",
]

export class Villager extends Prop {
    constructor(x, y) {
        super(x, y, TILE_VILLAGER, {
            name: "Orc Villager",
            description: "A villager of the clan, going about their day.",
            type: "npc",
            art: { sheet: "monsters", file: "orc_south.png" },
        })
        this.faction = "orc"
        this.disposition = "neutral"
    }

    interactPrompt() { return "[F] Talk" }
    onInteract() { speech.say(this, pickLine(VILLAGER_LINES)) }
    onDestroy() {}
}

export class VillageElder extends Prop {
    constructor(x, y) {
        super(x, y, TILE_ELDER, {
            name: "Clan Elder",
            description: "An elder of the clan. They seem to have something to ask.",
            type: "npc",
            art: { sheet: "monsters", file: "elite_orc_south.png" },
        })
        this.faction = "orc"
        this.disposition = "neutral"
        // Seam for the future quest system — nothing wired yet.
        this.questGiver = true
    }

    interactPrompt() { return "[F] Speak with the elder" }
    onInteract() { speech.say(this, pickLine(ELDER_LINES)) }
    onDestroy() {}
}

// Faction vendor STUB. A clan trader who will one day sell faction goods — but
// there are no faction goods yet, so for now it only talks. `vendor = true` is
// the seam: when faction wares exist, wire onInteract to a (faction) shop
// screen the way Shopkeeper does. Distinct from the generic dungeon Shopkeeper.
const TILE_TRADER = 224 // people.shopManager — reads as a vendor; verify/swap in test.html
const TRADER_LINES = [
    "Trade? Hah — the clan's stores are bare just now. Come back, outsider.",
    "No wares yet. When the caravans return, we'll talk gold.",
    "I'd barter, but there's nothing worth your coin today.",
]

export class OrcTrader extends Prop {
    constructor(x, y) {
        super(x, y, TILE_TRADER, {
            name: "Orc Trader",
            description: "A clan trader. Their stall stands empty for now.",
            type: "npc",
            art: { sheet: "monsters", file: "orc_south.png" },
        })
        this.faction = "orc"
        this.disposition = "neutral"
        this.vendor = true // seam for a future faction shop; no goods yet
    }

    interactPrompt() { return "[F] Barter" }
    onInteract() { speech.say(this, pickLine(TRADER_LINES)) }
    onDestroy() {}
}
