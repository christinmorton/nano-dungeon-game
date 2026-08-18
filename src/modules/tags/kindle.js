import { defineStatus } from "./Status.js"

// Kindle — Fire pool passive trait: a flat +magicPower (raw flame empowers every
// spell via rollDamage). Permanent; attached/detached by the Passive wrapper.
const kindle = defineStatus({
    name: "Kindle",
    category: "buff",
    valence: "mixed",
    duration: null,
    initialize: function (bonus = 4) { this._kindle = bonus },
    statContribution: function (running, name) {
        if (name === 'magicPower') return (running || 0) + (this._kindle ?? 0)
        return running
    }
})

export default kindle
