import gameLog from "../GameLog.js"
import { defineStatus } from "./Status.js"

// Tithe — the ONGOING COST of a Void-aligned pact (void / demonic). The pact-bound
// power takes its due: the holder's wounds knit slower (incomingHealMult) for as
// long as the pact is held. Light-aligned pacts (light / holy / seraphic) are a
// pure boon and carry NO tithe. Applied on BaseHero.acceptPact for tithe affinities;
// removed when the pact ends (breakPact / dissolvePact). Persists until then — no
// self-expiry, so no countdown in refresh.
const tithe = defineStatus({
    name: "Tithe",
    category: "debuff",
    valence: "negative",
    icon: null,
    fx: "void",
    initialize: function () {
        gameLog.log(`${this.name} is bound by a tithe — the pact takes its due.`)
    },
    incomingHealMult: function (mult) {
        return (mult ?? 1) * 0.7
    },
    refresh: function (baseResult) {
        return baseResult   // persists; the pact's lifetime, not a timer, ends it
    },
})

export default tithe
