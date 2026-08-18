import mapState from "./MapState.js"

export function chebyshevDistance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function inDetectionRange(observer, target, radius) {
    return chebyshevDistance(observer, target) <= radius
}

export function canSee(observer, target) {
    // Targets burrowed underground (Dwarf Dig) or hidden in stealth
    // (Elf Stealth) are unseeable. Applies to every perception consumer
    // that goes through canSee — enemy notice checks, FoW reveal,
    // ability targeting — so these statuses uniformly block every
    // "do you see X?" question.
    if (target?._tags?.includes("Underground")) return false
    if (target?._tags?.includes("Invisible")) return false
    return mapState.hasLineOfSight(observer, target)
}

export function detects(observer, target, radius) {
    return inDetectionRange(observer, target, radius) && canSee(observer, target)
}

// Is the target inside the observer's forward vision cone? `coneDegrees` is
// the FULL cone width (90 => ±45 off the facing direction). Enemies gate
// updatePerception on this so they only notice what's in front of them, not
// a perfect 360. Two always-true escapes keep it from feeling broken:
//   - no facing yet (freshly spawned / hydrated) => omnidirectional
//   - point-blank (Chebyshev <= 1) => sensed regardless of facing, so an
//     enemy never ignores someone standing right next to it (melee stays sane)
export function inVisionCone(observer, target, coneDegrees) {
    const facing = observer.facing
    if (!facing || (facing.dx === 0 && facing.dy === 0)) return true

    const tdx = target.x - observer.x
    const tdy = target.y - observer.y
    if (tdx === 0 && tdy === 0) return true
    if (Math.max(Math.abs(tdx), Math.abs(tdy)) <= 1) return true

    const fLen = Math.hypot(facing.dx, facing.dy)
    const tLen = Math.hypot(tdx, tdy)
    const dot = (facing.dx * tdx + facing.dy * tdy) / (fLen * tLen)
    const halfAngleCos = Math.cos((coneDegrees / 2) * (Math.PI / 180))
    return dot >= halfAngleCos
}
