import Prop from "./Prop.js"
import gameLog from "../GameLog.js"
import { attuneAffinity } from "../abilities/attune.js"
import { affinityFor } from "../abilities/affinities.js"

// Essence Font — the BASIC-affinity acquisition vector: the in-world sibling of the
// essence ITEM and the basic-tier cousin of the pact room's PactGiver. A Prop the
// hero attunes AT (not one they carry): interact to bind the font's element as your
// basic affinity and roll its pool passive — the SAME grant path as absorbing an
// Essence of Flame (shared attuneAffinity helper). Seeded at spawn with ONE basic
// affinity key; the prompt names it, so it's take-it-or-leave-it. Spent after one
// use, like the Shrine.
//
// Placed by spawnEssenceRoom (spawnFromTable.js) in an "essence" room. Advanced
// affinities have NO font — they stay pact/curse-gated (spawnPactRoom / CursedGem).
// See documents/v3_cosmic_hierarchy_and_entities.md §9 (acquisition).

// tile 670 = the raw-essence mote art the Essence items use, so the font reads as
// affinity energy rather than a duplicate shrine pedestal. Confirm/swap in test.html
// (feedback: verify tiles visually before relying on an index).
const TILE_FONT = 670
const CONSUMED_TINT = 0x666666

export default class EssenceFont extends Prop {
    // `art` is the theme's "font" role, passed IN by the spawner rather than read
    // here: Prop deliberately does not import MapState (it would close
    // MapState -> BSPLevel -> spawnFromTable -> decor -> Prop), and a Prop
    // subclass must not reopen that. A region-shaped descriptor is forwarded as
    // `region` so the prop also picks up the art's footprint.
    constructor(x, y, affinityKey, art = null) {
        const label = affinityFor(affinityKey)?.label || "Essence"
        const asRegion = art && art.name ? { sheet: art.sheet, name: art.name } : null
        super(x, y, TILE_FONT, {
            name: `Font of ${label}`,
            description: `A wellspring of ${label.toLowerCase()} essence. Press F to attune.`,
            type: "essenceFont",
            region: asRegion,
            art: asRegion ? null : art,
        })
        this.affinityKey = affinityKey
        this.consumed = false
    }

    markConsumed() {
        this.consumed = true
        this.name = "Dry Font"
        this.description = "The essence has been drawn out; the font stands empty."
        if (this.sprite) this.sprite.setTint(CONSUMED_TINT)
    }

    interactPrompt(actor) {
        if (this.consumed) return null
        const label = affinityFor(this.affinityKey)?.label || "essence"
        return `[F] Attune to ${label}`
    }

    onInteract(actor) {
        if (this.consumed) return
        if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
            gameLog.log(`No movement left this turn.`)
            return
        }
        const result = attuneAffinity(actor, this.affinityKey)
        if (!result.ok) {
            // A basic attune only fails on an unknown key — the two affinity slots
            // coexist, so a held pact never blocks it. Guard anyway: a bad seed
            // fails soft instead of spending the font for nothing.
            gameLog.log(`The font's light gutters — nothing happens.`)
            return
        }
        // grantAffinity already logged the attune/swap/reroll; the font is spent.
        this.markConsumed()
        if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
    }

    onDestroy() {}
}
