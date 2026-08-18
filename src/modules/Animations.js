import dungeon from './Dungeon.js'
import mapState from './MapState.js'
import { statusesOnEntity } from './tags/Status.js'
import { resolveArt } from './assetLoader.js'
import { shapeOffsets } from './abilities/shapes.js'

// Size of the swung melee weapon sprite relative to a tile. 32rogues weapons
// fill their 32px frame, so < 1 keeps the swing from reading oversized.
const SWING_ART_SCALE = 0.75

// Preset configurations for cast-animation visuals. Each preset maps a
// semantic spell type to (tile, tint) — callers pass `type` and the
// animation system picks the visual. These are placeholder choices using
// kenney effect tiles + tints; the "special effect" payoff visuals will
// land later and may replace these.
const CAST_PRESETS = {
    arcane: { tile: 575, tint: 0xa78bfa }, // burstingBubbles, purple
    fire:   { tile: 505, tint: 0xff6633 }, // flame, orange
    frost:  { tile: 574, tint: 0x6ab8ff }, // bubbles, blue
    heal:   { tile: 574, tint: 0x4ade80 }  // bubbles, green
}

// Shared utility: resolve scene + map + tileSize from the dungeon
// singleton and bail with a callback fallback if the world isn't ready.
// All animation primitives need this; centralizes the defensive check.
function getSceneContext(onComplete) {
    const scene = dungeon.scene
    const map = mapState.map
    const tileSize = mapState.tileSize
    if (!scene || !map) {
        if (onComplete) onComplete()
        return null
    }
    return { scene, map, tileSize }
}

/**
 * Play a charging / cast animation at the caster's tile.
 *
 * The visual is a scale + alpha pulse: an orb grows + fades up at the
 * caster's position, then shrinks + fades out. ~`duration * 2`ms total
 * because of yoyo. If `onComplete` is provided, it fires after the
 * pulse finishes — useful for sequencing cast → spell-effect (projectile
 * fire, teleport snap, etc.). Without `onComplete`, the animation is
 * purely cosmetic and runs in parallel with whatever the caller does.
 *
 * @param caster Entity with `x`, `y` tile coords (typically the player).
 * @param options.type One of CAST_PRESETS keys. Default 'arcane'.
 * @param options.duration One-way tween length in ms. Default 200.
 * @param options.onComplete Optional callback fired after the pulse ends.
 */
export function playCast(caster, options = {}) {
    const { type = 'arcane', duration = 200, delay = 0, onComplete, tint } = options
    const preset = CAST_PRESETS[type] || CAST_PRESETS.arcane

    const ctx = getSceneContext(onComplete)
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(caster.x) + tileSize / 2
    const y = map.tileToWorldY(caster.y) + tileSize / 2

    const sprite = scene.add.sprite(x, y, 'tiles', preset.tile)
        .setOrigin(0.5)
        .setScale(0.3)
        .setAlpha(0)
        .setDepth(20) // above weapon swings (15) and entity sprites (10)

    // `tint` overrides the preset color so an ability can match its cast pulse
    // to its damage flavor (e.g. Acid Spray conjures green, not arcane purple).
    sprite.tint = tint ?? preset.tint
    sprite.tintFill = true

    scene.tweens.add({
        targets: sprite,
        scale: 1.4,
        alpha: { from: 0, to: 1 },
        duration,
        delay,
        ease: 'Power2',
        yoyo: true,
        onComplete: () => {
            sprite.destroy()
            if (onComplete) onComplete()
        }
    })
}

/**
 * Spawn a floating text label that rises and fades above a target tile.
 * Underlying primitive used by spawnDamageNumber / spawnHealNumber /
 * spawnBuffNumber. Color is a CSS color string.
 */
export function spawnFloatingNumber(target, label, color) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const worldX = map.tileToWorldX(target.x) + tileSize / 2
    const worldY = map.tileToWorldY(target.y)

    const text = scene.add.text(worldX, worldY, label, {
        font: 'bold 14px Arial',
        color,
        stroke: '#000000',
        strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(1000)

    scene.tweens.add({
        targets: text,
        y: worldY - 24,
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => text.destroy()
    })
}

/**
 * Damage feedback above the victim. Color comes from weapon.damageColor
 * if set (so different weapons / spells can have distinct damage tints),
 * otherwise white.
 */
export function spawnDamageNumber(target, amount, weapon) {
    const color = '#' + ((weapon && weapon.damageColor) || 0xffffff).toString(16).padStart(6, '0')
    spawnFloatingNumber(target, String(amount), color)
}

/** Healing feedback above the target — green "+Nhp". */
export function spawnHealNumber(target, amount) {
    spawnFloatingNumber(target, `+${amount}hp`, '#4ade80')
}

// --- Camp emotes -----------------------------------------------------------
// A small cycling emoji above each resting unit while camp is up — the party
// gathered around the flame (sleeping, singing, eating, laughing…). Purely cosmetic
// and on the scene clock, so it keeps playing while the world sits idle during a
// rest. Re-reads each unit's tile every cycle (a follower may drift a little).
// Returns a handle; call handle.stop() on break camp to tear it all down.
const CAMP_EMOTES = ['\u{1F4A4}', '\u{1F3B5}', '\u{1F356}', '\u{1F600}', '\u{1F60C}', '\u{1F525}']

export function startCampEmotes(units) {
    const ctx = getSceneContext()
    if (!ctx || !units || !units.length) return null
    const { scene, map, tileSize } = ctx
    const labels = new Map()
    const pick = () => CAMP_EMOTES[Math.floor(Math.random() * CAMP_EMOTES.length)]

    const cycle = () => {
        for (const unit of units) {
            if (!unit || unit.x == null) continue
            const x = map.tileToWorldX(unit.x) + tileSize / 2
            const y = map.tileToWorldY(unit.y) - 2
            let label = labels.get(unit)
            if (!label) {
                label = scene.add.text(x, y, '', { font: '16px Arial' }).setOrigin(0.5, 1).setDepth(25)
                labels.set(unit, label)
            }
            label.setText(pick())
            label.setPosition(x, y)
            label.setVisible(!!unit.sprite)
        }
    }
    cycle()
    const timer = scene.time.addEvent({ delay: 2200, loop: true, callback: cycle })

    return {
        stop() {
            if (timer) timer.remove(false)
            for (const label of labels.values()) label.destroy()
            labels.clear()
        },
    }
}

/** Buff feedback above the target — yellow "+N" (e.g. armor on equip). */
export function spawnBuffNumber(target, amount) {
    spawnFloatingNumber(target, `+${amount}`, '#facc15')
}

/** Attack outcome floats — miss / block / critical-hit damage. */
export function spawnMissNumber(target) {
    spawnFloatingNumber(target, 'Miss!', '#cfc6b8')
}

export function spawnBlockNumber(target) {
    spawnFloatingNumber(target, 'Block!', '#60a5fa')
}

export function spawnCriticalNumber(target, amount, weapon) {
    const color = '#' + ((weapon && weapon.damageColor) || 0xff6b6b).toString(16).padStart(6, '0')
    spawnFloatingNumber(target, `${amount}!`, color)
}

/**
 * Play a melee weapon-swing animation centered on the attacker.
 *
 * Spawns a transient sprite of `weapon.tile` at the attacker's tile,
 * anchored so its bottom-center pivots at the attacker's "hand"
 * position (~70% down the tile). Rotates through a 180° arc from
 * wind-up to follow-through, then yoyos back. Damage / block resolution
 * is the caller's responsibility via `onComplete` — the animation
 * function knows nothing about combat rules.
 *
 * @param attacker Entity with `x`, `y` tile coords.
 * @param victim Entity with `x`, `y` tile coords (defines swing direction).
 * @param weapon Item; uses `weapon.tile` for the sprite, `weapon.tint` if set.
 * @param options.onComplete Optional callback fired after the swing yoyos back.
 * @param options.delay Tween delay in ms (used to stagger parallel attackers).
 */
// Build the weapon sprite shared by melee animations — PNG art (32rogues) if
// available, else the Kenney tile. Origin (0.5, 1) = bottom-center, the "handle",
// so rotation pivots at the hand. Placed at (x, y); the caller animates it.
function buildWeaponSprite(scene, x, y, weapon, tileSize) {
    const swingArt = resolveArt(weapon.art)
    if (swingArt && scene.textures.exists(swingArt.key)) {
        const sprite = (swingArt.isImage
            ? scene.add.sprite(x, y, swingArt.key)
            : scene.add.sprite(x, y, swingArt.key, swingArt.frame))
            .setOrigin(0.5, 1)
            .setDepth(15)
        sprite.setScale((tileSize / swingArt.nativeSize) * SWING_ART_SCALE)
        if (weapon.tint) sprite.tint = weapon.tint
        return sprite
    }
    const sprite = scene.add.sprite(x, y, 'tiles', weapon.tile ?? 0)
        .setOrigin(0.5, 1)
        .setDepth(15)
    if (weapon.tint) {
        sprite.tint = weapon.tint
        sprite.tintFill = true
    }
    return sprite
}

export function playSwing(attacker, victim, weapon, options = {}) {
    const { onComplete, delay = 0 } = options

    const ctx = getSceneContext(onComplete)
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const attackerWorldX = map.tileToWorldX(attacker.x) + tileSize / 2
    // Pivot ~70% down the attacker tile so the swing pivots at hand/hip
    // height rather than chest height — reads as a held weapon.
    const attackerWorldY = map.tileToWorldY(attacker.y) + tileSize * 0.7
    const victimWorldX = map.tileToWorldX(victim.x) + tileSize / 2
    const victimWorldY = map.tileToWorldY(victim.y) + tileSize * 0.7

    // Fall back to tile 0 if the weapon has no sprite (e.g. the default
    // GenericItem on a basic enemy). Tile 0 is transparent so the swing
    // is invisible but damage still resolves.
    // Prefer the weapon's PNG art (32rogues item sprite) over the Kenney tile.
    // Origin (0.5, 1) puts the pivot at bottom-center — the "handle" — so
    // rotation sweeps the weapon's tip through an arc around the hand.
    // NOTE: the rotation below assumes a north-pointing sprite; 32rogues
    // weapons sit at a slight diagonal, so the swing aim may want a per-weapon
    // angle offset later if it reads wrong.
    const weaponSprite = buildWeaponSprite(scene, attackerWorldX, attackerWorldY, weapon, tileSize)

    // Weapon tiles in the kenney sheet point upward (north) by default.
    // To aim at the victim, rotate by attackAngle + 90°. The swing
    // sweeps ±90° around that aim — wind-up through follow-through.
    const attackAngle = Math.atan2(victimWorldY - attackerWorldY, victimWorldX - attackerWorldX)
    const aimRotation = attackAngle + Math.PI / 2
    weaponSprite.rotation = aimRotation - Math.PI / 2

    scene.tweens.add({
        targets: weaponSprite,
        rotation: aimRotation + Math.PI / 2,
        ease: 'Power2',
        hold: 20,
        duration: 140,
        delay,
        yoyo: true,
        onComplete: () => {
            weaponSprite.destroy()
            if (onComplete) onComplete()
        }
    })
}

/**
 * Overhead/overhand strike — raise the weapon high, then slam it DOWN onto the
 * target tile. The blunt-force counterpart to playSwing's horizontal sweep; used
 * by Bash (strikeStyle: 'overhead'). Same signature/contract as playSwing:
 * onComplete fires at the impact, so damage resolves on the slam.
 */
export function playOverheadStrike(attacker, victim, weapon, options = {}) {
    const { onComplete, delay = 0 } = options

    const ctx = getSceneContext(onComplete)
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const attackerWorldX = map.tileToWorldX(attacker.x) + tileSize / 2
    const attackerWorldY = map.tileToWorldY(attacker.y) + tileSize * 0.7
    const victimWorldX = map.tileToWorldX(victim.x) + tileSize / 2
    const victimWorldY = map.tileToWorldY(victim.y) + tileSize * 0.5

    const weaponSprite = buildWeaponSprite(scene, attackerWorldX, attackerWorldY, weapon, tileSize)

    // Aim the tip at the victim; start cocked back/up, away from the target.
    const attackAngle = Math.atan2(victimWorldY - attackerWorldY, victimWorldX - attackerWorldX)
    const aimRotation = attackAngle + Math.PI / 2
    weaponSprite.rotation = aimRotation - Math.PI * 0.85

    // Two beats: windup (lift up), then strike (drive down onto the victim,
    // rotating the tip through the aim and slightly past for a follow-through).
    scene.tweens.add({
        targets: weaponSprite,
        y: attackerWorldY - tileSize * 0.45,
        duration: 90,
        delay,
        ease: 'Quad.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: weaponSprite,
                rotation: aimRotation + Math.PI * 0.12,
                x: (attackerWorldX + victimWorldX) / 2,
                y: victimWorldY,
                duration: 110,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    playImpact(victim.x, victim.y, { color: weapon.tint || 0xffe6a8 })
                    weaponSprite.destroy()
                    if (onComplete) onComplete()
                }
            })
        }
    })
}

/**
 * Play a ranged-projectile animation from attacker to victim.
 *
 * Reads `weapon.attackTile` for the sprite frame, optional
 * `weapon.attackTexture` (defaults to "tiles") for non-tilesheet
 * assets, optional `weapon.attackScale` for sources that need to be
 * scaled to fit the in-world tile size, and optional
 * `weapon.attackAngle` for sprites that need pre-rotation. Tints with
 * `weapon.tint` unless an external texture is in use (those assets are
 * self-colored and tintFill would mask them).
 *
 * @param attacker Entity with `x`, `y` tile coords.
 * @param victim Entity with `x`, `y` tile coords.
 * @param weapon Item with `attackTile` set (orchestrator routes here only when so).
 * @param options.onComplete Optional callback fired after the projectile lands.
 * @param options.delay Tween delay in ms (used to stagger parallel attackers).
 */
export function playProjectile(attacker, victim, weapon, options = {}) {
    const { onComplete, delay = 0 } = options

    const ctx = getSceneContext(onComplete)
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const tint = weapon.tint && !weapon.attackTexture ? weapon.tint : false

    const stepX = Math.sign(victim.x - attacker.x)
    const stepY = Math.sign(victim.y - attacker.y)
    const x = map.tileToWorldX(attacker.x + stepX) + tileSize / 2
    const y = map.tileToWorldY(attacker.y + stepY) + tileSize / 2
    const texture = weapon.attackTexture || 'tiles'
    const sprite = scene.add.sprite(x, y, texture, weapon.attackTile).setOrigin(0.5)

    if (weapon.attackScale) {
        sprite.setScale(weapon.attackScale)
    }

    if (tint) {
        sprite.tint = tint
        sprite.tintFill = true
    }

    const targetX = map.tileToWorldX(victim.x) + tileSize / 2
    const targetY = map.tileToWorldY(victim.y) + tileSize / 2

    if (weapon.attackAngle !== undefined) {
        sprite.rotation = Math.atan2(targetY - y, targetX - x) - weapon.attackAngle
    }

    scene.tweens.add({
        targets: sprite,
        x: targetX,
        y: targetY,
        ease: 'Power2',
        hold: 20,
        duration: 180,
        delay,
        onComplete: () => {
            sprite.destroy()
            if (onComplete) onComplete()
        }
    })
}

// --- Combat-feel reactions (victim-side feedback on a landed hit) ---------
// These are cosmetic overlays fired the instant damage resolves; they never
// gate the turn loop. See documents/v3_animation_system.md.

const FLASH_WHITE = 0xffffff
const FLASH_RED = 0xff3b3b
const FLASH_DURATION = 120

// One flash beat: a transient duplicate of the victim's sprite, solid-tinted
// and faded out. Deliberately does NOT touch victim.sprite.tint/.alpha —
// status effects (Slow/Freeze/Petrify/Invisible/...) own those persistently,
// so writing them here would wipe a frozen enemy's tint. The duplicate mirrors
// the victim's transform so it lines up regardless of how the entity is set up.
function flashOverlay(victim, color, delay = 0) {
    const scene = dungeon.scene
    const src = victim.sprite
    if (!scene || !src) return

    const overlay = scene.add.sprite(src.x, src.y, src.texture.key, src.frame.name)
        .setOrigin(src.originX, src.originY)
        .setScale(src.scaleX, src.scaleY)
        .setDepth((src.depth ?? 10) + 1)
        .setAlpha(0)
    overlay.rotation = src.rotation
    overlay.setTintFill(color)

    scene.tweens.add({
        targets: overlay,
        alpha: { from: 0.85, to: 0 },
        duration: FLASH_DURATION,
        delay,
        ease: 'Power1',
        onComplete: () => overlay.destroy()
    })
}

/**
 * Sub-tile recoil on the victim — a quick nudge away from the attacker that
 * settles back. Tweens the sprite's position only (no status touches that, so
 * it's safe). With no attacker (ability / AOE damage), uses a small upward
 * jolt instead of a directional shove.
 */
export function playStagger(victim, attacker = null) {
    const ctx = getSceneContext()
    if (!ctx || !victim.sprite) return
    const src = victim.sprite

    let dx = 0, dy = 0
    if (attacker) {
        dx = Math.sign(victim.x - attacker.x)
        dy = Math.sign(victim.y - attacker.y)
    }
    if (dx === 0 && dy === 0) dy = -1

    const dist = ctx.tileSize * 0.18
    // Anchor the recoil to the victim's LOGICAL tile, never the sprite's live
    // pixel position, and snap back to the logical tile on complete (re-read,
    // not captured). Capturing src.x/y here strands the sprite off-tile when
    // staggers stack in one fight (free-for-all squads) or when the victim moves
    // before a lingering stagger finishes — that drift was the "skip every other
    // tile" desync. tileToWorldX(tile) is the sprite's rest position (origin 0).
    const homeX = ctx.map.tileToWorldX(victim.x)
    const homeY = ctx.map.tileToWorldY(victim.y)

    ctx.scene.tweens.add({
        targets: src,
        x: homeX + dx * dist,
        y: homeY + dy * dist,
        duration: 60,
        yoyo: true,
        ease: 'Power1',
        onComplete: () => {
            src.x = ctx.map.tileToWorldX(victim.x)
            src.y = ctx.map.tileToWorldY(victim.y)
        }
    })
}

/**
 * Forward body-lunge for a gap-closer that connects with NO room to travel
 * (charging an adjacent enemy): the attacker's sprite thrusts toward (dx, dy)
 * and snaps back, so a point-blank Charge/Lunge still reads as a charge instead
 * of a stationary swing. The attacker-side mirror of playStagger — same
 * logical-tile anchoring (never capture the live sprite pixel, or stacked
 * lunges strand it off-tile), a touch farther and snappier to sell the drive.
 */
export function playLunge(attacker, dx, dy) {
    const ctx = getSceneContext()
    if (!ctx || !attacker?.sprite) return
    const src = attacker.sprite
    if (dx === 0 && dy === 0) dy = -1

    const dist = ctx.tileSize * 0.6
    const homeX = ctx.map.tileToWorldX(attacker.x)
    const homeY = ctx.map.tileToWorldY(attacker.y)

    ctx.scene.tweens.add({
        targets: src,
        x: homeX + Math.sign(dx) * dist,
        y: homeY + Math.sign(dy) * dist,
        duration: 110,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
            src.x = ctx.map.tileToWorldX(attacker.x)
            src.y = ctx.map.tileToWorldY(attacker.y)
        }
    })
}

/**
 * The shared victim reaction for a landed hit: flash + recoil. Color encodes
 * the hit type — normal = white/grey, crit = red, true damage = both (a
 * white beat then a red beat). Called from both damage paths (Combat.attack's
 * resolveAttack and universals.resolveDamage) so melee and ability hits feel
 * identical. Survivors only — death plays its own fade via playDeath.
 *
 * @param victim Entity with `x`, `y`, `sprite`.
 * @param options.crit Whether the hit critically struck.
 * @param options.damageType 'physical' | 'magic' | 'true' (drives flash color).
 * @param options.attacker Optional source entity — sets recoil direction.
 */
export function playHitReaction(victim, { crit = false, damageType = 'physical', attacker = null } = {}) {
    if (!victim || !victim.sprite) return

    if (damageType === 'true') {
        flashOverlay(victim, FLASH_WHITE)
        flashOverlay(victim, FLASH_RED, 130)
    } else if (crit) {
        flashOverlay(victim, FLASH_RED)
    } else {
        flashOverlay(victim, FLASH_WHITE)
    }

    playStagger(victim, attacker)
}

/**
 * Death fade — fade + shrink a (already logically-removed) sprite, then
 * destroy it. Takes the raw sprite, not the entity: removeEntity detaches
 * `entity.sprite` synchronously (so the tile frees and loot drops fire), then
 * hands the captured reference here for the visual teardown. Falls back to an
 * immediate destroy if the scene is gone.
 */
export function playDeath(sprite, onComplete) {
    if (!sprite) { if (onComplete) onComplete(); return }
    const scene = dungeon.scene
    if (!scene) {
        sprite.destroy()
        if (onComplete) onComplete()
        return
    }

    scene.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: sprite.scaleX * 0.7,
        scaleY: sprite.scaleY * 0.7,
        duration: 220,
        ease: 'Power1',
        onComplete: () => {
            sprite.destroy()
            if (onComplete) onComplete()
        }
    })
}

/**
 * Drop a transient death marker (bones / skull / tombstone) at a tile — it
 * sits for `hold` ms, then fades over `fade` ms and destroys. Purely
 * decorative and non-blocking: the tile is already logically free, so a new
 * occupant can stand on it. Depth 9 keeps it just below entities (depth 10),
 * so a new occupant draws over it and the fading corpse sits above it.
 * The caller picks `tile` (kind-based variety lives at the call site).
 */
export function playDeathMarker(tileX, tileY, tile, { hold = 3000, fade = 600, depth = 9, scale = 0.65 } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2
    // Centered (origin 0.5) and scaled down so it reads as a marker on the
    // tile rather than a full-size sprite.
    const marker = scene.add.sprite(x, y, 'tiles', tile).setOrigin(0.5).setScale(scale).setDepth(depth)

    scene.tweens.add({
        targets: marker,
        alpha: 0,
        delay: hold,
        duration: fade,
        ease: 'Power1',
        onComplete: () => marker.destroy()
    })
    return marker
}

/**
 * Impact punctuation for a knockback that slams something — a quick expanding,
 * fading ring at the collision tile. Tile-free (a Phaser arc), so no tilesheet
 * dependency. Depth 16 sits above entities (10) and weapon swings (15). Called
 * by universals.knockback when the shove collides with a wall or another entity.
 */
export function playImpact(tileX, tileY, { color = 0xffffff } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2
    const ring = scene.add.circle(x, y, tileSize * 0.18, color, 0.85).setDepth(16)

    scene.tweens.add({
        targets: ring,
        scale: 2.2,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => ring.destroy()
    })
}

/** Cosmetic "arrow falling from above" onto a tile — a short shaft that drops in
 *  and pops a small impact. Call one per footprint tile (stagger via `delay`) to
 *  read an Arrow-Storm volley raining over an area, including empty ground. */
export function playArrowRain(tileX, tileY, { color = 0xffffff, delay = 0 } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2
    const startY = y - tileSize * 1.6
    const shaft = scene.add.rectangle(x, startY, 2, tileSize * 0.5, color, 0.9)
        .setOrigin(0.5, 1).setDepth(18)

    scene.tweens.add({
        targets: shaft,
        y,
        duration: 150,
        delay,
        ease: 'Quad.easeIn',
        onComplete: () => {
            shaft.destroy()
            playImpact(tileX, tileY, { color })
        }
    })
}

/** A ring outline marking an AoE zone (e.g. the Arrow Storm danger area). Drawn
 *  as a stroked circle of `radiusTiles` (+ a soft outer glow) centered on a tile.
 *  Returns the graphics object so a LINGERING effect can hold it and destroy() it
 *  on expiry; pass `fade` (ms) for a one-shot highlight that fades itself, or
 *  `pulse: true` for a persistent breathing outline. */
export function playAreaRing(centerTileX, centerTileY, radiusTiles, { color = 0xffffff, fade = 0, pulse = false } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return null
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(centerTileX) + tileSize / 2
    const y = map.tileToWorldY(centerTileY) + tileSize / 2
    const r = (radiusTiles + 0.5) * tileSize

    const g = scene.add.graphics().setDepth(9)   // above floor, below actors
    g.lineStyle(6, color, 0.16); g.strokeCircle(x, y, r)   // soft outer glow
    g.lineStyle(2, color, 0.95); g.strokeCircle(x, y, r)   // crisp border

    if (fade > 0) {
        scene.tweens.add({ targets: g, alpha: 0, duration: fade, ease: 'Sine.easeIn', onComplete: () => g.destroy() })
    } else if (pulse) {
        scene.tweens.add({ targets: g, alpha: { from: 0.55, to: 1 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    return g
}

/** A persistent translucent SHIELD BUBBLE around an ENTITY (the Barrier / ward
 *  visual). Unlike playAreaRing (a fixed tile), this follows its entity: hold the
 *  handle and call `handle.reposition()` each turn to snap it to the entity's tile,
 *  and `handle.destroy()` when the buff ends. Drawn above actors (depth 11) with a
 *  glassy low-alpha fill so the caster shows through, plus a pulsing rim. `color`
 *  defaults to grey-white (the base barrier); an element-flavored ward passes its
 *  own color (fire orange, ice blue, …). */
export function playShieldBubble(entity, { color = 0xcfd4da } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return null
    const { scene, map, tileSize } = ctx
    const r = tileSize * 0.72

    const g = scene.add.graphics().setDepth(11)   // above actors — a clear bubble over them
    const draw = () => {
        if (!entity?.sprite) return
        const cx = map.tileToWorldX(entity.x) + tileSize / 2
        const cy = map.tileToWorldY(entity.y) + tileSize / 2
        g.clear()
        g.fillStyle(color, 0.12); g.fillCircle(cx, cy, r)          // glassy clear fill
        g.lineStyle(6, color, 0.14); g.strokeCircle(cx, cy, r)     // soft glow
        g.lineStyle(2, color, 0.85); g.strokeCircle(cx, cy, r)     // crisp rim
    }
    draw()
    g.reposition = draw
    scene.tweens.add({ targets: g, alpha: { from: 0.6, to: 1 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    return g
}

/** A rectangular outline framing an AoE zone — the square BOUNDING BOX of a radius
 *  footprint (covers tiles cx-r..cx+r, cy-r..cy+r). The "amber box around the
 *  spell" highlight. Same handle/fade/pulse contract as playAreaRing: returns the
 *  graphics object (hold + destroy() for a lingering zone), `fade` (ms) for a
 *  one-shot, `pulse: true` for a persistent breathing border. */
export function playAreaBox(centerTileX, centerTileY, radiusTiles, { color = 0xffffff, fade = 0, pulse = false } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return null
    const { scene, map, tileSize } = ctx

    const left = map.tileToWorldX(centerTileX - radiusTiles)
    const top = map.tileToWorldY(centerTileY - radiusTiles)
    const side = (radiusTiles * 2 + 1) * tileSize

    const g = scene.add.graphics().setDepth(9)   // above floor, below actors
    g.lineStyle(6, color, 0.16); g.strokeRect(left, top, side, side)   // soft outer glow
    g.lineStyle(2, color, 0.95); g.strokeRect(left, top, side, side)   // crisp amber border

    if (fade > 0) {
        scene.tweens.add({ targets: g, alpha: 0, duration: fade, ease: 'Sine.easeIn', onComplete: () => g.destroy() })
    } else if (pulse) {
        scene.tweens.add({ targets: g, alpha: { from: 0.55, to: 1 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    return g
}

/** An outline that traces the EXACT silhouette of a shape footprint — for each
 *  footprint tile, draws only the edges whose neighbor is outside the footprint,
 *  so the border hugs the real shape (the Arrow Storm diamond/disc, a cone, …)
 *  instead of a bounding box. Center-inclusive (disc shapes exclude their center,
 *  but it's part of the zone). Same handle/fade/pulse contract as playAreaBox. */
export function playAreaOutline(centerTileX, centerTileY, shapeSpec, { color = 0xffffff, fade = 0, pulse = false } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return null
    const { scene, map, tileSize } = ctx

    const offsets = [{ dx: 0, dy: 0 }, ...shapeOffsets(shapeSpec ?? { kind: 'circle', radius: 2 }, 0, 0)]
    const inSet = new Set(offsets.map(o => `${o.dx},${o.dy}`))
    const has = (ox, oy) => inSet.has(`${ox},${oy}`)

    // Collect boundary edges (each drawn once, from the inside tile).
    const edges = []
    for (const o of offsets) {
        const left = map.tileToWorldX(centerTileX + o.dx)
        const top = map.tileToWorldY(centerTileY + o.dy)
        const right = left + tileSize
        const bottom = top + tileSize
        if (!has(o.dx, o.dy - 1)) edges.push([left, top, right, top])         // top
        if (!has(o.dx, o.dy + 1)) edges.push([left, bottom, right, bottom])   // bottom
        if (!has(o.dx - 1, o.dy)) edges.push([left, top, left, bottom])       // left
        if (!has(o.dx + 1, o.dy)) edges.push([right, top, right, bottom])     // right
    }

    const g = scene.add.graphics().setDepth(9)
    const stroke = (width, alpha) => {
        g.lineStyle(width, color, alpha)
        for (const [x1, y1, x2, y2] of edges) g.lineBetween(x1, y1, x2, y2)
    }
    stroke(6, 0.16)   // soft outer glow
    stroke(2, 0.95)   // crisp border

    if (fade > 0) {
        scene.tweens.add({ targets: g, alpha: 0, duration: fade, ease: 'Sine.easeIn', onComplete: () => g.destroy() })
    } else if (pulse) {
        scene.tweens.add({ targets: g, alpha: { from: 0.55, to: 1 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    return g
}

/**
 * Tiny deflection shake for a block or dodge — a quick low-amplitude jitter,
 * no flash (nothing landed). Distinct from playStagger's bigger hit recoil;
 * pairs with the existing Block!/Miss! float.
 */
export function playFlinch(victim) {
    const ctx = getSceneContext()
    if (!ctx || !victim.sprite) return
    const src = victim.sprite
    // Anchor to the logical tile so a flinch never strands the sprite off-tile
    // (see playStagger). tileToWorldX(tile) is the sprite's rest x (origin 0).
    const homeX = ctx.map.tileToWorldX(victim.x)
    const amp = ctx.tileSize * 0.08

    ctx.scene.tweens.add({
        targets: src,
        x: homeX + amp,
        duration: 45,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => { src.x = ctx.map.tileToWorldX(victim.x) }
    })
}

/**
 * Physical wind-up for a drawn weapon (bow): the shooter braces backward away
 * from the target, then releases — `onComplete` fires at the release so the
 * projectile launches as the draw snaps forward. The physical counterpart to
 * playCast's magical buildup; wired via weapon.drawType in Combat.attack.
 */
export function playDraw(caster, target, { onComplete, delay = 0 } = {}) {
    const ctx = getSceneContext(onComplete)
    if (!ctx) return
    const src = caster.sprite
    if (!src) { if (onComplete) onComplete(); return }

    const dx = Math.sign(caster.x - target.x)
    const dy = Math.sign(caster.y - target.y)
    const dist = ctx.tileSize * 0.16
    // Anchor to the shooter's logical tile (see playStagger) so the draw-back
    // can't strand the sprite off-tile when it overlaps other animations.
    const homeX = ctx.map.tileToWorldX(caster.x)
    const homeY = ctx.map.tileToWorldY(caster.y)

    ctx.scene.tweens.add({
        targets: src,
        x: homeX + dx * dist,
        y: homeY + dy * dist,
        duration: 110,
        delay,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => {
            src.x = ctx.map.tileToWorldX(caster.x)
            src.y = ctx.map.tileToWorldY(caster.y)
            if (onComplete) onComplete()
        }
    })
}

// --- Per-ability FX overlays (tile-free shapes) ---------------------------
// Flourishes for physical abilities that otherwise only show the generic hit
// reaction. All drawn with Phaser shapes (no tilesheet dependency), tinted by
// the caller so each ability can match its damage flavor.

/** A quick blade-swipe arc through a target tile — for melee strike abilities. */
export function playSlashArc(tileX, tileY, { color = 0xffffff } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2
    const blade = scene.add.rectangle(x, y, tileSize * 0.9, 2, color).setOrigin(0.5).setDepth(17)
    blade.rotation = -Math.PI / 3

    scene.tweens.add({
        targets: blade,
        rotation: Math.PI / 3,
        alpha: { from: 1, to: 0 },
        duration: 150,
        ease: 'Power2',
        onComplete: () => blade.destroy()
    })
}

/** An expanding ring radiating from an origin tile — for AOE abilities. The
 *  ring grows to roughly cover `radius` tiles. */
export function playBurst(tileX, tileY, { radius = 1, color = 0xffffff } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2
    const ring = scene.add.circle(x, y, tileSize * 0.3, color, 0.35).setDepth(16)
    ring.setStrokeStyle(2, color, 0.9)

    scene.tweens.add({
        targets: ring,
        scale: Math.max(2, (radius + 0.5) * 2),
        alpha: 0,
        duration: 280,
        ease: 'Power2',
        onComplete: () => ring.destroy()
    })
}

/** A wet splat covering a single tile — for spray/AOE footprints (acid, oil,
 *  blood). Pops in near tile-size and fades, briefly staining the tile. Call one
 *  per tile to paint a shape's whole footprint (e.g. an Acid Spray cone). Pass
 *  `residue: true` to leave a slow-fading stain underneath, as if the acid pools
 *  and eats at the floor before evaporating. */
export function playSplash(tileX, tileY, { color = 0xffffff, residue = false } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x = map.tileToWorldX(tileX) + tileSize / 2
    const y = map.tileToWorldY(tileY) + tileSize / 2

    if (residue) {
        const stain = scene.add.circle(x, y, tileSize * 0.38, color, 0.3).setDepth(14)
        scene.tweens.add({
            targets: stain,
            alpha: 0,
            duration: 1600,
            ease: 'Sine.easeIn',
            onComplete: () => stain.destroy()
        })
    }

    const splat = scene.add.circle(x, y, tileSize * 0.42, color, 0.55).setDepth(15)
    scene.tweens.add({
        targets: splat,
        scale: { from: 0.6, to: 1.15 },
        alpha: { from: 0.7, to: 0 },
        duration: 360,
        ease: 'Quad.easeOut',
        onComplete: () => splat.destroy()
    })
}

/** Cosmetic "inhaled something" reaction — the target coughs and reels woozily,
 *  as if it breathed in powder / dust / gas. PURELY visual (no gameplay effect):
 *  a few little puff clouds drift up off it, the body wobbles (a rotation jitter,
 *  so it doesn't fight a concurrent hit-stagger's position tween), and a "*cough*"
 *  floats overhead. A reusable primitive — call it for any inhalant effect
 *  (Blinding Powder now; choking gas, spores, sneeze pepper… later). `color` tints
 *  the puffs. (The VERBAL "*cough*" emote is a speech bubble — see
 *  enemyReactions.reactCough; this is just the physical puff + reel.) */
export function playCough(target, { color = 0xe8d8a0 } = {}) {
    const ctx = getSceneContext()
    if (!ctx || !target?.sprite) return
    const { scene, map, tileSize } = ctx
    const src = target.sprite
    const cx = map.tileToWorldX(target.x) + tileSize / 2
    const cy = map.tileToWorldY(target.y) + tileSize / 2

    // A few small puffs rising and spreading — the exhaled powder cloud.
    const puffs = 3
    for (let i = 0; i < puffs; i++) {
        const ox = (i - (puffs - 1) / 2) * tileSize * 0.18
        const puff = scene.add.circle(cx + ox, cy - tileSize * 0.12, tileSize * 0.12, color, 0.5).setDepth(17)
        scene.tweens.add({
            targets: puff,
            x: cx + ox + (i % 2 ? 1 : -1) * tileSize * 0.12,
            y: cy - tileSize * (0.5 + 0.12 * i),
            scale: { from: 0.6, to: 1.5 },
            alpha: { from: 0.6, to: 0 },
            duration: 520 + i * 90,
            delay: i * 70,
            ease: 'Sine.easeOut',
            onComplete: () => puff.destroy()
        })
    }

    // Woozy wobble — a quick rotation jitter that reads as the "*cough cough*"
    // reel. Rotation (not x/y) so it composes with the hit-stagger; reset to 0.
    scene.tweens.add({
        targets: src,
        angle: { from: -8, to: 8 },
        duration: 90,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => { src.angle = 0 }
    })
}

/** A solid BEAM that flares along a straight line from one tile to another — a
 *  laser / energy lance. Draws a thick rotated rectangle that fills the lane
 *  through every tile it crosses (plus a bright white core), then fades. Use for
 *  charged beams / piercing lines instead of a row of per-tile splashes.
 *  `width` is a fraction of a tile (the perpendicular thickness); pass the beam's
 *  tile-width for a multi-lane beam. `alpha`/`duration`/`core` tune the look — a
 *  faint, core-less, slow-fading beam doubles as a wind-up telegraph. */
export function playBeam(fromTileX, fromTileY, toTileX, toTileY,
    { color = 0xffffff, width = 0.5, alpha = 0.5, duration = 260, core = true } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x1 = map.tileToWorldX(fromTileX) + tileSize / 2
    const y1 = map.tileToWorldY(fromTileY) + tileSize / 2
    const x2 = map.tileToWorldX(toTileX) + tileSize / 2
    const y2 = map.tileToWorldY(toTileY) + tileSize / 2
    // Extend half a tile past each end so the bar fills the caster's and the
    // farthest tile's squares rather than stopping at their centers.
    const span = Math.hypot(x2 - x1, y2 - y1) + tileSize
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2

    const outer = scene.add.rectangle(cx, cy, span, tileSize * width, color, alpha)
        .setOrigin(0.5).setDepth(16)
    outer.rotation = angle
    scene.tweens.add({
        targets: outer,
        alpha: 0,
        scaleY: 1.35,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => outer.destroy()
    })

    if (core) {
        const inner = scene.add.rectangle(cx, cy, span, Math.max(2, tileSize * width * 0.4), 0xffffff, Math.min(1, alpha + 0.4))
            .setOrigin(0.5).setDepth(17)
        inner.rotation = angle
        scene.tweens.add({
            targets: inner,
            alpha: 0,
            duration: duration * 0.8,
            ease: 'Quad.easeOut',
            onComplete: () => inner.destroy()
        })
    }
}

/** Charging particles drawn INWARD to a caster's tile — energy being gathered /
 *  absorbed during a wind-up (charged beams, big spells). A handful of motes spawn
 *  on a ring around the caster and rush in, shrinking + fading as they converge,
 *  over a soft core glow that pulses as the energy concentrates. Call repeatedly
 *  (on a throttle) for a continuous channel. Tinted by `color`, so it adopts the
 *  spell's element color — the same single knob that drives the beam + cast pulse.
 *  (Cosmetic foundation: future fire/holy/etc. beams recolor by passing a
 *  different color; no per-element code needed here.) */
export function playChannelGather(caster, { color = 0xffffff, motes = 4, radius = 1.4 } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const cx = map.tileToWorldX(caster.x) + tileSize / 2
    const cy = map.tileToWorldY(caster.y) + tileSize / 2
    const ringRadius = tileSize * radius

    for (let i = 0; i < motes; i++) {
        // Spread the motes around the ring with a little jitter so successive
        // bursts don't stack on the same spokes.
        const angle = ((i + Math.random() * 0.6) / motes) * Math.PI * 2
        const sx = cx + Math.cos(angle) * ringRadius
        const sy = cy + Math.sin(angle) * ringRadius
        const mote = scene.add.circle(sx, sy, Math.max(1, tileSize * 0.07), color, 0.9).setDepth(16)
        scene.tweens.add({
            targets: mote,
            x: cx,
            y: cy,
            scale: { from: 1, to: 0.15 },
            alpha: { from: 0.9, to: 0.15 },
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => mote.destroy()
        })
    }

    const core = scene.add.circle(cx, cy, tileSize * 0.3, color, 0.4).setDepth(16)
    scene.tweens.add({
        targets: core,
        scale: { from: 0.5, to: 1.1 },
        alpha: { from: 0.5, to: 0 },
        duration: 320,
        ease: 'Sine.easeOut',
        onComplete: () => core.destroy()
    })
}

/** A directional ARROW flashed ahead of a caster, pointing along (dx, dy) — the
 *  wind-up telegraph for a charge / dash / lunge. A chevron about a tile ahead
 *  that surges forward and fades; call repeatedly (on a throttle) for a continuous
 *  "about to charge THIS way" cue. The triangle is built already oriented along
 *  the aim (tip forward, base behind), so diagonals need no rotation. Tinted by
 *  `color`. */
export function playChargeArrow(caster, dx, dy, { color = 0xffffff, reach = 1 } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx
    if (dx === 0 && dy === 0) return

    const baseX = map.tileToWorldX(caster.x) + tileSize / 2 + dx * tileSize * reach
    const baseY = map.tileToWorldY(caster.y) + tileSize / 2 + dy * tileSize * reach
    const perpX = -dy
    const perpY = dx
    const s = tileSize * 0.5

    const tipX = dx * s,                          tipY = dy * s
    const aX = -dx * s * 0.5 + perpX * s * 0.7,   aY = -dy * s * 0.5 + perpY * s * 0.7
    const bX = -dx * s * 0.5 - perpX * s * 0.7,   bY = -dy * s * 0.5 - perpY * s * 0.7

    const arrow = scene.add.triangle(baseX, baseY, tipX, tipY, aX, aY, bX, bY, color, 0.85).setDepth(16)
    scene.tweens.add({
        targets: arrow,
        x: baseX + dx * tileSize * 0.6,
        y: baseY + dy * tileSize * 0.6,
        alpha: { from: 0.85, to: 0 },
        scaleX: { from: 0.8, to: 1.25 },
        scaleY: { from: 0.8, to: 1.25 },
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => arrow.destroy()
    })
}

/** A fading streak from one tile to another — for movement/dash abilities. */
export function playTrail(fromTileX, fromTileY, toTileX, toTileY, { color = 0xffffff } = {}) {
    const ctx = getSceneContext()
    if (!ctx) return
    const { scene, map, tileSize } = ctx

    const x1 = map.tileToWorldX(fromTileX) + tileSize / 2
    const y1 = map.tileToWorldY(fromTileY) + tileSize / 2
    const x2 = map.tileToWorldX(toTileX) + tileSize / 2
    const y2 = map.tileToWorldY(toTileY) + tileSize / 2
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < 1) return

    const streak = scene.add.rectangle((x1 + x2) / 2, (y1 + y2) / 2, length, 4, color, 0.5)
        .setOrigin(0.5).setDepth(14)
    streak.rotation = Math.atan2(y2 - y1, x2 - x1)

    scene.tweens.add({
        targets: streak,
        alpha: 0,
        duration: 220,
        ease: 'Power2',
        onComplete: () => streak.destroy()
    })
}

// --- Status visual FX (looping overlay while a status is active) ----------
// An entity's syncStatusFX (BaseEnemy) creates one overlay per active status
// that declares an `fx` key, repositions it each frame to follow the sprite,
// and destroys it when the status clears. The loop animation only touches
// scale/alpha/angle — never absolute x/y, since the follower drives position.
// Some FX reuse in-game effect tiles (consistent with the cast visuals); the
// daze stars are tile-free shapes, so no tilesheet dependency.

function fxEffectSprite(scene, tile, tint, scale) {
    const s = scene.add.sprite(0, 0, 'tiles', tile).setOrigin(0.5).setScale(scale).setDepth(54)
    s.setTint(tint)
    return s
}

function fxDazeStars(scene) {
    // Three small sparks in a ring, spun by the loop tween — a tile-free
    // "dazed" cue that needs no sprite-sheet entry.
    const container = scene.add.container(0, 0).setDepth(54)
    const radius = 5
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2
        container.add(scene.add.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.6, 0xfff27a, 1))
    }
    return container
}

function fxBloodDrops(scene) {
    // A few dark-red droplets low on the body — tile-free bleed cue.
    const container = scene.add.container(0, 0).setDepth(54)
    const drops = [[-2, 0], [2, 1], [0, 3]]
    for (const [dx, dy] of drops) {
        container.add(scene.add.circle(dx, dy, 1.4, 0xaa1111, 1))
    }
    return container
}

// key -> { build(scene) => displayObject, anim, offsetY (from the entity's center) }
const STATUS_FX = {
    burning: { build: (s) => fxEffectSprite(s, 505, 0xff7733, 0.6),  anim: 'flicker', offsetY: -2 },
    poison:  { build: (s) => fxEffectSprite(s, 574, 0x66dd55, 0.55), anim: 'pulse',   offsetY: -2 },
    stun:    { build: (s) => fxDazeStars(s),                          anim: 'spin',    offsetY: -11 },
    daze:    { build: (s) => fxDazeStars(s),                          anim: 'spin',    offsetY: -9 },
    freeze:  { build: (s) => fxEffectSprite(s, 574, 0x99ddff, 0.55), anim: 'pulse',   offsetY: -2 },
    bleed:   { build: (s) => fxBloodDrops(s),                         anim: 'pulse',   offsetY: 3 },
    cursed:  { build: (s) => fxEffectSprite(s, 575, 0xaa55ee, 0.55), anim: 'pulse',   offsetY: -2 },
}

/** Vertical offset (from the entity's center) where a given fx overlay sits. */
export function statusFXOffset(key) {
    return STATUS_FX[key]?.offsetY ?? -6
}

/**
 * Build the overlay for a status fx key and start its looping animation.
 * Returns the display object (sprite or container), or null for an unknown
 * key / missing scene. The caller positions it each frame and destroys it when
 * the status clears.
 */
export function createStatusFX(scene, key) {
    const def = STATUS_FX[key]
    if (!def || !scene) return null
    const obj = def.build(scene)

    if (def.anim === 'spin') {
        scene.tweens.add({ targets: obj, angle: 360, duration: 1200, repeat: -1, ease: 'Linear' })
    } else if (def.anim === 'flicker') {
        scene.tweens.add({ targets: obj, alpha: { from: 1, to: 0.45 }, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    } else if (def.anim === 'pulse') {
        scene.tweens.add({ targets: obj, alpha: { from: 0.9, to: 0.5 }, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    return obj
}

/**
 * Per-frame status-FX sync for any sprite-backed entity (hero or enemy). Builds
 * one looping overlay per active status that declares an `fx` key, repositions
 * each to follow the entity's sprite, fog-gates visibility, and destroys an
 * overlay when its status clears. Stored on `entity.statusFX` (keyed by fx).
 * Shared by BaseEnemy and BaseHero so the two stay identical. Tear-down on
 * death lives in each entity's onDestroy.
 */
export function syncEntityStatusFX(entity, visibleByFog) {
    const sprite = entity.sprite
    if (!sprite) return
    if (!entity.statusFX) entity.statusFX = {}
    const scene = sprite.scene
    const tileSize = mapState.tileSize

    // Lifecycle tracks the actual statuses; fog only gates visibility, so an
    // overlay isn't rebuilt each time the entity flickers in/out of sight.
    const fxStatuses = statusesOnEntity(entity).filter(s => s.fx)
    const activeKeys = new Set(fxStatuses.map(s => s.fx))

    const cx = sprite.x + tileSize / 2
    const cy = sprite.y + tileSize / 2

    for (const meta of fxStatuses) {
        let fx = entity.statusFX[meta.fx]
        if (!fx) {
            fx = createStatusFX(scene, meta.fx)
            if (!fx) continue
            entity.statusFX[meta.fx] = fx
        }
        fx.x = cx
        fx.y = cy + statusFXOffset(meta.fx)
        fx.setVisible(visibleByFog)
    }

    for (const key of Object.keys(entity.statusFX)) {
        if (!activeKeys.has(key)) {
            entity.statusFX[key].destroy()
            delete entity.statusFX[key]
        }
    }
}

// --- Void rift aura (a darkness-source effect, no art assets) --------------
// A persistent, looping effect anchored at a world position (the void rift's
// tile center): a dark ground pool ringed in purple that pulses, plus jagged
// purple "void crackles" that flicker by redrawing on a timer. Built entirely
// from Phaser primitives (circle + Graphics polylines) like the tile-free
// status FX — the game ships no special-effect sprites. Returns a controller
// the owner (VoidRift) holds: setVisible to fog-gate it, destroy to tear it
// down. See documents/v3_darkness_settlements.md.
const VOID_PURPLE = 0xa855f7      // ring rim + crackle glow
const VOID_PURPLE_BRIGHT = 0xe9d5ff // crackle core
const VOID_DARK = 0x140020        // the dark pool

export function createVoidRiftAura(scene, cx, cy) {
    if (!scene) return null
    const tileSize = mapState.tileSize || 16
    const reach = tileSize * 0.95

    // Dark pool with a purple rim, beneath the floating skull. A circle game
    // object so a single scale/alpha tween can pulse it (like playBurst's ring).
    const pool = scene.add.circle(cx, cy, tileSize * 0.85, VOID_DARK, 0.5).setDepth(6)
    pool.setStrokeStyle(2, VOID_PURPLE, 0.85)
    const poolTween = scene.tweens.add({
        targets: pool,
        scale: { from: 0.92, to: 1.06 },
        alpha: { from: 0.5, to: 0.78 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    })

    // Crackles: redraw a few jagged bolts each tick so the electricity flickers.
    const crackle = scene.add.graphics().setDepth(11)
    const drawBolt = (angle) => {
        const segs = 4
        crackle.beginPath()
        crackle.moveTo(cx, cy)
        for (let s = 1; s <= segs; s++) {
            const rr = reach * (s / segs)
            const jitter = (Math.random() - 0.5) * (tileSize * 0.4)
            const px = cx + Math.cos(angle) * rr + Math.cos(angle + Math.PI / 2) * jitter
            const py = cy + Math.sin(angle) * rr + Math.sin(angle + Math.PI / 2) * jitter
            crackle.lineTo(px, py)
        }
        crackle.strokePath()
    }
    const drawCrackles = () => {
        crackle.clear()
        const bolts = 3
        const base = Math.random() * Math.PI * 2
        const angles = []
        for (let i = 0; i < bolts; i++) {
            angles.push(base + (i / bolts) * Math.PI * 2 + (Math.random() - 0.5) * 0.8)
        }
        // Outer glow pass, then a bright thin core for an electric look.
        crackle.lineStyle(3, VOID_PURPLE, 0.30)
        for (const a of angles) drawBolt(a)
        crackle.lineStyle(1, VOID_PURPLE_BRIGHT, 0.95)
        for (const a of angles) drawBolt(a)
    }
    drawCrackles()
    const timer = scene.time.addEvent({ delay: 140, loop: true, callback: drawCrackles })

    return {
        setVisible(v) { pool.setVisible(v); crackle.setVisible(v) },
        destroy() {
            poolTween.stop()
            timer.remove()
            pool.destroy()
            crackle.destroy()
        }
    }
}

// A pair of glowing eyes — the only thing you see of an enemy lurking in the
// dark beyond your light (void rooms). Tile-free (two circles in a container)
// and slow-pulsing so they read as "watching." FogOfWar positions/destroys it.
const EYES_COLOR = 0xc026d3 // void magenta
export function createDarkEyes(scene) {
    if (!scene) return null
    const c = scene.add.container(0, 0).setDepth(11)
    c.add(scene.add.circle(-2.5, 0, 1.5, EYES_COLOR, 1))
    c.add(scene.add.circle(2.5, 0, 1.5, EYES_COLOR, 1))
    scene.tweens.add({
        targets: c,
        alpha: { from: 0.5, to: 1 },
        duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    })
    return c
}

// Corrupted floor patches — dark-purple ground stains that dress a void room.
// Drawn once at depth 4 (BELOW the fog overlay at depth 5), so the void room's
// pitch-black fog naturally hides them beyond the hero's light cone and reveals
// them only as the hero's light sweeps over the floor — no per-frame gating.
// `points` are world-space tile centers. Asset-free (filled circles). Returns a
// controller the owner (VoidRift) holds for teardown.
const CORRUPTION_COLOR = 0x4a0d5c
export function createCorruptionField(scene, points) {
    if (!scene || !points || !points.length) return null
    const g = scene.add.graphics().setDepth(4)
    for (const p of points) {
        const blobs = 1 + Math.floor(Math.random() * 2)
        for (let b = 0; b < blobs; b++) {
            const r = 4 + Math.random() * 5
            const ox = (Math.random() - 0.5) * 6
            const oy = (Math.random() - 0.5) * 6
            g.fillStyle(CORRUPTION_COLOR, 0.5)
            g.fillCircle(p.x + ox, p.y + oy, r)
        }
    }
    const tween = scene.tweens.add({
        targets: g,
        alpha: { from: 0.7, to: 1 },
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    })
    return { destroy() { tween.stop(); g.destroy() } }
}

// Channel aura — the telegraph for a void captain channeling a new rift into
// being. Same dark-ring + purple-crackle vocabulary as the rift aura, but it
// GROWS with setProgress(0..1): a small gathering of void energy that swells to
// full rift size as the channel completes ("becoming the skull"). Anchored at
// the captain's tile (it holds position while channeling). Asset-free.
export function createChannelAura(scene, cx, cy) {
    if (!scene) return null
    const tileSize = mapState.tileSize || 16
    const maxReach = tileSize * 0.95
    let progress = 0

    // Full-size pool, scaled down — grown via setProgress (Arc scale is reliable
    // where setRadius is not across Phaser versions).
    const pool = scene.add.circle(cx, cy, tileSize * 0.85, VOID_DARK, 0.5).setDepth(6)
    pool.setStrokeStyle(2, VOID_PURPLE, 0.9).setScale(0.25)

    const crackle = scene.add.graphics().setDepth(11)
    const drawCrackles = () => {
        crackle.clear()
        const reach = maxReach * (0.3 + 0.7 * progress)
        const bolts = 3
        const base = Math.random() * Math.PI * 2
        const angles = []
        for (let i = 0; i < bolts; i++) {
            angles.push(base + (i / bolts) * Math.PI * 2 + (Math.random() - 0.5) * 0.8)
        }
        const drawBolt = (angle) => {
            crackle.beginPath()
            crackle.moveTo(cx, cy)
            for (let s = 1; s <= 4; s++) {
                const rr = reach * (s / 4)
                const jitter = (Math.random() - 0.5) * (tileSize * 0.4)
                crackle.lineTo(
                    cx + Math.cos(angle) * rr + Math.cos(angle + Math.PI / 2) * jitter,
                    cy + Math.sin(angle) * rr + Math.sin(angle + Math.PI / 2) * jitter)
            }
            crackle.strokePath()
        }
        crackle.lineStyle(3, VOID_PURPLE, 0.30 * (0.4 + 0.6 * progress))
        for (const a of angles) drawBolt(a)
        crackle.lineStyle(1, VOID_PURPLE_BRIGHT, 0.95)
        for (const a of angles) drawBolt(a)
    }
    drawCrackles()
    const timer = scene.time.addEvent({ delay: 120, loop: true, callback: drawCrackles })

    return {
        setProgress(p) {
            progress = Math.max(0, Math.min(1, p))
            pool.setScale(0.25 + 0.75 * progress)
        },
        setVisible(v) { pool.setVisible(v); crackle.setVisible(v) },
        destroy() { timer.remove(); pool.destroy(); crackle.destroy() }
    }
}
