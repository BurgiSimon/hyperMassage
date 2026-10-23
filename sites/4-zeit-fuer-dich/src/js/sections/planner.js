import { qs, qsa, clamp, HOURS, DAY_NAMES, MONTHS, fmtTime, nextWeekday, addDays, zurichNow, onVisibility } from '../utils/helpers.js'
import { paintStill } from '../gl/scene.js'
import { zurichDay } from '../gl/sun.js'

const START = 7 * 60
const END = 19 * 60
const SPAN = END - START
const PRICES = { 30: 45, 45: 65, 60: 85 }

/**
 * Pick a weekday and a duration, then slide your time into the day.
 * An arched window shows the sky over Kestenholz on that very date and hour
 * (after site 3, «Ein Tag»).
 */
export function initPlanner({ webgl }) {
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
  const sky = qs('[data-p-sky]', root)
  const caption = qs('[data-p-caption]', root)
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
  // (a browser may restore the form after going back: start from what is checked)
  const fromForm = () => {
    state.day = Number(qs('input[name="p-day"]:checked', root)?.value || 1)
    state.dur = Number(qs('input[name="p-dur"]:checked', root)?.value || 60)
  }
  fromForm()
  /** the next date on the chosen weekday – next week if today's slot has already begun */
  const upcoming = () => {
    const today = zurichDay()
    const date = nextWeekday(state.day, today)
    const now = zurichNow()
    const isToday = date.y === today.y && date.m === today.m && date.d === today.d
    return isToday && state.start <= now.hour * 60 + now.minute ? addDays(date, 7) : date
  }
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
    // (a separator stays with the word before it: never at the start of a line)
    const text = `${DAY_NAMES[state.day]}, ${from}\u00a0–\u00a0${to}\u00a0· ${state.dur}\u00a0Minuten${isHot ? '\u00a0Hot\u00a0Stone' : ''}\u00a0· CHF\u00a0${price}`
    summary.textContent = text
    slot.setAttribute('aria-valuemin', lo)
    slot.setAttribute('aria-valuemax', hi)
    slot.setAttribute('aria-valuenow', state.start)
    slot.setAttribute('aria-valuetext', `${DAY_NAMES[state.day]} ${from} bis ${to}`)
    const date = upcoming()
    cta.dataset.when = `${DAY_NAMES[state.day]}, ${from} – ${to} Uhr (z. B. am ${date.d}. ${MONTHS[date.m - 1]})`
    cta.dataset.dur = state.dur
    // only Hot Stone changes the treatment; otherwise the visitor's choice stays
    if (isHot) {
      cta.dataset.service = 'Hot-Stone-Massage'
      delete cta.dataset.notHot
    } else {
      delete cta.dataset.service
      cta.dataset.notHot = ''
    }
  }

  qsa('input[name="p-day"]', root).forEach((r) => r.addEventListener('change', () => r.checked && ((state.day = Number(r.value)), render(), preview(), announce())))
  qsa('input[name="p-dur"]', root).forEach((r) => r.addEventListener('change', () => r.checked && ((state.dur = Number(r.value)), render(), preview(), announce())))
  hot.addEventListener('change', () => (render(), announce()))

  // ───── the window: that date's sky at the middle of the appointment ─────
  let visible = false
  let painted = ''
  let queued = false
  let lastPaint = 0
  const paintSky = () => {
    queued = false
    if (!visible || !sky) return
    const date = upcoming()
    const mid = (state.start + state.dur / 2) / 60
    const key = `${date.y}-${date.m}-${date.d}-${mid}`
    caption.innerHTML = `Der Himmel über Kestenholz<br />${DAY_NAMES[state.day]}, ${date.d}.&nbsp;${MONTHS[date.m - 1]}, ${fmtTime(state.start / 60)}&nbsp;–&nbsp;${fmtTime((state.start + state.dur) / 60)}&nbsp;Uhr`
    if (key === painted) return
    const r = sky.getBoundingClientRect()
    if (!r.width) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.round(r.width * dpr)
    const h = Math.round(r.height * dpr)
    if (sky.width !== w || sky.height !== h) {
      sky.width = w
      sky.height = h
    }
    // (a tall window looks a little to the west of the Roggenflue, where the afternoon sun sets)
    if (webgl && paintStill(sky, mid, { day: date, azC: 318, fov: Math.min(64, Math.max(40, (w / h) * 52)) })) painted = key
    lastPaint = performance.now()
  }
  // (a software renderer is slow: at most a few pictures a second while dragging)
  const preview = () => {
    if (queued) return
    queued = true
    const wait = Math.max(0, 90 - (performance.now() - lastPaint))
    setTimeout(() => requestAnimationFrame(paintSky), wait)
  }
  const endPreview = () => preview()
  onVisibility(sky, (v) => {
    visible = v
    if (v) preview()
  })
  window.addEventListener('resize', () => {
    painted = ''
    preview()
  })

  // drag the slot; the window follows
  let drag = null
  const fromPointer = (e) => {
    if (!drag.on) return
    const r = track.getBoundingClientRect()
    const m = START + ((e.clientX - r.left) / r.width) * SPAN - drag.grab
    const [lo, hi] = range()
    state.start = clamp(Math.round(m / 15) * 15, lo, hi)
    render()
    preview()
  }
  // a mouse moves the slot at once; a finger only after a sideways move (a vertical swipe scrolls the page)
  slot.addEventListener('pointerdown', (e) => {
    // (measured from the slot's real start – a short slot is drawn wider and may be shifted left)
    const tr = track.getBoundingClientRect()
    drag = { grab: START + ((e.clientX - tr.left) / tr.width) * SPAN - state.start, x: e.clientX, y: e.clientY, on: e.pointerType === 'mouse' }
    slot.setPointerCapture(e.pointerId)
    if (drag.on) slot.classList.add('is-drag')
  })
  // the track: a click or a tap (no swipe) puts the slot there
  let tap = null
  track.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-p-slot]')) return
    tap = { x: e.clientX, y: e.clientY }
  })
  track.addEventListener('pointerup', (e) => {
    if (!tap || e.target.closest('[data-p-slot]')) return
    const still = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8
    tap = null
    if (!still) return
    drag = { grab: state.dur / 2, on: true }
    fromPointer(e)
    drag = null
    endPreview()
    announce()
  })
  track.addEventListener('pointercancel', () => (tap = null))
  slot.addEventListener('pointermove', (e) => {
    if (!drag) return
    if (!drag.on) {
      const dx = Math.abs(e.clientX - drag.x)
      if (dx < 6 || dx < Math.abs(e.clientY - drag.y)) return
      drag.on = true
      slot.classList.add('is-drag')
    }
    fromPointer(e)
  })
  const end = () => {
    if (!drag) return
    const moved = drag.on
    drag = null
    slot.classList.remove('is-drag')
    if (!moved) return
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
    preview()
    announce()
  })
  slot.setAttribute('data-cursor', 'Verschieben')
  render()
  window.addEventListener('pageshow', () => {
    fromForm()
    render()
    preview()
  })
}
