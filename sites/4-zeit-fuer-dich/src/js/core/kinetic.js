import gsap from 'gsap'
import { qsa, clamp } from '../utils/helpers.js'
import { pointer } from './pointer.js'

/*
 * Kinetic type, after site 2 («Entspannung»), set in Fraunces.
 * Every letter carries a tension value `--k` (CSS maps it onto weight and the
 * SOFT axis): −1 = tense (heavy, sharp), 0 = at rest, 1 = relaxed (light, soft).
 * Letters are springs: a headline arrives tense and exhales, and letters near
 * your pointer (or finger) let go a little more, like muscles under a hand.
 */

const SPRING = { stiffness: 120, damping: 11 }
const SPACE = /([ \t\n\r\f]+)/ // (not \s: a non-breaking space keeps its words together)

/** Spring step for a single value. */
export function spring(s, target, dt, { stiffness, damping } = SPRING) {
  const a = -stiffness * (s.v - target) - damping * s.vel
  s.vel += a * dt
  s.v += s.vel * dt
  return s
}

/**
 * Split an element's text into words (and letters), keeping inline markup such as <em>.
 * Screen readers get the plain sentence; the visual copy is hidden from them.
 * Returns the word spans; letters are `.kc` inside them when `letters` is set.
 */
export function splitText(el, { letters = true, wordClass = 'kw' } = {}) {
  if (el.__kSrc === undefined) el.__kSrc = el.innerHTML
  el.innerHTML = el.__kSrc
  const plain = el.textContent.replace(/[ \t\n\r\f]+/g, ' ').trim()
  const visual = document.createElement('span')
  visual.className = 'kvis'
  visual.setAttribute('aria-hidden', 'true')
  while (el.firstChild) visual.appendChild(el.firstChild)
  const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT)
  const texts = []
  while (walker.nextNode()) texts.push(walker.currentNode)
  const words = []
  texts.forEach((node) => {
    const frag = document.createDocumentFragment()
    node.textContent.split(SPACE).forEach((part) => {
      if (!part) return
      if (SPACE.test(part)) {
        frag.appendChild(document.createTextNode(' '))
        return
      }
      const w = document.createElement('span')
      w.className = wordClass
      if (letters) {
        for (const ch of part) {
          const c = document.createElement('span')
          c.className = 'kc'
          c.textContent = ch
          w.appendChild(c)
        }
      } else w.textContent = part
      frag.appendChild(w)
      words.push(w)
    })
    node.replaceWith(frag)
  })
  const sr = document.createElement('span')
  sr.className = 'sr-only'
  sr.textContent = plain
  el.append(sr, visual)
  return { visual, words }
}

/** Freeze the line breaks the browser chose, so letters can change width without the text re-wrapping. */
export function freezeLines(visual, words) {
  visual.classList.remove('is-frozen')
  visual.querySelectorAll('br[data-k]').forEach((br) => br.remove())
  let lastTop = null
  const breaks = []
  for (const w of words) {
    const top = w.getBoundingClientRect().top
    if (lastTop !== null && top > lastTop + 4) breaks.push(w)
    lastTop = top
  }
  for (const w of breaks) {
    const br = document.createElement('br')
    br.dataset.k = ''
    w.parentNode.insertBefore(br, w)
  }
  visual.classList.add('is-frozen')
}

const active = new Set()
let running = false
function loop(_, deltaMs) {
  const dt = Math.min(deltaMs / 1000, 1 / 30)
  // read everything first, then write – one layout per frame instead of one per heading
  active.forEach((k) => k.read())
  active.forEach((k) => k.write(dt))
}
function ensureLoop() {
  if (running) return
  running = true
  gsap.ticker.add(loop)
}

export class Kinetic {
  /**
   * @param {HTMLElement} el
   * @param {{ radius?: number, strength?: number, start?: number }} opts
   *   start: the tension the letters wait in before `release()` (−1 = tense)
   */
  constructor(el, opts = {}) {
    this.el = el
    this.opts = { radius: 190, strength: 0.9, start: -1, stagger: 0.028, ...opts }
    this.offset = 0 // added to every letter (scroll, breath …)
    this.split()
    this.visible = false
    this.released = null
    this.t = 0
    this.settled = false
    ensureLoop()
  }

  split() {
    const { words } = splitText(this.el)
    this.words = words
    this.visual = this.el.querySelector('.kvis')
    const start = this.released === null || this.released === undefined ? this.opts.start : 0
    this.letters = qsa('.kc', this.visual).map((node) => ({ node, k: { v: start, vel: 0 }, cx: 0, cy: 0, last: null }))
    this.letters.forEach((l) => this.paint(l))
    freezeLines(this.visual, this.words)
  }

  /** after a width change: measure the line breaks again */
  rebuild() {
    this.split()
    this.wake()
  }

  /** the letters exhale (staggered), from their waiting tension to rest */
  release(delay = 0) {
    this.released = this.t + delay
    this.wake()
  }

  setVisible(v) {
    this.visible = v
    if (v) this.wake()
  }

  wake() {
    this.settled = false
    active.add(this)
  }

  read() {
    const { radius } = this.opts
    this.near = false
    if (!pointer.active || !this.visible) return
    const r = this.el.getBoundingClientRect()
    this.near = pointer.x > r.left - radius && pointer.x < r.right + radius && pointer.y > r.top - radius && pointer.y < r.bottom + radius
    if (!this.near) return
    for (const l of this.letters) {
      const b = l.node.getBoundingClientRect()
      l.cx = b.left + b.width / 2
      l.cy = b.top + b.height / 2
      l.h = b.height
    }
  }

  paint(l) {
    const kv = Math.round(l.k.v * 1000) / 1000
    if (kv === l.last) return
    l.last = kv
    l.node.style.setProperty('--k', kv)
  }

  write(dt) {
    this.t += dt
    const { radius, strength, stagger, start } = this.opts
    let moving = false
    this.letters.forEach((l, i) => {
      const waiting = this.released === null || this.t < this.released + i * stagger
      let target = (waiting ? start : 0) + this.offset
      if (this.near) {
        const r = Math.max(radius * 0.6, (l.h || 0) * 1.1)
        const d = Math.hypot(pointer.x - l.cx, (pointer.y - l.cy) * 1.3)
        target += strength * Math.max(0, 1 - d / r) ** 2
      }
      target = clamp(target, -1.2, 1.2)
      spring(l.k, target, dt)
      if (Math.abs(l.k.v - target) > 0.002 || Math.abs(l.k.vel) > 0.002) moving = true
      this.paint(l)
    })
    const waitingAny = this.released !== null && this.t < this.released + this.letters.length * stagger
    this.settled = !moving && !this.near && !waitingAny
    // (visible headings stay in the loop: the pointer may come close any time)
    if (this.settled && !this.visible) active.delete(this)
  }
}
