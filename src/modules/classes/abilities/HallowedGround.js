import Phaser from 'phaser'
import Ability from './Ability.js'
import { groundZone } from '../../abilities/patterns.js'
import { heal, resolveDamage } from '../../abilities/universals.js'
import { isUndead } from '../../enemies/enemyKinds.js'
import { enlarge, quickened, bump } from '../../abilities/traitDefs.js'

// Holy tree — consecrate a patch of ground into HALLOWED GROUND: a blessed zone
// that HEALS friendly units standing in it each round AND SEARS enemies with holy
// fire (doubled vs undead). A planted battlefield — drop it on a chokepoint and
// hold the line, mending allies while undead burn to cross. Aimed at an area
// (aoeTile). Composes groundZone with the NEW `onTickFn` hook (a dual-affect zone:
// affects:'all' + branch on entity.type — heal heroes, sear enemies). TEMPORARY
// zone. Library/unslotted.
//
// NOTE: "allies" today = the hero (affects:'all' → actor types hero/enemy; a
// type:'ally' follower isn't reached — the known team-awareness gap on zones).

const HOLY_TINT = 0xFFE7A0

export default class HallowedGround extends Ability {
    name = 'Hallowed Ground'
    icon = 31
    description = 'Consecrate an area — allies in it are healed each round and enemies are seared by holy light (2× undead). 1 AP, cd 8.'
    cost = { ap: 1, mp: 0 }
    cooldown = 8
    range = 5
    target = 'aoeTile'
    radius = 1
    fxColor = HOLY_TINT
    damageType = 'magic'

    zoneDuration = 5
    healPerTurn = 4
    searMin = 3
    searMax = 6
    undeadMult = 2

    // --- Progression ladder ----------------------------------------------------
    //   L1 : r1 · heal 4/round to allies · sear 3-6 to enemies (×2 undead) · 5 rounds
    //   L2 : +2 healing                                                    [boost]
    //   L3 : augment — Wide (+radius) | Radiant (+sear) | Enduring (+duration)
    //   L4 : a trait slot — Enlarge (+radius) | Blessed (+heal) | Quickened
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.healPerTurn += 2 },
    }

    augments = {
        wide:     { label: 'Wide',     apply: a => { a.radius += 1 } },
        radiant:  { label: 'Radiant',  apply: a => { a.searMin += 3; a.searMax += 4 } },
        enduring: { label: 'Enduring', apply: a => { a.zoneDuration += 3 } },
    }

    traits = {
        enlarge:   enlarge(1),
        blessed:   bump('Blessed', 'healPerTurn', 3),
        quickened: quickened(2),
    }

    activate(hero, target) {
        const searMin = this.searMin, searMax = this.searMax
        const healAmt = this.healPerTurn, undeadMult = this.undeadMult
        return groundZone(this, hero, target.tiles, {
            kind: 'default',          // purple base; gold tint via fxColor on the burst
            duration: this.zoneDuration,
            damage: null,             // all effects routed through onTickFn (dual-affect)
            affects: 'all',
            onTickFn: (e) => {
                if (e.type === 'hero' || e.team === hero.team) {
                    heal(e, healAmt)
                } else if (e.type === 'enemy') {
                    const base = Phaser.Math.Between(searMin, searMax)
                    const raw = isUndead(e) ? base * undeadMult : base
                    resolveDamage(e, raw, 'magic', { aoe: true, attacker: hero })
                }
            },
        })
    }
}
