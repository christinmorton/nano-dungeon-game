// ObjectiveMeter — a reusable labeled progress bar. Deliberately decoupled
// from the encounter system: it just renders a 0..1 value + a label, so the
// same widget is the *view* for any objective's progress (the active battle
// today; a multi-floor quest or a boss phase later). The UI scene feeds it
// values each frame. See documents/v3_objective_driven_encounters.md.
//
// Continuous (filling bar) mode for now. Segmented (pips, for wave counts) is
// a future render mode on the same widget.

const DEPTH = 90
const FILL_COLOR = 0xffcc55
const BG_COLOR = 0x000000
const BORDER_COLOR = 0x4a4a4a

export default class ObjectiveMeter {
    constructor(scene, { x, y, width = 220, height = 12 } = {}) {
        this.scene = scene
        this._pad = 2
        this._maxFill = width - this._pad * 2

        this.label = scene.add.text(x, y - 4, '', { font: '12px Arial', color: '#e8e8e8' })
            .setOrigin(0.5, 1).setDepth(DEPTH + 1)
        this.bg = scene.add.rectangle(x, y, width, height, BG_COLOR, 0.55)
            .setOrigin(0.5, 0).setStrokeStyle(1, BORDER_COLOR).setDepth(DEPTH)
        this.fill = scene.add.rectangle(x - width / 2 + this._pad, y + this._pad, 0, height - this._pad * 2, FILL_COLOR)
            .setOrigin(0, 0).setDepth(DEPTH + 1)

        this.parts = [this.label, this.bg, this.fill]
        this.hide()
    }

    set(progress, label) {
        const p = Math.max(0, Math.min(1, progress || 0))
        this.fill.width = this._maxFill * p
        this.label.setText(label || '')
    }

    show() { this.parts.forEach(p => p.setVisible(true)) }
    hide() { this.parts.forEach(p => p.setVisible(false)) }
}
