import Passive from './Passive.js'
import adrenaline from '../../tags/adrenaline.js'

// Adrenaline — triggered passive: a successful dodge grants a brief attack spike
// (the onDodge hook). The skirmisher/evasion passive — rewards getting missed.
// Pairs naturally with the Evasion / Elusive Step / Tumble dodge family. Unslotted.
export default class Adrenaline extends Passive {
    name = 'Adrenaline'
    icon = 31
    description = 'Passive: a successful dodge grants +3 attack for 2 turns.'
    tags = [adrenaline]
}
