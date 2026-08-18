import run from '../Run.js'
import router from '../SceneRouter.js'
import { draftBasicPassiveOptions } from './affinityPassives.js'

// Shared basic-affinity attune flow (§14 affinity / §18). Grant `affinityKey` to
// `hero`, then give the slot its POOL passive: a COMMON source (passiveSelect false)
// rolls one at random; a RARE "select" source (passiveSelect true) stages a DRAFT of
// a few options and opens the DraftScreen. Advanced affinities carry no pool —
// grantAffinity attaches their fixed base passive itself — so this is a no-op there
// beyond the grant. Returns grantAffinity's result plus `drafted`.
//
// The ONE place this logic lives. Both acquisition surfaces call it so they attune
// identically: the essence ITEM (Consumable._attune, carried + used) and the essence
// FONT (components/EssenceFont, attuned in-world). It does NOT consume the source —
// the caller removes the item / spends the font on `ok`.
export function attuneAffinity(hero, affinityKey, { passiveSelect = false, empowered = false } = {}) {
    if (!hero?.grantAffinity) return { ok: false, reason: 'unknown' }
    const result = hero.grantAffinity(affinityKey, { empowered })
    if (!result.ok) return result

    // An empowered grant (a beast's gift) OR a rare "pure" essence gets to PICK its
    // pool passive from a draft of a few; a plain grant rolls one at random.
    const options = (passiveSelect || empowered) ? draftBasicPassiveOptions(affinityKey, 3) : []
    if (options.length > 1) {
        run.pendingPassiveDraft = { affinity: affinityKey, options }
        router.openDraft()
        return { ...result, drafted: true }
    }
    hero.rollBasicPassive?.()
    return { ...result, drafted: false }
}
