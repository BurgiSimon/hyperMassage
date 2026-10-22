import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, whenNear } from '../utils/helpers.js'

/** The village at night: streets drawn in light, the practice glowing. */
export function initMap({ reduced }) {
  const host = qs('[data-map-host]')
  if (!host) return
  whenNear(host, async () => {
    const { default: svg } = await import('../../images/map-kestenholz.svg?raw')
    host.innerHTML = svg
    const map = qs('svg', host)
    map.setAttribute('viewBox', '-900 -620 1800 1240')
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
