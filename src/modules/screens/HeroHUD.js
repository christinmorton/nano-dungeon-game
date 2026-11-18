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
import { spawnFloatingNumber } from '../Animations.js'

// The turn-state banner (2026-10-03). The round only ends when the hero's
// MOVEMENT points are spent; attacks and abilities cost ACTION points and
// leave movement untouched (deliberate — strike, then step). So after every
// attack the enemies wait on two movement points the player may not realise
// they still hold, and the game reads as "paused until I press Space". The
// AP/MP bars said so all along, in 8px. This says it in words, above the HUD:
// what the hero can still do this round, and how to end it.
const COLOR_BANNER_IDLE = "#7a7466"
const COLOR_BANNER_LIVE = "#cfc6b8"
const COLOR_BANNER_SPENT = "#fbbf24"
const BANNER_H = 20
// A round that ends and refreshes on the same frame (no engaged enemies) would
// flash "Enemies act" for one frame. The banner only says it once the wait has
// actually lasted this long.
const OVER_HOLD_MS = 120

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
        this.width = config.width

        this.UIbanner = null
        this._bannerState = null
        this._overSince = null
        this._mpPulse = null

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

        // Turn-state banner: a strip above the stats + abilities boxes, spanning
        // both, whichever side the abilities box sits on. Positions come from
        // the config the UI scene passed (box interiors, 8px inset), so the
        // strip follows the HUD anchor preference.
        const inset = 8
        const left = Math.min(x, this.abilitiesX) - inset
        const right = Math.max(x + (this.width ?? 176), this.abilitiesX + this.abilitiesWidth) + inset
        const bannerY = y - inset - BANNER_H - 4
        const bg = scene.add.rectangle(left, bannerY, right - left, BANNER_H, 0x1a1a1a)
            .setOrigin(0)
            .setStrokeStyle(1, 0x4a4a4a)
        const text = scene.add.text(left + (right - left) / 2, bannerY + BANNER_H / 2, '', {
            font: '12px Arial',
            color: COLOR_BANNER_IDLE
        }).setOrigin(0.5)
        this.UIbanner = { bg, text }
        this._updateTurnState(this.hero.movementPoints <= 0 && !this.hero.moving)

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

        // Ability GRID — 16x16 icon slots labelled from the keymap, laid out
        // three across and two down inside the dedicated abilities box drawn by
        // UserInterface, centered within the box interior. Per
        // documents/v3_abilities.md: idle = full color, on cooldown =
        // desaturated + numeric overlay, insufficient resource = red
        // tint. Empty slots stay hidden.
        //
        // Hotkeys + slot count come from the central keymap (InputMap) so the
        // Ultimate slot (the last key, default R) and any rebinds reflect here
        // automatically. The final slot is the Ultimate slot — labelled gold.
        //
        // WAS a single row of six until 2026-09-10. Six slots at pitch 22 is
        // 126px wide in a 112px box interior, so the row overflowed its padding
        // and sat a pixel off each edge of the 128px box. Three columns fits
        // with room to spare — enough that the slots were then enlarged to use
        // it (see SLOT SIZE below). The ultimate falls naturally into the
        // bottom-right corner, which reads as the capstone position.
        //
        // COLS is the layout, not the slot count: the loop derives rows from
        // however many keys the keymap declares, so a seventh slot would start
        // a third row rather than silently overflowing again.
        const ABILITY_HOTKEYS = inputMap.abilitySlotKeys.map(k => k.toUpperCase())
        const slotCount = ABILITY_HOTKEYS.length
        const ultimateSlot = inputMap.ultimateSlotIndex
        // SLOT SIZE. The sheet's native frame is 16px; these are drawn at 24 so
        // the slots fill the box instead of floating in it. That matters more
        // here than it looks, because every ability in v5 declares icon 31 —
        // the picture is the same in all six slots and the INFORMATION is the
        // tint (grey cooldown / red no-resource / amber targeting / cyan
        // channelling) plus the hotkey letter. Both read better with more area.
        //
        // 24 rather than a clean 2x 32: at 32 a row is 32 + label + gap = 44px,
        // and two rows overflow the 80px box interior. 24 keeps the label
        // beneath its icon, which is where it identifies the slot. Going bigger
        // means moving the letter on top of the icon — say so if you want that.
        const iconSize = 24
        const slotPitch = 36
        const COLS = 3
        // 38 clears a 24px icon plus its 12px hotkey label.
        const rowPitch = 38
        const rowCount = Math.ceil(slotCount / COLS)
        const abilityGridWidth = (Math.min(COLS, slotCount) - 1) * slotPitch + iconSize
        const ax = this.abilitiesX + Math.floor((this.abilitiesWidth - abilityGridWidth) / 2)
        const ay = this.abilitiesY
        this.UIabilities = []
        for (let i = 0; i < slotCount; i++) {
            const slotX = ax + (i % COLS) * slotPitch
            const slotY = ay + Math.floor(i / COLS) * rowPitch
            // Texture is 'skills', not 'tiles': ability.icon is a frame index
            // into the generated ability sheet (World.preload, and
            // scripts/build_skill_icons.mjs). Every ability used to declare
            // icon 31 — one Kenney tile — so all six slots drew the same
            // picture and only the hotkey letter told them apart.
            const sprite = scene.add.sprite(slotX, slotY, "skills", 0)
                .setOrigin(0)
                .setDisplaySize(iconSize, iconSize)
                .setVisible(false)
            // Label centred beneath its own icon rather than offset from the
            // corner, so it stays put if iconSize changes again.
            const label = scene.add.text(slotX + iconSize / 2, slotY + iconSize + 1, ABILITY_HOTKEYS[i], {
                font: 'bold 12px Arial',
                color: i === ultimateSlot ? '#ffcc66' : '#cfc6b8'
            }).setOrigin(0.5, 0)
            // Cooldown number sits ON the icon, centred. It was an 11px digit in
            // the corner of a 16px square; there is room now to make it legible.
            const cooldown = scene.add.text(slotX + iconSize / 2, slotY + iconSize / 2, '', {
                font: 'bold 14px Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setVisible(false)

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
        // Sit below the ability grid inside the same abilities box, also
        // centered using the max-4 footprint so the layout stays stable
        // as PRs populate them. Per-class PRs fill the slots; PR 1 ships
        // the plumbing only, so all four start hidden.
        //
        // Y is derived from the grid rather than fixed: this was a hardcoded
        // ay + 38, which the second ability row now occupies.
        //
        // NOTE: with the enlarged 3x2 grid this lands below the box interior.
        // Harmless today — no v5 profile declares passiveBadges (all three set
        // `passives: []`), so all four badges are created hidden and stay that
        // way, which is why their reserved strip was available to spend on the
        // ability slots at all. If passives are ever turned on, the abilities
        // box has to grow; do not just shrink the slots back.
        const passivePitch = 14
        const passiveRowWidth = (4 - 1) * passivePitch + 12
        const passiveX = this.abilitiesX + Math.floor((this.abilitiesWidth - passiveRowWidth) / 2)
        const passiveY = ay + rowCount * rowPitch + 8
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

    // Called by BaseHero.over(), which TurnManager asks every frame — so this
    // runs every frame and must be cheap: it only touches text when the state
    // actually changes.
    setTurnOverStyle(isOver) {
        if (this.UIheader) this.UIheader.setColor(isOver ? "#cfc6b8" : "#fff")
        this._updateTurnState(isOver)
    }

    _updateTurnState(isOver) {
        if (!this.UIbanner) return
        const hero = this.hero
        if (hero.moving) return

        let state, label, color
        const wait = inputMap.keyLabel('passTurn')
        if (isOver) {
            // Hold before announcing the enemies' turn — see OVER_HOLD_MS.
            if (this._overSince == null) this._overSince = Date.now()
            if (Date.now() - this._overSince < OVER_HOLD_MS) return
            state = 'over'
            label = 'Enemies act…'
            color = COLOR_BANNER_IDLE
        } else {
            this._overSince = null
            const ap = hero.actionPoints
            const mp = hero.movementPoints
            if (ap <= 0 && mp > 0) {
                state = 'spent'
                label = `Action spent — move (${mp} left) or ${wait} to wait`
                color = COLOR_BANNER_SPENT
            } else if (mp < hero.maxMovementPoints) {
                state = 'partial'
                label = `${mp} move left — attack, move, or ${wait} to wait`
                color = COLOR_BANNER_LIVE
            } else {
                state = 'fresh'
                label = 'Your turn — attack or move'
                color = COLOR_BANNER_IDLE
            }
        }

        const key = `${state}:${label}`
        if (key === this._bannerState) return
        const previous = this._bannerState ? this._bannerState.split(':')[0] : null
        this._bannerState = key
        this.UIbanner.text.setText(label).setColor(color)

        // Entering "spent" from anything else: say it over the hero too, once,
        // and pulse the MP bar until the points are used. Leaving it: stop.
        if (state === 'spent' && previous !== 'spent') {
            spawnFloatingNumber(hero, 'Action spent', COLOR_BANNER_SPENT)
            this._startMpPulse()
        } else if (state !== 'spent' && previous === 'spent') {
            this._stopMpPulse()
        }
    }

    _startMpPulse() {
        if (this._mpPulse || !this.UImpBar) return
        this._mpPulse = this.scene.tweens.add({
            targets: this.UImpBar.fill,
            alpha: 0.3,
            duration: 450,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        })
    }

    _stopMpPulse() {
        if (!this._mpPulse) return
        this._mpPulse.stop()
        this._mpPulse = null
        if (this.UImpBar) this.UImpBar.fill.setAlpha(1)
    }

    destroy() {
        this._stopMpPulse()
        this.UIbanner = null
        this._bannerState = null
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
