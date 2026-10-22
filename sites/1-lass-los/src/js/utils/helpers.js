export const qs = (sel, root = document) => root.querySelector(sel)
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const mapRange = (v, inMin, inMax, outMin, outMax) =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)

export const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Run `cb` once the element is near the viewport. */
export function whenNear(el, cb, rootMargin = '300px') {
  if (!el) return
  if (!('IntersectionObserver' in window)) return cb()
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        cb()
      }
    },
    { rootMargin },
  )
  io.observe(el)
}

/** Toggle `cb(visible)` while the element is (not) on screen. */
export function onVisibility(el, cb, rootMargin = '0px') {
  if (!el || !('IntersectionObserver' in window)) return cb(true)
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), { rootMargin })
  io.observe(el)
  return () => io.disconnect()
}

/** Split an element's text nodes into word spans, preserving inline children. */
export function splitWords(root) {
  const words = []
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/)
        const frag = document.createDocumentFragment()
        parts.forEach((part) => {
          if (!part) return
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '))
          } else {
            const span = document.createElement('span')
            span.className = 'word'
            span.textContent = part
            frag.appendChild(span)
            words.push(span)
          }
        })
        child.replaceWith(frag)
      } else if (child.nodeType === Node.ELEMENT_NODE && !child.matches('.pill, canvas, svg')) {
        walk(child)
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        words.push(child)
      }
    })
  }
  walk(root)
  return words
}

/** Split plain text of an element into character spans. */
export function splitChars(el, className = 'char') {
  const text = el.textContent
  el.textContent = ''
  const sr = document.createElement('span')
  sr.className = 'visually-hidden'
  sr.textContent = text
  el.appendChild(sr)
  return Array.from(text).map((ch) => {
    const span = document.createElement('span')
    span.className = className
    span.setAttribute('aria-hidden', 'true')
    span.textContent = ch === ' ' ? ' ' : ch
    el.appendChild(span)
    return span
  })
}

/** Wrap [data-roll] contents for the rolling hover effect. */
export function initRollText(root = document) {
  qsa('[data-roll]', root).forEach((el) => {
    if (el.dataset.rollReady) return
    const text = el.textContent
    el.dataset.rollReady = '1'
    el.classList.add('roll')
    el.innerHTML = ''
    const a = document.createElement('span')
    a.className = 'roll__a'
    a.textContent = text
    const b = document.createElement('span')
    b.className = 'roll__b'
    b.setAttribute('aria-hidden', 'true')
    b.textContent = text
    el.append(a, b)
  })
}

export function setRollText(el, text) {
  if (!el) return
  if (!el.dataset.rollReady) {
    el.textContent = text
    return
  }
  el.querySelectorAll('.roll__a, .roll__b').forEach((s) => (s.textContent = text))
}

/** Current wall-clock time in Kestenholz (Europe/Zurich). */
export function zurichNow() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const hour = parseInt(parts.hour, 10)
  const minute = parseInt(parts.minute, 10)
  return { day: days[parts.weekday], hour, minute, decimal: hour + minute / 60 }
}
