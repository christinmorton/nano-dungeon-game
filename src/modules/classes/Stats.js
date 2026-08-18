import Phaser from 'phaser'

// Six base stats for any combatant (hero or enemy). Composed onto an
// entity as entity.stats. Derived stats (attack, dodge, armor, etc.)
// live on the entity and read from here via the entity's stat()
// reducer; this class only holds the base values.
//
// JS has no constructor overloading, so the three construction paths
// the design called for live as one plain constructor + two static
// factories:
//   new Stats()                   -> blank (all 0s)
//   Stats.randomized()            -> rolled within design tier range
//   Stats.from({STR, DEX, ...})   -> explicit values
//
// Numeric scale from documents/v3_combat_stats_system.md: low=5, mid=10,
// high=15. Randomized() rolls 4..15 so a procgen actor lands somewhere
// between "weak" and "elite".

const STAT_NAMES = ['STR', 'DEX', 'CON', 'SPD', 'INT', 'Magic']

export default class Stats {
    constructor() {
        this.STR = 0
        this.DEX = 0
        this.CON = 0
        this.SPD = 0
        this.INT = 0
        this.Magic = 0
    }

    static randomized() {
        const s = new Stats()
        for (const name of STAT_NAMES) {
            s[name] = Phaser.Math.Between(4, 15)
        }
        return s
    }

    static from(values) {
        const s = new Stats()
        for (const name of STAT_NAMES) {
            if (values[name] != null) s[name] = values[name]
        }
        return s
    }

    get(name) {
        return this[name] ?? 0
    }
}

export { STAT_NAMES }
