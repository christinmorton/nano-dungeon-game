import { defineStatus } from "./Status.js"

// Warrior passive — "Enrage." While the Warrior's healthPoints are
// below a third of max, contribute +floor(STR/2) to attackPower.
// Always-on tag attached at hero construction via the Warrior profile.
// Stat reads happen through BaseHero.stat('attackPower') which chains
// this contribution via Taggable wrapping.

const warriorEnrage = defineStatus({
    name: "Warrior Enrage",
    category: "buff",
    valence: "positive",
    icon: null,
    duration: null,
    initialize: function () {},
    statContribution: function (running, name) {
        if (name !== 'attackPower') return running
        if (this.healthPoints >= this.maxHealthPoints / 3) return running
        // stat('STR') picks up equipment STR contributions; the inner
        // re-entry into statContribution for 'STR' is safe — this
        // handler returns `running` when name !== 'attackPower'.
        return (running || 0) + Math.floor(this.stat('STR') / 2)
    }
})

export default warriorEnrage
