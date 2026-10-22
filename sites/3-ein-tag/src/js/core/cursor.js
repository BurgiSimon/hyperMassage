import gsap from 'gsap'
import { qs, canHover } from '../utils/helpers.js'

const HOVER_SEL = 'a, button, label, summary, select, [data-cursor], [role="slider"]'
let api = null

/** A small warm light that follows the pointer. */
export function initCursor() {
  const el = qs('[data-cursor-el]')
  if (!el || !canHover()) return null
  document.documentElement.classList.add('has-cursor')
  const label = qs('[data-cursor-label]', el)
  const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' })
  const y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' })
  el.classList.add('is-hidden')
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
    const t = e.target.closest?.(HOVER_SEL)
    el.classList.toggle('is-hover', !!t && !t.matches('.hero'))
    const text = t?.getAttribute('data-cursor')
    if (text) {
      label.textContent = text
      el.classList.add('has-label')
    } else el.classList.remove('has-label')
  })
  // buttons: the fill grows from where the pointer entered
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.('.btn')
    if (!b) return
    const r = b.getBoundingClientRect()
    b.style.setProperty('--bx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(0)}%`)
    b.style.setProperty('--by', `${(((e.clientY - r.top) / r.height) * 100).toFixed(0)}%`)
  })
  api = { el }
  return api
}

export const cursor = () => api
