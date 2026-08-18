import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import haste from '../../tags/haste.js'
import slow from '../../tags/slow.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Time tree — warp the flow of time over an area: a TEMPORAL FIELD that HASTES
// your allies and SLOWS enemies who stand in it. A dual-affect zone (affects:'all'
// + branch on type in onTickFn — the same hook Hallowed Ground uses). Tempo
// control / battlefield shaping: drop it on a chokepoint so you cross fast and
// they crawl. Statuses are re-applied with a short duration each round, so they
// last only while a unit lingers in the field. TEMPORARY zone. Composes
// groundZone. Library/unslotted.
//
// NOTE: "allies" today = the hero (affects:'all' reaches actor types hero/enemy;
// a type:'ally' follower isn't covered — the known zone team-awareness gap).

const TIME_TINT = 0x7fd4ff

export default class TemporalField extends Ability {
    name = 'Temporal Field'
    icon = 31
    description = 'Warp time over an area — allies in it are Hasted, enemies are Slowed. 1 AP, cd 7.'
    cost = { ap: 1, mp: 0 }
    cooldown = 7
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = TIME_TINT
    damageType = 'magic'

    zoneDuration = 5
    hasteBonus = 1             // MP/turn granted to allies in the field

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 · Haste allies (+1 MP) / Slow enemies · 5 rounds
    //   L2 : +2 duration                                                   [boost]
    //   L3 : augment — Wide (+radius) | Enduring (+duration) | Accelerate (+haste)
    //   L4 : a trait slot — Enlarge (+radius) | Quickened | Accelerating (+haste)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.zoneDuration += 2 },
    }

    augments = {
        wide:       { label: 'Wide',       apply: a => { a.radius += 1 } },
        enduring:   { label: 'Enduring',   apply: a => { a.zoneDuration += 4 } },
        accelerate: { label: 'Accelerate', apply: a => { a.hasteBonus += 1 } },
    }

    traits = {
        enlarge:      enlarge(1),
        quickened:    quickened(1),
        accelerating: bump('Accelerating', 'hasteBonus', 1),
    }

    activate(hero, target) {
        const hasteBonus = this.hasteBonus
        return groundZone(this, hero, target.tiles, {
            kind: 'wind',             // pale cyan field
            duration: this.zoneDuration,
            damage: null,
            affects: 'all',
            onTickFn: (e) => {
                if (e.type === 'hero' || e.team === hero.team) {
                    e.addTag(haste, 2, hasteBonus)
                } else if (e.type === 'enemy') {
                    e.addTag(slow, 2)
                }
            },
        })
    }
}
