import tm from '../TurnManager.js'
import gameLog from '../GameLog.js'
import mapState from '../MapState.js'
import Container, { INVENTORY_CAP } from '../items/Container.js'
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

    // STACKING (added 2026-09-20, scope doc §10.9).
    //
    // A stack is ONE item object carrying a `count`, not a list of objects — so
    // everything that already walks this.items (the digit keys, the Pause panel,
    // dropAt, the carry cap) keeps working unchanged and only needs to render the
    // count. Only items declaring `stackable` participate; gear never does,
    // because two swords can differ in what they contribute.
    //
    // Items are matched by NAME rather than by class. Two potions built by the
    // same constructor are interchangeable, and the name is what the player sees.
    stackCountOf(item) {
        return item?.stackable ? (item.count ?? 1) : 1
    }

    // The existing stack an incoming item should join, or null for a new slot.
    _stackFor(item) {
        if (!item?.stackable) return null
        return this.items.find(i => i.stackable && i.name === item.name) ?? null
    }

    // Can this item be taken, given the carry cap? True when there is a free slot
    // OR when it merges into a stack already held — a full pack must still accept
    // a third potion when two are already in one slot, or stacking would make the
    // inventory feel BROKEN rather than roomier. Every pickup path asks this
    // instead of testing items.length directly.
    canAccept(item) {
        if (this._stackFor(item)) return true
        return this.items.length < INVENTORY_CAP
    }

    add(item) {
        const stack = this._stackFor(item)
        if (stack) {
            // Absorb into the existing stack. The incoming object is discarded —
            // it was never placed on the map or in the list, so nothing else can
            // be holding a reference to it.
            stack.count = this.stackCountOf(stack) + this.stackCountOf(item)
            this.hero.hud?.refresh()
            return
        }
        if (item?.stackable && item.count == null) item.count = 1
        this.items.push(item)
        this.hero.hud?.refresh()
    }

    // Remove ONE from the entry at `index`. A stack of more than one loses a
    // single unit and stays in place; anything else leaves the list entirely.
    //
    // This is what a consumable's own equip() calls when it is used, so drinking
    // one potion from a stack of three must not remove the other two.
    removeAt(index) {
        const item = this.items[index]
        if (!item) return
        if (item.stackable && this.stackCountOf(item) > 1) {
            item.count = this.stackCountOf(item) - 1
            this.hero.hud?.refresh()
            return
        }
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
        // An item that reads its wearer's state (the Berserker's Charm, §10.17)
        // needs to know who that is. Cleared on unequip and on displacement.
        item.owner = this.hero

        gameLog.log(`${this.hero.name} equips ${item.name}: ${item.description}.`)
        const carryIndex = this.items.indexOf(item)  // -1 now; equip() doesn't need the index
        item.equip(carryIndex, this.hero)

        const defense = item.protection?.() ?? 0
        if (defense > 0) {
            spawnBuffNumber(this.hero, defense)
        }

        if (displaced) {
            displaced.active = false
            displaced.owner = null
            displaced.unequip?.(this.hero)
            this.items.push(displaced)
            gameLog.log(`${this.hero.name} unequips ${displaced.name} to make room.`)
        }

        this.hero.hud?.refresh()
    }

    // Unequip a slot back to carry — the Pause panel's and Character screen's
    // click-to-unequip (the per-slot letter keys went on 2026-10-03). If carry
    // is full and the slot occupant can't fit, drop it into a bag on the hero's
    // tile (reusing the bag-on-drop infra).
    unequipSlot(slotName) {
        const item = this.equippedSlots[slotName]
        if (!item) return

        item.active = false
        item.owner = null
        item.unequip?.(this.hero)
        this.equippedSlots[slotName] = null

        if (this.items.length < INVENTORY_CAP) {
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

        // A stack drops WHOLE — the count rides on the item object, so the bag
        // receives all of them as one entry and picking it back up restores the
        // stack intact. (Decided 2026-09-20: dropping one at a time would need a
        // second button for "drop all", and the stack is one inventory entry
        // everywhere else.)
        const count = this.stackCountOf(item)
        gameLog.log(count > 1
            ? `${this.hero.name} dropped ${item.name} x${count}.`
            : `${this.hero.name} dropped ${item.name}.`)
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
