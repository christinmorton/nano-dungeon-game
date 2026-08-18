import GenericItem from "./GenericItem.js"
import gameLog from "../GameLog.js"
import { spawnHealNumber } from "../Animations.js"
import { shrineSpeaks } from "../dialog/environmentBarks.js"
import cursed from "../tags/cursed.js"
import mapState from "../MapState.js"
import { themeArt } from "../levels/themeRoles.js"
import { roleArt, drawRegionExtras } from "../components/regionArt.js"

// Coin offering the shrine demands to lift the CURSE affinity (§18). The Cursed
// status + Cursed Gem are cleansed free; only the bound affinity has a price.
const CURSE_CLEANSE_PRICE = 20
// The offering to DISSOLVE a pact cleanly (being released peacefully — no hostility,
// no Forsaken mark). NOT coins: the shrine takes a weightier price by priority — an
// affinity ESSENCE (raw affinity energy) if carried, else a BLOOD PRICE (a share of
// max HP, always available). A sacrificed relic is a planned third option; the
// "Favor" currency idea is parked (user, 2026-07-01).
const PACT_BLOOD_FRACTION = 0.4

// Verified candidate tile from tileReference.json (worldRoofMC, 834 —
// "pedestal surface for amulet / quest item"). If the visual reads as
// something other than a shrine in test.html, swap this number.
const TILE_SHRINE = 834
const CONSUMED_TINT = 0x666666

export default class Shrine extends GenericItem {
    constructor(x, y) {
        // Themed shrine art when the realm supplies it; otherwise the Kenney
        // frame above. Read inside the constructor (deferred) — see Container.
        // roleArt resolves a region name against the LABEL store; skipping that
        // renders tile 0 of the sheet instead of the shrine.
        const themed = roleArt(themeArt(mapState.theme, "shrine"))
        super(x, y, TILE_SHRINE, null, themed ? themed.art : null)
        if (themed && themed.frames) {
            this._regionFrames = themed.frames
            this.footprint = themed.footprint
            this.region = themed.region
        }
        this.type = "shrine"
        this.name = "Shrine"
        this.description = "An ancient shrine. Press E to pray."
        this.consumed = false
        // Props don't take random material / effect tags.
        this.tagPolicy = { materials: false, effects: false }
        drawRegionExtras(this)   // paint the rest of a multi-tile region
    }

    markConsumed() {
        this.consumed = true
        this.name = "Spent Shrine"
        this.description = "The shrine has gone silent."
        if (this.sprite) this.sprite.setTint(CONSUMED_TINT)
    }

    interactPrompt(actor) {
        if (this.consumed) return null
        // While offering a pact-dissolve, the shrine asks Y/N (reusing the decision
        // keys) instead of the pray hint.
        if (this.pactPending) return "[Y] Dissolve pact · [N] Keep"
        return "[F] Pray at shrine"
    }

    onInteract(actor) {
        if (this.consumed) return
        // If the hero holds a pact, offer to DISSOLVE it first (Y/N) — a clean
        // release for a price (no Forsaken mark). Praying proceeds after the choice,
        // so a beneficial pact is never broken just by praying.
        if (actor._pact && !this.pactPending) {
            this.pactPending = true
            gameLog.log(`The shrine's light can sever your pact — it takes an essence if you carry one, else a price in blood. [Y] sever · [N] keep it.`)
            return
        }
        this._pray(actor)
    }

    // Y — SEVER the held pact: take the offering (essence, else blood) and dissolve
    // it cleanly. This SPENDS the shrine and does NOT also heal, so the blood price
    // sticks (praying to heal is the [N] path).
    confirmPact(actor) {
        this.pactPending = false
        if (!actor._pact) { this._pray(actor); return }
        const paid = this._takePactPayment(actor)
        actor.dissolvePact?.()
        gameLog.log(`The shrine severs the bond — ${paid}.`)
        this.markConsumed()
        if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
    }

    // Priority payment: an affinity ESSENCE if carried (removed), else a BLOOD PRICE
    // (a share of max HP — always available). Returns a short description.
    _takePactPayment(actor) {
        const items = actor.items || []
        const idx = items.findIndex(it => it.category === "Affinity" && it.profile?.affinity)
        if (idx >= 0) {
            const name = items[idx].name
            actor.removeItem?.(idx)
            return `you offer ${name}`
        }
        const maxHp = actor._maxHp || actor.maxHealthPoints || actor.healthPoints
        const toll = Math.max(1, Math.floor(maxHp * PACT_BLOOD_FRACTION))
        actor.healthPoints = Math.max(1, actor.healthPoints - toll)
        return `it exacts ${toll} in blood`
    }

    // N — keep the pact; pray anyway (heal + cleanse).
    rejectPact(actor) {
        this.pactPending = false
        this._pray(actor)
    }

    _pray(actor) {
        if (this.consumed) return
        if (typeof actor.movementPoints === "number" && actor.movementPoints <= 0) {
            gameLog.log(`No movement left this turn.`)
            return
        }

        this._cleanse(actor)

        const maxHp = actor._maxHp || actor.healthPoints
        const restored = maxHp - actor.healthPoints
        actor.healthPoints = maxHp
        if (restored > 0) spawnHealNumber(actor, restored)

        // Speak the blessing before markConsumed() renames/greys it to a
        // "Spent Shrine", so the bubble reads as the living shrine.
        shrineSpeaks(this)
        this.markConsumed()
        gameLog.log(`${actor.name} prays at the shrine and feels restored.`)
        if (typeof actor.movementPoints === "number") actor.movementPoints -= 1
    }

    // Cleansing services (§18). Free: clear the Cursed status + neutralize held Cursed
    // Gems (converting them to coins, like a Cure Potion). Paid: lift the Curse
    // AFFINITY for a coin offering, which restores the suppressed basic affinity.
    _cleanse(actor) {
        // 1. Cursed status (free).
        if (actor._tags?.includes?.("Cursed")) {
            actor.removeTag(cursed)
            gameLog.log(`The shrine's light burns the curse from ${actor.name}.`)
        }
        // 2. Held Cursed Gems (free) — cleanse them into coins, then remove.
        const gems = (actor.items || []).filter(it => it.cursed)
        for (const it of gems) {
            if (it.tallyKey && actor.tallies) {
                const v = it.value?.() ?? 1
                actor.tallies[it.tallyKey] = (actor.tallies[it.tallyKey] || 0) + v
                gameLog.log(`The shrine cleanses ${it.name} — it crumbles to ${v} ${it.tallyKey}.`)
            }
        }
        if (gems.length) actor.removeItemByProperty?.("cursed", true)
        // 3. Curse AFFINITY (paid) — an offering lifts it and restores your affinity.
        if (actor.affinityAdvanced === 'curse') {
            const coins = actor.tallies?.coins || 0
            if (coins >= CURSE_CLEANSE_PRICE) {
                actor.tallies.coins = coins - CURSE_CLEANSE_PRICE
                actor.restoreSuppressedBasic?.()
                gameLog.log(`You offer ${CURSE_CLEANSE_PRICE} coins; the curse is lifted and your affinity returns.`)
            } else {
                gameLog.log(`The shrine would lift your curse for ${CURSE_CLEANSE_PRICE} coins — you cannot pay.`)
            }
        }
    }

    onDestroy() {}
}
