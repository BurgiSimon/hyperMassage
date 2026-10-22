import gsap from 'gsap'
import { qs, qsa, clamp } from '../utils/helpers.js'

const PRICES = { 30: 45, 45: 65, 60: 85 }
const HOTSTONE = 15
const STOPS = [30, 45, 60]
const nearestStop = (v) => STOPS.reduce((b, m) => (Math.abs(m / 60 - v) < Math.abs(b / 60 - v) ? m : b), 60)

/** Time is the only variable: stretch the bar, and the word «Minuten» stretches with it. */
export function initPrices({ reduced }) {
  const root = qs('[data-prices]')
  if (!root) return
  const track = qs('[data-stretch-track]', root)
  const handleBox = qs('[data-stretch]', root)
  const minEl = qs('[data-stretch-min]', root)
  const word = qs('[data-stretch-word]', root)
  const priceEl = qs('[data-price]', root)
  const hot = qs('[data-hotstone]', root)
  const cta = qs('[data-booking-from-price]', root)
  const ctaLabel = qs('[data-price-cta]', root)
  const radios = qsa('input[name="dur"]', root)
  const live = qs('[data-price-live]', root)

  const state = { v: 1, minutes: 60, shown: 85 }

  const paint = (v) => {
    state.v = v
    track.style.setProperty('--v', v.toFixed(4))
    // 30 min → clenched, 60 min → wide open
    const r = clamp((v - 0.5) / 0.5)
    word.style.fontStretch = `${(56 + r * 94).toFixed(1)}%`
    word.style.fontWeight = (760 - r * 540).toFixed(0)
    // the word stretches continuously; the number shows the duration you will get
    minEl.textContent = nearestStop(v)
  }

  const commit = (minutes, animate = true) => {
    state.minutes = minutes
    radios.forEach((r) => (r.checked = Number(r.value) === minutes))
    const price = PRICES[minutes] + (hot?.checked ? HOTSTONE : 0)
    gsap.to(state, {
      shown: price,
      duration: animate && !reduced ? 0.9 : 0,
      ease: 'expo.out',
      onUpdate: () => (priceEl.textContent = Math.round(state.shown)),
    })
    const proxy = { v: state.v }
    gsap.to(proxy, {
      v: minutes / 60,
      duration: animate && !reduced ? 1.1 : 0,
      ease: 'elastic.out(1, 0.55)',
      onUpdate: () => paint(proxy.v),
    })
    const hs = hot?.checked
    ctaLabel.textContent = hs ? `${minutes} Min. Hot Stone anfragen` : `${minutes} Minuten anfragen`
    cta.dataset.dur = minutes
    // one tariff for every treatment: only Hot Stone changes the request
    if (hs) cta.dataset.service = 'Hot-Stone-Massage'
    else delete cta.dataset.service
    if (live && animate) live.textContent = `${minutes} Minuten${hs ? ' Hot Stone' : ''}: CHF ${price}`
  }

  radios.forEach((r) => r.addEventListener('change', () => r.checked && commit(Number(r.value))))
  hot?.addEventListener('change', () => commit(state.minutes))

  // drag the bar (a vertical swipe still scrolls the page and changes nothing)
  let drag = null
  const fromPointer = (e) => {
    const rect = track.getBoundingClientRect()
    const v = clamp((e.clientX - rect.left) / rect.width, 0.5, 1)
    gsap.killTweensOf(state)
    paint(v)
    const nearest = nearestStop(v)
    priceEl.textContent = PRICES[nearest] + (hot?.checked ? HOTSTONE : 0)
    // segments and request follow while dragging, so the panel never contradicts itself
    radios.forEach((r) => (r.checked = Number(r.value) === nearest))
    ctaLabel.textContent = hot?.checked ? `${nearest} Min. Hot Stone anfragen` : `${nearest} Minuten anfragen`
    return nearest
  }
  track.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: e.pointerType === 'mouse' }
    track.setPointerCapture(e.pointerId)
    track.classList.add('is-drag')
    if (drag.moved) fromPointer(e)
  })
  track.addEventListener('pointermove', (e) => {
    if (!drag) return
    if (!drag.moved && Math.abs(e.clientX - drag.x) > 6) drag.moved = true
    if (drag.moved) fromPointer(e)
  })
  track.addEventListener('pointerup', (e) => {
    if (!drag) return
    drag = null
    track.classList.remove('is-drag')
    commit(fromPointer(e))
  })
  track.addEventListener('pointercancel', () => {
    if (!drag) return
    drag = null
    track.classList.remove('is-drag')
    commit(state.minutes)
  })
  track.setAttribute('data-cursor', 'Ziehen')
  handleBox.classList.add('is-ready')

  commit(60, false)
}
