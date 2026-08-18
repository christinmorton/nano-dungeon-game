import { defineStatus } from "./Status.js"

// Permanent trait tag behind the Fast Hands passive (the renamed Quickdraw
// passive): ability cooldowns recover TWICE as fast. refresh() already ticks each
// ability's cooldown once per round (BaseHero.refresh); this fires AFTER it (the
// Taggable wrap) and ticks every ability ONE more time, so cooldowns drop by 2/
// round. Guarded for an entity with no abilities array. No duration — managed by
// the Passive wrapper.

const fastHands = defineStatus({
    name: "Fast Hands",
    category: "buff",
    valence: "mixed",
    icon: null,
    duration: null,
    refresh: function (baseResult) {
        if (Array.isArray(this.abilities)) {
            for (const ability of this.abilities) ability.tickCooldown?.()
        }
        return baseResult
    }
})

export default fastHands
