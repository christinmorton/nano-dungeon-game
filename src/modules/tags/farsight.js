const farsight = {
    name: "Farsight",
    initialize: function () {
        if (this.archetype !== "captain") return
        // Wider command radius (8 vs 5) — the captain's voice reaches
        // further into the room. Perception bumps too, so the captain
        // notices the player first more often.
        this.commandRadius = 8
        this.detectionRadius = Math.max(this.detectionRadius, 10)
        this.name = `Farsight ${this.name}`
    }
}

export default farsight
