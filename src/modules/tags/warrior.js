// Warrior role tag — the "trained professional" relative to a plain
// untagged class instance. Small stat bump: a bit more HP and a STR
// boost so warriors hit harder than rabble. No archetype change;
// warrior keeps the host class's default melee AI (brute on Orc/Ogre
// /etc). The role mostly exists so recipes can distinguish "trained
// warband member" from "untyped enemy" — see documents/v3_enemy_squad_design.md.

const warrior = {
    name: "Warrior",
    initialize: function () {
        this.maxHealthPoints += 10
        this.healthPoints = this.maxHealthPoints
        if (this.stats) this.stats.STR += 1
        this.name = `Warrior ${this.name}`
    }
}

export default warrior
