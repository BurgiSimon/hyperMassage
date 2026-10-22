import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, whenNear } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger)

const NS = 'http://www.w3.org/2000/svg'

/** Custom-drawn street map of Kestenholz – no third-party embeds, no tracking. */
export function initMap({ reduced }) {
  const host = qs('[data-map]')
  if (!host) return
  whenNear(host, async () => {
    const { default: markup } = await import('../../images/map-kestenholz.svg?raw')
    host.innerHTML = markup
    const svg = qs('svg', host)
    const layer = qs('[data-map-layer]', svg)
    const pin = qs('.m-pin', svg)

    // label next to the pin
    const label = document.createElementNS(NS, 'g')
    label.setAttribute('class', 'm-pin-label')
    label.innerHTML =
      '<rect class="m-label-bg" x="22" y="-17" rx="16" width="232" height="34"/>' +
      '<text class="m-label" x="40" y="5">Massage Claudia Bürgi</text>'
    pin.appendChild(label)
    const text = qs('text', label)
    requestAnimationFrame(() => {
      try {
        const w = text.getComputedTextLength()
        qs('rect', label).setAttribute('width', String(Math.ceil(w + 36)))
      } catch (e) {
        /* not rendered yet */
      }
    })

    // frame the practice: right of centre on wide screens, upper third on tall ones
    const frame = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      const aspect = w / h
      const wide = aspect > 1
      const vbW = wide ? 1500 : 640
      const vbH = vbW / aspect
      const px = wide ? 0.64 : 0.36
      const py = wide ? 0.5 : 0.3
      svg.setAttribute('viewBox', `${-vbW * px} ${-vbH * py} ${vbW} ${vbH}`)
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      // on a phone the practice's name must stay readable (≈ 12 px)
      label.setAttribute('transform', wide ? '' : `scale(${Math.max(1, (12 / 13) * (vbW / w)).toFixed(2)})`)
    }
    frame()
    window.addEventListener('resize', frame)

    if (reduced) return

    const groups = [
      qsa('.m-road.r1, .m-road.r2', svg),
      qsa('.m-road.r3, .m-water', svg),
      qsa('.m-road.r4', svg),
    ]
    groups
      .flat()
      .filter((p) => p.hasAttribute('pathLength'))
      .forEach((p) => {
        p.style.strokeDasharray = '1 1'
        p.style.strokeDashoffset = '1'
      })
    gsap.set(qsa('.m-road.r4', svg), { autoAlpha: 0 })
    gsap.set(qs('.m-build', svg), { autoAlpha: 0 })
    gsap.set(qsa('.m-street', svg), { autoAlpha: 0 })
    gsap.set(pin, { scale: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' })
    gsap.set(label, { autoAlpha: 0, x: -10 })

    const section = host.closest('section')
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 10%', scrub: 1 },
      })
      .to(groups[0], { strokeDashoffset: 0, duration: 1, ease: 'none', stagger: 0.01 }, 0)
      .to(groups[1], { strokeDashoffset: 0, duration: 1, ease: 'none', stagger: 0.002 }, 0.25)
      .to(groups[2], { autoAlpha: 1, duration: 0.5, ease: 'none' }, 0.7)
      .to(qs('.m-build', svg), { autoAlpha: 1, duration: 0.6, ease: 'none' }, 0.55)
      .to(qsa('.m-street', svg), { autoAlpha: 1, duration: 0.3 }, 0.9)

    ScrollTrigger.create({
      trigger: section,
      start: 'top 35%',
      once: true,
      onEnter: () => {
        gsap.to(pin, { scale: 1, duration: 1.2, ease: 'expo.out' })
        gsap.to(label, { autoAlpha: 1, x: 0, duration: 1, ease: 'expo.out', delay: 0.3 })
      },
    })

    // slow drift + pointer parallax
    gsap.fromTo(
      layer,
      { scale: 1.08, transformOrigin: '50% 50%' },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    )
    if (window.matchMedia('(hover: hover)').matches) {
      const xTo = gsap.quickTo(layer, 'x', { duration: 1.6, ease: 'power3.out' })
      const yTo = gsap.quickTo(layer, 'y', { duration: 1.6, ease: 'power3.out' })
      section.addEventListener('pointermove', (e) => {
        xTo(((e.clientX / window.innerWidth) * 2 - 1) * -18)
        yTo(((e.clientY / window.innerHeight) * 2 - 1) * -12)
      })
    }
  })
}
