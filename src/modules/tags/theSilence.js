import gameLog from "../GameLog.js"
import { defineStatus, positiveStatusesOn, getStatusTemplate } from "./Status.js"
import weaken from "./weaken.js"
import silence from "./silence.js"

// The Silence — Void path (§19.6): erasure, the face that "unmakes memory, name,
// identity." Every hit UN-WRITES the target — strips positive statuses (erasing what
// it has gained), diminishes it (Weaken), and Silences its casting. (The silence
// cast-block is still a stub in silence.js, so that half is forward-compatible for
// now; the buff-strip + Weaken bite immediately.) Rank scales how many boons are torn.
const rankOf = e => e.affinityPaths?.silence?.rank || 1

// Tear up to `n` positive statuses off the victim (iterate a snapshot, remove by
// template — removeTag matches on the exact template object).
function stripPositives(victim, n) {
    let stripped = 0
    for (const meta of positiveStatusesOn(victim)) {
        if (stripped >= n) break
        const tmpl = getStatusTemplate(meta.name)
        if (tmpl) { victim.removeTag(tmpl); stripped++ }
    }
    return stripped
}

const theSilence = defineStatus({
    name: "The Silence",
    category: "buff",
    valence: "mixed",
    duration: null,
    onDealtDamage: function (ret, victim, dealt) {
        if (dealt > 0 && victim?.sprite && victim !== this && victim.healthPoints > 0) {
            const n = stripPositives(victim, rankOf(this))
            victim.addTag(weaken)
            victim.addTag(silence)
            gameLog.log(`${victim.name} is unwritten by the Silence${n ? ` (${n} boon${n > 1 ? "s" : ""} erased)` : ""}.`)
        }
        return ret
    },
})

export function silenceReadout(entity, rank = 1) {
    return `erases ${rank || 1} boon/hit · Weakens + Silences`
}

export default theSilence
