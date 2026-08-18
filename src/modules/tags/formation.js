const formation = {
    name: "Formation",
    initialize: function () {
        if (this.archetype !== "captain") return
        // Switch the captain to the formation playbook (gather → hold →
        // break → repeat state machine). Default cooldown is unused; the
        // playbook drives on phase timing instead.
        this.playbook = "formation"
        this.name = `Formation ${this.name}`
    }
}

export default formation
