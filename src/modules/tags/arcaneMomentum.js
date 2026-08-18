import gameLog from "../GameLog.js"
import manaweave from "./manaweave.js"
import { defineStatus } from "./Status.js"

// Arcane Momentum — permanent trait behind the passive: landing a KILL (the onKill
// hook) grants a brief +magicPower surge by applying the existing Manaweave buff (a
// short, self-expiring duration buff). Re-killing while it's active is a no-op until
// it lapses (addTag dedupes) — momentum you have to keep earning.
const arcaneMomentum = defineStatus({
    name: "Arcane Momentum",
    category: "buff",
    valence: "mixed",
    duration: null,
    onKill: function (ret, victim) {
        this.addTag(manaweave)
        gameLog.log(`${this.name} surges with arcane momentum.`)
        return ret
    }
})

export default arcaneMomentum
