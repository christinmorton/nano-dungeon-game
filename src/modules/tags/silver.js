const silver = {
    name: "Silver",
    initialize: function () {
        this.name = `Silver ${this.name}`
        this.tint = 0xcccccc

        if (this.sprite) {
            this.sprite.tint = this.tint
            this.sprite.tintFill = false
        }
    }
}

export default silver
