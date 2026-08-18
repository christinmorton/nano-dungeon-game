// Training-bench console helpers — exposed as `window.training` on the arena
// page (see arenaMain.js) so abilities, enemies, and the dummy can be driven by
// hand while walking the A->Z ability pass. Game-only/debug; not imported by the
// real game (index.html).
//
// The HUD has 5 fixed ability slots and its refresh() reads hero.abilities live
// every tick, so reassigning hero.abilities here updates the castable bar with
// no extra refresh call. Anything past the 5th is held on the array but isn't
// hotkeyed — hence BAR_SIZE.

import dungeon from "./Dungeon.js"
import tm from "./TurnManager.js"
import mapState from "./MapState.js"
import gameLog from "./GameLog.js"
import run from "./Run.js"
import inputMap from "./InputMap.js"
import {
    abilitiesAlphabetical,
    randomAbility,
    makeAbility,
    ALL_ABILITIES,
} from "./classes/abilities/abilityRegistry.js"
import { spawnEnemyByName, ENEMY_NAMES } from "./enemies/enemyRegistry.js"
import TrainingDummy from "./enemies/TrainingDummy.js"
import { makeItem } from "./items/itemProfiles.js"
import { affinityFor, AFFINITY_KEYS, BASIC_AFFINITY_KEYS } from "./abilities/affinities.js"
import { affinityPathsFor, affinityPathDef } from "./abilities/affinityPaths.js"
import { convertToAlly } from "./companions/allegiance.js"
import { BEAST_KEYS } from "../data/cosmicBeings.js"
import PactGiver from "./components/PactGiver.js"
import EssenceFont from "./components/EssenceFont.js"
import Shrine from "./items/Shrine.js"

// Bar size + hotkeys come from the central keymap (InputMap), so the bench
// matches the live HUD — including the Ultimate slot (the last key, default R).
const BAR_SIZE = inputMap.abilitySlotKeys.length
// slot i casts with HOTKEYS[i]. Shown in the load log so the keybind for each
// loaded ability is explicit.
const HOTKEYS = inputMap.abilitySlotKeys.map(k => k.toUpperCase())

function hero() {
    const h = dungeon.player
    if (!h) gameLog.log("Training: no hero in the world yet.")
    return h
}

// Set the hero's ability bar. Accepts ability display names/keys (strings) or
// registry metadata objects; caps at the 5 HUD slots.
export function loadAbilities(list) {
    const h = hero()
    if (!h) return null
    const items = (Array.isArray(list) ? list : [list]).slice(0, BAR_SIZE)
    const instances = items
        .map(it => (typeof it === "string" ? makeAbility(it, h) : (it?.Ability ? new it.Ability(h) : null)))
        .filter(Boolean)
    h.abilities = instances
    const bar = instances.map((a, i) => `${HOTKEYS[i]}:${a.name}`).join(", ") || "empty"
    gameLog.log(`Training: bar = [${bar}]`)
    return instances
}

// Load a page of the alphabetical list onto the bar — pageAbilities(0) is A..,
// pageAbilities(1) the next 5, and so on. Walks the whole catalog 5 at a time.
export function pageAbilities(page = 0) {
    const all = abilitiesAlphabetical()
    const pages = Math.max(1, Math.ceil(all.length / BAR_SIZE))
    const p = ((page % pages) + pages) % pages          // wrap, support negatives
    const slice = all.slice(p * BAR_SIZE, p * BAR_SIZE + BAR_SIZE)
    loadAbilities(slice)
    gameLog.log(`Training: page ${p + 1}/${pages} (${all.length} abilities total)`)
    return slice
}

// Fill the bar with up to n distinct random abilities.
export function randomBar(n = BAR_SIZE) {
    const picks = []
    const seen = new Set()
    let guard = 0
    while (picks.length < Math.min(n, BAR_SIZE) && guard++ < 200) {
        const meta = randomAbility()
        if (meta && !seen.has(meta.key)) { seen.add(meta.key); picks.push(meta) }
    }
    return loadAbilities(picks)
}

// Find the active training dummy in the world, if any. tm.entities is a Set
// (iterable, no .find), so walk it directly.
function findDummy() {
    for (const e of tm.entities) {
        if (e instanceof TrainingDummy) return e
    }
    return null
}

// Is any entity standing on (x, y)? Scans the Set since there's no index here.
function tileOccupied(x, y) {
    for (const e of tm.entities) {
        if (e.x === x && e.y === y) return true
    }
    return false
}

// Restore the dummy to full HP (clears the damage tally; status tags persist
// until they expire so you can still watch DoTs play out).
export function resetDummy() {
    const d = findDummy()
    if (!d) { gameLog.log("Training: no dummy found."); return null }
    d.resetHealth()
    gameLog.log(`Training: dummy reset to ${d.maxHealthPoints} HP.`)
    return d
}

// Find a free tile near (cx, cy), spiralling outward, for placing a spawn.
function findFreeTileNear(cx, cy) {
    let walkableFallback = null
    for (let r = 1; r <= 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                const x = cx + dx, y = cy + dy
                if (!mapState.isWalkableTile(x, y)) continue
                if (!tileOccupied(x, y)) return { x, y }          // prefer a free tile
                if (!walkableFallback) walkableFallback = { x, y } // else any walkable
            }
        }
    }
    return walkableFallback || { x: cx, y: cy }
}

// Spawn a specific enemy by class name (see window.training.enemies for the
// list) near the dummy, or near the hero if there's no dummy. Optional explicit
// (x, y) overrides placement.
export function spawnEnemy(name, x, y) {
    const anchor = findDummy() || hero()
    if (!anchor && (x == null || y == null)) { gameLog.log("Training: nothing to anchor a spawn to."); return null }
    let tx = x, ty = y
    if (tx == null || ty == null) {
        const tile = findFreeTileNear(anchor.x, anchor.y)
        tx = tile.x; ty = tile.y
    }
    const enemy = spawnEnemyByName(name, tx, ty)
    if (!enemy) {
        gameLog.log(`Training: unknown enemy "${name}". See window.training.enemies.`)
        return null
    }
    gameLog.log(`Training: spawned ${enemy.name} at (${tx}, ${ty}).`)
    return enemy
}

// Spawn an enemy (any name, incl. cosmic beings) already flipped to YOUR team, so
// it stands with you instead of one-shotting you — for inspecting the apex beings
// and as pact-testing groundwork (a pact's "aligned" end-state = convertToAlly).
export function spawnAlly(name, x, y) {
    const enemy = spawnEnemy(name, x, y)
    if (!enemy) return null
    convertToAlly(enemy, hero())
    gameLog.log(`Training: ${enemy.name} joined you as an ally.`)
    return enemy
}

// --- Pacts (§17) ------------------------------------------------------------
// Two entry vectors, both in-world (interact F → hear offer → interact again → accept).

// MODEL A — the cosmic being bargains DIRECTLY. Spawns it NEUTRAL (stands peacefully,
// isHostile excludes neutral) with its offer armed. Accepting flips IT to your side.
export function spawnPactBeing(name) {
    const being = spawnEnemy(name)
    if (!being) return null
    if (!being.pactAffinity) {
        gameLog.log(`Training: ${being.name} has no pact to offer (mythical/elemental beings don't).`)
        return being
    }
    being.team = "neutral"        // peaceful until dealt with (or the pact is broken)
    being.pactOfferer = true      // unlocks the offer (a plain hostile enemy won't)
    gameLog.log(`Training: ${being.name} waits, neutral — step beside it and interact (F) to hear its offer.`)
    return being
}

// Spawn a MYTHICAL BEAST as a neutral BOON offerer (the empowered-basics vector) — F
// to receive its blessing, Y to accept (empowered basic affinity + it joins as a
// friendly guardian). Pass a beast key (e.g. "FirstWeaver"); see training.beasts.
export function spawnBoonBeast(name) {
    const being = spawnEnemy(name)
    if (!being) return null
    if (!being.boonAffinity) {
        gameLog.log(`Training: ${being.name} has no boon to offer (only mythical beasts do).`)
        return being
    }
    being.team = "neutral"        // a friendly guardian, peaceful until dealt with
    being.boonOfferer = true      // unlocks the blessing (a plain hostile enemy won't)
    gameLog.log(`Training: ${being.name} waits, neutral — F to receive its EMPOWERED ${affinityFor(being.boonAffinity)?.label} blessing.`)
    return being
}

// MODEL B — a neutral BROKER NPC offers on a being's behalf (the Whispering Pact).
// Accepting spawns the bound being as your ally; the broker never fights.
export function spawnPactGiver(name) {
    const h = hero()
    if (!h) return null
    const tile = findFreeTileNear(h.x, h.y)
    const giver = new PactGiver(tile.x, tile.y, { beingKey: name })
    if (!giver.pactAffinity) {
        gameLog.log(`Training: no pactable being "${name}" (mythical/elemental beings don't offer).`)
        return null
    }
    tm.addEntity(giver)
    gameLog.log(`Training: a Pact Emissary offers a ${giver.pactAffinity} pact (binds ${name}) — step beside it and interact (F).`)
    return giver
}

// Inspect the follower roster — the ACTIVE party vs the reserve bench (cosmic
// followers benched by the one-god cap). `[god]` marks a cosmic follower.
export function roster() {
    const h = hero()
    if (!h) return null
    const nm = a => `${a.name}${a.cosmicKind != null ? " [god]" : ""}`
    const active = (h.party || []).map(nm)
    const bench = (h.followerBench || []).map(nm)
    console.log("%cRoster", "font-weight:bold", { active, bench })
    gameLog.log(`Party: ${active.join(", ") || "(none)"} · Reserve: ${bench.join(", ") || "(none)"}.`)
    return { active, bench }
}

// Beckon a benched follower into play (previews the step-2 keybind). If the incoming
// is a cosmic follower it SWAPS — benches the active god first to respect the cap.
// Omit `name` for the first follower in reserve.
export function beckon(name) {
    const h = hero()
    if (!h) return null
    // Space/case-insensitive match so "FirstWeaver" (the key) finds "The First Weaver"
    // (the display name).
    const norm = s => String(s ?? "").replace(/\s+/g, "").toLowerCase()
    const matches = a => !name || norm(a.name).includes(norm(name))
    const bench = h.followerBench || []
    if (!bench.length) {
        // Distinguish "already active" from "nothing owned" so a beckon of the active
        // god explains itself instead of silently returning null.
        const active = (h.party || []).find(matches)
        gameLog.log(active
            ? `Training: ${active.name} is already active — reserve is empty.`
            : `Training: no follower in reserve.`)
        return roster()
    }
    const target = name ? bench.find(matches) : bench[0]
    if (!target) {
        const active = (h.party || []).find(matches)
        gameLog.log(active
            ? `Training: ${active.name} is already active (not in reserve).`
            : `Training: no reserved follower matching "${name}". Reserve: ${bench.map(a => a.name).join(", ")}.`)
        return roster()
    }
    if (target.cosmicKind != null) {
        const activeCosmic = (h.party || []).find(a => a.cosmicKind != null)
        if (activeCosmic) dungeon.benchFollower(activeCosmic)
    }
    dungeon.activateFollower(target)
    gameLog.log(`Training: Beckoned ${target.name}.`)
    return roster()
}

// Break the hero's active pact the RAW way — the pact-bound being turns hostile
// and hunts you, and you take the Forsaken mark.
export function breakPact() {
    const h = hero()
    if (!h) return null
    const r = h.breakPact?.()
    if (!r?.ok) gameLog.log(`Training: no pact to break${r?.reason ? ` (${r.reason})` : ""}.`)
    return r
}

// Place a Shrine beside the hero — to test the clean pact DISSOLVE (step up, F to
// offer, Y to dissolve for coins / N to keep + pray) and curse cleansing.
export function spawnShrine() {
    const h = hero()
    if (!h) return null
    const tile = findFreeTileNear(h.x, h.y)
    const shrine = new Shrine(tile.x, tile.y)
    tm.addEntity(shrine)
    gameLog.log(`Training: a Shrine appears — F to pray; with a pact held, F then Y/N to dissolve it.`)
    return shrine
}

// Spawn an Essence Font (basic-affinity acquisition vector) next to the hero — F to
// attune to its element. Pass a basic affinity key (e.g. "fire"); omit for a random
// basic. See training.affinities for the key list; advanced affinities have no font.
export function spawnEssenceFont(key) {
    const h = hero()
    if (!h) return null
    const affinityKey = BASIC_AFFINITY_KEYS.includes(key)
        ? key
        : BASIC_AFFINITY_KEYS[Math.floor(Math.random() * BASIC_AFFINITY_KEYS.length)]
    const tile = findFreeTileNear(h.x, h.y)
    const font = new EssenceFont(tile.x, tile.y, affinityKey)
    tm.addEntity(font)
    gameLog.log(`Training: a Font of ${affinityFor(affinityKey)?.label} appears — F to attune.`)
    return font
}

// Grant affinity shards (for testing the affinity upgrade tree — Skillbook K,
// Affinity tab). Normally earned by wielding your element + kills.
export function giveShards(n = 20) {
    run.awardAffinityShards(n)
    gameLog.log(`Training: +${n} affinity shards (now ${run.affinityShards}). Spend in Skillbook [K] → Affinity.`)
    return run.affinityShards
}

// Grant coins (for testing the paid Shrine dissolve / curse cleanse).
export function giveCoins(n = 50) {
    const h = hero()
    if (!h) return null
    if (!h.tallies) h.tallies = {}
    h.tallies.coins = (h.tallies.coins || 0) + n
    gameLog.log(`Training: +${n} coins (now ${h.tallies.coins}).`)
    return h.tallies.coins
}

// Console-friendly listings.
export function listAbilities() {
    const names = abilitiesAlphabetical().map(a => a.name)
    console.log(`%c${names.length} abilities (A->Z):`, "font-weight:bold", names.join(", "))
    console.log("%cLoad up to 5 onto the bar:", "font-weight:bold",
        `training.loadAbilities("Bull Rush")  ·  training.loadAbilities(["Acid Spray", "Bull Rush"])`)
    return names
}

// Equip a weapon by profile name onto the hero's mainhand — for testing
// weapon-delegated abilities (Bash, Cleave) with a known weapon, and for seeing
// its weaponCategory. e.g. giveWeapon("mace") (blunt) vs giveWeapon("sword")
// (blade). NOTE: the weaponCategory gate is bypassed on the bench (like the
// class/stat gates), so Bash fires regardless of category here — the gate
// enforces blunt-only in the real game. This helper is for damage + inspection.
export function giveWeapon(name) {
    const h = hero()
    if (!h) return null
    let item
    try {
        item = makeItem(name, h.x, h.y)
    } catch {
        gameLog.log(`Training: unknown item profile "${name}".`)
        return null
    }
    h.inventory.items.push(item)
    h.inventory.equipFromCarry(item)
    gameLog.log(`Training: equipped ${item.name} — weaponCategory ${item.weaponCategory ?? "—"}.`)
    return item
}

// Drop an item into the hero's CARRY (without equipping) — for testing the
// throwing style's empower-on-pickup: carrying e.g. "venomfangKnives" empowers
// Throw Knives (equipping would take it out of carry). e.g.
// giveItem("balancedSteelKnives") then cast Throw Knives and watch the bonus.
export function giveItem(name) {
    const h = hero()
    if (!h) return null
    let item
    try {
        item = makeItem(name, h.x, h.y)
    } catch {
        gameLog.log(`Training: unknown item profile "${name}".`)
        return null
    }
    h.inventory.items.push(item)
    const empower = item.throwEmpower ?? item.profile?.throwEmpower
    gameLog.log(`Training: carried ${item.name}${empower ? ` — empowers ${empower.ability}` : ""}.`)
    return item
}

// --- Ability progression (drive the level/augment/trait system by hand) -------
// `which` is a bar slot index (0-4) or an ability display name ("Acid Spray").

function findAbility(which) {
    const h = hero()
    if (!h) return null
    const bar = h.abilities || []
    if (typeof which === "number") return bar[which] || null
    const lc = String(which).toLowerCase()
    return bar.find(a => a.name.toLowerCase() === lc) || null
}

// Level an ability up by one, or to an explicit level: levelAbility("Acid Spray", 3).
export function levelAbility(which, n) {
    const a = findAbility(which)
    if (!a) { gameLog.log(`Training: no ability "${which}" on the bar.`); return null }
    if (n == null) a.levelUp(); else a.levelTo(n)
    gameLog.log(`Training: ${a.name} -> level ${a.level}/${a.maxLevel}.`)
    dungeon.player?.hud?.refresh()
    return a
}

// Choose a mutually-exclusive augment branch (call with no key to list options).
export function augmentAbility(which, key) {
    const a = findAbility(which)
    if (!a) { gameLog.log(`Training: no ability "${which}" on the bar.`); return null }
    const keys = Object.keys(a.augments)
    if (!key) { gameLog.log(`Training: ${a.name} augments: ${keys.join(", ") || "none"} (unlock L${a.augmentLevel}).`); return a }
    const ok = a.chooseAugment(key)
    gameLog.log(ok
        ? `Training: ${a.name} augment = ${key} (${a.augments[key].label}).`
        : `Training: can't choose "${key}" — needs level ${a.augmentLevel} (has ${a.level}). Options: ${keys.join(", ")}`)
    return a
}

// Slot an additive trait (call with no key to list options + slot usage).
export function traitAbility(which, key) {
    const a = findAbility(which)
    if (!a) { gameLog.log(`Training: no ability "${which}" on the bar.`); return null }
    const keys = Object.keys(a.traits)
    if (!key) { gameLog.log(`Training: ${a.name} traits: ${keys.join(", ") || "none"} — slots ${a.equippedTraits.length}/${a.maxTraits} (unlock L${a.traitLevel}).`); return a }
    const ok = a.equipTrait(key)
    gameLog.log(ok
        ? `Training: ${a.name} equipped "${key}". Slots ${a.equippedTraits.length}/${a.maxTraits}.`
        : `Training: can't equip "${key}" — needs level ${a.traitLevel}, slots ${a.equippedTraits.length}/${a.maxTraits}. Options: ${keys.join(", ")}`)
    return a
}

export function untraitAbility(which, key) {
    const a = findAbility(which)
    if (!a) { gameLog.log(`Training: no ability "${which}" on the bar.`); return null }
    a.unequipTrait(key)
    gameLog.log(`Training: ${a.name} traits now [${a.equippedTraits.join(", ") || "none"}].`)
    return a
}

// Reset an ability to pristine level 1 (no augment, no traits).
export function resetAbility(which) {
    const a = findAbility(which)
    if (!a) { gameLog.log(`Training: no ability "${which}" on the bar.`); return null }
    a.level = 1
    a.chosenAugment = null
    a.equippedTraits = []
    a.rebuild()
    gameLog.log(`Training: ${a.name} reset to level 1.`)
    return a
}

// Dump an ability's live progression state + resolved fields to the console.
// Prefers the live instance on the bar; if it isn't loaded, falls back to a fresh
// registry instance so ANY ability can be inspected by name without loading it
// (its progression / _cast state will just be defaults). Warns to the CONSOLE —
// not the in-game log — when the name is unknown, so the caller sees why.
export function abilityInfo(which) {
    let a = findAbility(which)
    const onBar = !!a
    if (!a && typeof which !== "number") a = makeAbility(which, hero())
    if (!a) {
        console.warn(`Training: "${which}" isn't on the bar or in the registry. Run training.listAbilities() — if it's missing there, restart the dev server so the glob re-scans the new file.`)
        return null
    }
    const info = {
        name: a.name,
        onBar,                                   // false = a fresh probe, not your live bar instance
        level: `${a.level}/${a.maxLevel}`,
        augment: a.chosenAugment || "(none)",
        traits: a.equippedTraits.length ? a.equippedTraits : "(none)",
        augmentsAvailable: Object.keys(a.augments),
        traitsAvailable: Object.keys(a.traits),
        shape: a.shape,
        impactDamage: [a.damageMin, a.damageMax],
        fxColor: a.fxColor != null ? "0x" + a.fxColor.toString(16) : null,
    }
    if (a.requiresWeaponCategory) {
        info.requiresWeaponCategory = a.requiresWeaponCategory
        info.currentWeaponCategory = dungeon.player?.currentWeapon?.()?.weaponCategory ?? "(none)"
    }
    if (a.damageMult != null) info.damageMult = a.damageMult
    if (a.arcs != null) info.chain = { arcs: a.arcs, radius: a.chainRadius, falloff: a.arcFalloff }
    if (a.stunChance != null) info.stunChance = a.stunChance
    if (a.knockbackTiles) info.knockbackTiles = a.knockbackTiles
    if (a.bonusDamage) info.bonusDamage = a.bonusDamage
    if (a.dotDamageMin != null) {
        info.dot = { perStack: [a.dotDamageMin, a.dotDamageMax], turns: a.dotTurns, maxStacks: a.dotMaxStacks }
    }
    // Charged-cast (windup->fire->ending) abilities — Arcane Beam et al. Surface
    // the lifecycle knobs + live phase state so they can be tuned on the bench.
    if (a.windupMs != null) {
        info.chargedCast = {
            windupMs: a.windupMs,
            fireMs: a.fireMs,
            endingMs: a.endingMs,
            maxOvercharge: a.maxOvercharge,
            overchargePower: a.overchargePower,
            overchargeWidth: a.overchargeWidth,
            phase: a._cast?.phase ?? "(idle)",
        }
    }
    if (a.requires && Object.keys(a.requires).length) info.requires = a.requires
    console.log(`%c${a.name}`, "font-weight:bold", info)
    return info
}

// Equip a PASSIVE on the hero by registry name (Bloodthirst, Thorns, Adrenaline,
// Momentum, Deflection, Toughness, ...). Passives aren't hotkeyed — this builds the
// subclass and calls apply() to attach its trait tag(s). Returns the instance.
export function givePassive(name) {
    const h = hero()
    if (!h) return null
    const p = makeAbility(name, h)
    if (!p) { gameLog.log(`Training: unknown passive "${name}". See training.abilities.`); return null }
    if (!p.passive) { gameLog.log(`Training: "${name}" is an active ability — use loadAbilities().`); return null }
    p.apply()
    return p
}

// --- Affinity system (§18) --------------------------------------------------
// Drive the two-slot affinity system by hand on the bench. The game-screen
// `window.grantAffinity` global (World.js) isn't present on the arena page, so
// these wrap the BaseHero methods (grantAffinity / rollBasicPassive / forceCurse
// / restoreSuppressedBasic) with key validation + logging. Basic affinities go
// to the swappable slot AND roll a pool passive (mirroring the common-essence
// path); advanced ones bind to the second slot; curse is forced separately.

// Report the hero's current affinity state to the log + console.
export function affinityInfo() {
    const h = hero()
    if (!h) return null
    const basic = affinityFor(h.affinityBasic)
    const advanced = affinityFor(h.affinityAdvanced)
    const passiveName = p => p?.name || p?.constructor?.name || "(none)"
    const info = {
        basic: basic ? `${basic.label}${(h.affinityBasicTier || 0) > 0 ? " (empowered)" : ""}` : "(none)",
        basicPassive: passiveName(h._basicPassive),
        advanced: advanced ? advanced.label : "(none)",
        advancedPassive: passiveName(h._advancedPassive),
        suppressedBasic: h._suppressedBasic ? (affinityFor(h._suppressedBasic.key)?.label || "(none)") : "(none)",
    }
    console.log("%cAffinity", "font-weight:bold", info)
    gameLog.log(`Affinity: basic ${info.basic} (${info.basicPassive}) / advanced ${info.advanced} (${info.advancedPassive}).`)
    return info
}

// Grant an affinity by key. Basic (or a same-element reroll) also rolls a pool
// passive, mirroring the common-essence path; advanced binds the fixed base
// passive. Unknown/blocked keys log why (advanced won't displace a held pact).
// Keys: physical fire frost poison acid lightning earth wind arcane (basic);
//       curse light void holy seraphic demonic (advanced — use forceCurse for curse).
export function grantAffinity(key, empowered = false) {
    const h = hero()
    if (!h) return null
    const aff = affinityFor(key)
    if (!aff) {
        gameLog.log(`Training: unknown affinity "${key}". Keys: ${AFFINITY_KEYS.join(", ")}.`)
        return null
    }
    // `empowered` (2nd arg, basic only) grants the stronger tier-1 version — bigger
    // bonus + stat payload. NOTE: the bench rolls a RANDOM pool passive (below); the
    // empowered PICK-1-of-3 draft is exercised via the beast/font path, not here.
    const r = h.grantAffinity(key, { empowered })
    if (!r?.ok) {
        gameLog.log(`Training: can't grant ${aff.label} — ${r?.reason || "failed"}.`)
        return r
    }
    if (h.affinityBasic === key) h.rollBasicPassive?.()   // mirror the essence path
    return affinityInfo()
}

// Reroll the basic slot's pool passive (see the pool's other options).
export function rollAffinityPassive() {
    const h = hero()
    if (!h) return null
    if (!h.affinityBasic) { gameLog.log("Training: no basic affinity — grant one first."); return null }
    h.rollBasicPassive()
    return affinityInfo()
}

// Invest an affinity shard rank into one of the current affinity's empowerment PATHS
// (§19) — the affinity upgrade-tree fork. Pass a path key (seraphic: "ascendance" /
// "twilight" / "veil"); resolves the owning affinity from whichever attuned slot has
// that path. Bypasses the shard cost (bench convenience) — use spendShards for economy.
export function investPath(pathKey) {
    const h = hero()
    if (!h) return null
    for (const key of [h.affinityAdvanced, h.affinityBasic]) {
        if (affinityPathDef(key, pathKey)) {
            const r = h.investAffinityPath(key, pathKey)
            gameLog.log(`Training: ${r.ok ? `${r.reason} ${r.name} (rank ${r.rank})` : `path refused — ${r.reason}`}.`)
            return r
        }
    }
    gameLog.log(`Training: no attuned affinity offers path "${pathKey}". Grant seraphic first (grantAffinity("seraphic")).`)
    return null
}

// Force the Curse advanced affinity — the parasitic attunement that SUPPRESSES
// the basic slot (mirrors a Cursed Gem pickup). Refused if a real pact already
// holds the advanced slot. Undo with cleanseCurse().
export function forceCurse() {
    const h = hero()
    if (!h) return null
    const r = h.forceCurse()
    if (!r?.ok) gameLog.log(`Training: forceCurse refused — ${r?.reason || "failed"}.`)
    return affinityInfo()
}

// The Shrine-cleanse path: strip the Curse affinity and restore the suppressed
// basic (+ its exact stashed passive). No-op if not cursed.
export function cleanseCurse() {
    const h = hero()
    if (!h) return null
    h.restoreSuppressedBasic()
    return affinityInfo()
}

// Mark a tile as a sturdy (impassable to Breach & Dig) story wall, to test the
// phasing abilities' refusal. Pass tile coords; with no args, marks the tile just
// in front of (east of) the hero. Returns the marked tile.
export function markSturdyWall(x, y) {
    const hero = dungeon.player
    if (x == null || y == null) { x = (hero?.x ?? 0) + 1; y = hero?.y ?? 0 }
    mapState.markSturdyWall(x, y)
    gameLog.log(`Training: marked sturdy wall at ${x},${y} (Breach/Dig can't pass).`)
    return { x, y }
}

// The `window.training` surface.
const training = {
    loadAbilities,
    pageAbilities,
    randomBar,
    spawnEnemy,
    spawnAlly,
    spawnPactBeing,
    spawnPactGiver,
    spawnBoonBeast,
    roster,
    beckon,
    breakPact,
    spawnShrine,
    spawnEssenceFont,
    giveShards,
    giveCoins,
    resetDummy,
    listAbilities,
    giveWeapon,
    giveItem,
    givePassive,
    markSturdyWall,
    // Affinity system (two-slot attunement — grant / roll passive / curse).
    grantAffinity,
    rollAffinityPassive,
    investPath,
    forceCurse,
    cleanseCurse,
    affinityInfo,
    // Ability progression (level / augment / trait authoring + inspection).
    levelAbility,
    augmentAbility,
    traitAbility,
    untraitAbility,
    resetAbility,
    abilityInfo,
    abilities: ALL_ABILITIES,   // raw registry list (metadata objects)
    enemies: ENEMY_NAMES,       // spawnable enemy class names
    beasts: BEAST_KEYS,         // mythical beasts that offer an empowered-basic boon
}

export default training
