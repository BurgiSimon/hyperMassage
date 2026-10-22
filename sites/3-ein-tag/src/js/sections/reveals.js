import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger)

/** Hero lines rise like the sun; hours and cards drift in. */
export function prepareHero({ reduced }) {
  if (reduced) return { play() {} }
  const lines = qsa('[data-hero-line]')
  const fades = qsa('[data-hero-fade], .hero__greet')
  gsap.set(lines, { yPercent: 110 })
  gsap.set(fades, { opacity: 0, y: 18 })
  return {
    play() {
      gsap.to(lines, { yPercent: 0, duration: 1.6, ease: 'expo.out', stagger: 0.14 })
      gsap.to(fades, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.5, clearProps: 'transform' })
    },
  }
}

export function initReveals({ reduced }) {
  if (reduced) return
  // interludes: the hour fades in as it arrives
  qsa('.interlude').forEach((el) => {
    const time = qs('.interlude__time', el)
    const text = qs('.interlude__text', el)
    gsap
      .timeline({ scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 25%', toggleActions: 'play reverse play reverse' } })
      .fromTo(time, { opacity: 0, y: 60, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out' })
      .fromTo(text, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 0.2)
  })
  // cards rise into place
  qsa('.page__card').forEach((card) => {
    gsap.fromTo(card, { y: 80, opacity: 0.4 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 55%', scrub: 0.6 } })
  })
  const els = qsa('.page__kicker, .page__title, .page__lead, .quote, .about > *, .facts > div, .treat, .tariff li, .planner, .gift > *, .faq details, .phone, .contact li, .hours__days li, .visit > *, .footer__cols > div')
  gsap.set(els, { opacity: 0, y: 28 })
  ScrollTrigger.batch(els, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, overwrite: true, clearProps: 'transform' }),
  })
  // good night
  const night = qs('.footer__night')
  if (night) gsap.fromTo(night, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: night, start: 'top 85%' } })
}
