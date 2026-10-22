import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

let lenis = null
const EASE = (t) => 1 - Math.pow(1 - t, 4)

export function initScroll({ smooth = true } = {}) {
  ScrollTrigger.config({ ignoreMobileResize: true })
  if (smooth) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true })
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
  }
  return lenis
}

export const getLenis = () => lenis

export function scrollTo(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (lenis) {
    lenis.scrollTo(el ?? 0, { duration: 1.5, easing: EASE, ...opts })
    return
  }
  const top =
    typeof el === 'number' ? el : el ? el.getBoundingClientRect().top + window.scrollY + (opts.offset || 0) : 0
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top, behavior: opts.immediate || reduced ? 'auto' : 'smooth' })
}

// Several things can lock the page (loader, menu, booking sheet). Only when
// every one of them has let go does the page scroll again.
const locks = new Set()

export function stopScroll(reason = 'default') {
  locks.add(reason)
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
}

export function startScroll(reason = 'default') {
  locks.delete(reason)
  if (locks.size) return
  lenis?.start()
  document.documentElement.style.overflow = ''
}

export function releaseAllScrollLocks() {
  locks.clear()
  startScroll()
}

/** Smooth anchor links. */
export function initAnchors(onNavigate) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll-to]')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || !href.startsWith('#')) return
    const target = href === '#start' ? 0 : document.getElementById(decodeURIComponent(href.slice(1)))
    if (target == null) return
    e.preventDefault()
    onNavigate?.()
    scrollTo(target, { offset: href === '#start' ? 0 : -8 })
    history.replaceState(null, '', href === '#start' ? location.pathname : href)
    // move keyboard focus along with the scroll (back to the top: to the hero)
    const focusEl = target === 0 ? document.getElementById('start') : target
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1')
      focusEl.focus({ preventScroll: true })
    }
  })
}
