import { defineStatus } from "./Status.js"
import smitten from "./smitten.js"

// Judgment — Holy path (§19.6): the angel's smite. Every hit calls radiant judgment down
// on the target (Smitten — an unblockable radiant DoT, doubled on the unholy), and the
// bearer strikes the WICKED harder still. Holy is Light EMBODIED as the judgment of
// angels; this is its offensive face. Rank scales the bonus vs unholy foes; read live off
// `affinityPaths.judgment.rank`.

const BONUS_PER_RANK = 0.15
const UNHOLY_AFFINITIES = ["void", "demonic", "curse"]
const UNHOLY_TAGS = ["Cursed", "Corruption", "Blight", "Doom", "Unmaking", "Damned"]
const rankOf = e => e.affinityPaths?.judgment?.rank || 1

function isUnholy(entity) {
    if (UNHOLY_AFFINITIES.includes(entity?.affinityAdvanced)) return true
    return (entity?._tags || []).some(t => UNHOLY_TAGS.includes(t))
}

const judgment = defineStatus({
    name: "Judgment",
    category: "buff",
    valence: "positive",
    duration: null,
    outgoingDamageMult: function (running, victim) {
        return (running ?? 1) * (isUnholy(victim) ? 1 + rankOf(this) * BONUS_PER_RANK : 1)
    },
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            victim.addTag(smitten)
        }
        return ret
    },
})

export function judgmentReadout(entity, rank = 1) {
    return `Smite on hit · +${Math.round((rank || 1) * BONUS_PER_RANK * 100)}% vs the unholy`
}

export default judgment
