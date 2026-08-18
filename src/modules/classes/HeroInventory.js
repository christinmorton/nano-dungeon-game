import tm from '../TurnManager.js'
import gameLog from '../GameLog.js'
import mapState from '../MapState.js'
import Container from '../items/Container.js'
import { spawnBuffNumber } from '../Animations.js'
import { SLOT_NAMES } from '../items/GenericItem.js'

// The hero's carried items: storage + equip/drop operations + the
// reducer that combat uses (statContribution per equipped slot).
//
// Two collections now:
//   - this.items         : the carry list (max 10), addressable by digit keys
//   - this.equippedSlots : { mainhand, offhand, head, body, accessory }
//                          one item per slot, set by equipFromCarry,
//                          cleared by unequipSlot.
//
// Equipped items live ONLY in equippedSlots; they leave the carry list when
// equipped and rejoin it when unequipped. Unslotted items (potions, blink/
// teleport scrolls) are "use on activate" and keep their existing equip()
// trigger behavior without ever entering equippedSlots.
//
// Mutations call hero.hud?.refresh() so the HUD repaints. The HUD owns
// sprite handles (post #14 PR 1) — this class never touches them directly.

export default class HeroInventory {
    constructor(hero) {
        this.hero = hero
        this.items = []
        this.equippedSlots = {}
        for (const name of SLOT_NAMES) this.equippedSlots[name] = null
    }

    add(item) {
        this.items.push(item)
        this.hero.hud?.refresh()
    }

    removeAt(index) {
        const item = this.items[index]
        if (!item) return
        this.items = this.items.filter(i => i !== item)
        this.hero.hud?.refresh()
    }

    removeByProperty(property, value) {
        this.items = this.items.filter(i => i[property] !== value)
        this.hero.hud?.refresh()
    }

    // Number-key handler. For slotted items, equips the carry item into
    // its slot (displacing the prior occupant back to carry). For unslotted
    // items (potions, blink/teleport scrolls), just fires item.equip() —
    // the item itself handles consumption.
    toggleAt(index) {
        const item = this.items[index]
        if (!item) return

        if (item.slot) {
            this.equipFromCarry(item)
        } else {
            // Use semantics. equip() triggers the effect; the item is
            // responsible for removing itself from inventory.
            item.active = true
            gameLog.log(`${this.hero.name} uses ${item.name}: ${item.description}.`)
            item.equip(index, this.hero)
        }
    }

    equipFromCarry(item) {
        const slot = item.slot
        if (!slot || !(slot in this.equippedSlots)) return

        const displaced = this.equippedSlots[slot]
        // Move the new item from carry into the slot.
        this.items = this.items.filter(i => i !== item)
        this.equippedSlots[slot] = item
        item.active = true

        gameLog.log(`${this.hero.name} equips ${item.name}: ${item.description}.`)
        const carryIndex = this.items.indexOf(item)  // -1 now; equip() doesn't need the index
        item.equip(carryIndex, this.hero)

        const defense = item.protection?.() ?? 0
        if (defense > 0) {
            spawnBuffNumber(this.hero, defense)
        }

        if (displaced) {
            displaced.active = false
            displaced.unequip?.(this.hero)
            this.items.push(displaced)
            gameLog.log(`${this.hero.name} unequips ${displaced.name} to make room.`)
        }

        this.hero.hud?.refresh()
    }

    // M/O/H/B/A unequip handler. If carry is full and the slot occupant
    // can't fit, drop it into a bag on the hero's tile (reusing the
    // bag-on-drop infra).
    unequipSlot(slotName) {
        const item = this.equippedSlots[slotName]
        if (!item) return

        item.active = false
        item.unequip?.(this.hero)
        this.equippedSlots[slotName] = null

        if (this.items.length < 10) {
            this.items.push(item)
            gameLog.log(`${this.hero.name} unequips ${item.name}.`)
        } else {
            const existing = mapState.containerAtTile(this.hero.x, this.hero.y)
            if (existing) {
                existing.contents.push(item)
            } else {
                tm.addEntity(new Container(this.hero.x, this.hero.y, "bag", [item]))
            }
            gameLog.log(`${this.hero.name} unequips ${item.name} and drops it (no room in carry).`)
        }

        this.hero.hud?.refresh()
    }

    dropAt(index) {
        const item = this.items[index]
        if (!item) return

        if (item.cursed) {
            gameLog.log(`${item.name} is stuck to your hand. Find a Cure Potion.`)
            return
        }

        item.active = false
        this.items = this.items.filter(i => i !== item)
        this.hero.hud?.refresh()

        const existing = mapState.containerAtTile(this.hero.x, this.hero.y)
        if (existing) {
            existing.contents.push(item)
        } else {
            tm.addEntity(new Container(this.hero.x, this.hero.y, "bag", [item]))
        }

        gameLog.log(`${this.hero.name} dropped ${item.name}.`)
    }

    equipped() {
        return SLOT_NAMES
            .map(name => this.equippedSlots[name])
            .filter(item => item != null)
    }

    equippedAt(slotName) {
        return this.equippedSlots[slotName] ?? null
    }

    currentWeapon() {
        return this.equippedSlots.mainhand
    }

    // Sum the named stat across all equipped slots. Each item's
    // statContribution() defines how it adds to a given stat; defaults
    // route the legacy damage()/protection() through 'attackPower' /
    // 'armor' so today's items just work.
    statContribution(name) {
        let total = 0
        for (const slot of SLOT_NAMES) {
            const item = this.equippedSlots[slot]
            if (!item) continue
            total += item.statContribution?.(name) ?? 0
        }
        return total
    }
}
