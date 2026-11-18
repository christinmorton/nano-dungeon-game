import dungeon from "../Dungeon.js"
import router from "../SceneRouter.js"
import run from "../Run.js"
import audio from "../Audio.js"

// The shared end-of-run screen, rendered by both GameOver and QuestComplete.
//
// Written down from v3's 225 lines rather than pruned, because most of its back
// half is the meta-progression layer v5 cuts: account.recordRun and the LIFETIME
// stats column beside each row, the personal-best comparison, the skillbook
// "abilities banked / lost on death" line, and the whole hero-roster commit —
// run.commitOnDeath / commitOnWin and the "Keep this hero? [S]ave / [D]ismiss"
// prompt. Those two Run methods do not even exist in v5; they were deleted on the
// first day of the port, so that block could never have run.
//
// What survives is the part that describes THIS run: score, the breakdown that
// earned it, how long it took, and a key to start again. The scoring maths and
// the clock helper are v3's, verbatim.

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_WIN = "#86efac"
const COLOR_LOSS = "#fca5a5"

export function renderEndScreen(scene, { title, isWin }) {
    const cx = GAME_W / 2

    // The run is over: cut the floor loop and let the fanfare have the room.
    // Re-bound to this scene because World has stopped by now, and the manager
    // holds the last scene that bound it.
    audio.bind(scene)
    audio.stopMusic()
    audio.play(isWin ? 'fanfare-victory' : 'fanfare-defeat')

    // Fade in from black — the death window / win transition fades out first, so
    // the score screen rises smoothly out of black instead of hard-cutting.
    scene.cameras.main.fadeIn(400, 0, 0, 0)
    const stats = run.stats || {}
    const tallies = (dungeon.player && dungeon.player.tallies) || { coins: 0, keys: 0 }
    const score = run.computeScore()

    scene.add.text(cx, 80, title, {
        font: "84px Arial",
        color: isWin ? COLOR_WIN : COLOR_LOSS
    }).setOrigin(0.5)

    scene.add.text(cx, 180, `Score: ${score}`, {
        font: "44px Arial",
        color: COLOR_PRIMARY
    }).setOrigin(0.5)

    // Breakdown table
    const breakdownY = 270
    scene.add.text(cx, breakdownY, "BREAKDOWN", {
        font: "14px Arial",
        color: COLOR_DIM
    }).setOrigin(0.5)

    const breakdown = computeBreakdown(stats)
    const rowH = 24
    const labelX = cx - 130
    const valueX = cx + 60
    const pointsX = cx + 130

    breakdown.rows.forEach((row, i) => {
        const y = breakdownY + 26 + i * rowH
        scene.add.text(labelX, y, row.label, { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)
        scene.add.text(valueX, y, String(row.value), { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)
        const pointsColor = row.points < 0 ? COLOR_LOSS : COLOR_PRIMARY
        const pointsText = (row.points >= 0 ? "+" : "") + row.points
        scene.add.text(pointsX, y, pointsText, { font: "16px Arial", color: pointsColor }).setOrigin(1, 0.5)
    })

    const totalY = breakdownY + 26 + breakdown.rows.length * rowH + 6
    scene.add.rectangle(cx, totalY, 280, 1, 0x4a4a4a)
    scene.add.text(labelX, totalY + 16, "Total", { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(0, 0.5)
    scene.add.text(pointsX, totalY + 16, String(breakdown.total), { font: "16px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)

    // Play-time summary — informational, not scored.
    const timeSummary = typeof run.timeSummary === "function" ? run.timeSummary() : null
    if (timeSummary && timeSummary.records.length) {
        const floors = timeSummary.records.length
        scene.add.text(cx, totalY + 44,
            `Run time ${fmtClock(timeSummary.totalSeconds)}  ·  ${floors} floor${floors === 1 ? "" : "s"}  ·  ${timeSummary.totalRounds} rounds`,
            { font: "14px Arial", color: COLOR_ACCENT }
        ).setOrigin(0.5)
    }

    // This run's tallies. v3 rendered these beside a LIFETIME column fed by the
    // account; with no account there is one column, centred.
    const summaryY = totalY + 76
    scene.add.text(cx, summaryY, "THIS RUN", {
        font: "14px Arial",
        color: COLOR_DIM
    }).setOrigin(0.5)

    const summaryRows = [
        { label: "Coins", value: tallies.coins || 0 },
        { label: "Keys", value: tallies.keys || 0 },
        { label: "Outcome", value: isWin ? "Win" : "Loss" },
    ]

    summaryRows.forEach((row, i) => {
        const y = summaryY + 26 + i * 22
        scene.add.text(cx - 60, y, row.label, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
        scene.add.text(cx + 60, y, String(row.value), { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)
    })

    // Any key starts over. router.toMenu() is a hard location.reload(), which in
    // v5 lands straight back in a fresh run — there is no Intro to return to yet,
    // and a reload is the reset mechanism v3 already used.
    scene.add.text(cx, GAME_H - 60, "Press any key to play again", {
        font: "18px Arial",
        color: COLOR_DIM
    }).setOrigin(0.5)

    scene.input.keyboard.once("keyup", () => {
        scene.cameras.main.fadeOut(400, 0, 0, 0)
        scene.cameras.main.once("camerafadeoutcomplete", () => {
            router.bind(scene)
            router.toMenu()
        })
    })
}

// m:ss clock for the play-time summary.
function fmtClock(sec) {
    const s = Math.max(0, Math.floor(sec))
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

function computeBreakdown(stats) {
    const floor = stats.deepestFloor || 1
    const kills = stats.kills || 0
    const items = stats.itemsFound || 0
    const turns = stats.turns || 0
    const turnsPenalty = -Math.floor(turns / 10)
    const rows = [
        { label: "Floor reached", value: floor, points: floor * 100 },
        { label: "Kills", value: kills, points: kills * 10 },
        { label: "Items found", value: items, points: items * 5 },
        { label: "Turns", value: turns, points: turnsPenalty }
    ]
    const total = Math.max(0, rows.reduce((sum, r) => sum + r.points, 0))
    return { rows, total }
}
