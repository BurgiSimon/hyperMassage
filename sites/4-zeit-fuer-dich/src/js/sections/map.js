import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, whenNear } from '../utils/helpers.js'

/** The village around the practice, drawn from OpenStreetMap data; the practice is the pin in the middle. */
export function initMap({ reduced }) {
  const host = qs('[data-map-host]')
  if (!host) return
  whenNear(host, async () => {
    const { default: svg } = await import('../../images/map-kestenholz.svg?raw')
    host.innerHTML = svg
    const map = qs('svg', host)
    // (closer in on a narrow map, so the streets around the practice stay readable; the practice stays in the middle)
    const frame = () => map.setAttribute('viewBox', host.clientWidth < 600 ? '-560 -470 1120 940' : '-900 -620 1800 1240')
    frame()
    new ResizeObserver(frame).observe(host)
    new IntersectionObserver((e) => host.parentElement.classList.toggle('is-on', e[0].isIntersecting)).observe(host)
    if (reduced) return
    const paths = qsa('.m-draw', map)
    paths.forEach((p) => {
      const len = p.getTotalLength?.() || 600
      p.style.strokeDasharray = `${len} ${len}`
      p.style.strokeDashoffset = len
    })
    ScrollTrigger.create({
      trigger: host,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.to(paths, { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', stagger: { amount: 1.4, from: 'center' } })
        gsap.from(qsa('.m-build, .m-forest, .m-street', map), { opacity: 0, duration: 1.8, delay: 0.9 })
        gsap.from(qs('.m-pin', map), { scale: 0, transformOrigin: 'center', duration: 1.2, ease: 'back.out(2)', delay: 1.6 })
      },
    })
    ScrollTrigger.refresh()
  })
}
