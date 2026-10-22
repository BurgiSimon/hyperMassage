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
export function whenNear(el, cb, rootMargin = '500px') {
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

/** Resolves once the web fonts are really loaded (or after a timeout). */
let fontsPromise = null
export function fontsReady(timeout = 3500) {
  if (fontsPromise) return fontsPromise
  const load = document.fonts
    ? Promise.all([
        document.fonts.load('italic 300 16px Cormorant'),
        document.fonts.load('400 16px Cormorant'),
        document.fonts.load('400 16px "Instrument Sans"'),
      ]).then(() => document.fonts.ready)
    : Promise.resolve()
  fontsPromise = Promise.race([load, new Promise((r) => setTimeout(r, timeout))]).catch(() => {})
  return fontsPromise
}

/** Current wall-clock time in Kestenholz (Europe/Zurich). */
let nowFmt
export function zurichNow() {
  const fmt = (nowFmt ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }))
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const hour = parseInt(parts.hour, 10)
  const minute = parseInt(parts.minute, 10)
  return { day: days[parts.weekday], hour, minute, decimal: hour + minute / 60 }
}

/** Opening hours (decimal hours, Europe/Zurich). */
export const HOURS = { 1: [7.5, 19], 2: [8, 19], 3: [7.5, 19], 4: [7.5, 19] }
export const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
export const fmtTime = (d, pad = false) => {
  let h = Math.floor(d)
  let m = Math.round((d - h) * 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  h = ((h % 24) + 24) % 24
  return `${pad ? String(h).padStart(2, '0') : h}:${String(m).padStart(2, '0')}`
}

export function openStatus(now = zurichNow()) {
  const today = HOURS[now.day]
  if (today && now.decimal >= today[0] && now.decimal < today[1]) return { open: true, text: `Jetzt geöffnet · bis ${fmtTime(today[1])}` }
  if (today && now.decimal < today[0]) return { open: false, text: `Heute ab ${fmtTime(today[0])} für dich da` }
  for (let i = 1; i <= 7; i++) {
    const d = (now.day + i) % 7
    if (HOURS[d]) return { open: false, text: `${i === 1 ? 'Morgen' : `Am ${DAY_NAMES[d]}`} ab ${fmtTime(HOURS[d][0])} wieder für dich da` }
  }
  return { open: false, text: 'Termine nur mit Voranmeldung' }
}

/** Words for the time of day. */
export function partOfDay(h) {
  const x = ((h % 24) + 24) % 24
  if (x < 5) return 'Nacht'
  if (x < 10) return 'Morgen'
  if (x < 12) return 'Vormittag'
  if (x < 14) return 'Mittag'
  if (x < 17.5) return 'Nachmittag'
  if (x < 21.5) return 'Abend'
  return 'Nacht'
}
