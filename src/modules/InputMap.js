import prefs from './Prefs.js'

// Central keybinding map — the single source of truth for key -> action, so the
// hardcoded `event.key === "f"` checks scattered through HeroController collapse
// to one declarative table. This is the seam the planned configurable-keybind UI
// (Settings "Controls") and the Ultimate-slot rebind ride on.
//
// SCOPE (first slice): the DISCRETE action keys (ability bar Q/W/E/A/S, interact,
// retreat, pass-turn) + movement directions. Item digits (1-0), drop (Shift+digit),
// and unequip letters are still resolved structurally in HeroController — they're
// index-parameterized and migrate in a follow-up. The DEFAULT_* tables below MATCH
// today's hardcoded bindings exactly: this refactor changes no behavior.

// Normalize a KeyboardEvent to a stable token: 'Space' for the spacebar, a
// lowercased single letter, the raw key name otherwise ('ArrowUp', 'Escape', …).
// Lowercasing matches the existing `event.key.toLowerCase()` handling so Shift /
// CapsLock don't change which action a letter fires.
export function tokenFor(event) {
    const k = event?.key
    if (!k) return null
    if (k === ' ' || k === 'Spacebar') return 'Space'
    if (k.length === 1) return k.toLowerCase()
    return k
}

// Ordered ability-bar slot keys: the token at index i fires ability slot i. The
// first five are the normal bar; the LAST entry is the Ultimate slot (default R).
const DEFAULT_ABILITY_SLOT_KEYS = ['q', 'w', 'e', 'a', 's', 'r']

// Movement: token -> step. Arrows today; WASD stays free because A/S are ability
// slots. (Direction aiming for targeting / steerable channels reads this too, so
// rebinding movement also rebinds aim.)
const DEFAULT_MOVEMENT = {
    ArrowUp:    { dx: 0, dy: -1 },
    ArrowDown:  { dx: 0, dy: 1 },
    ArrowLeft:  { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
}

// Discrete single-press actions: action id -> tokens that trigger it.
// Retreat moved off R (now the Ultimate slot) to X; it's combat-only and
// rebindable in the Controls UI. (See v3_input_and_keybinds.md.)
const DEFAULT_ACTIONS = {
    interact:  ['f'],
    retreat:   ['x'],
    passTurn:  ['Space'],
    // NOTE: 'skillbook' (K) was removed on 2026-09-10. The screen it opened is
    // cut in v5, and its handler paused World+UI before launching an
    // unregistered scene — a soft-lock, not a no-op. Do not re-add the binding
    // without registering the scene.
    // General yes/no for decisions — the "accept" (Y) and "decline" (N) pair.
    // First consumer is a pending pact offer (F hears it, then Y/N answer); future
    // yes/no prompts reuse these. Both rebindable in the Controls UI.
    accept:  ['y'],
    decline: ['n'],
    // Companion management: Beckon (V) calls your followers to your side / manifests
    // your reserve; Dismiss (D) sends active followers to the reserve bench. Together
    // they swap which god fights beside you (Dismiss the active, Beckon a reserve one).
    // Provisional letters (b/c/g/m/o/h/t are taken by unequip-slot keys); rebindable.
    beckon:  ['v'],
    dismiss: ['d'],
    // The Character screen (screens/Character.js): stats, gear, and what each
    // carried item would change. Opens AND closes on the same key. Added
    // 2026-10-03; C was free because the unequip letters went the same day.
    character: ['c'],
}

// Unequip keys: token -> equipment slot. EMPTY as of 2026-10-03 — the user's
// call. The seven letters (M O H B T G C) were a stopgap from before the Pause
// panel could unequip by click; with that panel and the Character screen both
// doing it by click, a letter per slot was seven bindings to learn for nothing,
// and two of the slots (feet, gloves) have no items in the game at all. The
// table is kept rather than deleted so the Controls screen's reader and a
// future rebind UI need no change: an empty map prints no section.
const DEFAULT_EQUIP_SLOT_KEYS = {}

function cloneActions(actions) {
    const out = {}
    for (const id in actions) out[id] = [...actions[id]]
    return out
}

class InputMap {
    constructor() {
        this.resetDefaults()
        this._loadSaved()
    }

    // Apply the player's saved keybind overrides (from Account/localStorage) over
    // the defaults. Safe everywhere — Account.load() returns null if localStorage
    // is unavailable, leaving defaults intact.
    _loadSaved() {
        try {
            const cfg = prefs.getPreferences().keybinds
            if (cfg) this.applyConfig(cfg)
        } catch (e) {
            // localStorage unavailable (private mode / headless) — keep defaults.
        }
    }

    // Persist the current bindings as the player's override. Called by the
    // Controls screen after each rebind.
    persist() {
        try {
            prefs.setPreference('keybinds', this.toConfig())
        } catch (e) { /* ignore — see _loadSaved */ }
    }

    // Drop the saved override (the Controls "Reset to defaults" path).
    clearSaved() {
        try {
            prefs.setPreference('keybinds', null)
        } catch (e) { /* ignore */ }
    }

    resetDefaults() {
        this.abilitySlotKeys = [...DEFAULT_ABILITY_SLOT_KEYS]
        this.movement = { ...DEFAULT_MOVEMENT }
        this.actions = cloneActions(DEFAULT_ACTIONS)
        this.equipSlotKeys = { ...DEFAULT_EQUIP_SLOT_KEYS }
        this._rebuildIndex()
    }

    _rebuildIndex() {
        this._actionByToken = new Map()
        for (const id in this.actions) {
            for (const token of this.actions[id]) this._actionByToken.set(token, id)
        }
        this._slotByToken = new Map()
        this.abilitySlotKeys.forEach((token, i) => this._slotByToken.set(token, i))
    }

    // --- display -------------------------------------------------------------

    // Printable label for an action's primary key: 'interact' -> 'F'. Every UI
    // string that names a key should read this rather than hardcode a letter.
    //
    // It exists because they didn't: the interact prompts on containers, doors
    // and hidden passages all read "[E] ..." long after interact moved to F, and
    // nothing caught it because the string and the binding had no connection.
    // Rebinding through the Controls UI had the same problem in waiting.
    //
    // Single characters uppercase; named keys ('Space', 'ArrowUp') pass through.
    keyLabel(action) {
        const token = this.actions[action]?.[0]
        if (!token) return '?'
        return token.length === 1 ? token.toUpperCase() : token
    }

    // Same thing for an ability-bar slot index, including the ultimate slot.
    slotLabel(index) {
        const token = this.abilitySlotKeys[index]
        return token ? (token.length === 1 ? token.toUpperCase() : token) : '?'
    }

    // --- resolvers (the hot path) --------------------------------------------

    // The discrete action bound to this event ('interact'|'retreat'|'passTurn'),
    // or null.
    actionForEvent(event) {
        const t = tokenFor(event)
        return t ? (this._actionByToken.get(t) ?? null) : null
    }

    // Ability-bar slot index for this event, or -1. Shared by the normal dispatch
    // AND the channel toggle so the two never drift apart.
    abilitySlotForEvent(event) {
        const t = tokenFor(event)
        if (t == null) return -1
        const i = this._slotByToken.get(t)
        return i === undefined ? -1 : i
    }

    // Movement step {dx,dy} for this event, or null.
    directionForEvent(event) {
        const t = tokenFor(event)
        return t ? (this.movement[t] ?? null) : null
    }

    // The bar's LAST slot is the Ultimate slot (default key R). The HUD uses this
    // to mark it; the loadout UI uses it to restrict the slot to tier:'ultimate'.
    get ultimateSlotIndex() {
        return this.abilitySlotKeys.length - 1
    }

    // --- mutators (for the future Settings "Controls" UI) --------------------
    // Rebinds re-resolve immediately. Conflict policy (one key, two actions) is
    // the UI's job; this layer is last-write-wins per the index rebuild.

    rebind(action, tokens) {
        if (!(action in this.actions)) return
        this.actions[action] = [...tokens]
        this._rebuildIndex()
    }

    rebindAbilitySlot(index, token) {
        if (index < 0 || index >= this.abilitySlotKeys.length) return
        this.abilitySlotKeys[index] = token
        this._rebuildIndex()
    }

    // --- persistence seam ----------------------------------------------------
    // Account (localStorage) will call these to save/restore a player's overrides.
    // Unused in this slice; defaults are authoritative until the Controls UI lands.

    toConfig() {
        return {
            actions: cloneActions(this.actions),
            abilitySlotKeys: [...this.abilitySlotKeys],
            movement: { ...this.movement },
        }
    }

    applyConfig(cfg) {
        if (!cfg) return
        if (cfg.actions) this.actions = { ...this.actions, ...cloneActions(cfg.actions) }
        if (Array.isArray(cfg.abilitySlotKeys)) this.abilitySlotKeys = [...cfg.abilitySlotKeys]
        if (cfg.movement) this.movement = { ...this.movement, ...cfg.movement }
        this._rebuildIndex()
    }
}

export default new InputMap()
