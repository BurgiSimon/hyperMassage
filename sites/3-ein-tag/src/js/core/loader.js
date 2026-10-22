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

/** Before sunrise: the skyline is drawn, the sun climbs behind the Jura, the day begins. */
export function runLoader({ reduced, revisit }) {
  const el = qs('[data-loader]')
  if (!el) return Promise.resolve()
  const ridge = qs('[data-loader-ridge] path', el)
  const sun = qs('[data-loader-sun]', el)
  const time = qs('[data-loader-time]', el)
  ridge.setAttribute('d', skylinePath())

  const ready = Promise.all([
    fontsReady(),
    new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
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

  const len = ridge.getTotalLength?.() || 3000
  ridge.style.strokeDasharray = `${len} ${len}`
  ridge.style.strokeDashoffset = len
  const clock = { m: 5 * 60 }
  const paint = () => (time.textContent = `${String(Math.floor(clock.m / 60)).padStart(2, '0')}:${String(Math.floor(clock.m % 60)).padStart(2, '0')}`)

  return new Promise((resolve) => {
    const min = revisit ? 0.8 : 2
    const tl = gsap.timeline()
    tl.to(ridge, { strokeDashoffset: 0, duration: min, ease: 'power2.inOut' }, 0)
    tl.to(clock, { m: 6 * 60 + 40, duration: min, ease: 'power1.inOut', onUpdate: paint }, 0)
    tl.to(el, { background: 'linear-gradient(#141c38, #3c3a5c 60%, #b7787a)', duration: min, ease: 'none' }, 0)
    tl.add(() => {
      tl.pause()
      ready.then(() => tl.resume())
    })
    tl.to(sun, { opacity: 1, yPercent: -40, scale: 1, duration: 1.1, ease: 'power2.out' })
    tl.to(clock, { m: 7 * 60 + 30, duration: 1.1, ease: 'power2.out', onUpdate: paint }, '<')
    tl.add(() => {
      el.classList.add('is-done')
      resolve()
    }, '-=0.3')
    tl.to(el, { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut', onComplete: () => el.remove() })
  })
}
