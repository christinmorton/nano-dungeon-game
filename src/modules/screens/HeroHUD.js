// HUD panel for the player's hero. Owns sprite/text handles for the
// stats column (name, HP/AP/MP bars) and tallies row (gems, keys).
// Built per scene-create by UserInterface; lives only while the world
// scene is active and is rebuilt on scene restart (floor transitions).
//
// Extracted from BaseHero so the data class doesn't carry presentation
// state. See PR 1 of known issue #14 in documents/v3_known_issues.md.
// PR 2 will introduce HeroInventory; this file will then read
// hero.inventory.items instead of hero.items directly.

import worldTooltip from '../WorldTooltip.js'
import { addEntityIcon } from '../assetLoader.js'
import inputMap from '../InputMap.js'

export default class HeroHUD {
    constructor(hero, config) {
        this.hero = hero
        this.scene = config.scene
        this.x = config.x
        this.y = config.y
        this.abilitiesX = config.abilitiesX
        this.abilitiesY = config.abilitiesY
        this.abilitiesWidth = config.abilitiesWidth
        this.abilitiesHeight = config.abilitiesHeight

        this.UIheader = null
        this.UIhpBar = null
        this.UIapBar = null
        this.UImpBar = null
        this.UIsprite = null
        this.UItallies = null
        this.UIitems = []
        this.UIabilities = []
        this.UIpassives = []
    }

    create() {
        const x = this.x
        const y = this.y
        const scene = this.scene

        // Stats column (left half of the panel)
        this.UIsprite = addEntityIcon(scene, x, y, this.hero, { display: 16, originX: 0, originY: 0 })

        this.UIheader = scene.add.text(x + 22, y - 2, this.hero.name, {
            font: '16px Arial',
            color: '#cfc6b8'
        })

        const makeStatBar = (rowY, labelText, color) => {
            const label = scene.add.text(x, rowY - 1, labelText, { font: '10px Arial', color: '#cfc6b8' })
            const bg = scene.add.rectangle(x + 22, rowY, 100, 8, 0x2a2a2a).setOrigin(0)
            const fill = scene.add.rectangle(x + 22, rowY, 100, 8, color).setOrigin(0)
            const value = scene.add.text(x + 128, rowY - 1, '', { font: '10px Arial', color: '#cfc6b8' })
            return { label, bg, fill, value, baseColor: color, width: 100 }
        }

        this.UIhpBar = makeStatBar(y + 22, 'HP', 0x4ade80)
        this.UIapBar = makeStatBar(y + 36, 'AP', 0x60a5fa)
        this.UImpBar = makeStatBar(y + 50, 'MP', 0xfbbf24)

        // Tally row: coins (gems) and keys, beneath the bars
        const tallyY = y + 68
        const coinSprite = scene.add.sprite(x, tallyY, "tiles", 522).setOrigin(0)
        const coinText = scene.add.text(x + 20, tallyY + 1, 'x0', { font: '12px Arial', color: '#cfc6b8' })
        const keySprite = scene.add.sprite(x + 70, tallyY, "tiles", 571).setOrigin(0)
        const keyText = scene.add.text(x + 90, tallyY + 1, 'x0', { font: '12px Arial', color: '#cfc6b8' })
        this.UItallies = { coinText, keyText, coinSprite, keySprite }

        // Inventory grid removed in #44 — items still tracked on the hero
        // and equipped via the digit keys; HUD now shows only stats + log.
        // Keeping UIitems as an empty array makes refresh()'s loop safe.
        this.UIitems = []

        // Ability row — 16x16 icon slots labelled from the keymap (Q/W/E/A/S +
        // the gold Ultimate slot, default R), laid
        // out horizontally inside the dedicated abilities box drawn by
        // UserInterface. Centered within the box interior. Per
        // documents/v3_abilities.md: idle = full color, on cooldown =
        // desaturated + numeric overlay, insufficient resource = red
        // tint. Empty slots stay hidden.
        // Hotkeys + slot count come from the central keymap (InputMap) so the
        // Ultimate slot (the last key, default R) and any rebinds reflect here
        // automatically. The final slot is the Ultimate slot — labelled gold.
        const ABILITY_HOTKEYS = inputMap.abilitySlotKeys.map(k => k.toUpperCase())
        const slotCount = ABILITY_HOTKEYS.length
        const ultimateSlot = inputMap.ultimateSlotIndex
        const slotPitch = 22
        const iconSize = 16
        const abilityRowWidth = (slotCount - 1) * slotPitch + iconSize
        const ax = this.abilitiesX + Math.floor((this.abilitiesWidth - abilityRowWidth) / 2)
        const ay = this.abilitiesY
        this.UIabilities = []
        for (let i = 0; i < slotCount; i++) {
            const slotX = ax + i * slotPitch
            const sprite = scene.add.sprite(slotX, ay, "tiles", 0).setOrigin(0).setVisible(false)
            const label = scene.add.text(slotX + 3, ay + 18, ABILITY_HOTKEYS[i], { font: '10px Arial', color: i === ultimateSlot ? '#ffcc66' : '#cfc6b8' })
            const cooldown = scene.add.text(slotX + 4, ay + 2, '', { font: '11px Arial', color: '#ffffff' }).setVisible(false)

            // Hover tooltip — reuses WorldTooltip (already bound to this
            // UI scene). Reads the live ability instance off the hero
            // each hover so cooldown / cost text could later surface.
            sprite.setInteractive({ useHandCursor: true })
            const slotIndex = i
            sprite.on('pointerover', (pointer) => {
                const ability = this.hero.abilities?.[slotIndex]
                if (!ability) return
                worldTooltip.show({ name: `${ABILITY_HOTKEYS[slotIndex]} — ${ability.name}`, description: ability.description }, pointer)
            })
            sprite.on('pointerout', () => worldTooltip.hide())

            this.UIabilities.push({ sprite, label, cooldown })
        }

        // Passive badges — small icons declared by profile.passiveBadges.
        // Sit below the ability row inside the same abilities box, also
        // centered using the max-4 footprint so the layout stays stable
        // as PRs populate them. Per-class PRs fill the slots; PR 1 ships
        // the plumbing only, so all four start hidden.
        const passivePitch = 14
        const passiveRowWidth = (4 - 1) * passivePitch + 12
        const passiveX = this.abilitiesX + Math.floor((this.abilitiesWidth - passiveRowWidth) / 2)
        const passiveY = ay + 38
        this.UIpassives = []
        for (let i = 0; i < 4; i++) {
            const badge = scene.add.sprite(passiveX + i * passivePitch, passiveY, "tiles", 0)
                .setOrigin(0)
                .setScale(0.75)
                .setVisible(false)
            this.UIpassives.push(badge)
        }
    }

    refresh() {
        // Item slot rendering — no-op since the HUD inventory grid was
        // removed in #44 (UIitems is always empty). When the grid returns
        // it needs to render both carry items and equipped slots; today
        // the Pause screen is the only place items are visible.

        if (this.UItallies) {
            this.UItallies.coinText.setText(`x${this.hero.tallies.coins || 0}`)
            this.UItallies.keyText.setText(`x${this.hero.tallies.keys || 0}`)
        }

        const updateBar = (bar, current, max) => {
            if (!bar) return
            const ratio = Math.max(0, Math.min(current / max, 1))
            bar.fill.scaleX = ratio
            bar.value.setText(`${Math.max(0, current)}/${max}`)
        }

        updateBar(this.UIhpBar, this.hero.healthPoints, this.hero.maxHealthPoints)
        updateBar(this.UIapBar, this.hero.actionPoints, this.hero.maxActionPoints)
        updateBar(this.UImpBar, this.hero.movementPoints, this.hero.maxMovementPoints)

        if (this.UIhpBar) {
            const lowHp = this.hero.healthPoints / this.hero.maxHealthPoints <= 0.3
            this.UIhpBar.fill.setFillStyle(lowHp ? 0xef4444 : this.UIhpBar.baseColor)
        }

        const abilities = this.hero.abilities || []
        const targetingSlot = this.hero.controller?.targeting?.slotIndex
        const invokingSlot = this.hero.controller?.invoking?.slotIndex
        for (let i = 0; i < this.UIabilities.length; i++) {
            const slot = this.UIabilities[i]
            // Keep the hotkey label in sync with the keymap so a rebind shows
            // live (the label is otherwise only set at construction / floor load).
            const hotkey = inputMap.abilitySlotKeys[i]
            if (hotkey && slot.label) slot.label.setText(hotkey.toUpperCase())
            const ability = abilities[i]
            if (!ability) {
                slot.sprite.setVisible(false)
                slot.cooldown.setVisible(false)
                continue
            }
            slot.sprite.setVisible(true).setFrame(ability.icon)
            const isInvoking = invokingSlot === i
            const isTargeting = targetingSlot === i
            const onCooldown = ability.cooldownRemaining > 0
            const noResource = !onCooldown && !ability.canActivate()
            if (isInvoking) {
                // Active channel — distinct cyan + an "on" marker. Takes priority
                // over every other slot state while the invocation runs.
                slot.sprite.setTint(0x22d3ee)
                slot.cooldown.setText('●').setVisible(true)
            } else if (isTargeting) {
                slot.sprite.setTint(0xfbbf24)
                slot.cooldown.setVisible(false)
            } else if (onCooldown) {
                slot.sprite.setTint(0x555555)
                slot.cooldown.setText(`${ability.cooldownRemaining}`).setVisible(true)
            } else if (noResource) {
                slot.sprite.setTint(0xef4444)
                slot.cooldown.setVisible(false)
            } else {
                slot.sprite.clearTint()
                slot.cooldown.setVisible(false)
            }
        }

        // Passive badges are declared by the active profile rather than
        // introspected from the tag system — Taggable doesn't carry
        // per-tag metadata (would treat `icon` as a handler key and
        // crash). Each per-class PR populates profile.passiveBadges.
        const passiveBadges = this.hero.profile?.passiveBadges || []
        for (let i = 0; i < this.UIpassives.length; i++) {
            const badge = this.UIpassives[i]
            const entry = passiveBadges[i]
            if (!entry) {
                badge.setVisible(false)
                continue
            }
            badge.setVisible(true).setFrame(entry.icon)
        }
    }

    setTurnOverStyle(isOver) {
        if (!this.UIheader) return
        this.UIheader.setColor(isOver ? "#cfc6b8" : "#fff")
    }

    destroy() {
        // Drop refs only — Phaser destroys scene children on scene
        // restart, which is the path that calls cleanup. Mirrors the
        // original BaseHero.cleanup behavior (delete statements without
        // explicit .destroy() on each child).
        this.UIheader = null
        this.UIhpBar = null
        this.UIapBar = null
        this.UImpBar = null
        this.UIsprite = null
        this.UItallies = null
        this.UIitems = []
        this.UIabilities = []
        this.UIpassives = []
        this.hero.items.forEach(i => {
            if (i.UIsprite) delete i.UIsprite
        })
    }
}
