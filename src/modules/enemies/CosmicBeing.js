import Phaser from "phaser"
import dungeon from "../Dungeon.js"
import BaseEnemy from "./BaseEnemy.js"
import { COSMIC_PROFILES, PACT_AFFINITY, BEAST_AFFINITY } from "../../data/cosmicBeings.js"
import { speakPactBroken } from "../dialog/pactBarks.js"
import { pactOffer, pactSeal, pactReject } from "../pactOffer.js"
import { attuneAffinity } from "../abilities/attune.js"
import { affinityFor } from "../abilities/affinities.js"
import { convertToAlly } from "../companions/allegiance.js"
import gameLog from "../GameLog.js"

// Data-driven base for every cosmic being — angels, demons, facsimiles, the two
// Principles, and the mythical/elemental demi-gods. A being's identity + art +
// power + stats live as a DATA row in data/cosmicBeings.js; this class reads the
// row and applies it, so there is no per-being class file. The enemy registry
// enumerates the table's keys and factory-spawns them (new CosmicBeing(x, y, key)).
//
// See documents/v3_cosmic_hierarchy_and_entities.md. Grade (elite) and command
// role (captain/royal) are ORTHOGONAL and layer on top — not baked in here.
// Alignment is a runtime state: `alignment: 'ally'` sets team "player" at spawn,
// but pacts flip it later via companions/allegiance.js. Deterministic stats via
// applyProfile so finalizeSpawn keeps them.
export default class CosmicBeing extends BaseEnemy {
    constructor(x, y, profileKey = null) {
        super(x, y)
        const key = profileKey || this.constructor.name
        const p = COSMIC_PROFILES[key]
        if (!p) {
            console.warn(`CosmicBeing: no profile for "${key}" — see data/cosmicBeings.js.`)
            return
        }
        this.name = p.name
        this.art = p.art                          // overrides BaseEnemy's ENEMY_ART lookup
        this.tier = p.tier ?? this.tier
        this.powerLevel = p.powerLevel
        this.cosmicKind = p.kind ?? "cosmic"
        // The advanced affinity a pact with this being binds (null = can't pact,
        // e.g. mythical/elemental beasts). See data/cosmicBeings.js PACT_AFFINITY.
        this.pactAffinity = PACT_AFFINITY[key] ?? null
        // The BASIC affinity a mythical BEAST gifts EMPOWERED (null for non-beasts) —
        // the boon vector. The grove room / bench spawn it with `boonOfferer` set.
        this.boonAffinity = BEAST_AFFINITY[key] ?? null
        if (p.archetype) this.archetype = p.archetype
        if (p.alignment === "ally") { this.team = "player"; this.type = "ally" }

        this.applyProfile({ stats: p.stats, hpFormula: p.hpFormula })

        this.movementPoints = 2
        this.actionPoints = 1
        this.refreshRates = { movementPoints: 2, actionPoints: 1, healthPoints: 0 }

        if (p.weapon) {
            this.weapon.name = p.weapon.name
            const [lo, hi] = p.weapon.damage
            this.weapon.damage = () => Phaser.Math.Between(lo, hi)
        }

        dungeon.initializeEntity(this)
    }

    // A NEUTRAL pact-offerer (Model A) just waits to be dealt with — it doesn't
    // run its combat AI. It must still ZERO its AP/MP so over() reports true and
    // the round can complete (same reason the Stun/Daze skips do in BaseEnemy);
    // returning early without this stalls TurnManager.over() and freezes turns.
    // Once the pact is sealed (convertToAlly -> "player") or broken
    // (revertAllegiance -> "monster") its team changes and it acts normally.
    turn() {
        if (this.team === "neutral") {
            this.movementPoints = 0
            this.actionPoints = 0
            return
        }
        return super.turn()
    }

    // --- Pact offering (Model A — the being bargains directly, in-world dialog) --
    // Only a NEUTRAL offerer (spawned with `pactOfferer`) courts the hero; a plain
    // hostile cosmic enemy just fights. The FIRST interact speaks the offer, the
    // SECOND binds the being's advanced affinity (BaseHero.acceptPact) and flips
    // the being to your side. Breaking the pact (BaseHero.breakPact) turns it
    // hostile again. (Model B routes the same accept through components/PactGiver.)
    canOfferPact() {
        return !!this.pactAffinity && this.pactOfferer === true && !this.pactSealed
    }

    // Boon offering (mythical beast — a friendly guardian bestows an EMPOWERED basic
    // affinity). Unlike a pact this GIFTS (no bind, no tithe) and, on accept, flips
    // the beast to a friendly guardian. Reuses the SAME in-world decision protocol as
    // the pact — `pactPending` + confirmPact/rejectPact (the keys HeroController
    // dispatches, the same ones the Shrine's dissolve reuses) — branching on the mode.
    canOfferBoon() {
        return !!this.boonAffinity && this.boonOfferer === true && !this.boonGranted
    }

    interactPrompt(hero) {
        if (this.canOfferBoon()) {
            return this.pactPending ? "[Y] Accept  ·  [N] Decline" : "[F] Receive the blessing"
        }
        if (!this.canOfferPact()) return null
        return this.pactPending ? "[Y] Accept  ·  [N] Reject" : "[F] Hear the offer"
    }

    // Interact (F) hears the offer / blessing; Y/N answer it.
    onInteract(hero) {
        if (this.canOfferBoon()) { this._offerBoon(); return }
        if (!this.canOfferPact()) return
        pactOffer(this)
    }

    // The player's "yes" (Y). A beast boon grants the empowered basic; otherwise seal
    // the pact (bind the advanced affinity + flip the being to your side).
    confirmPact(hero) {
        if (this.boonOfferer && this.pactPending) { this._sealBoon(hero); return }
        pactSeal(this, () => hero.acceptPact?.(this) ?? { ok: false, reason: "no-hero" })
    }

    // The player's "no" (N) while this being is mid-offer.
    rejectPact() {
        if (this.boonOfferer && this.pactPending) { this._rejectBoon(); return }
        pactReject(this)
    }

    // HEAR the blessing (F): arm the decision + name the element on offer.
    _offerBoon() {
        this.pactPending = true
        const label = affinityFor(this.boonAffinity)?.label || this.boonAffinity
        gameLog.log(`${this.name} offers its blessing — an EMPOWERED ${label} attunement. [Y] accept · [N] decline.`)
    }

    // ACCEPT (Y): grant the empowered basic affinity (opens the pool-passive pick),
    // then the guardian joins your side. Same-element re-grant empowers what you hold.
    _sealBoon(hero) {
        if (!this.pactPending) return
        this.pactPending = false
        const r = attuneAffinity(hero, this.boonAffinity, { empowered: true })
        if (r?.ok) {
            this.boonGranted = true
            convertToAlly(this, hero)
            dungeon.enforceCosmicFollowerCap(hero)   // one god active at a time — surplus benches
            gameLog.log(`${this.name} bestows its power — you are empowered with ${r.name}.`)
        } else {
            gameLog.log(`The blessing cannot take hold${r?.reason ? ` (${r.reason})` : ""}.`)
        }
    }

    // DECLINE (N): the blessing lapses; interact again to re-hear it.
    _rejectBoon() {
        this.pactPending = false
        gameLog.log(`${this.name}'s blessing goes unclaimed — for now.`)
    }

    // Spoken by BaseHero.breakPact() when the player breaks faith.
    sayPactBroken() {
        speakPactBroken(this)
    }
}
