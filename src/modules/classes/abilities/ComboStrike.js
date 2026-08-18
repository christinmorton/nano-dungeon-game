import Ability from './Ability.js'
import bleed from '../../tags/bleed.js'
import sunder from '../../tags/sunder.js'
import { comboStrike } from '../../abilities/patterns.js'
import { addStatus, quickened } from '../../abilities/traitDefs.js'

// Combo Strike — a flurry of quick strikes on a single adjacent enemy in one
// turn, via the `comboStrike` pattern (weaponAttack: each hit is a fresh
// hero.attack() roll; stops early on a kill). Any rider status lands once on the
// survivor after the flurry. Unslotted.
export default class ComboStrike extends Ability {
    name = 'Combo Strike'
    icon = 31
    description = 'Strike an adjacent enemy three times in one move. 1 AP, cd 4.'
    cost = { ap: 1, mp: 0 }
    cooldown = 4
    range = 1
    target = 'pickEnemy'

    // Declarative payload (mutated by the ladder). hits = number of strikes;
    // appliesStatus = a rider applied once to a survivor after the combo.
    hits = 3
    appliesStatus = null

    // --- Progression ladder ----------------------------------------------------
    //   L1 : 3 hits
    //   L2 : 4 hits                                                  [boost]
    //   L3 : augment — Flurry (5 hits) | Bleeding Edge (+bleed) | Sunder Combo (+sunder)
    //   L4 : a trait slot (Quickened | Finisher +1 hit | Rending +bleed)
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.hits += 1 },
    }

    augments = {
        flurry:       { label: 'Flurry', apply: a => { a.hits = 5 } },
        bleedingEdge: addStatus('Bleeding Edge', bleed),
        sunderCombo:  addStatus('Sunder Combo', sunder),
    }

    traits = {
        quickened: quickened(1),
        finisher:  { label: 'Finisher', apply: a => { a.hits += 1 } },
        rending:   addStatus('Rending', bleed),
    }

    activate(hero, target) {
        const victim = target.entity
        comboStrike(this, hero, victim, { hits: this.hits, weaponAttack: true })
        // Rider status lands once on a survivor after the flurry (the weaponAttack
        // path inside comboStrike doesn't carry appliesStatus, so apply it here).
        if (victim.sprite) {
            for (const status of [].concat(this.appliesStatus || [])) victim.addTag(status)
        }
    }
}
