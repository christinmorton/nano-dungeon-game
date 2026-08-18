// Hover-tooltip for in-world entities. Shows the entity's name, tag list,
// description, and (for enemies) HP next to the cursor. Lives at depth
// 1000 with scrollFactor 0 so it stays pinned to screen coordinates while
// the world camera moves.
//
// Singleton, mirrors the lifecycle of the World scene: bind() is called
// from Dungeon.initialize each time the scene is created (re-bound on
// every floor entry because scene.restart() destroys the text object).
// attach(entity) is called from Dungeon.initializeEntity to wire pointer
// events onto an entity's sprite.

class WorldTooltip {
    constructor() {
        this.text = null
    }

    bind(scene) {
        this.text = scene.add.text(0, 0, '', {
            font: '11px Arial',
            color: '#fff',
            backgroundColor: '#000000cc',
            padding: { x: 6, y: 4 },
            wordWrap: { width: 200 }
        }).setDepth(1000).setScrollFactor(0).setVisible(false)
    }

    show(entity, pointer) {
        if (!this.text) return
        const lines = [entity.name]
        // Universal rank (modules/Rank.js) — items expose rankKey(); other nouns
        // can adopt it later and show the same way.
        if (typeof entity.rankKey === 'function') {
            lines.push(`Rank ${entity.rankKey()}`)
        }
        if (entity._tags && entity._tags.length) {
            lines.push(entity._tags.map(t => `#${t}`).join(', '))
        }
        if (entity.description) lines.push(entity.description)
        if (entity.type === "enemy" && entity.healthPoints != null) {
            const max = entity._maxHp || entity.maxHealthPoints || entity.healthPoints
            lines.push(`HP: ${Math.max(0, entity.healthPoints)}/${max}`)
        }
        // Captain identifier — visible at a glance when hovering. Shows
        // playbook, command radius, and most recent command. Formation
        // captains also surface the current phase (gather/hold/break)
        // so the dev can correlate behavior to state.
        if (entity.archetype === "captain") {
            const playbook = entity.playbook || "blitz"
            lines.push(`Captain · ${playbook} · radius ${entity.commandRadius ?? 5}`)
            if (entity.playbookState && entity.playbookState.phase) {
                lines.push(`Phase: ${entity.playbookState.phase}`)
            }
            if (entity.lastCommand) lines.push(`Last: ${entity.lastCommand}`)
        }
        // Active order display for any enemy currently under a Captain's
        // order. Surfaces even before the order's availableAt tick so
        // the dev can see the order in-flight; archetypes still gate
        // execution on _readCurrentOrder.
        if (entity.type === "enemy" && entity.currentOrder) {
            const o = entity.currentOrder
            lines.push(`Order: ${o.command} (${o.persistent ? "persistent" : "one-shot"})`)
        }
        this.text.setText(lines.join('\n'))

        // Default to bottom-right of cursor. If that would overflow the
        // camera viewport, flip the tooltip to the other side of the
        // cursor; finally clamp to a small margin so it never sits
        // flush against the edge.
        const camera = this.text.scene.cameras.main
        const offset = 12
        const margin = 4
        let x = pointer.x + offset
        let y = pointer.y + offset
        if (x + this.text.width > camera.width - margin) {
            x = pointer.x - this.text.width - offset
        }
        if (y + this.text.height > camera.height - margin) {
            y = pointer.y - this.text.height - offset
        }
        x = Math.max(margin, x)
        y = Math.max(margin, y)
        this.text.setPosition(x, y)
        this.text.setVisible(true)
    }

    hide() {
        if (this.text) this.text.setVisible(false)
    }

    // Wire the entity's sprite for hover. Also flips it interactive so
    // pointer events actually fire. Caller decides which entity types
    // get tooltips (hero is currently excluded).
    attach(entity) {
        if (!entity.sprite) return
        entity.sprite.setInteractive({ useHandCursor: true })
        entity.sprite.on('pointerover', (pointer) => this.show(entity, pointer))
        entity.sprite.on('pointerout', () => this.hide())
    }
}

export default new WorldTooltip()
