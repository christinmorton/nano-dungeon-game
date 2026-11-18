// The name -> template registry Taggable.addTags() resolves against.
//
// v5 caps statuses at TWELVE (scope doc section 5). v3's tags/ directory holds 170
// files, but that number is the ability encyclopedia, not the status system - every
// status here is a small self-contained module built on defineStatus.
//
// Deliberately NOT carried over from v3's Tags.js:
//   - getRandomTagsForItem + the golden/silver/iron materials. v5 items are flat,
//     with no tier or rarity field, so there is nothing for a material to modify.
//   - getRandomTagsForEnemy + the aggro/crafty/fast/royal modifiers. These are cheap
//     variety on a capped roster and may earn their way back in - but that is a
//     scope change and goes through section 9, not a quiet re-add here.
//   - statusList.js, which registers ~90 statuses by name. v5 references its twelve
//     directly, so the indirection has nothing to do.
//
// KEEP THIS LIST COMPLETE. A status missing here still works when applied with a
// direct addTag(template), which is most call sites — so the gap is invisible
// until something resolves it BY NAME and silently gets nothing. That is exactly
// how `sense` sat unregistered from 2026-09-10 until it was noticed on 2026-09-20.
// Hazards.applyStatuses (used by every ZoneEffect and trap) is a by-name caller.
//
// Statuses are usually applied with addTag(template) directly; this registry exists
// for the addTags(["name"]) path, where the caller only has strings.
import burning from "./tags/burning.js"
import poison from "./tags/poison.js"
import stun from "./tags/stun.js"
import rooted from "./tags/rooted.js"
import slow from "./tags/slow.js"
import weaken from "./tags/weaken.js"
import shield from "./tags/shield.js"
import bulwark from "./tags/bulwark.js"
import barrier from "./tags/barrier.js"
import invisible from "./tags/invisible.js"
import sense from "./tags/sense.js"
import corrupted from "./tags/corrupted.js"

const tags = {
    burning,
    poison,
    stun,
    rooted,
    slow,
    weaken,
    shield,
    bulwark,
    barrier,
    invisible,
    sense,
    corrupted,
}

export default tags
