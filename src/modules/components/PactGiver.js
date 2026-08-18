import Prop from "./Prop.js"
import mapState from "../MapState.js"
import { PACT_AFFINITY } from "../../data/cosmicBeings.js"
import { spawnEnemyByName } from "../enemies/enemyRegistry.js"
import { pactOffer, pactSeal, pactReject } from "../pactOffer.js"

// Pact Emissary (Model B) — a NEUTRAL broker NPC that offers a pact on behalf of
// a cosmic being (the "Whispering Pact" fiction: seducers, not soldiers). Built
// on the Prop primitive like the other components/ NPCs (Shopkeeper, Villager),
// so it's non-combat and interactable for free. The FIRST interact speaks the
// offer; the SECOND spawns the bound being and binds its affinity on the hero
// (BaseHero.acceptPact -> convertToAlly). The broker itself never fights; break
// the pact (BaseHero.breakPact) and the SUMMONED being is what turns on you.
//
// See documents/v3_cosmic_hierarchy_and_entities.md §9. The direct-offer vector
// (a cosmic being bargaining in person) is Model A on CosmicBeing.

const TILE_FALLBACK = 224   // people.shopManager — Kenney fallback if art misses

export default class PactGiver extends Prop {
    constructor(x, y, { beingKey } = {}) {
        super(x, y, TILE_FALLBACK, {
            name: "Pact Emissary",
            description: "A broker of cosmic bargains. Interact to hear its offer.",
            type: "npc",
            art: { sheet: "cosmic", file: "demons/demon_warlock.png" },
        })
        // Which cosmic being this pact binds, and the advanced affinity it grants.
        this.beingKey = beingKey
        this.pactAffinity = PACT_AFFINITY[beingKey] ?? null
        this.faction = "whispering-pact"
        this.disposition = "neutral"
    }

    canOfferPact() {
        return !!this.pactAffinity && !this.pactSealed
    }

    interactPrompt() {
        if (!this.canOfferPact()) return null
        return this.pactPending ? "[Y] Accept  ·  [N] Reject" : "[F] Hear the offer"
    }

    // Interact (F) hears the offer; Y/N answer it.
    onInteract(hero) {
        if (!this.canOfferPact()) return
        pactOffer(this)
    }

    // The player's "yes" (Y) — spawn the bound being + bind its affinity.
    confirmPact(hero) {
        pactSeal(this, () => this._seal(hero))
    }

    // The player's "no" (N) while mid-offer.
    rejectPact() {
        pactReject(this)
    }

    // Bring the bound being into the world beside the hero and bind its affinity.
    // spawnEnemyByName makes it team "monster" for an instant; acceptPact's
    // convertToAlly flips it to your side in the same synchronous call, so no
    // turn passes as a hostile.
    _seal(hero) {
        const tile = this._freeTileNear(hero)
        const being = spawnEnemyByName(this.beingKey, tile.x, tile.y)
        if (!being) return { ok: false, reason: "no-room" }
        return hero.acceptPact?.(being) ?? { ok: false, reason: "no-hero" }
    }

    _freeTileNear(anchor) {
        const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
        for (const [dx, dy] of ring) {
            const x = anchor.x + dx, y = anchor.y + dy
            if (mapState.isWalkableTile(x, y) && !mapState.entityAtTile(x, y)) return { x, y }
        }
        return { x: anchor.x, y: anchor.y }
    }

    onDestroy() {}
}
