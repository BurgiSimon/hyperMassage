import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qsa, prefersReducedMotion } from '../utils/helpers.js'

/** Native <details>, with a soft height animation on top. */
export function initFaq() {
  const reduced = prefersReducedMotion()
  let refreshT = null
  const refresh = () => {
    clearTimeout(refreshT)
    refreshT = setTimeout(() => ScrollTrigger.refresh(), 450)
  }
  qsa('[data-faq] details').forEach((d) => {
    const summary = d.querySelector('summary')
    const body = d.querySelector('.qa__a')
    let anim = null
    summary.addEventListener('click', (e) => {
      if (reduced || !body.animate) return refresh()
      e.preventDefault()
      anim?.cancel()
      if (!d.open) {
        d.open = true
        const h = body.offsetHeight
        anim = body.animate({ height: ['0px', `${h}px`], opacity: [0, 1] }, { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
      } else {
        const h = body.offsetHeight
        anim = body.animate({ height: [`${h}px`, '0px'], opacity: [1, 0] }, { duration: 380, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' })
        anim.onfinish = () => (d.open = false)
      }
      body.style.overflow = 'hidden'
      anim.addEventListener('finish', () => (body.style.overflow = ''))
      refresh()
    })
  })
}
