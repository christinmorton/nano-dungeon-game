import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import { supportAlly } from '../../abilities/patterns.js'
import { bump, quickened } from '../../abilities/traitDefs.js'

// HOLY ANGEL tree (§6.8) — Angelic Aegis. Wrap yourself or an ally in a vast
// shield of light (a big absorb pool, magicPower-scaled). The Angel tree's
// defensive pillar — the apex of the Aegis line, sized for higher-tier fights.
// Higher-tier (gated). Composes supportAlly (absorb). Library/unslotted.

const HOLY_TINT = 0xffe9a0

export default class AngelicAegis extends Ability {
    name = 'Angelic Aegis'
    icon = 31
    description = 'Shield yourself or an ally with a vast aegis of light (absorb, scales with magic; range 6). 1 AP, cd 6.'
    cost = { ap: 1, mp: 0 }
    cooldown = 6
    range = 6
    target = 'pickAlly'
    fxColor = HOLY_TINT
    requires = { Magic: 25 }

    shieldBase = 40            // + magicPower at cast

    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = { 2: a => { a.shieldBase += 15 } }

    augments = {
        greater:   bump('Greater', 'shieldBase', 25),
        quickened: quickened(2),
        radiant:   bump('Radiant', 'shieldBase', 15),
    }

    traits = {
        reinforced: bump('Reinforced', 'shieldBase', 20),
        quickened:  quickened(1),
    }

    activate(hero, target) {
        const ally = target?.entity ?? hero
        const amount = this.shieldBase + hero.stat('magicPower')
        const did = supportAlly(this, hero, ally, { shieldAmount: amount, castType: 'heal' })
        gameLog.log(`${hero.name} wraps ${ally.name} in an angelic aegis (${amount}).`)
        return did
    }
}
