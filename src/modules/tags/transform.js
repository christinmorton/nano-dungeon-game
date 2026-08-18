import dungeon from "../Dungeon.js"
import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Transform — temporarily swap an entity's FORM: its art/tint and (optionally)
// stats + HP, restoring them when it ends. Two uses through one tag:
//   • SELF transform (a rage / mist form) — the hero keeps control; just a new
//     look + stat sheet for the duration.
//   • TARGET polymorph — morph an enemy into a harmless critter: the form swap
//     PLUS `_transformHarmless`, which archetypes/mindControl.js reads to make
//     the polymorphed enemy stumble idly instead of fighting (so it changes the
//     enemy's behavior without touching the captain/squad AI).
// valence "mixed" so a routine cleanse/dispel doesn't strip it — it ends on its
// timer (or an explicit removeTag). Snapshot/restore live in applyTransform /
// restoreForm; the tag just runs the countdown and restores on cleanup.

const transform = defineStatus({
    name: "Transform",
    category: "alteration",
    valence: "mixed",
    icon: null,
    duration: 3,
    initialize: function (turns = 3) {
        if (this._transformTurns == null) this._transformTurns = turns
    },
    refresh: function (baseResult) {
        this._transformTurns -= 1
        if (this._transformTurns <= 0) this.removeTag(transform)
        return baseResult
    },
    cleanup: function () {
        restoreForm(this)        // fires on expiry AND on an explicit removeTag
    },
})

function reinitSprite(entity) {
    if (entity.sprite) { entity.sprite.destroy(); entity.sprite = null }
    dungeon.initializeEntity(entity)
}

// Enter a new form. Snapshots the original the first time, swaps the provided
// fields, and rebuilds the sprite. art/tint always; stats/hp only if given.
export function applyTransform(entity, opts = {}) {
    const { turns = 3, art = null, tint = null, stats = null, hp = null, harmless = false } = opts
    if (!entity._transformSnapshot) {
        entity._transformSnapshot = {
            art: entity.art,
            tile: entity.tile,
            tint: entity.tint,
            stats: entity.stats,
            maxHealthPoints: entity.maxHealthPoints,
            healthPoints: entity.healthPoints,
        }
    }
    if (art) entity.art = art
    if (tint != null) entity.tint = tint
    if (stats) entity.stats = stats
    if (hp != null) {
        entity.maxHealthPoints = hp
        if (entity.healthPoints > hp) entity.healthPoints = hp
    }
    entity._transformHarmless = harmless
    entity._transformTurns = turns
    reinitSprite(entity)
    entity.addTag(transform, turns)
    gameLog.log(`${entity.name} transforms.`)
}

function restoreForm(entity) {
    const snap = entity._transformSnapshot
    if (!snap) return
    entity.art = snap.art
    entity.tile = snap.tile
    entity.tint = snap.tint
    entity.stats = snap.stats
    entity.maxHealthPoints = snap.maxHealthPoints
    entity.healthPoints = Math.min(snap.healthPoints, entity.maxHealthPoints)
    entity._transformSnapshot = null
    entity._transformHarmless = false
    reinitSprite(entity)
    gameLog.log(`${entity.name} returns to its true form.`)
}

export default transform
