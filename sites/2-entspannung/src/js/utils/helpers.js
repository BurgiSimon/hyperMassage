export const qs = (sel, root = document) => root.querySelector(sel)
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Run `cb` once the element is near the viewport. */
export function whenNear(el, cb, rootMargin = '400px') {
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

/** Call `cb(visible)` whenever the element enters or leaves the screen. */
export function onVisibility(el, cb, rootMargin = '0px') {
  if (!el || !('IntersectionObserver' in window)) return cb(true)
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), { rootMargin })
  io.observe(el)
  return () => io.disconnect()
}

/**
 * Split an element's text into word and letter spans for kinetic type.
 * Screen readers get one untouched copy of the text.
 */
export function splitLetters(el) {
  if (el.dataset.split) return qsa('.kc', el)
  el.dataset.split = '1'
  const text = el.textContent.replace(/\s+/g, ' ').trim()
  el.textContent = ''
  const sr = document.createElement('span')
  sr.className = 'sr-only'
  sr.textContent = text
  el.appendChild(sr)
  const letters = []
  text.split(' ').forEach((word, i, words) => {
    const w = document.createElement('span')
    w.className = 'kw'
    w.setAttribute('aria-hidden', 'true')
    Array.from(word).forEach((ch) => {
      const c = document.createElement('span')
      c.className = 'kc'
      c.textContent = ch
      w.appendChild(c)
      letters.push(c)
    })
    el.appendChild(w)
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '))
  })
  return letters
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

/** Opening hours of the practice (decimal hours, Europe/Zurich). */
export const HOURS = {
  1: [7.5, 19],
  2: [8, 19],
  3: [7.5, 19],
  4: [7.5, 19],
}
export const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
export const fmtTime = (d) => `${Math.floor(d)}:${String(Math.round((d % 1) * 60)).padStart(2, '0')}`

/** Human status line: "Heute offen bis 19:00", "Öffnet morgen um 8:00" … */
export function openStatus(now = zurichNow()) {
  const today = HOURS[now.day]
  if (today && now.decimal >= today[0] && now.decimal < today[1]) {
    return { open: true, text: `Jetzt offen · bis ${fmtTime(today[1])}` }
  }
  if (today && now.decimal < today[0]) {
    return { open: false, text: `Öffnet heute um ${fmtTime(today[0])}` }
  }
  for (let i = 1; i <= 7; i++) {
    const d = (now.day + i) % 7
    if (HOURS[d]) {
      const when = i === 1 ? 'morgen' : `am ${DAY_NAMES[d]}`
      return { open: false, text: `Öffnet ${when} um ${fmtTime(HOURS[d][0])}` }
    }
  }
  return { open: false, text: 'Termine nur mit Voranmeldung' }
}

/**
 * Resolves once the two web fonts are really loaded (or after a timeout).
 * `document.fonts.ready` alone can resolve before a font has even been requested.
 */
let fontsPromise = null
export function fontsReady(timeout = 3500) {
  if (fontsPromise) return fontsPromise
  const load = document.fonts
    ? Promise.all([document.fonts.load('700 16px Anybody'), document.fonts.load('400 16px "Mona Sans"')]).then(() => document.fonts.ready)
    : Promise.resolve()
  fontsPromise = Promise.race([load, new Promise((r) => setTimeout(r, timeout))]).catch(() => {})
  return fontsPromise
}

/** Re-run `fn` when the viewport width really changes (not on mobile toolbar resizes). */
export function onWidthChange(fn) {
  let w = window.innerWidth
  let t = null
  window.addEventListener('resize', () => {
    clearTimeout(t)
    t = setTimeout(() => {
      if (Math.abs(window.innerWidth - w) < 2) return
      w = window.innerWidth
      fn()
    }, 180)
  })
}
