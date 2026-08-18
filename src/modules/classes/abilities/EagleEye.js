import Passive from './Passive.js'
import eagleEye from '../../tags/eagleEye.js'

// Passive pool ability — Eagle Eye: a permanent +10% crit chance. Bridge-to-tags:
// wraps the eagleEye trait tag. The Elf/ranged precision passive — the crit
// counterpart to Keen Edge (+attack). Unslotted.

export default class EagleEye extends Passive {
    name = 'Eagle Eye'
    icon = 31
    description = 'Passive: +10% critical hit chance.'
    tags = [eagleEye]
}
