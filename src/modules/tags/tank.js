// Tank role tag — pure stat-bump, no archetype change. Stays on the
// host class's existing AI (brute for Orc/Ogre/etc.) so the tank just
// pushes to the front and soaks damage rather than introducing a new
// behavior pattern. Trades raw STR for HP + CON. Aggro-pull / intercept-
// for-captain mechanics are deferred per
// documents/v3_enemy_squad_design.md.

const tank = {
    name: "Tank",
    initialize: function () {
        this.maxHealthPoints += 20
        this.healthPoints = this.maxHealthPoints
        if (this.stats) {
            this.stats.CON += 2
            this.stats.STR = Math.max(1, this.stats.STR - 2)
        }
        this.name = `Tank ${this.name}`
    }
}

export default tank
