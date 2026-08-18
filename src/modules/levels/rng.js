// Seedable pseudo-random generator for reproducible level generation.
//
// Core is mulberry32 — a tiny, fast 32-bit PRNG. NOT cryptographic; it is
// plenty for procedural geometry and its whole point is determinism: the same
// seed always yields the same sequence, so a floor (and later a static-overworld
// node) can be regenerated exactly for debugging or replay. See
// documents/v3_dungeon_archetype_system.md §11 (review limitation #8).
//
// The helper methods mirror the handful of Phaser.Math / Phaser.Utils.Array /
// Math.random calls the generators use, so generation code reads the same as
// before — `this.rng.between(a, b)` replaces `Phaser.Math.Between(a, b)`,
// `this.rng.pick(arr)` replaces `Phaser.Utils.Array.GetRandom(arr)`,
// `this.rng.chance(p)` replaces `Math.random() < p`, `this.rng.shuffle(arr)`
// replaces `Phaser.Utils.Array.Shuffle(arr)`.

// xmur3 string hash → uint32, so a run label like "1720000000000:2" becomes a
// numeric seed. Deterministic for a given string.
export function hashSeed(str) {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
    }
    return h >>> 0
}

export default class RNG {
    constructor(seed = 0) {
        this.seed = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0)
        // Avoid a zero state (mulberry32 still works but a non-zero start is tidier)
        this._state = this.seed || 1
    }

    // mulberry32 core → float in [0, 1)
    next() {
        let t = (this._state += 0x6D2B79F5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    // float in [min, max)
    float(min = 0, max = 1) {
        return min + (max - min) * this.next()
    }

    // integer in [min, max] INCLUSIVE — matches Phaser.Math.Between semantics
    between(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min
    }

    // true with probability p — matches `Math.random() < p`
    chance(p) {
        return this.next() < p
    }

    // uniform element — matches Phaser.Utils.Array.GetRandom
    pick(arr) {
        if (!arr || arr.length === 0) return undefined
        return arr[Math.floor(this.next() * arr.length)]
    }

    // in-place Fisher-Yates — matches Phaser.Utils.Array.Shuffle
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1))
            const tmp = arr[i]
            arr[i] = arr[j]
            arr[j] = tmp
        }
        return arr
    }
}
