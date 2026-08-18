import { defineStatus } from "./Status.js"

// Spell Pierce — permanent trait behind the passive: the bearer's MAGIC damage
// ignores some of the target's barrier (the armorPen hook, subtracted from protection
// in Combat.attack + resolveDamage). The Arcane signature — defenses mean less to a
// true arcanist. Physical hits are unaffected (pen keyed to 'magic').
const spellPierce = defineStatus({
    name: "Spell Pierce",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (pierce = 3) { this._spellPierce = pierce },
    armorPen: function (running, damageType) {
        return (running || 0) + (damageType === 'magic' ? (this._spellPierce ?? 0) : 0)
    }
})

export default spellPierce
