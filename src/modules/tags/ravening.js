import { defineStatus } from "./Status.js"

// Ravening — Demonic path (§19.6): the hunger deepened. Every blow the bearer lands
// drinks life — heal a fraction of the damage dealt, ON TOP of Devour's base lifesteal.
// This is the demon's per-HIT appetite (contrast Void's Hunger, which feeds per DEATH).
// Rank scales the fraction, read live off `affinityPaths.ravening.rank`.

const FRAC_PER_RANK = 0.1   // heal 10% of damage dealt per rank
const rankOf = e => e.affinityPaths?.ravening?.rank || 1

const ravening = defineStatus({
    name: "Ravening",
    category: "buff",
    valence: "positive",
    duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && this.healthPoints > 0) {
            const heal = Math.round(dealt * rankOf(this) * FRAC_PER_RANK)
            if (heal > 0) this.healthPoints = Math.min(this.maxHealthPoints ?? this.healthPoints, this.healthPoints + heal)
        }
        return ret
    },
})

export function raveningReadout(entity, rank = 1) {
    return `heal ${Math.round((rank || 1) * FRAC_PER_RANK * 100)}% of damage dealt`
}

export default ravening
