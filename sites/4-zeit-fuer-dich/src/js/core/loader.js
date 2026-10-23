import gsap from 'gsap'
import { qs, fontsReady } from '../utils/helpers.js'
import horizon from '../../data/horizon.json'

/** The real skyline as one line: the highest point of every distance band, azimuth 255° … 45°. */
export function skylinePath(width = 1000, height = 300, from = 255, to = 405) {
  const { az0, step, bands } = horizon
  const pts = []
  for (let az = from; az <= to; az += 0.5) {
    const i = Math.round((az - az0) / step)
    let el = -1
    for (let b = 1; b < bands.length; b++) el = Math.max(el, (bands[b].el[i] ?? -100) / 100)
    const x = ((az - from) / (to - from)) * width
    const y = height - (height * 0.12 + Math.max(el, -0.3) * (height * 0.075))
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `M0 ${height} L${pts.join(' L')} L${width} ${height} Z`
}

/** One breath before the page: the Jura is drawn while you breathe in, the sun rises while you breathe out. */
export function runLoader({ reduced, revisit }) {
  const el = qs('[data-loader]')
  if (!el) return Promise.resolve()
  const ridge = qs('[data-loader-ridge] path', el)
  const sun = qs('[data-loader-sun]', el)
  const word = qs('[data-loader-word]', el)
  ridge.setAttribute('d', skylinePath())

  // fonts and the load event, but never longer than a few seconds
  const ready = Promise.race([
    Promise.all([
      fontsReady(),
      new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
    ]),
    new Promise((r) => setTimeout(r, 5000)),
  ])

  // (a second visit in the same session: no ceremony)
  if (reduced || revisit) {
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

  const len = ridge.getTotalLength?.() || 3000
  ridge.style.strokeDasharray = `${len} ${len}`
  ridge.style.strokeDashoffset = len

  return new Promise((resolve) => {
    const inhale = 1.3
    const tl = gsap.timeline()
    // breathe in: the skyline is drawn, the word fills and sharpens
    tl.to(ridge, { strokeDashoffset: 0, duration: inhale, ease: 'power2.inOut' }, 0)
    tl.fromTo(word, { opacity: 0, fontWeight: 300, fontVariationSettings: "'SOFT' 100", letterSpacing: '-0.04em' }, { opacity: 1, fontWeight: 760, fontVariationSettings: "'SOFT' 0", letterSpacing: '0.01em', duration: inhale, ease: 'sine.inOut' }, 0)
    // dawn: a second sky fades in (tweening one gradient into another flickers through transparent)
    const dawn = document.createElement('div')
    dawn.className = 'loader__dawn'
    el.prepend(dawn)
    tl.to(dawn, { opacity: 1, duration: inhale, ease: 'none' }, 0)
    tl.add(() => {
      tl.pause()
      ready.then(() => tl.resume())
    })
    // breathe out: the sun rises, the word lets go
    tl.add(() => {
      word.textContent = 'und aus.'
    })
    tl.to(word, { fontWeight: 280, fontVariationSettings: "'SOFT' 100", letterSpacing: '-0.035em', duration: 1.1, ease: 'sine.inOut' })
    tl.to(sun, { opacity: 1, yPercent: -40, scale: 1, duration: 1.1, ease: 'power2.out' }, '<')
    tl.add(() => {
      el.classList.add('is-done')
      resolve()
    }, '-=0.35')
    tl.to([word, qs('.loader__line', el)], { opacity: 0, y: -12, duration: 0.4, ease: 'power2.in' }, '-=0.2')
    tl.to(el, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut', onComplete: () => el.remove() }, '-=0.15')
  })
}
