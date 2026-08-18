import { defineStatus } from "./Status.js"

// Wrath — Demonic path (§19.6): the cornered demon RAGES. Outgoing damage rises as the
// bearer's own HP falls — fury fed by wounds. Rule-bending in flavor (borrowed demonic
// fury), desperation-scaled like Curse's own empowerment but as a chosen path. Rank
// steepens the curve; read live off `affinityPaths.wrath.rank`.

const K_PER_RANK = 0.25   // at 0 HP: up to +25% outgoing damage per rank
const rankOf = e => e.affinityPaths?.wrath?.rank || 1

const wrath = defineStatus({
    name: "Wrath",
    category: "buff",
    valence: "positive",
    duration: null,
    outgoingDamageMult: function (running, victim) {
        const maxHp = this.maxHealthPoints || 1
        const hpFrac = Math.max(0, Math.min(1, this.healthPoints / maxHp))
        return (running ?? 1) * (1 + (1 - hpFrac) * rankOf(this) * K_PER_RANK)
    },
})

export function wrathReadout(entity, rank = 1) {
    return `up to +${Math.round((rank || 1) * K_PER_RANK * 100)}% damage as your HP falls`
}

export default wrath
