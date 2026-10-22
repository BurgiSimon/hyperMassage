import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

let lenis = null

export function initScroll({ smooth = true } = {}) {
  if (smooth) {
    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      smoothWheel: true,
    })
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
    lenis.scrollTo(el ?? 0, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts })
  } else if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

export function stopScroll() {
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
}

export function startScroll() {
  lenis?.start()
  document.documentElement.style.overflow = ''
}

/** Smooth anchor links. */
export function initAnchors(onNavigate) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll-to]')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || !href.startsWith('#')) return
    e.preventDefault()
    onNavigate?.()
    const target = href === '#start' ? 0 : document.querySelector(href)
    scrollTo(target === 0 ? 0 : target, { offset: href === '#start' ? 0 : -10 })
    history.replaceState(null, '', href === '#start' ? location.pathname : href)
  })
}
