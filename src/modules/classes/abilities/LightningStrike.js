import Phaser from 'phaser'
import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import mapState from '../../MapState.js'
import { dealHit } from '../../abilities/patterns.js'
import burning from '../../tags/burning.js'
import { playBurst } from '../../Animations.js'
import { empowered, quickened, reaching } from '../../abilities/traitDefs.js'

// Storm damage — a literal LIGHTNING STRIKE called down from the sky onto a TILE
// (range 6). Hits whoever stands on it for heavy magic damage, with a SMALL chance
// to set them Burning (reuses the Fire tree's burning DoT — a cross-tree synergy).
// Tile-targeted (aoeTile, single tile) so you can also pre-aim a chokepoint. The
// committed-cast cousin of Levin Bolt (the projectile bolt). Display name
// "Lightning Bolt"; class is LightningStrike (LightningBolt = Levin Bolt).

const STORM_TINT = 0xaaccff

export default class LightningStrike extends Ability {
    name = 'Lightning Bolt'
    icon = 31
    description = 'Call a lightning strike down on a tile (range 6): magicPower + 5..9 damage to whoever stands there, with a small chance to set them Burning. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 6
    radius = 0
    target = 'aoeTile'
    fxColor = STORM_TINT

    damageMin = 5
    damageMax = 9
    damageStat = 'magicPower'
    damageType = 'magic'
    burnChance = 0.25          // small chance to ignite (Fire tree's Burning)

    // --- Progression ladder ----------------------------------------------------
    //   L1 : magicPower + 5..9, 25% Burn
    //   L2 : +2/+3 damage                                                  [boost]
    //   L3 : augment — Overcharged (+dmg) | Scorching Bolt (+Burn chance) | Rapid Strike (cd -1)
    //   L4 : a trait slot — Empowered | Quickened | Reaching
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.damageMin += 2; a.damageMax += 3 },
    }

    augments = {
        overcharged: { label: 'Overcharged', apply: a => { a.damageMin += 4; a.damageMax += 6 } },
        scorching:   { label: 'Scorching Bolt', apply: a => { a.burnChance += 0.35 } },
        rapid:       { label: 'Rapid Strike', apply: a => { a.cooldown = Math.max(0, a.cooldown - 1) } },
    }

    traits = {
        empowered: empowered(3),
        quickened: quickened(1),
        reaching:  reaching(2),
    }

    activate(hero, target) {
        const { x, y } = target.tile
        playBurst(x, y, { radius: 1, color: this.fxColor })   // the strike flash
        const victim = mapState.entityAtTile(x, y)
        if (victim && victim.type === 'enemy') {
            const result = dealHit(this, hero, victim, { aoe: true })
            if (!result.killed && Phaser.Math.Between(1, 100) <= this.burnChance * 100) {
                victim.addTag(burning)
                gameLog.log(`${victim.name} is set alight by the strike!`)
            }
        } else {
            gameLog.log(`${hero.name}'s Lightning Bolt cracks the empty ground.`)
        }
        return true
    }
}
