const freeform = {
    name: "Freeform",
    initialize: function () {
        if (this.archetype !== "captain") return
        // Switch to freeform playbook (long cooldown, sparse commands).
        // Allies lean on their default behaviors between captain orders.
        this.playbook = "freeform"
        this.name = `Freeform ${this.name}`
    }
}

export default freeform
