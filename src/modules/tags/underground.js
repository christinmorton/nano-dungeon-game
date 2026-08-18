import gameLog from "../GameLog.js"
import mapState from "../MapState.js"
import { defineStatus } from "./Status.js"

// Whether an entity is burrowed (Dig). The single predicate the damage path
// (resolveDamage / Combat.attack) and the hero movement gate read to grant the
// dwarf its underground protection + tunnel movement.
export function isBurrowed(entity) {
    return !!entity?._tags?.includes("Underground")
}

// Underground — applied by Dwarf Dig. While active:
//   - Perception.canSee returns false against this entity (enemies can't
//     target / notice)
//   - Sprite tints brown + alpha 0.5 so the player sees they're burrowed
// Duration ticks down each refresh. Visual restoration lives in the
// cleanup hook, which Taggable.removeTag fires on every removal — natural
// expiry, Dig's surface-early flow, or a future cleanse/dispel. surface()
// stays as the named early-exit entry point (Dig imports it) and just
// routes through removeTag.
//
// Prototype scope: does NOT yet prevent the player from attacking or
// interacting with surface entities. The design says it should; the
// HeroController input gate to enforce that is deferred to the
// post-prototypes pass.

const SUBMERGED_ALPHA = 0.5
const SUBMERGED_TINT = 0x8b6f3a

export function surface(entity) {
    if (!entity._tags?.includes("Underground")) return
    // Never surface inside solid rock: a dwarf mid-tunnel (Dig can move through
    // shallow walls) must reach open ground first. The tag persists, so the next
    // move / auto-surface retries — they can't be stranded inside a wall.
    if (mapState.level?.[entity.y]?.[entity.x] !== 0) {
        gameLog.log(`${entity.name} can't surface inside solid rock — keep tunneling to open ground.`)
        return
    }
    entity.removeTag(underground)
    gameLog.log(`${entity.name} surfaces.`)
}

const underground = defineStatus({
    name: "Underground",
    category: "spatial",
    valence: "mixed",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        this._undergroundTurns = turns
        this._undergroundPrevAlpha = this.sprite?.alpha ?? 1
        this._undergroundPrevTint = this.sprite?.tint
        if (this.sprite) {
            this.sprite.alpha = SUBMERGED_ALPHA
            this.sprite.tint = SUBMERGED_TINT
            this.sprite.tintFill = false
        }
        gameLog.log(`${this.name} burrows underground.`)
    },
    refresh: function (baseResult) {
        this._undergroundTurns -= 1
        if (this._undergroundTurns <= 0) {
            surface(this)
        }
        return baseResult
    },
    // Teardown — restore alpha + tint. Fires on natural expiry, on Dig's
    // surface() re-press, AND on any direct removeTag, via removeTag's hook.
    cleanup: function () {
        if (this.sprite) {
            this.sprite.alpha = this._undergroundPrevAlpha ?? 1
            if (this._undergroundPrevTint !== undefined) {
                this.sprite.tint = this._undergroundPrevTint
            } else {
                this.sprite.clearTint?.()
            }
        }
    }
})

export default underground
