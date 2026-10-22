import gsap from 'gsap'
import { qs, fontsReady } from '../utils/helpers.js'

/**
 * A slack string is pulled taut while the page loads («Spannung 0 → 100 %»),
 * then the curtain lifts onto the clenched hero word.
 */
export function runLoader({ reduced, revisit }) {
  const el = qs('[data-loader]')
  if (!el) return Promise.resolve()
  const path = qs('[data-loader-path]', el)
  const count = qs('[data-loader-count]', el)

  // fonts and the load event, but never longer than a few seconds – a hanging request must not lock the page
  const ready = Promise.race([
    Promise.all([
      fontsReady(),
      new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
    ]),
    new Promise((r) => setTimeout(r, 5000)),
  ])

  if (reduced) {
    return ready.then(
      () =>
        new Promise((resolve) => {
          gsap.to(el, {
            autoAlpha: 0,
            duration: 0.4,
            onComplete: () => {
              el.remove()
              resolve()
            },
          })
        }),
    )
  }

  const state = { p: 0, t: 0 }
  const draw = () => {
    state.t += gsap.ticker.deltaRatio() / 60
    const p = state.p
    const sag = (1 - p) ** 1.6 * 80
    const buzz = p > 0.75 ? Math.sin(state.t * 70) * ((p - 0.75) / 0.25) ** 2 * 7 : 0
    path.setAttribute('d', `M0 100 Q500 ${(100 + sag * 2 + buzz).toFixed(2)} 1000 100`)
    count.textContent = Math.round(p * 100)
  }
  gsap.ticker.add(draw)

  const min = revisit ? 0.7 : 1.7
  return new Promise((resolve) => {
    const tl = gsap.timeline()
    tl.to(state, { p: 0.86, duration: min, ease: 'power2.inOut' })
    tl.add(() => {
      tl.pause()
      ready.then(() => tl.resume())
    })
    tl.to(state, { p: 1, duration: 0.45, ease: 'power3.out' })
    tl.to({}, { duration: revisit ? 0.15 : 0.35 })
    tl.add(() => {
      el.classList.add('is-done')
      resolve()
    })
    tl.to(el, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: 1.1,
      ease: 'expo.inOut',
      onComplete: () => {
        gsap.ticker.remove(draw)
        el.remove()
      },
    })
  })
}
