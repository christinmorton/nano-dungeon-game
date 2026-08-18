import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import bleed from '../../tags/bleed.js'
import poison from '../../tags/poison.js'
import slow from '../../tags/slow.js'
import { throwSalvo, applyThrowEmpowerments } from '../../abilities/throwing.js'
import { addStatus, reaching, bump } from '../../abilities/traitDefs.js'

// Throw Knives — the first ability of the THROWING combat style (a midrange
// attack style, NOT a new role: any hero can slot it). No cooldown: it's meant to
// be spammed as a ranged near-replacement for the basic attack (gated only by its
// 1 AP). Self-contained, so always usable — but its POWER is GEAR-GATED:
//   - non-throwing weapon equipped (or unarmed) -> a weak IMPROVISED toss (flat
//     single-digit damage, no stat scaling). You're chucking a belt-knife.
//   - a THROWABLE weapon equipped -> the throw scales with attackPower AND folds
//     in that weapon's OWN damage roll (a better throwing weapon throws harder),
//     plus any special trait it grants (Venomfang -> poison).
// Throwing MULTIPLE knives at once comes from RANK, not gear (L2 -> 2, Barrage ->
// 3). EMPOWER comes from the EQUIPPED throwing weapon (see abilities/throwing.js);
// we re-run rebuild() on cast so it tracks gear.
export default class ThrowKnives extends Ability {
    name = 'Throw Knives'
    icon = 31
    description = 'Fling a knife at an enemy up to 3 tiles away (no cooldown). Weak with a non-throwing weapon; equip throwing knives to throw hard (and gain their trait). Rank up to throw more at once. 1 AP.'
    cost = { ap: 1, mp: 0 }
    cooldown = 0
    range = 3
    target = 'pickEnemy'
    damageType = 'physical'

    // Self-supplied projectile sprite — the dagger frame (tile 375), shrunk so a
    // thrown knife reads smaller than a held weapon (tune projectileScale).
    projectileTile = 375
    projectileScale = 0.5

    // Damage model (per knife; more knives = more total, the rank payoff). Tunable:
    //   improvised (no throwing weapon): flat unarmedMin..unarmedMax, single digit.
    //   armed (throwable equipped): round(attackPower * armedScale) + weapon.damage()
    //     — the equipped throwing weapon's own roll, so a better weapon throws harder.
    knives = 1
    unarmedMin = 2
    unarmedMax = 5
    armedScale = 0.3
    appliesStatus = null

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 1 knife
    //   L2 : 2 knives                                                 [boost]
    //   L3 : augment — Barrage (3 knives) | Serrated (+bleed) | Long Throw (+range)
    //   L4 : a trait slot (Keen (+scaling) | Venom (+poison) | Pinning (+slow))
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.knives += 1 },
    }

    augments = {
        barrage:   { label: 'Barrage', apply: a => { a.knives += 1 } },
        serrated:  addStatus('Serrated', bleed),
        longThrow: reaching(2),
    }

    traits = {
        keen:    bump('Keen', 'armedScale', 0.1),
        venom:   addStatus('Venom', poison),
        pinning: addStatus('Pinning', slow),
    }

    // Empower from the EQUIPPED throwing weapon (status / scaling).
    applyEmpowerments() { applyThrowEmpowerments(this) }

    activate(hero, target) {
        this.rebuild()   // refresh equipped throwing-weapon empowerments + ladder
        const victim = target.entity
        const knives = Math.max(1, this.knives)
        const weapon = throwSalvo(this, hero, victim, {
            count: knives,
            statuses: [].concat(this.appliesStatus || []),
        })
        gameLog.log(`${hero.name} flings ${knives} ${knives > 1 ? 'knives' : 'knife'}${weapon ? '' : ' (improvised)'} at ${victim.name}.`)
    }
}
