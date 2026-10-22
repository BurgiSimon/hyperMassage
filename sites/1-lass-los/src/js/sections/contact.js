import gsap from 'gsap'
import { qs, qsa, splitChars, zurichNow } from '../utils/helpers.js'

const RANGE_START = 7
const RANGE_END = 19
const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

const fmt = (h) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}:${String(mm).padStart(2, '0')}`
}

/** Opening hours as small timelines, with today and "now" highlighted. */
export function initHours() {
  const box = qs('[data-hours]')
  if (!box) return
  const status = qs('[data-hours-status]', box)
  const days = qsa('.hours__day', box)

  days.forEach((li) => {
    const open = parseFloat(li.dataset.open)
    const close = parseFloat(li.dataset.close)
    if (Number.isNaN(open)) return
    const bar = qs('.hours__bar', li)
    bar.style.setProperty('--from', `${((open - RANGE_START) / (RANGE_END - RANGE_START)) * 100}%`)
    bar.style.setProperty('--to', `${((RANGE_END - close) / (RANGE_END - RANGE_START)) * 100}%`)
  })

  const update = () => {
    const now = zurichNow()
    let todayLi = null
    days.forEach((li) => {
      const isToday = li.dataset.day.split(',').map(Number).includes(now.day)
      li.classList.toggle('is-today', isToday)
      qs('.hours__bar b', li)?.remove()
      if (isToday) todayLi = li
    })

    const open = parseFloat(todayLi?.dataset.open)
    const close = parseFloat(todayLi?.dataset.close)
    const hasHours = !Number.isNaN(open)

    if (todayLi && now.decimal >= RANGE_START && now.decimal <= RANGE_END) {
      const marker = document.createElement('b')
      marker.style.left = `${((now.decimal - RANGE_START) / (RANGE_END - RANGE_START)) * 100}%`
      qs('.hours__bar', todayLi).appendChild(marker)
    }

    status.classList.remove('is-open')
    if (hasHours && now.decimal >= open && now.decimal < close) {
      status.textContent = `Heute bis ${fmt(close)} · auf Voranmeldung`
      status.classList.add('is-open')
    } else if (hasHours && now.decimal < open) {
      status.textContent = `Heute ab ${fmt(open)} · auf Voranmeldung`
    } else {
      // find next open day
      for (let i = 1; i <= 7; i++) {
        const d = (now.day + i) % 7
        const li = days.find((x) => x.dataset.day.split(',').map(Number).includes(d) && x.dataset.open)
        if (li) {
          const label = i === 1 ? 'Morgen' : DAY_NAMES[d]
          status.textContent = `${label} wieder ab ${fmt(parseFloat(li.dataset.open))}`
          break
        }
      }
    }
  }
  update()
  setInterval(update, 60 * 1000)
}

export function initClock() {
  const el = qs('[data-clock]')
  const year = qs('[data-year]')
  if (year) year.textContent = new Date().getFullYear()
  const years = qs('[data-years]')
  if (years) {
    const n = new Date().getFullYear() - 2004
    years.textContent = n
    years.dataset.countTo = n
  }
  if (!el) return
  const tick = () => {
    const now = zurichNow()
    el.textContent = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`
  }
  tick()
  setInterval(tick, 15 * 1000)
}

/** The big phone number ripples like a wave when hovered. */
export function initBigNumber({ reduced }) {
  const el = qs('[data-bignum]')
  if (!el) return
  const chars = splitChars(el, 'bignum__char')
  if (reduced) return
  const link = el.closest('a')
  link.addEventListener('pointerenter', () => {
    gsap.fromTo(
      chars,
      { y: 0 },
      {
        keyframes: { y: [0, -14, 0] },
        duration: 0.9,
        stagger: 0.035,
        ease: 'sine.inOut',
        overwrite: true,
      },
    )
  })
}
