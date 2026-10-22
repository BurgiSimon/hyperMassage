import gsap from 'gsap'
import { qs, qsa, setRollText } from '../utils/helpers.js'

const PRICES = { 30: 45, 45: 65, 60: 85 }
const HOTSTONE = 15
const R = 150
const C = 2 * Math.PI * R
const NS = 'http://www.w3.org/2000/svg'

/** Clock-face price dial: the arc is the length of your treatment. */
export function initPrices({ emit }) {
  const dial = qs('[data-dial]')
  if (!dial) return
  const ticks = qs('[data-dial-ticks]', dial)
  const arc = qs('[data-dial-arc]', dial)
  const knob = qs('[data-dial-knob]', dial)
  const priceEl = qs('[data-dial-price]', dial)
  const durEl = qs('[data-dial-dur]', dial)
  const radios = qsa('input[name="duration"]')
  const hot = qs('[data-hotstone]')
  const cta = qs('[data-booking-from-price]')
  const ctaLabel = qs('[data-price-cta]')

  // build the clock face
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2
    const major = i % 5 === 0
    const r1 = major ? 164 : 167
    const r2 = major ? 176 : 173
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('x1', 200 + Math.cos(a) * r1)
    line.setAttribute('y1', 200 + Math.sin(a) * r1)
    line.setAttribute('x2', 200 + Math.cos(a) * r2)
    line.setAttribute('y2', 200 + Math.sin(a) * r2)
    if (major) line.classList.add('is-major')
    ticks.appendChild(line)
    if (i % 15 === 0) {
      const text = document.createElementNS(NS, 'text')
      text.setAttribute('x', 200 + Math.cos(a) * 192)
      text.setAttribute('y', 200 + Math.sin(a) * 192)
      text.textContent = i === 0 ? '60' : String(i)
      ticks.appendChild(text)
    }
  }

  const state = { minutes: 60, price: 85, shown: 85 }

  const render = (animate = true) => {
    const minutes = state.minutes
    const price = PRICES[minutes] + (hot?.checked ? HOTSTONE : 0)
    const angle = (minutes / 60) * Math.PI * 2 - Math.PI / 2
    const offset = C * (1 - minutes / 60)
    const d = animate ? 1.1 : 0
    gsap.to(arc, { strokeDashoffset: offset, duration: d, ease: 'expo.out' })
    const from = { a: state.angle ?? angle }
    gsap.to(from, {
      a: angle,
      duration: d,
      ease: 'expo.out',
      onUpdate: () => {
        knob.setAttribute('cx', 200 + Math.cos(from.a) * R)
        knob.setAttribute('cy', 200 + Math.sin(from.a) * R)
        state.angle = from.a
      },
    })
    gsap.to(state, {
      shown: price,
      duration: d,
      ease: 'expo.out',
      onUpdate: () => (priceEl.textContent = Math.round(state.shown)),
    })
    durEl.textContent = `${minutes} Minuten${hot?.checked ? ' · Hot Stone' : ''}`
    dial.classList.toggle('is-hot', !!hot?.checked)
    const text = hot?.checked ? `${minutes} Min. Hot Stone anfragen` : `${minutes} Minuten anfragen`
    setRollText(ctaLabel, text)
    if (cta) {
      cta.dataset.dur = minutes
      cta.dataset.service = hot?.checked ? 'Hot-Stone-Massage' : ''
    }
  }

  const select = (minutes, fromDial = false) => {
    if (minutes === state.minutes && !fromDial) return
    state.minutes = minutes
    radios.forEach((r) => (r.checked = Number(r.value) === minutes))
    render()
    emit?.('ui:tick')
  }

  radios.forEach((r) => r.addEventListener('change', () => r.checked && select(Number(r.value))))
  hot?.addEventListener('change', () => {
    render()
    emit?.('ui:tick')
  })

  // drag around the dial
  const svg = qs('.dial__svg', dial)
  let dragging = false
  const fromPointer = (e) => {
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - (rect.left + rect.width / 2)
    const y = e.clientY - (rect.top + rect.height / 2)
    let a = Math.atan2(y, x) + Math.PI / 2
    if (a < 0) a += Math.PI * 2
    let minutes = (a / (Math.PI * 2)) * 60
    if (minutes < 10) minutes = 60 // near 12 o'clock → full hour
    const options = [30, 45, 60]
    const nearest = options.reduce((best, m) => (Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best), 60)
    if (nearest !== state.minutes) select(nearest, true)
  }
  dial.addEventListener('pointerdown', (e) => {
    dragging = true
    dial.setPointerCapture(e.pointerId)
    fromPointer(e)
  })
  dial.addEventListener('pointermove', (e) => dragging && fromPointer(e))
  dial.addEventListener('pointerup', () => (dragging = false))
  dial.addEventListener('pointercancel', () => (dragging = false))
  dial.style.cursor = 'grab'
  dial.setAttribute('data-cursor', 'Drehen')

  state.angle = Math.PI * 1.5
  render(false)
}
