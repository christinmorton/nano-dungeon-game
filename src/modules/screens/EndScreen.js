import dungeon from "../Dungeon.js"
import account from "../Account.js"
import router from "../SceneRouter.js"
import run from "../Run.js"
import { abilityByName } from "../classes/abilities/abilityRegistry.js"

const GAME_W = 80 * 16
const GAME_H = 50 * 16

const COLOR_PRIMARY = "#cfc6b8"
const COLOR_DIM = "#7a7466"
const COLOR_ACCENT = "#facc15"
const COLOR_WIN = "#86efac"
const COLOR_LOSS = "#fca5a5"

export function renderEndScreen(scene, { title, isWin }) {
    const cx = GAME_W / 2

    // Fade in from black — the death window / win transition fades out first,
    // so the score screen rises smoothly out of black instead of hard-cutting.
    scene.cameras.main.fadeIn(400, 0, 0, 0)
    const stats = run.stats || {}
    const tallies = (dungeon.player && dungeon.player.tallies) || { coins: 0, keys: 0 }
    const score = run.computeScore()
    const result = account.recordRun({ ...stats, ...tallies, score }, isWin ? "win" : "loss")
    const acc = result.account || {}

    // Skillbook extraction commit (§14 B3): abilities learned this run bank to the
    // account ONLY on a win; a death drops them. Resolve keys -> display names for
    // the feedback line.
    const learnedKeys = run.learnedAbilities || []
    const learnedNames = learnedKeys.map(k => abilityByName(k)?.name || k)
    if (isWin && learnedKeys.length) {
        account.commitLearned({ abilities: learnedKeys })
    }

    // Title
    scene.add.text(cx, 80, title, {
        font: "84px Arial",
        color: isWin ? COLOR_WIN : COLOR_LOSS
    }).setOrigin(0.5)

    // Total score
    scene.add.text(cx, 180, `Score: ${score}`, {
        font: "44px Arial",
        color: COLOR_PRIMARY
    }).setOrigin(0.5)

    // Best comparison
    if (result.isNewBest) {
        scene.add.text(cx, 230, "New personal best!", {
            font: "20px Arial",
            color: COLOR_ACCENT
        }).setOrigin(0.5)
    } else {
        const diff = score - result.previousBest
        const diffText = diff < 0
            ? `${diff} from your best (${result.previousBest}, floor ${result.previousBestFloor})`
            : `Tied your best (${result.previousBest})`
        scene.add.text(cx, 230, diffText, {
            font: "16px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)
    }

    // Breakdown table
    const breakdownY = 290
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

    // Play-time summary (run-time budgeting) — informational, not scored. Shows how
    // long the run actually took, which calibrates the run-length presets.
    const timeSummary = typeof run.timeSummary === "function" ? run.timeSummary() : null
    if (timeSummary && timeSummary.records.length) {
        const floors = timeSummary.records.length
        scene.add.text(cx, totalY + 42,
            `Run time ${fmtClock(timeSummary.totalSeconds)}  ·  ${floors} floor${floors === 1 ? "" : "s"}  ·  ${timeSummary.totalRounds} rounds`,
            { font: "14px Arial", color: COLOR_ACCENT }
        ).setOrigin(0.5)
    }

    // This run / Lifetime side-by-side
    const summaryY = totalY + 70
    const colLeftX = cx - 110
    const colRightX = cx + 110

    scene.add.text(colLeftX, summaryY, "THIS RUN", {
        font: "14px Arial",
        color: COLOR_DIM
    }).setOrigin(0.5)
    scene.add.text(colRightX, summaryY, "LIFETIME", {
        font: "14px Arial",
        color: COLOR_DIM
    }).setOrigin(0.5)

    const summaryRows = [
        { label: "Coins", thisRun: tallies.coins || 0, lifetime: acc.lifetimeCoins || 0 },
        { label: "Keys", thisRun: tallies.keys || 0, lifetime: acc.lifetimeKeys || 0 },
        { label: "Runs", thisRun: outcomeLabel(isWin), lifetime: `${acc.runsCompleted || 0}/${acc.runsAttempted || 0}` }
    ]

    summaryRows.forEach((row, i) => {
        const y = summaryY + 26 + i * 22
        scene.add.text(colLeftX - 60, y, row.label, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
        scene.add.text(colLeftX + 60, y, String(row.thisRun), { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)
        scene.add.text(colRightX - 60, y, row.label, { font: "14px Arial", color: COLOR_DIM }).setOrigin(0, 0.5)
        scene.add.text(colRightX + 60, y, String(row.lifetime), { font: "14px Arial", color: COLOR_PRIMARY }).setOrigin(1, 0.5)
    })

    // Skillbook feedback — what this run's learning earned or cost.
    if (learnedNames.length) {
        const learnedText = isWin
            ? `Abilities banked to your account: ${learnedNames.join(", ")}`
            : `Lost on death: ${learnedNames.join(", ")}`
        scene.add.text(cx, GAME_H - 95, learnedText, {
            font: "15px Arial",
            color: isWin ? COLOR_WIN : COLOR_LOSS
        }).setOrigin(0.5)
    }

    // --- Hero-roster commit (rebuild phase 6b) ---------------------------------
    // The in-flight hero from this run (null in the arena, or a run that skipped the
    // 6a creation flow — the block then degrades to the old "press any key" behavior).
    const hero = run.character

    const returnToMenu = () => {
        scene.cameras.main.fadeOut(400, 0, 0, 0)
        scene.cameras.main.once("camerafadeoutcomplete", () => {
            router.bind(scene)
            router.toMenu()
        })
    }

    // DEATH = permadeath (doc §4.2): a saved/continued hero falls to the Fallen wall
    // with a death record; a brand-new hero that was never saved to the roster simply
    // doesn't persist (commitOnDeath returns null — nothing to move).
    if (!isWin && hero) run.commitOnDeath(account, {})

    if (isWin && hero) {
        // WIN: the player CHOOSES whether to save this hero to their roster (doc §4.1).
        const prompt = scene.add.text(cx, GAME_H - 62,
            `Keep ${hero.name}?    [S] Save to roster    [D] Let them go`,
            { font: "16px Arial", color: COLOR_ACCENT }).setOrigin(0.5)
        const footer = scene.add.text(cx, GAME_H - 34, "", {
            font: "14px Arial", color: COLOR_DIM
        }).setOrigin(0.5)

        let decided = false
        const decide = (save) => {
            if (decided) return
            decided = true
            if (save) {
                const saved = run.commitOnWin(account, {})
                if (saved) prompt.setText(`${hero.name} joins your roster.`).setColor(COLOR_WIN)
                else prompt.setText(`Roster full — free a slot at the hall to keep ${hero.name}.`).setColor(COLOR_LOSS)
            } else {
                prompt.setText(`${hero.name} goes their own way.`).setColor(COLOR_DIM)
            }
            footer.setText("Press any key to return to menu")
            scene.input.keyboard.once("keyup", returnToMenu)
        }

        scene.input.keyboard.on("keyup", (e) => {
            if (decided) return
            const k = (e.key || "").toLowerCase()
            if (k === "s") decide(true)
            else if (k === "d") decide(false)
        })
    } else {
        // Loss, or no in-flight hero: the classic single-key return.
        scene.add.text(cx, GAME_H - 60, "Press any key to return to menu", {
            font: "18px Arial",
            color: COLOR_DIM
        }).setOrigin(0.5)
        scene.input.keyboard.once("keyup", returnToMenu)
    }
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

function outcomeLabel(isWin) {
    return isWin ? "Win" : "Loss"
}
