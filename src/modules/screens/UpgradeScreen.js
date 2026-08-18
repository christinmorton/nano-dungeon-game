import Phaser from 'phaser'
import dungeon from '../Dungeon.js'
import run from '../Run.js'
import router from '../SceneRouter.js'
import inputMap from '../InputMap.js'
import { STAT_NAMES } from '../classes/Stats.js'
import { statusesOnEntity } from '../tags/Status.js'
import { AFFINITIES, MAX_EMPOWER_TIER } from '../abilities/affinities.js'
import { affinityPathsFor, MAX_PATH_RANK } from '../abilities/affinityPaths.js'
import { commandAlly, ALLY_COMMANDS } from '../companions/commands.js'
import gameLog from '../GameLog.js'

// In-run SKILLBOOK (§14) — evolved from the spend-points screen into the run hub.
// Modal (World+UI paused beneath), opened with K. Paged:
//   - Abilities : the run COLLECTION (hero.collection) — equipped + benched. Click
//                 one to inspect, equip/swap into a bar slot, and spend points on
//                 its rank / augment / traits.
//   - Passives  : the hero's always-on passives (read-only).
//   - Statuses  : active buffs / debuffs right now (read-only).
//   - Stats     : base-stat spend (+ derived read-out).
// Run-scoped: everything reads the hero, which is rebuilt each run; the account
// skillbook persists separately (B3). (Affinity page lands with Phase 3.)

const GAME_W = 80 * 16
const GAME_H = 50 * 16

// The scrollable body viewport — between the tab bar and the Close button. Content
// taller than this scrolls (mouse wheel); everything outside is masked off.
const BODY_TOP = 150
const BODY_BOTTOM = GAME_H - 84

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_OK = "#86efac"
const COLOR_MUTED = "#555"
const COLOR_BENCH = "#8aa0c0"
const COLOR_BAD = "#fca5a5"

// Purchase costs (tuning constants — pair with Run's accrual rates).
const RANK_COST = 2
const STAT_COST = 1
const AUGMENT_COST = 3
const TRAIT_COST = 2
// Affinity upgrade tree — paid in AFFINITY SHARDS, not skill points. Empower is the
// basic slot's broad-power dial; signature PATHS (§19) are the per-affinity fork. Both
// costs escalate with how deep you've already invested.
function empowerShardCost(tier) { return 4 + tier * 3 }
function pathShardCost(rank) { return 4 + rank * 2 }

const TABS = [
    { key: 'abilities', label: 'Abilities' },
    { key: 'passives', label: 'Passives' },
    { key: 'statuses', label: 'Statuses' },
    { key: 'affinity', label: 'Affinity' },
    { key: 'companions', label: 'Companions' },
    { key: 'stats', label: 'Stats' },
]

export default class UpgradeScreen extends Phaser.Scene {
    constructor() {
        super({ key: "upgrade-scene", active: false })
    }

    create() {
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.92).setOrigin(0)
        const cx = GAME_W / 2
        this.add.text(cx, 40, "Skillbook", { font: "40px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        this._pointsText = this.add.text(cx, 78, "", { font: "18px Arial", color: COLOR_OK }).setOrigin(0.5)

        this._tab = 'abilities'
        this._detail = null          // selected ability (Abilities tab)
        this._armedPath = null       // affinity path awaiting a commit-confirm click
        this._tabWidgets = []
        this._body = []
        this._scrollY = 0            // body scroll offset (<= 0); tabs that overflow scroll
        this._maxScroll = 0
        this._bodyMask = this._makeBodyMask()

        // Mouse wheel scrolls the body when its content overflows the viewport.
        this.input.on("wheel", (pointer, over, dx, dy) => {
            if (!this._maxScroll) return
            this._scrollY = Math.max(-this._maxScroll, Math.min(0, this._scrollY - dy * 0.4))
            this._render()
        })

        this._renderTabs()
        this._render()

        this._makeButton(cx, GAME_H - 60, "Close  [Esc]", () => this._close(), COLOR_PRIMARY)

        // Close on KEYUP (matches HeroController's dispatch — see the lean-start /
        // input notes) so the same physical press can't resume World and re-open.
        this.input.keyboard.on("keyup-ESC", () => this._close())
        this.input.keyboard.on("keyup-K", () => this._close())
    }

    _renderTabs() {
        this._tabWidgets.forEach(w => w.destroy())
        this._tabWidgets = []
        const cx = GAME_W / 2
        const w = 150, gap = 8
        const totalW = TABS.length * w + (TABS.length - 1) * gap
        let x = cx - totalW / 2
        for (const tab of TABS) {
            const active = this._tab === tab.key
            const rect = this.add.rectangle(x, 110, w, 32, active ? 0x3a5a3a : 0x2a2a2a).setOrigin(0).setStrokeStyle(1, 0x4a4a4a)
            const text = this.add.text(x + w / 2, 126, tab.label, { font: "14px Arial", color: active ? COLOR_OK : COLOR_DIM }).setOrigin(0.5)
            rect.setInteractive({ useHandCursor: true })
            rect.on("pointerover", () => { if (this._tab !== tab.key) rect.setFillStyle(0x3a3a3a) })
            rect.on("pointerout", () => { if (this._tab !== tab.key) rect.setFillStyle(0x2a2a2a) })
            rect.on("pointerup", () => { this._tab = tab.key; this._detail = null; this._armedPath = null; this._scrollY = 0; this._renderTabs(); this._render() })
            this._tabWidgets.push(rect, text)
            x += w + gap
        }
    }

    _render() {
        this._body.forEach(w => w.destroy())
        this._body = []
        this._pointsText.setText(`Skill points: ${run.skillPoints || 0}`)
        if (this._tab === 'abilities') {
            this._detail ? this._renderAbilityDetail(this._detail) : this._renderAbilities()
        } else if (this._tab === 'passives') {
            this._renderPassives()
        } else if (this._tab === 'statuses') {
            this._renderStatuses()
        } else if (this._tab === 'affinity') {
            this._renderAffinity()
        } else if (this._tab === 'companions') {
            this._renderCompanions()
        } else if (this._tab === 'stats') {
            this._renderStats()
        }
        this._applyScroll()
    }

    // A geometry mask over the body viewport so scrolled content is clipped to the
    // area between the tab bar and the Close button (not drawn over either).
    _makeBodyMask() {
        const g = this.make.graphics()
        g.fillStyle(0xffffff)
        g.fillRect(0, BODY_TOP, GAME_W, BODY_BOTTOM - BODY_TOP)
        return g.createGeometryMask()
    }

    // Offset every body element by the current scroll, mask it to the viewport, and
    // disable input on anything scrolled out of view (so it can't steal clicks). Also
    // sizes the scrollbar thumb. Called at the end of every _render.
    _applyScroll() {
        let maxY = 0
        for (const o of this._body) maxY = Math.max(maxY, o.y)
        this._maxScroll = Math.max(0, maxY - BODY_BOTTOM + 12)
        this._scrollY = Math.max(-this._maxScroll, Math.min(0, this._scrollY))
        for (const o of this._body) {
            o.y += this._scrollY
            o.setMask(this._bodyMask)
            if (o.input) o.input.enabled = (o.y >= BODY_TOP && o.y <= BODY_BOTTOM)
        }
        this._updateScrollbar()
    }

    _updateScrollbar() {
        this._scrollbar?.destroy()
        this._scrollbar = null
        if (!this._maxScroll) return
        const viewH = BODY_BOTTOM - BODY_TOP
        const contentH = viewH + this._maxScroll
        const thumbH = Math.max(24, viewH * viewH / contentH)
        const frac = this._maxScroll ? (-this._scrollY / this._maxScroll) : 0
        const thumbY = BODY_TOP + frac * (viewH - thumbH)
        this._scrollbar = this.add.rectangle(GAME_W - 12, thumbY + thumbH / 2, 6, thumbH, 0x666666).setOrigin(0.5)
    }

    // --- Abilities: the run collection -----------------------------------------

    _renderAbilities() {
        const hero = dungeon.player
        const collection = (hero?.collection || []).filter(Boolean)
        const left = GAME_W / 2 - 320
        let y = 172
        this._body.push(this.add.text(left, y, "Skills acquired this run — click one to inspect, equip/swap, or upgrade.", {
            font: "13px Arial", color: COLOR_DIM
        }).setOrigin(0, 0.5))
        y += 28

        if (!collection.length) {
            this._body.push(this.add.text(left, y, "No skills yet.", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            return
        }

        for (const ability of collection) {
            const slot = hero.abilities.indexOf(ability)
            const equipped = slot >= 0
            const tag = equipped ? `[${(inputMap.abilitySlotKeys[slot] || '?').toUpperCase()}]` : "(benched)"
            const row = this.add.text(left, y, `${ability.name}    Lv ${ability.level}/${ability.maxLevel}    ${this._elementLabel(ability)}`, {
                font: "15px Arial", color: COLOR_PRIMARY
            }).setOrigin(0, 0.5)
            row.setInteractive({ useHandCursor: true })
            row.on("pointerover", () => row.setColor(COLOR_ACCENT))
            row.on("pointerout", () => row.setColor(COLOR_PRIMARY))
            row.on("pointerup", () => { this._detail = ability; this._render() })
            this._body.push(row)
            this._body.push(this.add.text(left + 600, y, tag, { font: "13px Arial", color: equipped ? COLOR_OK : COLOR_BENCH }).setOrigin(1, 0.5))
            y += 28
            // (long lists scroll — see _applyScroll; no truncation needed)
        }
    }

    _renderAbilityDetail(ability) {
        const hero = dungeon.player
        const left = GAME_W / 2 - 320
        let y = 168

        this._body.push(this.add.text(left, y, `${ability.name}    Lv ${ability.level}/${ability.maxLevel}`, { font: "20px Arial", color: COLOR_ACCENT }).setOrigin(0, 0.5))
        y += 28
        const cost = `${ability.cost?.ap ?? 0} AP${ability.cost?.mp ? ` / ${ability.cost.mp} MP` : ''}`
        this._body.push(this.add.text(left, y, `${this._elementLabel(ability)}   •   ${cost}   •   cd ${ability.cooldown}   •   range ${ability.range}`, { font: "12px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 20
        if (ability.description) {
            this._body.push(this.add.text(left, y, ability.description, { font: "12px Arial", color: COLOR_PRIMARY, wordWrap: { width: 600 } }).setOrigin(0, 0))
            y += 40
        }

        // Equip / slot controls.
        const ultimateSlot = inputMap.ultimateSlotIndex
        const equippedSlot = hero.abilities.indexOf(ability)
        if (ability.tier === 'ultimate') {
            this._body.push(this.add.text(left, y, "Ultimate — locked to the R slot.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 32
        } else if (equippedSlot >= 0) {
            this._body.push(this.add.text(left, y, `Equipped in [${(inputMap.abilitySlotKeys[equippedSlot] || '?').toUpperCase()}]`, { font: "13px Arial", color: COLOR_OK }).setOrigin(0, 0.5))
            this._makeBodyButton(left + 190, y, "Unequip", () => { hero.unequipAbility(equippedSlot); this._render() }, 90)
            y += 34
        } else {
            this._body.push(this.add.text(left, y, "Equip to slot:", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            let bx = left + 110
            for (let i = 0; i < ultimateSlot; i++) {
                const key = (inputMap.abilitySlotKeys[i] || '?').toUpperCase()
                const occ = hero.abilities[i]
                this._makeBodyButton(bx, y, occ ? `${key}: ${occ.name.slice(0, 7)}` : `${key}: —`, () => { hero.equipAbility(ability, i); this._render() }, 92)
                bx += 98
            }
            y += 34
        }

        // Rank.
        if (ability.maxLevel > 1) {
            if (ability.level >= ability.maxLevel) {
                this._body.push(this.add.text(left, y, "Rank: MAX", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            } else {
                this._body.push(this.add.text(left, y, `Rank ${ability.level} → ${ability.level + 1}`, { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5))
                this._makeBodyButton(left + 240, y, `Rank Up  ${RANK_COST}sp`, () => this._rankUp(ability))
            }
            y += 34
        }

        // Augments (choose one).
        const augKeys = Object.keys(ability.augments || {})
        if (augKeys.length) {
            const locked = ability.level < ability.augmentLevel
            this._body.push(this.add.text(left, y, locked ? `AUGMENT — choose one (unlocks at Lv ${ability.augmentLevel})` : "AUGMENT — choose one", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 26
            for (const key of augKeys) {
                const aug = ability.augments[key]
                const chosen = ability.chosenAugment === key
                this._body.push(this.add.text(left, y, `${chosen ? "● " : "○ "}${aug.label}`, { font: "14px Arial", color: chosen ? COLOR_OK : COLOR_PRIMARY }).setOrigin(0, 0.5))
                if (!chosen && !locked) this._makeBodyButton(left + 260, y, `Choose  ${AUGMENT_COST}sp`, () => this._chooseAugment(ability, key))
                y += 30
            }
        }

        // Traits (equip up to maxTraits).
        const traitKeys = Object.keys(ability.traits || {})
        if (traitKeys.length) {
            const locked = ability.level < ability.traitLevel
            this._body.push(this.add.text(left, y, locked ? `TRAITS — up to ${ability.maxTraits} (unlocks at Lv ${ability.traitLevel})` : `TRAITS — up to ${ability.maxTraits}`, { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 26
            for (const key of traitKeys) {
                const tr = ability.traits[key]
                const equipped = ability.equippedTraits.includes(key)
                this._body.push(this.add.text(left, y, `${equipped ? "☑ " : "☐ "}${tr.label}`, { font: "14px Arial", color: equipped ? COLOR_OK : COLOR_PRIMARY }).setOrigin(0, 0.5))
                if (equipped) this._makeBodyButton(left + 260, y, "Remove", () => this._toggleTrait(ability, key))
                else if (!locked) this._makeBodyButton(left + 260, y, `Equip  ${TRAIT_COST}sp`, () => this._toggleTrait(ability, key))
                y += 30
            }
        }

        this._makeBodyButton(left, y + 12, "‹ Back", () => { this._detail = null; this._render() })
    }

    // --- Passives ---------------------------------------------------------------

    _renderPassives() {
        const passives = dungeon.player?.passives || []
        const left = GAME_W / 2 - 300
        let y = 172
        this._body.push(this.add.text(left, y, "Always-on passives.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 30
        if (!passives.length) {
            this._body.push(this.add.text(left, y, "None.", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            return
        }
        for (const p of passives) {
            this._body.push(this.add.text(left, y, p.name || p.constructor?.name || "Passive", { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5))
            y += 22
            if (p.description) {
                this._body.push(this.add.text(left + 12, y, p.description, { font: "12px Arial", color: COLOR_DIM, wordWrap: { width: 580 } }).setOrigin(0, 0))
                y += 34
            }
            y += 8
        }
    }

    // --- Statuses (active buffs / debuffs) --------------------------------------

    _renderStatuses() {
        const hero = dungeon.player
        const all = hero ? statusesOnEntity(hero) : []
        const buffs = all.filter(s => s.valence === "positive")
        const debuffs = all.filter(s => s.valence === "negative")
        const left = GAME_W / 2 - 300
        let y = 172

        this._body.push(this.add.text(left, y, "BUFFS", { font: "15px Arial", color: COLOR_OK }).setOrigin(0, 0.5))
        y += 26
        if (!buffs.length) { this._body.push(this.add.text(left + 12, y, "None active.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)); y += 26 }
        for (const s of buffs) { this._body.push(this.add.text(left + 12, y, `• ${s.name}`, { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)); y += 24 }

        y += 16
        this._body.push(this.add.text(left, y, "DEBUFFS", { font: "15px Arial", color: COLOR_BAD }).setOrigin(0, 0.5))
        y += 26
        if (!debuffs.length) { this._body.push(this.add.text(left + 12, y, "None active.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)); y += 26 }
        for (const s of debuffs) { this._body.push(this.add.text(left + 12, y, `• ${s.name}`, { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)); y += 24 }
    }

    // --- Affinity ---------------------------------------------------------------

    _renderAffinity() {
        const hero = dungeon.player
        const left = GAME_W / 2 - 280
        let y = 158
        // Two slots (§18) — read-only HUD. Basic is swappable (essences, random
        // passive); advanced is bound (pact / forced curse). Both stack.
        y = this._renderAffinitySlot(left, y, "BASIC  (element — swappable)", hero?.affinityBasic, false, hero?._basicPassive, hero?.affinityBasicTier || 0)
        y += 16
        y = this._renderAffinitySlot(left, y, "ADVANCED  (cosmic — bound)", hero?.affinityAdvanced, true, hero?._advancedPassive)
        if (!hero?.affinityBasic && !hero?.affinityAdvanced) {
            this._body.push(this.add.text(left, y + 12, "Affinities are EARNED during a run — absorb an essence (basic) or be bound by a pact / curse (advanced). Both slots can be filled at once; they stack.", {
                font: "12px Arial", color: COLOR_DIM, wordWrap: { width: 600 }
            }).setOrigin(0, 0))
        }

        // Upgrade tree (shared first slice): spend AFFINITY SHARDS to grow the ATTUNED
        // basic affinity. Shards = the affinity-only currency (mastery-through-use +
        // kills). Per-element flavor nodes are a later expansion; these work for all.
        if (hero?.affinityBasic || hero?.affinityAdvanced) {
            y += 20
            this._body.push(this.add.text(left, y, `AFFINITY SHARDS: ${run.affinityShards || 0}`, { font: "16px Arial", color: COLOR_ACCENT }).setOrigin(0, 0.5))
            this._body.push(this.add.text(left + 220, y, "earned by wielding your element + kills", { font: "11px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 30

            // Empower — the basic slot's broad-power dial (stats + element bonus).
            if (hero.affinityBasic) {
                const tier = hero.affinityBasicTier || 0
                if (tier >= MAX_EMPOWER_TIER) {
                    this._body.push(this.add.text(left + 12, y, `Empower — MAX (tier ${tier})`, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
                } else {
                    const cost = empowerShardCost(tier)
                    this._body.push(this.add.text(left + 12, y, `Empower  (tier ${tier} → ${tier + 1}) — stronger element bonus + stats`, { font: "13px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5))
                    this._makeBodyButton(left + 470, y, `${cost} shards`, () => this._buyEmpower(cost))
                }
                y += 32
            }

            // Signature PATHS (§19) — each affinity's empowerment forks into thematic
            // paths. Shown for whichever attuned slot(s) have a fork (only seraphic in
            // the first slice). Take one or deepen it; rank scales the effect live.
            for (const key of [hero.affinityBasic, hero.affinityAdvanced]) {
                if (!key) continue
                // Basic slot shows its demi-god fork only once EMPOWERED (tier > 0);
                // otherwise its simple signature. Advanced is always the deep fork.
                const empowered = (key === hero.affinityBasic) ? (hero.affinityBasicTier || 0) > 0 : true
                const paths = affinityPathsFor(key, empowered)
                if (!paths.length) continue
                y = this._renderAffinityPaths(left, y, key, paths)
            }
        }
    }

    // Render one affinity's empowerment-path fork; returns the new y.
    _renderAffinityPaths(left, y, affinityKey, paths) {
        const hero = dungeon.player
        const aff = AFFINITIES[affinityKey] || {}
        // Exclusive model: one path is committed per affinity; the others lock.
        const chosen = paths.find(p => hero.affinityPathRank(p.key) > 0)?.key || null
        y += 6
        const header = chosen ? `${aff.label || affinityKey} — PATH: ${paths.find(p => p.key === chosen)?.label}` : `${aff.label || affinityKey} — EMPOWERMENT PATHS  (choose ONE — the others lock)`
        this._body.push(this.add.text(left, y, header, { font: "12px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 24
        for (const p of paths) {
            const rank = hero.affinityPathRank(p.key)
            const isChosen = chosen === p.key
            const isLocked = chosen && !isChosen
            const maxed = rank >= MAX_PATH_RANK
            const nameColor = isChosen ? COLOR_OK : isLocked ? COLOR_MUTED : COLOR_PRIMARY
            const label = rank > 0 ? `${p.label}  (rank ${rank}/${MAX_PATH_RANK})` : p.label
            this._body.push(this.add.text(left + 12, y, label, { font: "14px Arial", color: nameColor }).setOrigin(0, 0.5))
            // Committed path shows its LIVE state (stacks / brand / evasion); the rest
            // show the static "what lane is this" blurb.
            const sub = isChosen && p.readout ? p.readout(hero, rank) : p.blurb
            this._body.push(this.add.text(left + 12, y + 15, sub, { font: "11px Arial", color: isChosen ? COLOR_ACCENT : COLOR_DIM }).setOrigin(0, 0.5))
            if (isLocked) {
                this._body.push(this.add.text(left + 470, y, "locked", { font: "12px Arial", color: COLOR_MUTED }).setOrigin(0, 0.5))
            } else if (maxed) {
                this._body.push(this.add.text(left + 470, y, "MAX", { font: "12px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            } else {
                const cost = pathShardCost(rank)
                const armed = this._armedPath === p.key
                const buttonLabel = armed ? "Commit? (locks others)" : rank > 0 ? `Deepen · ${cost}` : `Take · ${cost}`
                this._makeBodyButton(left + 470, y, buttonLabel, () => this._buyPath(affinityKey, p.key))
            }
            y += 40
        }
        return y
    }

    _buyEmpower(cost) {
        const hero = dungeon.player
        if (!hero?.affinityBasic || (hero.affinityBasicTier || 0) >= MAX_EMPOWER_TIER) return
        if (!run.spendAffinityShards(cost)) { gameLog.log("Not enough affinity shards."); return }
        hero.empowerCurrentAffinity()
        this._render()
    }

    _buyPath(affinityKey, pathKey) {
        const hero = dungeon.player
        const rank = hero.affinityPathRank(pathKey)
        if (rank >= MAX_PATH_RANK) return
        // Taking a NEW path is an irreversible commitment (locks the other two) — arm
        // a confirm on the first click, execute on the second. Deepening the already-
        // chosen path skips the confirm.
        if (rank === 0 && this._armedPath !== pathKey) {
            this._armedPath = pathKey
            this._render()
            return
        }
        const cost = pathShardCost(rank)
        if (!run.spendAffinityShards(cost)) { gameLog.log("Not enough affinity shards."); this._armedPath = null; return }
        hero.investAffinityPath(affinityKey, pathKey)
        this._armedPath = null
        this._render()
    }

    // Render one affinity slot's block; returns the new y. `key` may be null.
    // `passive` is the Passive INSTANCE the slot has attached (or null).
    _renderAffinitySlot(left, y, header, key, isAdvanced, passive, tier = 0) {
        this._body.push(this.add.text(left, y, header, { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 24
        if (!key) {
            this._body.push(this.add.text(left + 12, y, isAdvanced ? "None — bound by a pact or curse." : "None — absorb an essence.", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            return y + 24
        }
        const aff = AFFINITIES[key] || {}
        // Empowered basic slot (a mythical beast's gift) reads "Fire — Empowered".
        const qualifier = isAdvanced ? "  (Bound)" : (tier > 0 ? "  — Empowered" : "  (swappable)")
        this._body.push(this.add.text(left + 12, y, `${aff.label || key}${qualifier}`, { font: "17px Arial", color: isAdvanced ? COLOR_BAD : COLOR_ACCENT }).setOrigin(0, 0.5))
        y += 24
        this._body.push(this.add.text(left + 12, y, `Layers ${aff.label} onto every hit${aff.status ? ` — applies ${aff.status.name}` : ""}; a matching element is amplified.`, { font: "12px Arial", color: COLOR_PRIMARY, wordWrap: { width: 580 } }).setOrigin(0, 0))
        y += 32
        const sb = this._statBonusStr(aff.statBonus)
        if (sb) { this._body.push(this.add.text(left + 12, y, `Stat bonus: ${sb}`, { font: "12px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)); y += 22 }
        // The passive this slot rolled (basic) or was bound to (advanced).
        if (passive) {
            this._body.push(this.add.text(left + 12, y, `Passive: ${passive.name}`, { font: "12px Arial", color: COLOR_OK }).setOrigin(0, 0.5)); y += 20
            if (passive.description) { this._body.push(this.add.text(left + 24, y, passive.description, { font: "11px Arial", color: COLOR_DIM, wordWrap: { width: 560 } }).setOrigin(0, 0)); y += 22 }
        }
        return y
    }

    _statBonusStr(bonus) {
        if (!bonus) return ""
        return Object.entries(bonus).map(([s, n]) => `+${n} ${s}`).join(", ")
    }

    // --- Stats ------------------------------------------------------------------

    // Companions roster: ACTIVE followers (stance + Dismiss per ally) and the RESERVE
    // bench (per-ally Beckon, swap-aware). "Come to me" / "despawn" are the V/D
    // keybinds; this page is the per-ally control + stances the keys can't express.
    _renderCompanions() {
        const hero = dungeon.player
        const left = GAME_W / 2 - 300
        let y = 172
        const party = hero?.party || []
        const bench = hero?.followerBench || []

        this._body.push(this.add.text(left, y, "ACTIVE — fighting at your side", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 30
        if (!party.length) {
            this._body.push(this.add.text(left + 12, y, "None. Beckon a reserve companion below, or form a pact / boon.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 30
        }
        const STANCES = [
            [ALLY_COMMANDS.FOLLOW, "Follow"],
            [ALLY_COMMANDS.STAY, "Stay"],
            [ALLY_COMMANDS.PASSIVE, "Passive"],
            [ALLY_COMMANDS.AGGRESSIVE, "Aggressive"],
        ]
        for (const ally of party) {
            const god = ally.cosmicKind != null ? "  [god]" : ""
            this._body.push(this.add.text(left, y, `${ally.name}${god}`, { font: "16px Arial", color: COLOR_ACCENT }).setOrigin(0, 0.5))
            this._body.push(this.add.text(left + 300, y, `${ally.healthPoints ?? "?"}/${ally.maxHealthPoints ?? "?"} HP`, { font: "13px Arial", color: COLOR_OK }).setOrigin(0, 0.5))
            y += 26
            const stance = ally.allyCommand?.type || ALLY_COMMANDS.FOLLOW
            let bx = left + 12
            for (const [cmd, label] of STANCES) {
                const on = stance === cmd
                this._makeBodyButton(bx, y, on ? `● ${label}` : label, () => { commandAlly(ally, cmd, { by: hero }); this._render() }, 96)
                bx += 100
            }
            this._makeBodyButton(bx + 8, y, "Dismiss", () => { dungeon.benchFollower(ally); this._render() }, 88)
            y += 42
        }

        y += 8
        this._body.push(this.add.text(left, y, "RESERVE — waiting to be called", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 30
        if (!bench.length) {
            this._body.push(this.add.text(left + 12, y, "None.", { font: "13px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
            y += 26
        }
        for (const ally of bench) {
            const god = ally.cosmicKind != null ? "  [god]" : ""
            this._body.push(this.add.text(left, y, `${ally.name}${god}`, { font: "16px Arial", color: COLOR_BENCH }).setOrigin(0, 0.5))
            this._makeBodyButton(left + 320, y, "Beckon", () => { dungeon.manifestFollower(ally); this._render() }, 100)
            y += 34
        }
    }

    _renderStats() {
        const hero = dungeon.player
        const left = GAME_W / 2 - 220
        let y = 172
        this._body.push(this.add.text(left, y, `BASE STATS  (+1 costs ${STAT_COST}sp — lasts this run)`, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        y += 30
        for (const name of STAT_NAMES) {
            const value = hero?.stats?.[name] ?? 0
            this._body.push(this.add.text(left, y, name, { font: "15px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5))
            this._body.push(this.add.text(left + 120, y, String(value), { font: "15px Arial", color: COLOR_OK }).setOrigin(1, 0.5))
            this._makeBodyButton(left + 150, y, `+1  ${STAT_COST}sp`, () => this._upgradeStat(name))
            y += 32
        }

        y += 12
        this._body.push(this.add.text(left + 320, 202, "DERIVED", { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5))
        let dy = 228
        const derived = [["Max HP", "maxHP"], ["Attack", "attackPower"], ["Magic power", "magicPower"], ["Armor", "armor"], ["Dodge", "dodge"], ["Barrier", "barrier"]]
        for (const [label, key] of derived) {
            const v = hero?.stat ? hero.stat(key) : 0
            this._body.push(this.add.text(left + 320, dy, `${label}: ${v}`, { font: "13px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5))
            dy += 24
        }
    }

    // --- Element label proxy (precursor to the Phase 3 affinity display) --------

    _elementLabel(a) {
        if (a.damageFlavor) {
            return (a.damageType && a.damageType !== a.damageFlavor) ? `${a.damageType}·${a.damageFlavor}` : a.damageFlavor
        }
        const damaging = a.damageMin || a.damageMax || a.damageStat
        return damaging ? (a.damageType || 'physical') : 'support'
    }

    // --- Spend actions ----------------------------------------------------------

    _chooseAugment(ability, key) {
        if (ability.chosenAugment === key) return
        if (ability.level < ability.augmentLevel) { this._flash("Rank too low for an augment."); return }
        if (!run.spendSkillPoints(AUGMENT_COST)) { this._flash("Not enough skill points."); return }
        ability.chooseAugment(key)   // switching does not refund the prior augment
        this._render()
    }

    _toggleTrait(ability, key) {
        if (ability.equippedTraits.includes(key)) {
            ability.unequipTrait(key)   // free; no refund
            this._render()
            return
        }
        if (ability.level < ability.traitLevel) { this._flash("Rank too low for a trait."); return }
        if (ability.equippedTraits.length >= ability.maxTraits) { this._flash(`Only ${ability.maxTraits} trait slot${ability.maxTraits === 1 ? "" : "s"}.`); return }
        if (!run.spendSkillPoints(TRAIT_COST)) { this._flash("Not enough skill points."); return }
        ability.equipTrait(key)
        this._render()
    }

    _rankUp(ability) {
        if (ability.level >= ability.maxLevel) return
        if (!run.spendSkillPoints(RANK_COST)) { this._flash("Not enough skill points."); return }
        ability.levelUp()
        this._render()
    }

    _upgradeStat(name) {
        if (!run.spendSkillPoints(STAT_COST)) { this._flash("Not enough skill points."); return }
        dungeon.player?.upgradeBaseStat(name, 1)
        this._render()
    }

    _flash(msg) {
        if (this._flashText) this._flashText.destroy()
        this._flashText = this.add.text(GAME_W / 2, GAME_H - 100, msg, { font: "14px Arial", color: COLOR_BAD }).setOrigin(0.5)
        this.time.delayedCall(1100, () => { this._flashText?.destroy(); this._flashText = null })
    }

    _close() {
        router.bind(this)
        router.closeUpgrade()
        dungeon.player?.refreshUI?.()
    }

    _makeBodyButton(x, y, label, onClick, w = 110) {
        const h = 26
        const rect = this.add.rectangle(x + w / 2, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        const text = this.add.text(x + w / 2, y, label, { font: "12px Arial", color: COLOR_OK }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
        this._body.push(rect, text)
    }

    _makeButton(x, y, label, onClick, textColor = COLOR_PRIMARY) {
        const w = 220
        const h = 40
        const rect = this.add.rectangle(x, y, w, h, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a)
        this.add.text(x, y, label, { font: "18px Arial", color: textColor }).setOrigin(0.5)
        rect.setInteractive({ useHandCursor: true })
        rect.on("pointerover", () => rect.setFillStyle(0x3a3a3a))
        rect.on("pointerout", () => rect.setFillStyle(0x2a2a2a))
        rect.on("pointerup", onClick)
    }
}
