// Floating "talking head" speech bubbles for in-world actors.
//
// Any actor (hero, enemy, or item) can speak to the player on demand:
//
//     speech.say(entity, "You'll never leave here alive!")
//     speech.say(entity, ["Halt!", "You shouldn't have come."])   // sequence
//     speech.say(entity, "...", { portraitTile: 514, duration: 4000 })
//
// The bubble shows a scaled-up version of the actor's own tile as a
// portrait, the actor's name, and the line(s) of text. It floats above
// the actor's sprite in WORLD space (mirroring World.interactHint), so it
// follows the camera and the sprite for free and never pauses the game.
//
// Singleton, mirroring WorldTooltip's lifecycle: bind() is called from
// World.create() on every floor entry (scene.restart() destroys the old
// display objects), and sync() is called each tick from World.update() to
// reposition active bubbles, hide ones whose speaker has slipped into fog,
// and clean up after a speaker that died mid-sentence.

// Border tint by speaker type, so a glance reads who is talking.
const BORDER_BY_TYPE = {
    hero: 0xffd34d,     // gold
    enemy: 0xff5b5b,    // red
}
const BORDER_DEFAULT = 0x6fc3d6   // teal — items, shrines, narration, anything else

// One bubble's worth of tunable geometry (world pixels, pre camera zoom).
// Everything renders at 2x camera zoom in play, so these read ~double on
// screen — keep them small.
const PORTRAIT_SCALE = 1.0        // 16px tile -> 16px portrait
const PAD = 3
const GAP = 3                     // portrait -> text column gap
const WRAP_WIDTH = 92
const TAIL = 4                    // half-width / height of the downward tail
const GAP_ABOVE_SPRITE = 5        // bubble bottom sits this far above the sprite top
const NAME_FONT = "bold 8px Arial"
const BODY_FONT = "8px Arial"

// Sits above entity sprites (10) and ability/weapon FX (14-17) but BELOW
// the floating damage numbers (20) and enemy HP bars (50+), so combat
// readouts always render on top of a bubble that happens to overlap them.
const DEPTH = 18

// Auto-dismiss timing. A line holds for BASE + PER_CHAR * length, clamped,
// then fades over FADE. Real-time (scene clock) so the world keeps moving.
const HOLD_BASE = 1500
const HOLD_PER_CHAR = 45
const HOLD_MAX = 6000
const FADE = 280

class SpeechBubble {
    constructor() {
        this.scene = null
        // speaker entity -> active bubble record. One bubble per speaker; a
        // new say() on the same speaker replaces the old one.
        this.active = new Map()
    }

    // Called from World.create() each floor entry. The previous scene's
    // display objects are already gone with the restart, so just reset.
    bind(scene) {
        this.scene = scene
        this.active = new Map()
    }

    // Show a bubble above `speaker`. `content` is a string or an array of
    // strings (shown in sequence, each auto-advancing). opts:
    //   portraitTile : override the tile shown as the face (e.g. a 514-521
    //                  stylized portrait) instead of speaker.tile
    //   duration     : ms to hold EACH line before advancing/fading
    //   tail         : draw the downward pointer (default true)
    //   delay        : ms to wait before the bubble appears (e.g. a banter
    //                  partner's punchline landing a beat after the setup)
    //   combat       : intentional in-combat line (captain order, morale
    //                  break, hero low-HP) — exempt from the engaged-clear in
    //                  sync() so it survives while the speaker is fighting
    //   name         : override the displayed name — for a voice that borrows
    //                  another actor's bubble (a cursed gem whispering above
    //                  the hero, a chest reacting as it's opened)
    say(speaker, content, opts = {}) {
        if (!this.scene || !speaker || !speaker.sprite) return
        if (speaker.mute) return   // muted speakers (e.g. the training dummy) never bubble
        const lines = (Array.isArray(content) ? content : [content])
            .map(s => String(s)).filter(s => s.length)
        if (!lines.length) return

        if (opts.delay > 0) {
            this.scene.time.delayedCall(opts.delay, () => {
                // Speaker may have moved into combat / died during the wait.
                if (speaker.sprite && speaker.sprite.active) this._begin(speaker, lines, opts)
            })
            return
        }
        return this._begin(speaker, lines, opts)
    }

    _begin(speaker, lines, opts) {
        // Replace any existing bubble for this speaker outright.
        this._destroy(speaker)

        const record = {
            speaker,
            lines,
            lineIndex: 0,
            portraitTile: opts.portraitTile != null ? opts.portraitTile : speaker.tile,
            nameOverride: opts.name != null ? opts.name : null,
            durationOverride: opts.duration,
            persistInCombat: opts.combat === true,
            tail: opts.tail !== false,
            container: null,
            width: 0,
            height: 0,
            timer: null
        }
        this.active.set(speaker, record)
        this._buildLine(record)
        return record
    }

    // Build (or rebuild) the display objects for the current line of a record.
    _buildLine(record) {
        const scene = this.scene
        const { speaker } = record
        if (record.container) record.container.destroy()

        const text = record.lines[record.lineIndex]
        const border = speaker.type === "hero" || speaker.type === "enemy"
            ? BORDER_BY_TYPE[speaker.type]
            : BORDER_DEFAULT

        // --- text + portrait (measured before we can size the background) ---
        const displayName = record.nameOverride != null ? record.nameOverride : (speaker.name || "")
        const nameText = scene.add.text(0, 0, displayName, {
            font: NAME_FONT,
            color: "#ffffff"
        })
        const bodyText = scene.add.text(0, 0, text, {
            font: BODY_FONT,
            color: "#e8e8e8",
            wordWrap: { width: WRAP_WIDTH }
        })
        const portrait = scene.add.sprite(0, 0, "tiles", record.portraitTile)
            .setOrigin(0, 0).setScale(PORTRAIT_SCALE)
        const portraitSize = 16 * PORTRAIT_SCALE

        // --- layout: portrait on the left, name over body on the right ---
        const textColW = Math.max(nameText.width, bodyText.width)
        const textColH = nameText.height + 1 + bodyText.height
        const innerW = portraitSize + GAP + textColW
        const innerH = Math.max(portraitSize, textColH)
        const width = innerW + PAD * 2
        const height = innerH + PAD * 2

        portrait.setPosition(PAD, PAD)
        const textX = PAD + portraitSize + GAP
        nameText.setPosition(textX, PAD)
        bodyText.setPosition(textX, PAD + nameText.height + 1)

        // --- background panel + downward tail behind everything ---
        const bg = scene.add.graphics()
        bg.fillStyle(0x12131a, 0.92)
        bg.fillRoundedRect(0, 0, width, height, 4)
        if (record.tail) {
            bg.fillTriangle(
                width / 2 - TAIL, height,
                width / 2 + TAIL, height,
                width / 2, height + TAIL
            )
        }
        bg.lineStyle(1, border, 0.9)
        bg.strokeRoundedRect(0, 0, width, height, 4)

        const container = scene.add.container(0, 0,
            [bg, portrait, nameText, bodyText]).setDepth(DEPTH)

        record.container = container
        record.width = width
        record.height = height

        // Position immediately so it doesn't flash at (0,0) for one frame.
        this._reposition(record)

        // Schedule this line's hold -> advance-or-fade on the scene clock.
        const hold = record.durationOverride != null
            ? record.durationOverride
            : Math.min(HOLD_MAX, HOLD_BASE + HOLD_PER_CHAR * text.length)
        record.timer = scene.time.delayedCall(hold, () => this._advance(record))
    }

    // Move to the next line, or fade out if this was the last.
    _advance(record) {
        if (!this.active.has(record.speaker)) return
        if (record.lineIndex < record.lines.length - 1) {
            record.lineIndex += 1
            this._buildLine(record)
        } else {
            this._fadeOut(record)
        }
    }

    _fadeOut(record) {
        const scene = this.scene
        if (!record.container) { this._destroy(record.speaker); return }
        scene.tweens.add({
            targets: record.container,
            alpha: 0,
            duration: FADE,
            onComplete: () => this._destroy(record.speaker)
        })
    }

    // Called every tick from World.update(): keep each bubble pinned above
    // its speaker, hide it when the speaker is fogged, and tear it down if
    // the speaker's sprite is gone (death, pickup, floor change race).
    sync() {
        if (!this.active.size) return
        for (const record of this.active.values()) {
            const speaker = record.speaker
            const sprite = speaker.sprite
            if (!sprite || !sprite.active) { this._destroy(speaker); continue }
            // Once a speaker is engaged in combat a stray pre-combat bubble
            // (growl, idle chatter) would sit over its HP bar — drop it so the
            // fight reads clearly. Intentional combat lines (combat:true) are
            // exempt; they're meant to be heard mid-fight and render below the
            // HP bar / damage numbers anyway.
            if (!record.persistInCombat && speaker.isEngaged && speaker.isEngaged()) {
                this._destroy(speaker); continue
            }
            if (record.container) {
                record.container.setVisible(sprite.visible)
                if (sprite.visible) this._reposition(record)
            }
        }
    }

    _reposition(record) {
        const sprite = record.speaker.sprite
        if (!sprite || !record.container) return
        // sprite origin is (0,0) over a 16px tile, so its horizontal centre
        // is sprite.x + 8 and its top is sprite.y. Centre the bubble over
        // the actor and float it just above the head.
        record.container.x = Math.round(sprite.x + 8 - record.width / 2)
        record.container.y = Math.round(sprite.y - record.height - GAP_ABOVE_SPRITE)
    }

    _destroy(speaker) {
        const record = this.active.get(speaker)
        if (!record) return
        if (record.timer) record.timer.remove(false)
        if (record.container) record.container.destroy()
        this.active.delete(speaker)
    }

    // Drop every active bubble (floor transition / explicit teardown).
    clear() {
        for (const speaker of [...this.active.keys()]) this._destroy(speaker)
    }
}

export default new SpeechBubble()
