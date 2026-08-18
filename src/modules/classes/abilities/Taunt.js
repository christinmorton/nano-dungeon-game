import Ability from './Ability.js'
import gameLog from '../../GameLog.js'
import taunt from '../../tags/taunt.js'

// Taunt — a martial party-protection tool: roar a challenge that FORCES nearby
// enemies to attack YOU instead of a squishier teammate. Self-cast; applies the
// Taunt marker (tags/taunt.js), which the targeting seam (Targeting.js) reads to
// redirect any hostile within tauntRadius onto the taunter (hard force, v1).
//
// Meaningless solo — it only matters once you have an ally or summon for enemies
// to be pulled OFF of. The forcing function behind the whole targeting system.
// Library / unslotted; no class lock (any martial-leaning build can carry it).
export default class Taunt extends Ability {
    name = 'Taunt'
    icon = 31
    description = 'Roar a challenge — nearby enemies are forced to attack you instead of your allies. 1 AP, cd 5.'
    cost = { ap: 1, mp: 0 }
    cooldown = 5
    range = 0
    target = 'self'

    // Tunables the tag is parameterized with (see tags/taunt.js initialize args).
    tauntTurns = 3
    tauntRadius = 4

    // --- Progression ladder ----------------------------------------------------
    maxLevel = 4
    augmentLevel = 3
    traitLevel = 4
    maxTraits = 1

    levelBoosts = {
        2: a => { a.tauntRadius += 1 },
        3: a => { a.tauntTurns += 1 },
    }

    augments = {
        bellowing: { label: 'Bellowing', apply: a => { a.tauntRadius += 2 } },
        quickened: { label: 'Quickened', apply: a => { a.cooldown = Math.max(0, a.cooldown - 2) } },
    }

    traits = {
        relentless: { label: 'Relentless', apply: a => { a.tauntTurns += 2 } },
    }

    activate(hero, target) {
        // Re-cast refreshes: addTag dedupes by name, so drop a live marker first
        // and re-apply with the current duration/radius.
        if (hero._tags && hero._tags.includes('Taunt')) hero.removeTag(taunt)
        hero.addTag(taunt, this.tauntTurns, this.tauntRadius)
        gameLog.log(`${hero.name} bellows a taunt!`)
    }
}
