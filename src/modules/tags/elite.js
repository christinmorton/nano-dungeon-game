const elite = {
    name: "Elite",
    initialize: function () {
        if (this.archetype !== "captain") return
        // Wider decision matrix — issues two commands per tick when the
        // cooldown opens, plus stat boosts (per the alpha/omega/elite
        // table in v3_ai_behavior_system.md). For now this tag is only
        // applied to captains; the pack-vs-solitary animal overlays
        // land in Phase 4.
        this.commandsPerTick = 2
        this.detectionRadius = Math.max(this.detectionRadius, 10)
        this.maxHealthPoints += 20
        this.healthPoints = this.maxHealthPoints
        if (this.stats) this.stats.STR += 1
        this.name = `Elite ${this.name}`
    }
}

export default elite
