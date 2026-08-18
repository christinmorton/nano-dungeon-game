import GenericItem from "./GenericItem";

const VALUES = { Golden: 10, Silver: 5, Iron: 2 }

export default class Gem extends GenericItem {
    constructor(x, y) {
        super(x, y, 522)

        this.name = "Gem"
        this.description = "A gem worth coins. Iron, silver, and golden variants are higher denominations."
        this.tallyKey = "coins"
        // Allow material tags (denominations) but no effect tags — burning
        // or poison gems aren't a thing in the currency system.
        this.tagPolicy = { materials: true, effects: false }
    }

    value() {
        if (!this._tags) return 1
        for (const t of this._tags) {
            if (VALUES[t]) return VALUES[t]
        }
        return 1
    }
}
