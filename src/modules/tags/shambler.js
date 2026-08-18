// Shambler role tag — the void faction's melee identity (ghoul / skeleton).
// Like the Warrior role it keeps the host class's melee weapon, but it swaps the
// AI to the "shambler" archetype: a mindless undead that lurches straight at the
// player and never coordinates, instead of the brute's surround-and-kill. A bit
// of extra HP makes them relentless. See documents/v3_darkness_settlements.md.

const shambler = {
    name: "Shambler",
    initialize: function () {
        this.archetype = "shambler"
        this.maxHealthPoints += 10
        this.healthPoints = this.maxHealthPoints
        this.name = `Shambling ${this.name}`
    }
}

export default shambler
