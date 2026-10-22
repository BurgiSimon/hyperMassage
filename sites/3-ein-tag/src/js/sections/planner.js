import { qs, qsa, clamp, HOURS, DAY_NAMES, fmtTime } from '../utils/helpers.js'

const START = 7 * 60
const END = 19 * 60
const SPAN = END - START
const PRICES = { 30: 45, 45: 65, 60: 85 }

/**
 * Pick a weekday and a duration, then slide your time into the day.
 * While you slide, the sky behind the page shows that hour.
 */
export function initPlanner({ day }) {
  const root = qs('[data-planner]')
  if (!root) return
  const track = qs('[data-p-day]', root)
  const hours = qs('[data-p-hours]', root)
  const openEl = qs('[data-p-open]', root)
  const slot = qs('[data-p-slot]', root)
  const slotTime = qs('[data-p-slot-time]', root)
  const summary = qs('[data-p-summary]', root)
  const hot = qs('[data-p-hot]', root)
  const cta = qs('[data-from-planner]', root)
  const live = qs('[data-p-live]', root)
  let liveT = null
  const announce = () => {
    clearTimeout(liveT)
    liveT = setTimeout(() => (live.textContent = summary.textContent), 500)
  }

  for (let h = 7; h <= 19; h += 2) {
    const s = document.createElement('span')
    s.style.setProperty('--at', ((h * 60 - START) / SPAN).toFixed(4))
    s.textContent = `${h}`
    hours.appendChild(s)
  }

  const state = { day: 1, dur: 60, start: 10 * 60 }
  const range = () => {
    const [o, c] = HOURS[state.day]
    return [o * 60, c * 60 - state.dur]
  }

  const render = () => {
    const [o, c] = HOURS[state.day]
    openEl.style.setProperty('--o', ((o * 60 - START) / SPAN).toFixed(4))
    openEl.style.setProperty('--c', ((c * 60 - START) / SPAN).toFixed(4))
    const [lo, hi] = range()
    state.start = clamp(state.start, lo, hi)
    slot.style.setProperty('--s', ((state.start - START) / SPAN).toFixed(4))
    slot.style.setProperty('--w', (state.dur / SPAN).toFixed(4))
    const from = fmtTime(state.start / 60)
    const to = fmtTime((state.start + state.dur) / 60)
    slotTime.textContent = from
    const isHot = hot.checked
    const price = PRICES[state.dur] + (isHot ? 15 : 0)
    const text = `${DAY_NAMES[state.day]}, ${from} – ${to} · ${state.dur} Minuten${isHot ? ' Hot Stone' : ''} · CHF ${price}`
    summary.textContent = text
    slot.setAttribute('aria-valuemin', lo)
    slot.setAttribute('aria-valuemax', hi)
    slot.setAttribute('aria-valuenow', state.start)
    slot.setAttribute('aria-valuetext', `${DAY_NAMES[state.day]} ${from} bis ${to}`)
    cta.dataset.when = `${DAY_NAMES[state.day]}, ${from} – ${to} Uhr`
    cta.dataset.dur = state.dur
    cta.dataset.service = isHot ? 'Hot-Stone-Massage' : 'Klassische Massage'
  }

  qsa('input[name="p-day"]', root).forEach((r) => r.addEventListener('change', () => r.checked && ((state.day = Number(r.value)), render(), announce())))
  qsa('input[name="p-dur"]', root).forEach((r) => r.addEventListener('change', () => r.checked && ((state.dur = Number(r.value)), render(), announce())))
  hot.addEventListener('change', () => (render(), announce()))

  // drag the slot; the sky follows
  let drag = null
  let releaseT = null
  const preview = (minutes) => {
    clearTimeout(releaseT)
    day?.preview(minutes / 60)
  }
  const endPreview = () => {
    clearTimeout(releaseT)
    releaseT = setTimeout(() => day?.preview(null), 1400)
  }
  const fromPointer = (e) => {
    const r = track.getBoundingClientRect()
    const m = START + ((e.clientX - r.left) / r.width) * SPAN - drag.grab
    const [lo, hi] = range()
    state.start = clamp(Math.round(m / 15) * 15, lo, hi)
    render()
    preview(state.start + state.dur / 2)
  }
  slot.addEventListener('pointerdown', (e) => {
    const r = slot.getBoundingClientRect()
    const tr = track.getBoundingClientRect()
    drag = { grab: ((e.clientX - r.left) / tr.width) * SPAN }
    slot.setPointerCapture(e.pointerId)
    slot.classList.add('is-drag')
  })
  track.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-p-slot]')) return
    drag = { grab: state.dur / 2 }
    fromPointer(e)
    drag = null
    endPreview()
  })
  slot.addEventListener('pointermove', (e) => drag && fromPointer(e))
  const end = () => {
    if (!drag) return
    drag = null
    slot.classList.remove('is-drag')
    endPreview()
    announce()
  }
  slot.addEventListener('pointerup', end)
  slot.addEventListener('pointercancel', end)
  slot.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -15, ArrowDown: -15, ArrowRight: 15, ArrowUp: 15, PageDown: -60, PageUp: 60 }[e.key]
    const [lo, hi] = range()
    if (step) state.start = clamp(state.start + step, lo, hi)
    else if (e.key === 'Home') state.start = lo
    else if (e.key === 'End') state.start = hi
    else return
    e.preventDefault()
    render()
    preview(state.start + state.dur / 2)
    endPreview()
    announce()
  })
  slot.addEventListener('blur', () => day?.preview(null))
  slot.setAttribute('data-cursor', 'Verschieben')
  render()
}
