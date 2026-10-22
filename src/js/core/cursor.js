import gsap from 'gsap'
import { qs, qsa } from '../utils/helpers.js'

const HOVER_SEL = 'a, button, label, input, textarea, [data-cursor], [data-hover]'

export const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, nx: 0, ny: 0, moved: false }

export function trackPointer() {
  const needsPermission = typeof window.DeviceOrientationEvent?.requestPermission === 'function'
  if ('DeviceOrientationEvent' in window && !needsPermission && window.matchMedia('(hover: none)').matches) {
    window.addEventListener(
      'deviceorientation',
      (e) => {
        if (e.gamma == null || e.beta == null) return
        pointer.nx = Math.max(-1, Math.min(1, e.gamma / 30))
        pointer.ny = Math.max(-1, Math.min(1, (45 - e.beta) / 30))
        pointer.moved = true
      },
      { passive: true },
    )
  }
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.nx = (e.clientX / window.innerWidth) * 2 - 1
      pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1)
      pointer.moved = true
    },
    { passive: true },
  )
}

let api = null

export function initCursor() {
  const el = qs('[data-cursor-el]')
  if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null

  const ring = qs('.cursor__ring', el)
  const dot = qs('.cursor__dot', el)
  const label = qs('[data-cursor-label]', el)

  const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3.out' })
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3.out' })
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' })
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' })

  el.classList.add('is-hidden')

  let forcedLabel = null

  const setLabel = (text) => {
    if (text) {
      label.textContent = text
      el.classList.add('has-label')
    } else {
      el.classList.remove('has-label')
    }
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      el.classList.remove('is-hidden')
      ringX(e.clientX)
      ringY(e.clientY)
      dotX(e.clientX)
      dotY(e.clientY)
    },
    { passive: true },
  )
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'))
  document.addEventListener('pointerdown', () => el.classList.add('is-down'))
  document.addEventListener('pointerup', () => el.classList.remove('is-down'))

  document.addEventListener('pointerover', (e) => {
    if (forcedLabel) return
    const target = e.target.closest?.(HOVER_SEL)
    if (!target) {
      el.classList.remove('is-hover')
      setLabel(null)
      return
    }
    const text = target.getAttribute('data-cursor')
    el.classList.add('is-hover')
    setLabel(text)
  })

  api = {
    /** Force a label (e.g. while hovering a WebGL object). */
    label(text) {
      forcedLabel = text
      if (text) {
        el.classList.add('is-hover')
        setLabel(text)
      } else {
        el.classList.remove('is-hover')
        setLabel(null)
      }
    },
  }
  return api
}

export const cursor = () => api

/** Elements that gently follow the pointer. */
export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  qsa('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28)
      yTo((e.clientY - (r.top + r.height / 2)) * 0.36)
    })
    el.addEventListener('pointerleave', () => {
      xTo(0)
      yTo(0)
    })
  })
}
