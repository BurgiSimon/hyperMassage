import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, whenNear } from '../utils/helpers.js'

/** The street map of Kestenholz (OpenStreetMap data), drawn in as you arrive. */
export function initMap({ reduced }) {
  const host = qs('[data-map-host]')
  if (!host) return
  whenNear(host, async () => {
    const { default: svg } = await import('../../images/map-kestenholz.svg?raw')
    host.innerHTML = svg
    const map = qs('svg', host)
    map.setAttribute('viewBox', '-900 -560 1800 1120')
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
        gsap.to(paths, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', stagger: { amount: 1.2, from: 'center' } })
        gsap.from(qsa('.m-build, .m-forest, .m-street', map), { opacity: 0, duration: 1.6, delay: 0.8 })
        gsap.from(qs('.m-pin', map), { scale: 0, transformOrigin: 'center', duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 1.4 })
      },
    })
    ScrollTrigger.refresh()
  })
}
