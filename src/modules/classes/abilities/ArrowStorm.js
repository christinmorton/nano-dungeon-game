import Ability from './Ability.js'
import bleed from '../../tags/bleed.js'
import { rangedRain, lingeringRain } from '../../abilities/ranged.js'
import { playAreaOutline } from '../../Animations.js'
import { addStatus, quickened } from '../../abilities/traitDefs.js'

// Elf / ranged — the AOE skillshot. Loose a volley high into the air to rain
// arrows over a chosen circle of ground; every enemy caught under it takes a bow
// hit. Aimed at a clicked tile (aoeTile), so it's a true skillshot — drop it on a
// cluster. The skirmisher's pack-clearer.
//
// Weapon-delegated: each arrow is a full bow hit (skipFx — the falling-arrow rain
// IS the visual, so the bow's own horizontal projectile is suppressed and the
// storm reads as ONE volley, not a double shot). Damage is dialed DOWN
// (damageMult 0.7) because it can blanket many foes at once — area pays for reach.
// Footprint = a circle r2 (center-inclusive in rangedRain).

// Grow the footprint AND its aoeTile targeting preview together, so the green
// cursor always matches what actually gets hit. Module-level (not a static) so the
// level/augment/trait closures don't reference the class before it's defined.
function grow(a, n) { a.shape.radius += n; a.radius += n }

export default class ArrowStorm extends Ability {
    name = 'Arrow Storm'
    icon = 31
    description = 'Rain arrows over a target area, hitting every enemy under it. Higher ranks rain again over the next rounds — stay out of it. 1 AP, cd 6. Requires a ranged weapon.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 6
    target = 'aoeTile'

    // Footprint at the clicked tile — a circle (disc) of radius 2. `radius` is the
    // aoeTile targeting-PREVIEW size; kept equal to shape.radius (see grow()).
    shape = { kind: 'circle', radius: 2 }
    radius = 2

    // Weapon-delegated — damage is the bow's, scaled down for the wide footprint.
    damageType = 'physical'
    damageMult = 0.7
    bonusDamage = 0
    knockbackTiles = 0

    // Warm amber — tints the falling arrows AND the zone border highlight.
    fxColor = 0xffcc66

    // Lingering storm — re-rains over the area for this many EXTRA rounds (0 =
    // single volley). The Torrential augment turns it on; activate() reads it.
    lingerRounds = 0

    // --- Progression ladder ----------------------------------------------------
    // The signature scaling: each LEVEL makes the storm rain MORE TIMES over the
    // area (the cast volley + `lingerRounds` re-rains on the following rounds), so
    // enemies that keep standing in it eat 1 → 2 → 3 → 4 hits. Range grows too, and
    // it stays once gained. L3 opens an augment; L4 opens a trait slot.
    //   L1 : r2 · 0.7x · 1 volley
    //   L2 : r3 · 0.8x · 2 volleys (rains again next round)               [boost]
    //   L3 : r3 · 0.9x · 3 volleys   + augment unlock
    //   L4 : r4 · 1.0x · 4 volleys   + trait slot
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { grow(a, 1); a.damageMult = 0.8; a.lingerRounds = 1 },
        3: a => { a.damageMult = 0.9;  a.lingerRounds = 2 },
        4: a => { grow(a, 1); a.damageMult = 1.0; a.lingerRounds = 3 },
    }

    augments = {
        // Torrential: the storm rages even LONGER — two more rounds of volleys on
        // top of the level's count (the "endless barrage" build).
        torrential: { label: 'Torrential', apply: a => { a.lingerRounds += 2 } },
        cloudburst: { label: 'Cloudburst', apply: a => { grow(a, 2); a.damageMult -= 0.3 } },
        plunging:   { label: 'Plunging Volley', apply: a => { a.damageMult += 0.3; a.bonusDamage += 4 } },
    }

    traits = {
        barbed:    addStatus('Barbed', bleed),
        sprawling: { label: 'Sprawling', apply: a => { grow(a, 1) } },
        quickened: quickened(2),
    }

    activate(hero, target) {
        const tile = target.tile
        // Amber outline hugging the storm's exact footprint (the diamond/disc, not
        // a bounding box). If it lingers, the outline persists (pulsing) and
        // lingeringRain clears it when the storm ends; a single volley fades it.
        const lingering = this.lingerRounds > 0
        const border = playAreaOutline(tile.x, tile.y, this.shape, {
            color: this.fxColor,
            pulse: lingering,
            fade: lingering ? 0 : 700,
        })
        const hits = rangedRain(this, hero, tile)
        // Torrential / leveled storm: keeps raining over the same spot for a few
        // rounds, hitting whoever still stands there (the "consecutive hits" track).
        if (lingering) lingeringRain(this, hero, tile, this.lingerRounds, border)
        return hits
    }
}
