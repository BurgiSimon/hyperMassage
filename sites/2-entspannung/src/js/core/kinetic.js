import gsap from 'gsap'
import { qsa, clamp } from '../utils/helpers.js'
import { pointer } from './pointer.js'

/*
 * Kinetic type.
 * Every letter carries a tension value `--k` (CSS maps it onto the variable font's
 * width and weight axes): 1 = clenched (narrow, heavy), 0 = at rest, < 0 = relaxed
 * (wide, light). Letters are springs, so they wobble a little when they let go.
 */

const SPRING = { stiffness: 170, damping: 13 }

/** Spring step for a single value. */
export function spring(s, target, dt, { stiffness, damping } = SPRING) {
  const a = -stiffness * (s.v - target) - damping * s.vel
  s.vel += a * dt
  s.v += s.vel * dt
  return s
}

/**
 * Split text into words and letters and freeze the line breaks, so letters
 * can change width without the paragraph re-wrapping under the reader's eyes.
 */
export function splitKinetic(el) {
  // collapse ordinary whitespace only – a non-breaking space must keep its words together
  if (!el.dataset.kText) el.dataset.kText = el.textContent.replace(/[ \t\n\r\f]+/g, ' ').trim()
  const text = el.dataset.kText
  el.textContent = ''
  const sr = document.createElement('span')
  sr.className = 'sr-only'
  sr.textContent = text
  el.appendChild(sr)
  const visual = document.createElement('span')
  visual.className = 'kvis'
  visual.setAttribute('aria-hidden', 'true')
  el.appendChild(visual)
  // words, and compound words split after their hyphens so they can break there
  const words = []
  text.split(' ').forEach((word, i, all) => {
    const parts = word.split(/(?<=-)(?=.)/)
    parts.forEach((part, j) => {
      const w = document.createElement('span')
      w.className = 'kw'
      if (j < parts.length - 1) w.dataset.join = ''
      Array.from(part).forEach((ch) => {
        const c = document.createElement('span')
        c.className = 'kc'
        c.textContent = ch
        w.appendChild(c)
      })
      visual.appendChild(w)
      words.push(w)
    })
    if (i < all.length - 1) visual.appendChild(document.createTextNode(' '))
  })
  lockLines(visual, words)
  return qsa('.kc', el)
}

/** Group inline items into explicit line boxes based on where the browser broke them. */
export function lockLines(container, items) {
  // a new line starts wherever an item is not to the right of the one before it
  const lines = []
  let left = Infinity
  items.forEach((item) => {
    const l = item.getBoundingClientRect().left
    if (l <= left + 0.5) lines.push([])
    left = l
    lines[lines.length - 1].push(item)
  })
  container.textContent = ''
  lines.forEach((words) => {
    const line = document.createElement('span')
    line.className = 'kline'
    words.forEach((w, i) => {
      line.appendChild(w)
      if (i < words.length - 1 && !(w.dataset && 'join' in w.dataset)) line.appendChild(document.createTextNode(' '))
    })
    container.appendChild(line)
  })
  return lines
}

const wrapLetter = (node) => ({
  node,
  k: { v: 0, vel: 0 },
  x: { v: 0, vel: 0 },
  y: { v: 0, vel: 0 },
  cx: 0,
  cy: 0,
  lastK: null,
})

const active = new Set()
let running = false

function loop(_, deltaMs) {
  const dt = Math.min(deltaMs / 1000, 1 / 30)
  // read everything first, then write – one layout per frame instead of one per word
  active.forEach((k) => k.read())
  active.forEach((k) => k.write(dt))
}

function ensureLoop() {
  if (running) return
  running = true
  gsap.ticker.add(loop)
}

/**
 * Letters that relax when the pointer comes close (kneading), plus optional
 * per-letter gestures (used by the treatment list) and fit-to-width.
 */
export class Kinetic {
  constructor(el, opts = {}) {
    this.el = el
    this.opts = { radius: 170, strength: 0.85, knead: true, ...opts }
    this.letters = (opts.letters || splitKinetic(el)).map(wrapLetter)
    this.visible = false
    this.hot = false
    this.gesture = null
    this.t = 0
    this.settled = true
    ensureLoop()
  }

  setVisible(v) {
    this.visible = v
    if (v) active.add(this)
    else if (this.settled) active.delete(this)
  }

  measure() {
    for (const l of this.letters) {
      const r = l.node.getBoundingClientRect()
      l.cx = r.left + r.width / 2
      l.cy = r.top + r.height / 2
    }
  }

  read() {
    const { radius, knead } = this.opts
    this.near = false
    if (knead && pointer.active && this.visible) {
      const r = this.el.getBoundingClientRect()
      this.near =
        pointer.x > r.left - radius && pointer.x < r.right + radius && pointer.y > r.top - radius && pointer.y < r.bottom + radius
      if (this.near) this.measure()
    }
  }

  write(dt) {
    this.t += dt
    const { radius, strength } = this.opts
    const near = this.near
    let moving = false
    this.letters.forEach((l, i) => {
      let target = 0
      let tx = 0
      let ty = 0
      if (near) {
        const d = Math.hypot(pointer.x - l.cx, (pointer.y - l.cy) * 1.4)
        target -= strength * Math.max(0, 1 - d / radius) ** 2
      }
      let g = null
      if (this.gesture) {
        g = this.gesture(l, i, this.t, this.letters.length)
        target += g.k ?? 0
        tx = g.x ?? 0
        ty = g.y ?? 0
      }
      this.opts.onLetter?.(l, g)
      spring(l.k, target, dt)
      spring(l.x, tx, dt)
      spring(l.y, ty, dt)
      if (Math.abs(l.k.v - target) > 0.002 || Math.abs(l.k.vel) > 0.002 || Math.abs(l.x.v - tx) > 0.05 || Math.abs(l.y.v - ty) > 0.05)
        moving = true
      const kv = Math.round(l.k.v * 1000) / 1000
      if (kv !== l.lastK) {
        l.node.style.setProperty('--k', kv)
        l.lastK = kv
      }
      if (this.opts.move) l.node.style.transform = `translate(${l.x.v.toFixed(2)}px, ${l.y.v.toFixed(2)}px)`
    })
    this.opts.onTick?.(this)
    this.settled = !moving && !near && !this.gesture
    if (!this.visible && this.settled) active.delete(this)
  }

  /** Drive every letter's tension from outside (entrance animation, PMR squeeze). */
  set(values) {
    this.letters.forEach((l, i) => {
      l.k.v = typeof values === 'function' ? values(i) : values
      l.k.vel = 0
      l.node.style.setProperty('--k', l.k.v)
      l.lastK = l.k.v
    })
  }

  wake() {
    active.add(this)
  }

  /** Re-split after a width change (line breaks move). */
  rebuild() {
    if (this.opts.letters) return
    this.letters = splitKinetic(this.el).map(wrapLetter)
    this.wake()
  }
}

/** Shrink or grow the font size so `inner` exactly fills `outer`'s width. */
export function fitWidth(inner, outer, { max = Infinity, min = 8 } = {}) {
  const fs = parseFloat(getComputedStyle(inner).fontSize)
  const w = inner.getBoundingClientRect().width
  const target = outer.clientWidth
  if (!w || !target) return fs
  const next = clamp((fs * target) / w, min, max)
  if (Math.abs(next - fs) > 0.05) inner.style.fontSize = `${next}px`
  return next
}
