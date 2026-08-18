const COLOR = "#cfc6b8"
const CELL_SIZE = 80
const FONT = "12px monospace"

function fitCanvas(canvas) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
}

function draw(ctx, width, height) {
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = COLOR
    ctx.fillStyle = COLOR
    ctx.lineWidth = 1
    ctx.font = FONT
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const cols = Math.floor(width / CELL_SIZE)
    const rows = Math.floor(height / CELL_SIZE)
    const gridWidth = cols * CELL_SIZE
    const gridHeight = rows * CELL_SIZE

    // 0.5 offset keeps 1px lines crisp instead of being smeared across two pixel rows.
    for (let c = 0; c <= cols; c++) {
        const x = c * CELL_SIZE + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, gridHeight)
        ctx.stroke()
    }
    for (let r = 0; r <= rows; r++) {
        const y = r * CELL_SIZE + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(gridWidth, y)
        ctx.stroke()
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.fillText(
                `(${r}, ${c})`,
                c * CELL_SIZE + CELL_SIZE / 2,
                r * CELL_SIZE + CELL_SIZE / 2
            )
        }
    }
}

const canvas = document.getElementById("grid")
const ctx = canvas.getContext("2d")

function render() {
    fitCanvas(canvas)
    draw(ctx, canvas.width, canvas.height)
}

render()
window.addEventListener("resize", render)
