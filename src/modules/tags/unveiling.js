import { defineStatus } from "./Status.js"
import marked from "./marked.js"
import illuminated from "./illuminated.js"

// The Unveiling — Light path (§19.6): revelation. Light exposes what hides — every hit
// lays the target bare (Marked = takes more damage, Illuminated = can't evade), and the
// bearer strikes the exposed HARDER. Not raw damage; the power to reveal a weakness and
// exploit it. Rank scales the bonus vs exposed foes; read off `affinityPaths.unveiling.rank`.

const BONUS_PER_RANK = 0.12
const rankOf = e => e.affinityPaths?.unveiling?.rank || 1

function isExposed(victim) {
    const tags = victim?._tags || []
    return tags.includes("Marked") || tags.includes("Illuminated")
}

const unveiling = defineStatus({
    name: "The Unveiling",
    category: "buff",
    valence: "positive",
    duration: null,
    // Strike the exposed harder (checked BEFORE this hit re-exposes, so it rewards
    // sustained pressure on an already-revealed foe).
    outgoingDamageMult: function (running, victim) {
        return (running ?? 1) * (isExposed(victim) ? 1 + rankOf(this) * BONUS_PER_RANK : 1)
    },
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(marked)
            victim.addTag(illuminated)
        }
        return ret
    },
})

export function unveilingReadout(entity, rank = 1) {
    return `expose foes (Marked + Illuminated) · +${Math.round((rank || 1) * BONUS_PER_RANK * 100)}% vs exposed`
}

export default unveiling
