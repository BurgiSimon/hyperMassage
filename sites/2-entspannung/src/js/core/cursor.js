import gsap from 'gsap'
import { qs, canHover } from '../utils/helpers.js'

const HOVER_SEL = 'a, button, label, select, summary, [data-cursor], [data-press]'

let api = null

/** A small pressure dot that grows into a label over interactive things. */
export function initCursor() {
  const el = qs('[data-cursor-el]')
  if (!el || !canHover()) return null
  document.documentElement.classList.add('has-cursor')
  const label = qs('[data-cursor-label]', el)
  const x = gsap.quickTo(el, 'x', { duration: 0.18, ease: 'power3.out' })
  const y = gsap.quickTo(el, 'y', { duration: 0.18, ease: 'power3.out' })
  el.classList.add('is-hidden')
  let forced = null

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
      if (e.pointerType !== 'mouse') return
      el.classList.remove('is-hidden')
      x(e.clientX)
      y(e.clientY)
    },
    { passive: true },
  )
  document.documentElement.addEventListener('pointerleave', () => el.classList.add('is-hidden'))
  document.addEventListener('pointerdown', () => el.classList.add('is-down'))
  document.addEventListener('pointerup', () => el.classList.remove('is-down'))
  document.addEventListener('pointerover', (e) => {
    if (forced !== null) return
    const target = e.target.closest?.(HOVER_SEL)
    el.classList.toggle('is-hover', !!target)
    setLabel(target?.getAttribute('data-cursor') || null)
  })

  api = {
    label(text) {
      forced = text
      el.classList.toggle('is-hover', !!text)
      setLabel(text)
      if (!text) forced = null
    },
  }
  return api
}

export const cursor = () => api
