import tags from "./Tags.js"

export default class Taggable {
    addTagHandler(handlerName, handler) {
        if (!this._tagHandlers) {
            this._tagHandlers = {}
        }

        if (!this._tagHandlers[handlerName]) {
            this._tagHandlers[handlerName] = []
        }

        this._tagHandlers[handlerName].push(handler)
    }

    executeTag(handlerName, ret, ...args) {
        if (this._tagHandlers && this._tagHandlers[handlerName]) {
            this._tagHandlers[handlerName].forEach(handler => {
                args = [ret, ...args]
                ret = handler.apply(this, args)
            })
        }
        return ret
    }

    wrapFunction(handlerName) {
        if (!this._tagHandlers || !this._tagHandlers[handlerName]) {
            let originalFunction = this[handlerName]
            this[handlerName] = (...args) => {
                let ret = originalFunction.apply(this, args)
                return this.executeTag(handlerName, ret, ...args)
            }
        }
    }

    addTag(template, ...initArgs) {
        let tag = {}
        Object.assign(tag, template)

        let name = tag.name
        delete tag.name

        if (this._tags && this._tags.includes(name)) {
            return this
        }

        // initArgs forwards to initialize(...) so callers can parameterize a
        // status (e.g. addTag(rooted, 1) for a 1-turn root). No args -> defaults.
        tag.initialize.apply(this, initArgs)
        delete tag.initialize
        // cleanup is the teardown counterpart to initialize — invoked by
        // removeTag, never registered as a tag handler. Drop it before
        // wiring handlers so it isn't wrapped onto the entity (e.g. it
        // would otherwise clobber BaseHero.cleanup()).
        delete tag.cleanup

        let keys = Object.keys(tag)
        keys.forEach(handlerName => {
            this.wrapFunction(handlerName)
            this.addTagHandler(handlerName, tag[handlerName])
        })

        if (!this._tags) {
            this._tags = [name]
        } else {
            this._tags.push(name)
        }

        return this
    }

    removeTag(template) {
        let tag = {}
        Object.assign(tag, template)

        let name = tag.name
        delete tag.name
        delete tag.initialize
        let cleanup = tag.cleanup
        delete tag.cleanup

        let keys = Object.keys(tag)
        keys.forEach(handlerName => {
            let functionAsString = tag[handlerName].toString()
            let handlersAsString = this._tagHandlers[handlerName].map(handler => handler.toString())
            let index = handlersAsString.findIndex(handlerAsString => handlerAsString == functionAsString)
            this._tagHandlers[handlerName].splice(index, 1)
        })

        let tagPosition = this._tags.findIndex(tag => tag == name)
        this._tags.splice(tagPosition, 1)

        // Teardown counterpart to initialize: a status that set a sprite
        // tint/alpha (or any other side effect) in initialize restores it
        // here, so an early cleanse/dispel doesn't leave the state stuck.
        // Runs after handlers are detached and the name is cleared.
        if (typeof cleanup === "function") cleanup.apply(this)
    }

    addTags(templateNames) {

        templateNames.forEach(t => {
            if (tags[t]) {
                this.addTag(tags[t])
            }
        })
        return this
    }

    // --- Passives (entity-agnostic) -----------------------------------------
    // A Passive is an always-on ability attached to this entity; its apply()
    // attaches trait tag(s) (and may grant abilities), remove() detaches them.
    // BaseHero applies profile.passives at construction; these helpers add the
    // DYNAMIC path — granting/removing a passive at runtime (e.g. a player
    // selecting the Tame passive, or an enemy carrying one). Lives on Taggable so
    // heroes, enemies, and items all share one passives API.

    grantPassive(PassiveClass) {
        if (!this.passives) this.passives = []
        if (this.passives.some(p => p instanceof PassiveClass)) return null   // de-dupe
        const passive = new PassiveClass(this)
        this.passives.push(passive)
        passive.apply()
        return passive
    }

    removePassive(PassiveClass) {
        if (!this.passives) return null
        const i = this.passives.findIndex(p => p instanceof PassiveClass)
        if (i < 0) return null
        const [passive] = this.passives.splice(i, 1)
        passive.remove?.()
        return passive
    }

    hasPassive(PassiveClass) {
        return !!this.passives && this.passives.some(p => p instanceof PassiveClass)
    }
}